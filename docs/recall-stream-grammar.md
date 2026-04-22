# Recall Tagged-Stream Grammar

Contract between the Anthropic Claude streaming response and
`lib/llm/stream-parser.ts` (to be implemented in Phase 2A).

This doc pins **the only shape Claude is allowed to return** for
§3.6.2 Real-Time Recall and the parser state machine that turns that
shape into incremental UI updates.

Cross-refs:
- Schema for `source_id` values: `fixtures/precedents.schema.json`
  (field `Precedent.source_id`).
- Upstream phase plan: `docs/phase-plans/phase-0-plan.md` §0.2.
- LLM pipeline: `docs/architecture.md` §4.

---

## 1. Tag set

**7 content tags + 2 control tags.**

| Tag | Cardinality per turn | Content | UI slot |
|---|---|---|---|
| `<year>…</year>` | exactly 1 | integer string, 4 digits | card header |
| `<client>…</client>` | exactly 1 | plain text | card header |
| `<scene>…</scene>` | exactly 1 | plain text, ≤ 80 char | card subtitle |
| `<tag>…</tag>` | 1..N | single CGS methodology tag (must be whitelisted in `lib/methodology/tags.ts`) | tag chip row |
| `<quote>…</quote>` | 1..N | verbatim precedent quote | blockquote list |
| `<source_id>…</source_id>` | exactly 1 | id matching an entry in `fixtures/precedents.json` (`Precedent.source_id`) | citation link |
| `<fellow_voice>…</fellow_voice>` | 0 or 1 | Fellow-tone rewrite of the answer | right column (double-column view) |
| `<no_anchor/>` | 0 or 1 (self-closing) | — | replaces all above; UI shows **"suggest 24h Memo"** |
| `<done/>` | exactly 1 (self-closing) | — | closes the turn |

`<no_anchor/>` and the content tags are mutually exclusive. If
`<no_anchor/>` is emitted, the UI must ignore any content tags that
arrived in the same turn (defensive: Claude should not emit both).

---

## 2. Ordering, repetition, escape, nesting

### 2.1 Ordering

Canonical order:

```
year → client → scene → tag* → quote+ → fellow_voice? → source_id → done
```

The parser **tolerates out-of-order tags** — it dispatches events by
tag name, and the UI renders each event into its fixed slot regardless
of arrival order. Canonical order exists only as a Claude-side
authoring convention; do not build parser logic that assumes it.

### 2.2 Repetition

- `<tag>` and `<quote>` append to their respective arrays in arrival
  order.
- All other content tags are **last-wins** (a second `<year>` overwrites
  the first).
- `<done/>` appearing more than once is a protocol violation; parser
  emits the first and enters `ERROR_RECOVERY` on the second.

### 2.3 Escape

- Literal `<` inside tag content **must** be encoded as `&lt;` by the
  model.
- Parser does **not** reverse-escape. The UI renders every tag content
  string as a text node (no `innerHTML`), so `&lt;` stays literal —
  acceptable visual cost in exchange for zero XSS surface.
- Literal `>` inside content is permitted without escape (no parse
  ambiguity).

### 2.4 Nesting

- **Forbidden.** A `<` appearing inside an open tag before its closer
  is treated as a protocol violation.
- On violation the parser enters `ERROR_RECOVERY`: it drops the
  current buffer up to the next `</…>` close tag and resumes.
- ERROR_RECOVERY never throws — it degrades silently and keeps the
  streaming UX alive.

---

## 3. Parser state machine

### 3.1 States

```
OUTSIDE          no tag open; scanning for '<'
IN_OPEN_TAG      saw '<', accumulating tag name until '>' or '/>'
IN_CONTENT       inside tag body; accumulating until '</'
IN_CLOSE_TAG     saw '</', accumulating close-tag name until '>'
ERROR_RECOVERY   dropping buffer until next '</…>' then OUTSIDE
```

All five states are exhaustive; any character input maps to exactly
one transition (see §3.3 table).

### 3.2 Public contract

```ts
type TagName =
  | 'year' | 'client' | 'scene' | 'tag' | 'quote'
  | 'source_id' | 'fellow_voice' | 'no_anchor' | 'done';

type ParserEvent = {
  field: TagName;
  value: string | boolean;   // string for content tags; true for self-closing
  isComplete: boolean;       // false = partial (streaming fade-in); true = closed
};

class RecallStreamParser {
  push(chunk: string): ParserEvent[];  // pure; buffers internally
  end(): ParserEvent[];                // flush; returns any trailing partials (usually []).
}
```

> `end()` is **Phase 2A implementation discretion** — it is *not* part of
> the Phase 0 locked §0.2 contract. The locked contract is `push` alone.
> Phase 2A may add, rename, or omit `end()` as long as `push` keeps the
> signature and semantics documented here.

- `push` is pure with respect to the combined `(priorBuffer + chunk)`
  input; it never allocates side channels.
- Each call returns 0..N events in arrival order.
- The parser never throws; protocol violations emit no event and
  transition to `ERROR_RECOVERY`.

### 3.3 Chunk-boundary buffering

Field: `pendingBuffer: string`, carried across `push` calls.

On each `push(chunk)`:

