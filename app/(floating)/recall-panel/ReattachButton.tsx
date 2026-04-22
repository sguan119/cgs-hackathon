'use client';

// Phase 2D — chrome affordance rendered only when the follow-coordinator
// is in `detached` mode. Clicking emits SHELL_REATTACH_REQUESTED across
// windows; the main-window coordinator snaps recall back to main-right+8
// and flips mode back to `follow`, which causes this button to unmount.

type Props = {
  onReattach: () => void | Promise<void>;
};

export function ReattachButton({ onReattach }: Props) {
  return (
    <button
      type="button"
      className="recall-reattach"
      onClick={() => void onReattach()}
      aria-label="Reattach recall panel to main window"
    >
      ↩ Reattach
    </button>
  );
}
