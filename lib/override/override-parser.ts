// Tagged-stream parser for Phase 2B Fellow Override. Pure syntactic
// extractor — no semantic validation (whitelist / intervention-id checks
// belong one layer up in override-chain.ts). Never throws; protocol
// violations degrade silently via ERROR_RECOVERY.
//
// Structural sibling of `lib/llm/stream-parser.ts`: state-machine skeleton
// (OUTSIDE / IN_OPEN_TAG / IN_CONTENT / IN_CLOSE_TAG / ERROR_RECOVERY),
// chunk-boundary buffering rules, and partial-emission coalescing are
// copied from plan §4.1. Grammar differs — see phase-2b-plan.md §4.
//
// Pointer: `lib/llm/stream-parser.ts` is the Recall grammar. Any bug-fix
// to the shared state-machine behaviour MUST be mirrored between the two
// files (plan §7.5 risk callout).

export type OverrideTagName =
  | 'rationale'
  | 'hypothesis_start'
  | 'kind'
  | 'label'
  | 'statement'
  | 'confidence'
  | 'evidence_quote'
  | 'evidence_source'
  | 'intervention_id'
  | 'hypothesis_end'
  | 'done';

export type OverrideStreamEvent = {
  field: OverrideTagName;
  value: string | boolean;
  isComplete: boolean;
  // Stamped by the parser on every event. null before any <hypothesis_start>
  // and after <hypothesis_end/> / <done/>; the current slug in between.
  hypothesisId: string | null;
};

const KNOWN_TAGS: ReadonlySet<OverrideTagName> = new Set<OverrideTagName>([
  'rationale',
  'hypothesis_start',
  'kind',
  'label',
  'statement',
  'confidence',
  'evidence_quote',
  'evidence_source',
  'intervention_id',
  'hypothesis_end',
  'done',
]);

// Self-closing tags — carry value:true and have no content body.
const SELF_CLOSING_TAGS: ReadonlySet<OverrideTagName> = new Set<OverrideTagName>([
  'hypothesis_end',
  'done',
]);

type State =
  | 'OUTSIDE'
  | 'IN_OPEN_TAG'
  | 'IN_CONTENT'
  | 'IN_CLOSE_TAG'
  | 'ERROR_RECOVERY';

function isKnownTag(name: string): name is OverrideTagName {
  return KNOWN_TAGS.has(name as OverrideTagName);
}

export class OverrideStreamParser {
  private buffer = '';
  private state: State = 'OUTSIDE';
  private openTagName = '';
  private closeTagName = '';
  private content = '';
  private currentField: OverrideTagName | null = null;
  // Stamped onto every emitted event. `hypothesis_start` content, once
  // complete, commits here; `hypothesis_end` / `done` clear it.
  private currentHypothesisId: string | null = null;

  private resetToOutside(): void {
    this.currentField = null;
    this.content = '';
    this.openTagName = '';
    this.closeTagName = '';
    this.state = 'OUTSIDE';
  }

  private stamp(ev: Omit<OverrideStreamEvent, 'hypothesisId'>): OverrideStreamEvent {
    return { ...ev, hypothesisId: this.currentHypothesisId };
  }