1. Append `chunk` to `pendingBuffer`.
2. Scan from the current cursor:
   - **OUTSIDE** + see `<` → `IN_OPEN_TAG`, start tag-name accumulator.
     If input ends before `>` or `/>` is seen → freeze cursor at the
     `<`, return collected events, wait for next `push`.
   - **IN_OPEN_TAG** + see `>` → open tag committed; transition to
     `IN_CONTENT`.
   - **IN_OPEN_TAG** + see `/>` (self-closing) → emit
     `{ field: <name>, value: true, isComplete: true }`, transition
     `OUTSIDE`.
   - **IN_CONTENT** + new content character → emit
     `{ field, value: accumulatedContent, isComplete: false }` so the
     UI can fade-in partial text. (See §3.4 on batching.)
   - **IN_CONTENT** + see `</` → `IN_CLOSE_TAG`.
   - **IN_CLOSE_TAG** + see `>` → emit
     `{ field, value, isComplete: true }`, transition `OUTSIDE`.
   - **any state** + protocol violation (nesting, mismatched close
     tag, unknown tag name) → `ERROR_RECOVERY`.
   - **ERROR_RECOVERY** + see `</…>` → drop buffer up to and
     including that close tag, transition `OUTSIDE`.
3. Advance cursor only past committed content. Any un-committed tail
   (e.g. a partial `<cli`) stays in `pendingBuffer` for the next
   `push`.

### 3.4 Partial-emission batching

For `IN_CONTENT`, the parser **may** coalesce adjacent partial
emissions within a single `push` call into one `{ isComplete: false }`
event carrying the full current accumulator. Emitting one partial per
character is permitted but wasteful — Phase 2A implementation will
coalesce.

The final `{ isComplete: true }` emission for a tag is **mandatory**
regardless of how many partials preceded it.

---

## 4. Worked chunk-split example

Three arriving chunks:

- **Chunk 1:** `<year>2018</year><cli`
- **Chunk 2:** `ent>Globex</client><scene>CDO re`
- **Chunk 3:** `porting-line</scene>...`

Parser behaviour:

| After push | Events emitted | Residual `pendingBuffer` | Parser state |
|---|---|---|---|
| Chunk 1 | `{ year, "2018", true }` | `<cli` | `IN_OPEN_TAG` (tag name incomplete) |
| Chunk 2 | `{ client, "Globex", true }`, `{ scene, "CDO re", false }` | `CDO re` | `IN_CONTENT` for `scene` |
| Chunk 3 | `{ scene, "CDO reporting-line", true }` | `` (empty) | `OUTSIDE` |

Note:
- After chunk 1 the `<cli` tail is retained unchanged — the parser has
  entered `IN_OPEN_TAG` but the tag name is incomplete, so the entire
  `<cli` must survive into the next push.
- After chunk 2 the `<scene>` open tag has been committed and the parser
  is in `IN_CONTENT`. Per §3.3 step 3 ("advance cursor only past
  committed content"), the committed open-tag characters leave the
  buffer; only the un-committed content tail `CDO re` remains. Parser
  state is tracked in the state machine, not re-parsed from the buffer,
  so there is no need to keep `<scene>` in the buffer.
- After chunk 3 the scene closes; UI replaces the partial with the
  final complete value.

---

## 5. Unit-test seed cases (for Phase 2A)

`lib/llm/stream-parser.test.ts` **must** cover, at minimum:

1. **Tag split across 2 chunks.** `<ye` | `ar>2018</year>` → one
   `{year, "2018", true}` event after second push.
2. **Tag split across 3 chunks (stress).** `<yea` | `r>20` | `18</year>`
   → at most one partial (`"20"`) + final complete (`"2018"`).
3. **Literal `<` inside quote.** `<quote>cost &lt; 10% of revenue</quote>`
   → emits the content verbatim (parser does not reverse-escape). A
   raw `<` inside an open quote (no `&lt;`) must trigger
   `ERROR_RECOVERY`, not a thrown exception.
4. **Multiple `<quote>` in one chunk.** `<quote>A</quote><quote>B</quote>`
   → two complete quote events, both with `isComplete: true`, in
   arrival order.
5. **`<no_anchor/>` arriving alone.** `<no_anchor/><done/>` → emits
   `{ no_anchor, true, true }` then `{ done, true, true }`; no content
   events.
6. **Malformed: unclosed `<year>` followed by `<done/>`.**
   `<year>2018<done/>` → parser recognises the protocol violation
   (opening `<` inside open content), enters `ERROR_RECOVERY`, drops
   the malformed `<year>` buffer, and still emits
   `{ done, true, true }` so the turn closes cleanly.

These six cases are **non-negotiable for Phase 2A merge** (see
phase-0-plan.md Risks → R "Parser chunk-boundary bugs").

---

## 6. No-anchor path

When cosine retrieval scores below the threshold (see architecture.md
§5.2 / tech-design §2A fallback chain), the Phase 2A runtime **does
not call Claude**. It synthesises a single `<no_anchor/><done/>`
stream locally and pipes it through the same parser. This keeps the UI
render path identical for hit / miss — the Recall card renders the
"suggest 24h Memo" fallback without any code-path branching in the
component layer.

---

## 7. Boundary with the precedent schema

- `<source_id>` content MUST equal some `Precedent.source_id` in
  `fixtures/precedents.json` (schema: `fixtures/precedents.schema.json`).
- `<tag>` content MUST be a member of the methodology whitelist
  (`lib/methodology/tags.ts`, Phase 2C).
- `<year>` content should parse to an integer in
  `[2005, 2026]` (same range as `Precedent.year`).

The parser itself does **not** enforce these semantic rules — it is a
pure syntactic extractor. Validation belongs one layer up, in the
Recall runtime.
