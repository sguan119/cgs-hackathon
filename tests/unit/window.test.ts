import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @tauri-apps/api/window so the window helpers are unit-testable
// without a Tauri runtime. The test doubles record calls and return
// deterministic physical coordinates.

const mainOuterPosition = vi.fn(async () => ({ x: 200, y: 100 }));
const mainOuterSize = vi.fn(async () => ({ width: 1440, height: 900 }));
const recallOuterPosition = vi.fn(async () => ({ x: 1648, y: 180 }));
const recallSetPosition = vi.fn(async (_pos: { x: number; y: number }) => {});

vi.mock('@tauri-apps/api/window', () => {
  class PhysicalPositionStub {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  }
  return {
    PhysicalPosition: PhysicalPositionStub,
    getCurrentWindow: () => ({ label: 'main' }),
    Window: {
      getByLabel: vi.fn(async (label: string) => {
        if (label === 'main') {
          return {
            outerPosition: mainOuterPosition,
            outerSize: mainOuterSize,
          };
        }
        if (label === 'recall') {
          return {
            outerPosition: recallOuterPosition,
            setPosition: recallSetPosition,
          };
        }
        return null;
      }),
    },
  };
});

// GAP constants from lib/window.ts (GAP_X=8, GAP_Y=80)
const GAP_X = 8;
const GAP_Y = 80;

describe('lib/window Phase 2D helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // [W4] expectedRecallPosition with explicit main coords {x:100, y:200, width:1200, height:800}
  it('expectedRecallPosition({x:100,y:200,width:1200}) returns x=100+1200+GAP_X, y=200+GAP_Y', async () => {
    mainOuterPosition.mockResolvedValueOnce({ x: 100, y: 200 });
    mainOuterSize.mockResolvedValueOnce({ width: 1200, height: 800 });
    const { expectedRecallPosition } = await import('@/lib/window');
    const pos = await expectedRecallPosition();
    expect(pos).toEqual({ x: 100 + 1200 + GAP_X, y: 200 + GAP_Y });
  });

  // [W5] expectedRecallPosition with main at (0,0)
  it('expectedRecallPosition handles main at (0,0) — returns sensible coords', async () => {
    mainOuterPosition.mockResolvedValueOnce({ x: 0, y: 0 });
    mainOuterSize.mockResolvedValueOnce({ width: 1440, height: 900 });
    const { expectedRecallPosition } = await import('@/lib/window');
    const pos = await expectedRecallPosition();
    expect(pos).toEqual({ x: 0 + 1440 + GAP_X, y: 0 + GAP_Y });
  });

  // [W6] expectedRecallPosition with negative coords (secondary monitor)
  it('expectedRecallPosition with negative coords (multi-monitor) does not crash', async () => {
    mainOuterPosition.mockResolvedValueOnce({ x: -2560, y: -200 });
    mainOuterSize.mockResolvedValueOnce({ width: 2560, height: 1440 });
    const { expectedRecallPosition } = await import('@/lib/window');
    const pos = await expectedRecallPosition();
    expect(pos).toEqual({ x: -2560 + 2560 + GAP_X, y: -200 + GAP_Y });
    expect(pos?.x).toBe(GAP_X);
  });

  it('expectedRecallPosition returns main.x + width + 8 and main.y + 80', async () => {
    const { expectedRecallPosition } = await import('@/lib/window');
    const pos = await expectedRecallPosition();
    expect(pos).toEqual({ x: 200 + 1440 + 8, y: 100 + 80 });
  });

  it('getRecallOuterPosition returns recall window outer position', async () => {
    const { getRecallOuterPosition } = await import('@/lib/window');
    const pos = await getRecallOuterPosition();
    expect(pos).toEqual({ x: 1648, y: 180 });
  });

  it('repositionToMainRight sets recall to the expected position', async () => {
    const { repositionToMainRight } = await import('@/lib/window');
    await repositionToMainRight();
    expect(recallSetPosition).toHaveBeenCalledTimes(1);
    const arg = recallSetPosition.mock.calls[0]?.[0];
    expect(arg?.x).toBe(200 + 1440 + 8);
    expect(arg?.y).toBe(100 + 80);
  });
});
