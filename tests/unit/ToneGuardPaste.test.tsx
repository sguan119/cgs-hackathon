/* @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToneGuardPaste } from '@/app/(main)/continuity/ToneGuardPaste';

afterEach(() => {
  cleanup();
});

function getTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText(/Email body to validate/i) as HTMLTextAreaElement;
}

describe('ToneGuardPaste — integration (plan §9.2)', () => {
  it('renders textarea + Validate + Clear buttons initially, no result card', () => {
    render(<ToneGuardPaste />);
    expect(getTextarea()).toBeTruthy();
    expect(screen.getByRole('button', { name: /Validate/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Clear/i })).toBeTruthy();
    expect(document.querySelector('.tg-paste-result')).toBeNull();
  });

  it('typing body + click Validate renders a result card with TrafficLight', () => {
    render(<ToneGuardPaste />);
    const textarea = getTextarea();
    fireEvent.change(textarea, {
      target: {
        value:
          "What We're Seeing\nThe team is steady.\n\n" +
          'Quick Pulse Check\nDominant Logic is softening.\n\n' +
          'Preliminary Read\nSee you Tuesday.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    const result = document.querySelector('.tg-paste-result');
    expect(result).toBeTruthy();
    // Pass verdict → green TrafficLight
    expect(result?.querySelector('.traffic-light.green')).toBeTruthy();
  });

  it('empty body + Validate → shows info Toast, no result card', () => {
    render(<ToneGuardPaste />);
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    // Toast renders with role="status" for info variant
    const toast = document.querySelector('.toast.info');
    expect(toast).toBeTruthy();
    expect(toast?.textContent).toMatch(/Paste an email body first/i);
    expect(document.querySelector('.tg-paste-result')).toBeNull();
  });

  it('blacklist words in pasted text are underlined in the result card', () => {
    render(<ToneGuardPaste />);
    const textarea = getTextarea();
    fireEvent.change(textarea, {
      target: { value: 'Following up on our last Proposal. The Deal is hot.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    const highlighted = document.querySelectorAll('.tg-paste-result .tg-hl-high');
    expect(highlighted.length).toBeGreaterThan(0);
    // High-severity verdict → red TrafficLight
    expect(document.querySelector('.tg-paste-result .traffic-light.red')).toBeTruthy();
  });

  it('Clear button resets textarea and dismisses the result card', () => {
    render(<ToneGuardPaste />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: 'Proposal.' } });
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    expect(document.querySelector('.tg-paste-result')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect((getTextarea() as HTMLTextAreaElement).value).toBe('');
    expect(document.querySelector('.tg-paste-result')).toBeNull();
  });

  it('gap-close: paste very long body (5KB) → validate completes, result renders', () => {
    render(<ToneGuardPaste />);
    const textarea = getTextarea();
    const longBody =
      "What We're Seeing\n" +
      'The team is learning fast. '.repeat(80) +
      'Strategic Innovation is a priority.\n\n' +
      'Quick Pulse Check\n' +
      'Dominant Logic has not shifted. '.repeat(40) +
      '\n\nPreliminary Read\nSee you Tuesday.';
    fireEvent.change(textarea, { target: { value: longBody } });
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    expect(document.querySelector('.tg-paste-result')).toBeTruthy();
  });

  it('gap-close: clear button resets textarea + result', () => {
    render(<ToneGuardPaste />);
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: 'Proposal.' } });
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    expect(document.querySelector('.tg-paste-result')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect((getTextarea() as HTMLTextAreaElement).value).toBe('');
    expect(document.querySelector('.tg-paste-result')).toBeNull();
  });

  it('gap-close: textarea has maxLength attribute of 20000', () => {
    render(<ToneGuardPaste />);
    const textarea = getTextarea();
    expect(textarea.getAttribute('maxlength')).toBe('20000');
  });

  it('re-validating replaces the previous result (no stacking)', () => {
    render(<ToneGuardPaste />);
    const textarea = getTextarea();
    const validate = screen.getByRole('button', { name: /Validate/i });

    fireEvent.change(textarea, { target: { value: 'Proposal.' } });
    fireEvent.click(validate);
    expect(document.querySelector('.tg-paste-result .traffic-light.red')).toBeTruthy();

    fireEvent.change(textarea, {
      target: {
        value:
          "What We're Seeing\nSteady.\n\nQuick Pulse Check\nDominant Logic softening.\n\nPreliminary Read\nTuesday.",
      },
    });
    fireEvent.click(validate);
    // Exactly one result card in DOM, now green
    expect(document.querySelectorAll('.tg-paste-result').length).toBe(1);
    expect(document.querySelector('.tg-paste-result .traffic-light.green')).toBeTruthy();
  });
});