  push(chunk: string): OverrideStreamEvent[] {
    this.buffer += chunk;
    const events: OverrideStreamEvent[] = [];
    let contentDirty = false;

    while (this.buffer.length > 0) {
      if (this.state === 'OUTSIDE') {
        const lt = this.buffer.indexOf('<');
        if (lt === -1) {
          this.buffer = '';
          break;
        }
        if (lt > 0) this.buffer = this.buffer.slice(lt);
        if (this.buffer.length < 2) break;
        if (this.buffer[1] === '/') {
          // Stray close tag with no matching open — consume the full span
          // (mirrors stream-parser.ts behaviour — avoids infinite loop
          // through ERROR_RECOVERY).
          const gt = this.buffer.indexOf('>', 2);
          if (gt === -1) return events;
          this.buffer = this.buffer.slice(gt + 1);
          continue;
        }
        this.buffer = this.buffer.slice(1);
        this.state = 'IN_OPEN_TAG';
        this.openTagName = '';
        continue;
      }

      if (this.state === 'IN_OPEN_TAG') {
        let advanced = false;
        while (this.buffer.length > 0) {
          const ch = this.buffer[0]!;
          if (ch === '<') {
            // Malformed open tag (e.g. "<foo<bar>"). Drop and resume at
            // OUTSIDE so the new '<' is re-parsed cleanly.
            this.resetToOutside();
            advanced = true;
            break;
          }
          if (ch === '/') {
            if (this.buffer.length < 2) return events;
            if (this.buffer[1] === '>') {
              const name = this.openTagName;
              this.buffer = this.buffer.slice(2);
              if (isKnownTag(name)) {
                // Scope-stamp rules (shared by the "/>" self-closing and
                // the "<tag>" fallback path at line ~168, keep in lockstep):
                //   done            → clear BEFORE stamping (event.null)
                //   hypothesis_end  → clear AFTER stamping (event carries id)
                //   anything else   → no scope change
                if (name === 'done') this.currentHypothesisId = null;
                events.push(this.stamp({ field: name, value: true, isComplete: true }));
                if (name === 'hypothesis_end') this.currentHypothesisId = null;
              }
              this.state = 'OUTSIDE';
              this.openTagName = '';
              advanced = true;
              break;
            }
            this.state = 'ERROR_RECOVERY';
            advanced = true;
            break;
          }
          if (ch === '>') {
            const name = this.openTagName;
            this.buffer = this.buffer.slice(1);
            if (!isKnownTag(name)) {
              this.state = 'ERROR_RECOVERY';
              this.openTagName = '';
              advanced = true;
              break;
            }
            if (SELF_CLOSING_TAGS.has(name)) {
              // `<hypothesis_end>` / `<done>` written without "/" are
              // accepted as self-closing for robustness. Same scope rules
              // as the self-closing path above.
              if (name === 'done') this.currentHypothesisId = null;
              events.push(this.stamp({ field: name, value: true, isComplete: true }));
              if (name === 'hypothesis_end') this.currentHypothesisId = null;
              this.state = 'OUTSIDE';
              this.openTagName = '';
              advanced = true;
              break;
            }
            this.currentField = name;
            this.content = '';
            this.state = 'IN_CONTENT';
            this.openTagName = '';
            advanced = true;
            break;
          }
          this.openTagName += ch;
          this.buffer = this.buffer.slice(1);
        }
        if (!advanced) return events;
        continue;
      }

      if (this.state === 'IN_CONTENT') {
        const lt = this.buffer.indexOf('<');
        if (lt === -1) {
          this.content += this.buffer;
          this.buffer = '';
          contentDirty = true;
          break;
        }
        if (lt > 0) {
          this.content += this.buffer.slice(0, lt);
          this.buffer = this.buffer.slice(lt);
          contentDirty = true;
        }
        if (this.buffer.length < 2) return events;
        if (this.buffer[1] !== '/') {
          // Lenient recovery: a raw '<' mid-content hands control back to
          // OUTSIDE so the new tag (e.g. `<done/>`) can still parse. See
          // stream-parser.ts comment at the IN_CONTENT nesting branch.
          // Note: any partial text already emitted before the malformed
          // '<' remains visible to the UI for one frame — this brief
          // flicker is INTENTIONAL per plan §4.4 (keeping the `<done/>`
          // escape hatch alive is worth the flicker). Do not "fix" this.
          contentDirty = false;
          this.resetToOutside();
          continue;
        }
        this.buffer = this.buffer.slice(2);
        this.state = 'IN_CLOSE_TAG';
        this.closeTagName = '';
        continue;
      }

      if (this.state === 'IN_CLOSE_TAG') {
        const gt = this.buffer.indexOf('>');
        if (gt === -1) {
          this.closeTagName += this.buffer;
          this.buffer = '';
          return events;
        }
        this.closeTagName += this.buffer.slice(0, gt);
        this.buffer = this.buffer.slice(gt + 1);
        const name = this.closeTagName;
        const field = this.currentField;
        if (field && isKnownTag(name) && name === field) {
          // For `hypothesis_start`, commit the content as the current
          // hypothesis id BEFORE stamping the event — this ensures the
          // final complete event itself carries the new scope.
          if (field === 'hypothesis_start') {
            this.currentHypothesisId = this.content;
          }
          events.push(this.stamp({ field, value: this.content, isComplete: true }));
        }
        this.currentField = null;
        this.content = '';
        this.closeTagName = '';
        this.state = 'OUTSIDE';
        contentDirty = false;
        continue;
      }

      if (this.state === 'ERROR_RECOVERY') {
        let searchFrom = 0;
        if (this.buffer.length > 0 && this.buffer[0] === '<') searchFrom = 1;
        const nextLt = this.buffer.indexOf('<', searchFrom);
        if (nextLt === -1) {
          const tail =
            this.buffer.length > 0 && this.buffer[this.buffer.length - 1] === '<' ? '<' : '';
          this.buffer = tail;
          this.resetToOutside();
          return events;
        }
        this.buffer = this.buffer.slice(nextLt);
        this.resetToOutside();
        continue;
      }
    }

    if (contentDirty && this.state === 'IN_CONTENT' && this.currentField) {
      events.push(
        this.stamp({
          field: this.currentField,
          value: this.content,
          isComplete: false,
        })
      );
    }

    return events;
  }

  end(): OverrideStreamEvent[] {
    // Phase 2A discretion inherited (grammar §3.2 note). Trailing partials
    // without their close tag are protocol violations and stay silent.
    return [];
  }
}
