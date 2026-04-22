/* @vitest-environment happy-dom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SupersededCard } from '@/lib/components/SupersededCard';

afterEach(() => {
  cleanup();
});

// Reviewer-2 B2: the SupersededCard wrapper must support a `fadingOut`
// prop that keeps the element mounted with an `is-fading-out` class long
// enough for the 400ms CSS transition to run. DiagnosticPage owns the
// setTimeout-driven phase machine; this test locks the wrapper contract.

describe('SupersededCard', () => {
  it('renders with base class and no is-fading-out by default', () => {
    render(
      <SupersededCard>
        <div data-testid="child">hello</div>
      </SupersededCard>
    );
    const child = screen.getByTestId('child');
    const wrapper = child.parentElement!;
    expect(wrapper.className).toContain('superseded-card');
    expect(wrapper.className).not.toContain('is-fading-out');
    expect(wrapper.getAttribute('data-fading-out')).toBe('false');
    expect(wrapper.getAttribute('aria-hidden')).toBe('false');
  });

  it('adds is-fading-out class + aria-hidden when fadingOut=true', () => {
    render(
      <SupersededCard fadingOut>
        <div data-testid="child">hello</div>
      </SupersededCard>
    );
    const child = screen.getByTestId('child');
    const wrapper = child.parentElement!;
    expect(wrapper.className).toContain('is-fading-out');
    expect(wrapper.getAttribute('data-fading-out')).toBe('true');
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
  });
});
