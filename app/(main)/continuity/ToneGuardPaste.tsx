'use client';

import { useMemo, useState } from 'react';
import { Toast } from '@/lib/components/Toast';
import { TrafficLight } from '@/lib/components/TrafficLight';
import { buildHighlightRegions } from '@/lib/toneguard/highlight';
import type { ValidateResult, Verdict } from '@/lib/toneguard/types';
import { validate } from '@/lib/toneguard/validate';
import { HighlightedBody } from './HighlightedBody';
import { ReasonPopover } from './ReasonPopover';

const VERDICT_COLOR: Record<Verdict, 'red' | 'yellow' | 'green'> = {
  'pass': 'green',
  'borderline': 'yellow',
  'high-risk': 'red',
};

const VERDICT_LABEL: Record<Verdict, string> = {
  'pass': 'Pass',
  'borderline': 'Borderline',
  'high-risk': 'High risk',
};

const MAX_LEN = 20_000;

export function ToneGuardPaste() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const regions = useMemo(
    () => (result ? buildHighlightRegions(text, result.reasons) : []),
    [text, result]
  );

  const onValidate = () => {
    if (text.trim().length === 0) {
      setToastOpen(true);
      setResult(null);
      return;
    }
    setToastOpen(false);
    setResult(validate(text));
  };

  const onClear = () => {
    setText('');
    setResult(null);
    setToastOpen(false);
  };

  return (
    <section className="tg-paste card" aria-label="Tone Guard paste surface">
      <div className="card-h">
        <div className="t">E3 · Tone Guard · paste & validate</div>
        <span className="tag">synchronous · &lt;5 ms</span>
      </div>
      <div className="card-b">
        <label htmlFor="tg-paste-input" className="tg-paste-label">
          Paste any email body — the validator runs in-process, nothing leaves the window.
        </label>
        <textarea
          id="tg-paste-input"
          className="tg-paste-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_LEN}
          rows={10}
          placeholder="Paste email body here…"
          aria-label="Email body to validate"
        />
        <div className="tg-paste-actions">
          <button type="button" className="tg-btn primary" onClick={onValidate}>
            Validate
          </button>
          <button type="button" className="tg-btn" onClick={onClear}>
            Clear
          </button>
          <span className="tg-paste-count">
            {text.length.toLocaleString()} / {MAX_LEN.toLocaleString()}
          </span>
        </div>

        {toastOpen ? (
          <Toast variant="info" onDismiss={() => setToastOpen(false)}>
            Paste an email body first.
          </Toast>
        ) : null}

        {result ? (
          <div className="tg-paste-result">
            <div className="tg-paste-result-h">
              <TrafficLight
                color={VERDICT_COLOR[result.verdict]}
                label={VERDICT_LABEL[result.verdict]}
              />
              <span className="tg-paste-result-count">
                {result.reasons.length === 0
                  ? 'No findings'
                  : `${result.reasons.length} finding${result.reasons.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <ReasonPopover reasons={result.reasons} layout="inline" />
            <HighlightedBody body={text} regions={regions} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
