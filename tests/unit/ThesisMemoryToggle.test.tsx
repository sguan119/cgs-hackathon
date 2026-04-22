/* @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThesisMemoryToggle } from '@/app/(main)/dashboard/ThesisMemoryToggle';

afterEach(() => {
  cleanup();
});

describe('ThesisMemoryToggle', () => {
  it('initial render shows Before Meeting 1 image', () => {
    render(<ThesisMemoryToggle />);
    const img = screen.getByTestId('thesis-memory-image') as HTMLImageElement;
    expect(img.getAttribute('data-screenshot-id')).toBe('before_m1');
    expect(img.src).toContain('before-m1');
  });

  it('click swaps to Before Meeting 2; aria-pressed flips', () => {
    render(<ThesisMemoryToggle />);
    const button = screen.getByTestId('thesis-memory-toggle-button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    const img = screen.getByTestId('thesis-memory-image') as HTMLImageElement;
    expect(img.getAttribute('data-screenshot-id')).toBe('before_m2');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('ArrowRight on focused button swaps', () => {
    render(<ThesisMemoryToggle />);
    const button = screen.getByTestId('thesis-memory-toggle-button');
    button.focus();
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('ArrowLeft on focused button also swaps', () => {
    render(<ThesisMemoryToggle />);
    const button = screen.getByTestId('thesis-memory-toggle-button');
    button.focus();
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('onError handler swaps src to SVG placeholder', () => {
    render(<ThesisMemoryToggle />);
    const img = screen.getByTestId('thesis-memory-image') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.src).toContain('placeholder-before-m1.svg');
  });

  it('repeat clicks toggle back and forth', () => {
    render(<ThesisMemoryToggle />);
    const button = screen.getByTestId('thesis-memory-toggle-button');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});
