// Synthetic stream that renders the no-anchor fallback card by pushing a
// locally-built <no_anchor/><done/> payload through the real parser. Used
// by two branches in recall-chain: (a) cosine-threshold miss (retrieval
// returned nothing useful) and (b) retry-ladder exhaustion with no offline
// cache hit. UI is identical in both cases per grammar doc §6.

import { RecallStreamParser, type ParserEvent } from './stream-parser';

const NO_ANCHOR_STREAM = '<no_anchor/><done/>';

export function synthesizeNoAnchor(): ParserEvent[] {
  const parser = new RecallStreamParser();
  return parser.push(NO_ANCHOR_STREAM);
}

export async function* noAnchorEvents(): AsyncIterable<ParserEvent> {
  for (const ev of synthesizeNoAnchor()) yield ev;
}
