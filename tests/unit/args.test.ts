import { describe, it, expect } from 'vitest';
import { parseArgs, printHelp } from '@/scripts/lib/args';

describe('parseArgs', () => {
  it('returns all-false defaults when no args given', () => {
    const a = parseArgs([]);
    expect(a).toEqual({ dryRun: false, confirm: false, verbose: false, help: false, json: false });
  });

  it('--dry-run sets dryRun', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
  });

  it('--confirm sets confirm', () => {
    expect(parseArgs(['--confirm']).confirm).toBe(true);
  });

  it('--verbose sets verbose', () => {
    expect(parseArgs(['--verbose']).verbose).toBe(true);
  });

  it('--help sets help', () => {
    expect(parseArgs(['--help']).help).toBe(true);
  });

  it('-h sets help', () => {
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('--json sets json', () => {
    expect(parseArgs(['--json']).json).toBe(true);
  });

  it('--only value form', () => {
    expect(parseArgs(['--only', 'f3']).only).toBe('f3');
  });

  it('--only=value form', () => {
    expect(parseArgs(['--only=q-cdo']).only).toBe('q-cdo');
  });

  it('mixed flags all set correctly', () => {
    const a = parseArgs(['--dry-run', '--confirm', '--only', 'low', '--verbose']);
    expect(a.dryRun).toBe(true);
    expect(a.confirm).toBe(true);
    expect(a.only).toBe('low');
    expect(a.verbose).toBe(true);
  });

  it('--dry-run and --json together', () => {
    const a = parseArgs(['--dry-run', '--json']);
    expect(a.dryRun).toBe(true);
    expect(a.json).toBe(true);
  });

  it('positionals are ignored', () => {
    const a = parseArgs(['some-positional', '--dry-run']);
    expect(a.dryRun).toBe(true);
  });

  it('unknown flag throws', () => {
    expect(() => parseArgs(['--unknown-flag'])).toThrow(/Unknown flag/);
  });

  it('--only without value throws', () => {
    expect(() => parseArgs(['--only'])).toThrow();
  });

  it('unknown --key=value flag throws', () => {
    expect(() => parseArgs(['--bogus=val'])).toThrow(/Unknown flag/);
  });
});

describe('printHelp', () => {
  it('does not throw', () => {
    expect(() => printHelp('gen:test', 'Usage: some help text')).not.toThrow();
  });
});
