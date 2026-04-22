import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock must be declared before importing the module under test.
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockSave = vi.fn();
const mockOnKeyChange = vi.fn();
const mockLoad = vi.fn();

vi.mock('@tauri-apps/plugin-store', () => ({
  load: mockLoad,
}));

// Also mock window so isBrowser() returns true inside jsdom env.
// (happy-dom sets window, so no extra work needed.)

describe('lib/store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockLoad.mockResolvedValue({
      get: mockGet,
      set: mockSet,
      save: mockSave,
      onKeyChange: mockOnKeyChange,
    });
  });

  async function loadStore() {
    const mod = await import('@/lib/store');
    return mod;
  }

  it('get returns plugin value for current_client when plugin returns a string', async () => {
    mockGet.mockResolvedValue('acme');
    const { get } = await loadStore();
    const result = await get('current_client');
    expect(result).toBe('acme');
  });

  it('get returns null (not default) when plugin returns null for current_client', async () => {
    mockGet.mockResolvedValue(null);
    const { get } = await loadStore();
    const result = await get('current_client');
    expect(result).toBeNull();
  });

  it('get returns default when plugin returns undefined', async () => {
    mockGet.mockResolvedValue(undefined);
    const { get } = await loadStore();
    const result = await get('meeting_state');
    expect(result).toBe('idle');
  });

  it('set calls store.set and store.save', async () => {
    mockSet.mockResolvedValue(undefined);
    mockSave.mockResolvedValue(undefined);
    const { set } = await loadStore();
    await set('meeting_state', 'in_meeting');
    expect(mockSet).toHaveBeenCalledWith('meeting_state', 'in_meeting');
    expect(mockSave).toHaveBeenCalled();
  });

  it('subscribe wires onKeyChange for meeting_state', async () => {
    mockOnKeyChange.mockResolvedValue(() => {});
    const { subscribe } = await loadStore();
    const cb = vi.fn();
    await subscribe('meeting_state', cb);
    expect(mockOnKeyChange).toHaveBeenCalledWith('meeting_state', expect.any(Function));
  });

  it('subscribe returns an unlisten function', async () => {
    const unlisten = vi.fn();
    mockOnKeyChange.mockResolvedValue(unlisten);
    const { subscribe } = await loadStore();
    const result = await subscribe('recall_history', vi.fn());
    expect(typeof result).toBe('function');
  });

  it('subscribe fires callback with value from onKeyChange', async () => {
    let capturedHandler: ((v: unknown) => void) | null = null;
    mockOnKeyChange.mockImplementation((_key: string, handler: (v: unknown) => void) => {
      capturedHandler = handler;
      return Promise.resolve(() => {});
    });
    const { subscribe } = await loadStore();
    const cb = vi.fn();
    await subscribe('thesis_diff_state', cb);
    capturedHandler!('before_m2');
    await Promise.resolve(); // flush microtask
    expect(cb).toHaveBeenCalledWith('before_m2');
  });

  it('all 5 SessionStore keys are accepted by set without TS errors (runtime check)', async () => {
    mockSet.mockResolvedValue(undefined);
    mockSave.mockResolvedValue(undefined);
    const { set } = await loadStore();
    await set('current_client', 'acme');
    await set('meeting_state', 'idle');
    await set('recall_history', []);
    await set('thesis_diff_state', 'before_m1');
    await set('wheel_scores', { Purpose: 3 });
    expect(mockSet).toHaveBeenCalledTimes(5);
  });
});
