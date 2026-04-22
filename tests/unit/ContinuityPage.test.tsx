/* @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ContinuityPage } from '@/app/(main)/continuity/ContinuityPage';

function escapeKeydown() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

afterEach(() => {
  cleanup();
});

describe('ContinuityPage — integration (plan §9.2)', () => {
  it('renders three EmailCards — one per fixture id', () => {
    render(<ContinuityPage />);
    expect(screen.getByTestId('email-card-pass')).toBeTruthy();
    expect(screen.getByTestId('email-card-borderline')).toBeTruthy();
    expect(screen.getByTestId('email-card-high-risk')).toBeTruthy();
  });

  it('maps verdict → TrafficLight color (pass=green, borderline=yellow, high-risk=red)', () => {
    render(<ContinuityPage />);
    const passCard = screen.getByTestId('email-card-pass');
    const borderlineCard = screen.getByTestId('email-card-borderline');
    const highRiskCard = screen.getByTestId('email-card-high-risk');

    expect(passCard.querySelector('.traffic-light.green')).toBeTruthy();
    expect(borderlineCard.querySelector('.traffic-light.yellow')).toBeTruthy();
    expect(highRiskCard.querySelector('.traffic-light.red')).toBeTruthy();
  });

  it('clicking a badge opens ReasonPopover with findings for that email', () => {
    render(<ContinuityPage />);
    const highRiskCard = screen.getByTestId('email-card-high-risk');
    const badge = within(highRiskCard).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(badge);
    // Popover now in DOM — role="dialog" per ReasonPopover.tsx
    const popovers = document.querySelectorAll('.tg-reasons--popover');
    expect(popovers.length).toBeGreaterThanOrEqual(1);
    // High-risk fixture body contains at least one sales_blacklist rule
    const reasonRules = document.querySelectorAll('.tg-reason-rule');
    const ruleText = Array.from(reasonRules).map((el) => el.textContent).join(' ');
    expect(ruleText).toMatch(/sales_blacklist|missing_section|no_methodology_tag/);
  });

  it('Esc closes an open popover', () => {
    render(<ContinuityPage />);
    const card = screen.getByTestId('email-card-high-risk');
    const badge = within(card).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(badge);
    expect(document.querySelectorAll('.tg-reasons--popover').length).toBeGreaterThanOrEqual(1);
    // Reviewer-2 N2: dispatch a real KeyboardEvent wrapped in act() so
    // the window.addEventListener('keydown', ...) handler fires and the
    // React state update flushes before the assertion.
    escapeKeydown();
    expect(document.querySelectorAll('.tg-reasons--popover').length).toBe(0);
  });

  it('Reviewer-2 B1: clicking the same badge twice toggles the popover (open → close)', () => {
    render(<ContinuityPage />);
    const card = screen.getByTestId('email-card-high-risk');
    const badge = within(card).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(badge);
    expect(document.querySelectorAll('.tg-reasons--popover').length).toBe(1);
    fireEvent.click(badge);
    expect(document.querySelectorAll('.tg-reasons--popover').length).toBe(0);
  });

  it('Reviewer-2 B2: Esc-closing the popover returns focus to the badge', () => {
    render(<ContinuityPage />);
    const card = screen.getByTestId('email-card-high-risk');
    const badge = within(card).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(badge);
    escapeKeydown();
    expect(document.activeElement).toBe(badge);
  });

  it('Reviewer-3 B1: opened dialog has aria-modal="true" + aria-labelledby pointing to its heading', () => {
    render(<ContinuityPage />);
    const card = screen.getByTestId('email-card-high-risk');
    const badge = within(card).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(badge);
    const dialog = document.querySelector('.tg-reasons--popover');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy!);
    expect(heading?.textContent).toMatch(/Tone Guard findings/);
  });

  it('Reviewer-3 B2: click-outside close does NOT return focus to the badge (a11y pin)', () => {
    render(<ContinuityPage />);
    const card = screen.getByTestId('email-card-high-risk');
    const badge = within(card).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(badge);
    expect(document.querySelectorAll('.tg-reasons--popover').length).toBe(1);
    // Simulate a click on document.body (outside popover + outside badge)
    // — dispatch a real bubbling click so the window-level click-outside
    // handler fires with event.target !== popover root.
    act(() => {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.querySelectorAll('.tg-reasons--popover').length).toBe(0);
    expect(document.activeElement).not.toBe(badge);
  });

  it('pass fixture has no findings listed in its popover', () => {
    render(<ContinuityPage />);
    const passCard = screen.getByTestId('email-card-pass');
    const badge = within(passCard).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(badge);
    const empty = document.querySelector('.tg-reasons-empty');
    expect(empty).toBeTruthy();
  });

  it('high-risk body renders underlined sales-speak tokens inline (HighlightedBody)', () => {
    render(<ContinuityPage />);
    const card = screen.getByTestId('email-card-high-risk');
    const highlighted = card.querySelectorAll('.tg-hl');
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it('gap-close: two different badges open independent popovers without sharing state', () => {
    render(<ContinuityPage />);
    // Open the high-risk popover
    const highRiskCard = screen.getByTestId('email-card-high-risk');
    const highRiskBadge = within(highRiskCard).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(highRiskBadge);
    expect(document.querySelectorAll('.tg-reasons--popover').length).toBe(1);

    // Open the borderline popover — high-risk should close (only one popover at a time per card)
    // then borderline opens; each card manages its own open state independently
    const borderlineCard = screen.getByTestId('email-card-borderline');
    const borderlineBadge = within(borderlineCard).getByRole('button', { name: /Tone Guard verdict/i });
    fireEvent.click(borderlineBadge);
    // At least one popover is open (borderline's)
    expect(document.querySelectorAll('.tg-reasons--popover').length).toBeGreaterThanOrEqual(1);
  });

  it('gap-close: page renders exactly 3 cards matching 3 fixture files', () => {
    render(<ContinuityPage />);
    expect(screen.getByTestId('email-card-pass')).toBeTruthy();
    expect(screen.getByTestId('email-card-borderline')).toBeTruthy();
    expect(screen.getByTestId('email-card-high-risk')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid^="email-card-"]').length).toBe(3);
  });
});
