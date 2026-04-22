// Tagged-stream parser for Claude's Real-Time Recall response format.
// Contract: docs/recall-stream-grammar.md. Pure syntactic extractor — no
// semantic validation (whitelist / source_id checks belong one layer up in
// recall-chain.ts). Never throws; protocol violations degrade silently.
//
// Lenient recovery: IN_CONTENT violation hands the `<` back to OUTSIDE
// rather than strict §2.4 drop-to-`</…>` — required by grammar §5 seed
// test 6 because `<done/>` has no close tag and must still emit.

export type TagName =
  | 'year'
  | 'client'
  | 'scene'
  | 'tag'
  | 'quote'
  | 'source_id'
  | 'fellow_voice'
  | 'no_anchor'
  | 'done';

export type ParserEvent = {
  field: TagName;
  value: string | boolean;
  isComplete: boolean;
};

const KNOWN_TAGS: ReadonlySet<TagName> = new Set<TagName>([
  'year',
  'client',
  'scene',
  'tag',
  'quote',
  'source_id',
  'fellow_voice',
  'no_anchor',
  'done',
]);

type State =
  | 'OUTSIDE'
  | 'IN_OPEN_TAG'
  | 'IN_CONTENT'
  | 'IN_CLOSE_TAG'
  | 'ERROR_RECOVERY';

function isKnownTag(name: string): name is TagName {
  return KNOWN_TAGS.has(name as TagName);
}

export class RecallStreamParser {
  private buffer = '';
  private state: State = 'OUTSIDE';
  private openTagName = '';
  private closeTagName = '';
  private content = '';
  private currentField: TagName | null = null;

  // Single point of truth for recovery: reset all tag accumulators, drop
  // tag state, and hand control back to OUTSIDE. Both the IN_OPEN_TAG
  // '<'-nesting case and the IN_CONTENT '<X' case route through this so
  // observable behaviour matches.
  private resetToOutside(): void {
    this.currentField = null;
    this.content = '';
    this.openTagName = '';
    this.closeTagName = '';
    this.state = 'OUTSIDE';
  }

  push(chunk: string): ParserEvent[] {
    this.buffer += chunk;
    const events: ParserEvent[] = [];
    let contentDirty = false;

    while (this.buffer.length > 0) {
      if (this.state === 'OUTSIDE') {
        const lt = this.buffer.indexOf('<');
        if (lt === -1) {
          // Discard stray text between tags.
          this.buffer = '';
          break;
        }
        if (lt > 0) this.buffer = this.buffer.slice(lt);
        if (this.buffer.length < 2) break;
        if (this.buffer[1] === '/') {
          // Stray close tag with no matching open — drop it. Consuming the
          // full close-tag span here (instead of routing through
          // ERROR_RECOVERY) is necessary because ERROR_RECOVERY resumes at
          // the next '<' and would re-find this one, causing an infinite
          // loop.
          const gt = this.buffer.indexOf('>', 2);
          if (gt === -1) {
            // Wait for more — keep buffer as-is.
            return events;
          }
          this.buffer = this.buffer.slice(gt + 1);
          continue;
        }
        this.buffer = this.buffer.slice(1);
        this.state = 'IN_OPEN_TAG';
        this.openTagName = '';
        continue;
      }

      if (this.state === 'IN_OPEN_TAG') {
        // Accumulate tag name until '>' or '/>'. A '<' appearing here is a
        // protocol violation (nesting).
        let advanced = false;
        while (this.buffer.length > 0) {
          const ch = this.buffer[0]!;
          if (ch === '<') {
            // Malformed open tag (e.g. "<foo<bar>"). Drop the accumulator
            // and resume at OUTSIDE so the new '<' is re-parsed cleanly.
            this.resetToOutside();
            advanced = true;
            break;
          }
          if (ch === '/') {
            // Self-closing "/>". Need next char.
            if (this.buffer.length < 2) {
              // Wait for more.
              return events;
            }
            if (this.buffer[1] === '>') {
              const name = this.openTagName;
              this.buffer = this.buffer.slice(2);
              if (isKnownTag(name)) {
                events.push({ field: name, value: true, isComplete: true });
              }
              // Unknown self-closing tag silently dropped (not a violation
              // per grammar — defensive treatment).
              this.state = 'OUTSIDE';
              this.openTagName = '';
              advanced = true;
              break;
            }
            // Stray '/' mid-name is a protocol violation.
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
        if (!advanced) {
          // Ran out of buffer mid tag-name; wait for more.
          return events;
        }
        continue;
      }

      if (this.state === 'IN_CONTENT') {
        // Look for "</" to transition into close tag. Otherwise accumulate.
        const lt = this.buffer.indexOf('<');
        if (lt === -1) {
          // All buffer is content.
          this.content += this.buffer;
          this.buffer = '';
          contentDirty = true;
          break;
        }
        // Accumulate up to the '<'.
        if (lt > 0) {
          this.content += this.buffer.slice(0, lt);
          this.buffer = this.buffer.slice(lt);
          contentDirty = true;
        }
        // Need at least "</" to decide.
        if (this.buffer.length < 2) return events;
        if (this.buffer[1] !== '/') {
          // Lenient recovery: IN_CONTENT violation hands the `<` back to
          // OUTSIDE rather than strict §2.4 drop-to-`</…>` — required by
          // grammar §5 seed test 6 because `<done/>` has no close tag and
          // must still emit.
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
        // Coalesce any pending partial — skipped; we go straight to the
        // final complete emission.
        if (field && isKnownTag(name) && name === field) {
          events.push({ field, value: this.content, isComplete: true });
        } else {
          // Mismatched close or unknown — violation. Drop whatever we had.
          // The grammar says ERROR_RECOVERY drops buffer up to next close
          // tag; we've already consumed this one, so just reset.
          // No complete event emitted.
        }
        this.currentField = null;
        this.content = '';
        this.closeTagName = '';
        this.state = 'OUTSIDE';
        contentDirty = false;
        continue;
      }

      if (this.state === 'ERROR_RECOVERY') {
        // Reached when an earlier handler explicitly set this state —
        // currently (a) the stray-'/' path in IN_OPEN_TAG and (b) the
        // unknown-tag-name close path in IN_OPEN_TAG (line ~146). Skip
        // past the current '<' if we're sitting on one so we don't
        // re-enter recovery on the same byte, then hand control back to
        // OUTSIDE via the shared reset. Preserves the "degrade silently,
        // keep UX alive" contract from grammar §2.4.
        let searchFrom = 0;
        if (this.buffer.length > 0 && this.buffer[0] === '<') searchFrom = 1;
        const nextLt = this.buffer.indexOf('<', searchFrom);
        if (nextLt === -1) {
          // Nothing more to scan. Preserve a trailing '<' in case it starts
          // a future tag at the next push, else drop everything.
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
      // Coalesce: one partial emission per push per content run.
      events.push({
        field: this.currentField,
        value: this.content,
        isComplete: false,
      });
    }

    return events;
  }

  end(): ParserEvent[] {
    // Phase 2A discretion (grammar §3.2 note). Flush nothing — trailing
    // partials without their close tag are protocol violations and stay
    // silent, consistent with ERROR_RECOVERY semantics.
    return [];
  }
}
