
// DesignCanvas.jsx — Figma-ish design canvas wrapper
// Warm gray grid bg + Sections + Artboards + PostIt notes.
// No assets, no deps.

const DC = {
  bg: '#f0eee9',
  grid: 'rgba(0,0,0,0.06)',
  label: 'rgba(60,50,40,0.7)',
  title: 'rgba(40,30,20,0.85)',
  subtitle: 'rgba(60,50,40,0.6)',
  postitBg: '#fef4a8',
  postitText: '#5a4a2a',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

// ─────────────────────────────────────────────────────────────
// Main canvas — transform-based pan/zoom viewport
//
// Input mapping (Figma-style):
//   • trackpad pinch  → zoom   (ctrlKey wheel; Safari gesture* events)
//   • trackpad scroll → pan    (two-finger)
//   • mouse wheel     → zoom   (notched; distinguished from trackpad scroll)
//   • middle-drag / primary-drag-on-bg → pan
//
// Transform state lives in a ref and is written straight to the DOM
// (translate3d + will-change) so wheel ticks don't go through React —
// keeps pans at 60fps on dense canvases.
// ─────────────────────────────────────────────────────────────
function DesignCanvas({ children, minScale = 0.1, maxScale = 8, style = {} }) {
  const vpRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const tf = React.useRef({ x: 0, y: 0, scale: 1 });

  const apply = React.useCallback(() => {
    const { x, y, scale } = tf.current;
    const el = worldRef.current;
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  React.useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;

    const zoomAt = (cx, cy, factor) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left, py = cy - r.top;
      const t = tf.current;
      const next = Math.min(maxScale, Math.max(minScale, t.scale * factor));
      const k = next / t.scale;
      // keep the world point under the cursor fixed
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.scale = next;
      apply();
    };

    // Mouse-wheel vs trackpad-scroll heuristic. A physical wheel sends
    // line-mode deltas (Firefox) or large integer pixel deltas with no X
    // component (Chrome/Safari, typically multiples of 100/120). Trackpad
    // two-finger scroll sends small/fractional pixel deltas, often with
    // non-zero deltaX. ctrlKey is set by the browser for trackpad pinch.
    const isMouseWheel = (e) =>
      e.deltaMode !== 0 ||
      (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40);

    const onWheel = (e) => {
      e.preventDefault();
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if (e.ctrlKey) {
        // trackpad pinch (or explicit ctrl+wheel)
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        // trackpad two-finger scroll — pan
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
    };

    // Safari sends native gesture* events for trackpad pinch with a smooth
    // e.scale; preferring these over the ctrl+wheel fallback gives a much
    // better feel there. No-ops on other browsers. Safari also fires
    // ctrlKey wheel events during the same pinch — isGesturing makes
    // onWheel drop those entirely so they neither zoom nor pan.
    let gsBase = 1;
    let isGesturing = false;
    const onGestureStart = (e) => { e.preventDefault(); isGesturing = true; gsBase = tf.current.scale; };
    const onGestureChange = (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, (gsBase * e.scale) / tf.current.scale);
    };
    const onGestureEnd = (e) => { e.preventDefault(); isGesturing = false; };

    // Drag-pan: middle button anywhere, or primary button starting on the
    // canvas background (not inside an artboard).
    let drag = null;
    const onPointerDown = (e) => {
      const onBg = e.target === vp || e.target === worldRef.current;
      if (!(e.button === 1 || (e.button === 0 && onBg))) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, lx: e.clientX, ly: e.clientY };
      vp.style.cursor = 'grabbing';
    };
    const onPointerMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX; drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = '';
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('gesturestart', onGestureStart, { passive: false });
    vp.addEventListener('gesturechange', onGestureChange, { passive: false });
    vp.addEventListener('gestureend', onGestureEnd, { passive: false });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    return () => {
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('gestureend', onGestureEnd);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, minScale, maxScale]);

  const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(DC.grid)}' stroke-width='1'/%3E%3C/svg%3E")`;
  return (
    <div
      ref={vpRef}
      className="design-canvas"
      style={{
        height: '100vh', width: '100vw',
        background: DC.bg,
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'none',
        position: 'relative',
        fontFamily: DC.font,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        ref={worldRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          transformOrigin: '0 0',
          willChange: 'transform',
          width: 'max-content', minWidth: '100%',
          minHeight: '100%',
          padding: '60px 0 80px',
          backgroundImage: gridSvg,
          backgroundSize: '120px 120px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section — title + subtitle + h-stack of artboards (no wrap)
// ─────────────────────────────────────────────────────────────
function DCSection({ title, subtitle, children, gap = 48, number }) {
  // Parse "Part 3 · S3 Layer 2 · Real-Time Recall  ·  DEMO HERO (60%)"
  // into: eyebrow = "Part 3", kicker = "S3 Layer 2", name = "Real-Time Recall", badge = "DEMO HERO (60%)"
  const parts = (title || '').split('·').map(s => s.trim()).filter(Boolean);
  const eyebrow = parts[0] || '';                              // "Part 3"
  const kicker  = parts.length > 2 ? parts[1] : '';            // "S3 Layer 2"
  const name    = parts.length > 2 ? parts[2] : (parts[1] || ''); // "Real-Time Recall"
  const badge   = parts.length > 3 ? parts.slice(3).join(' · ') : ''; // "DEMO HERO (60%)"

  return (
    <div style={{ marginBottom: 96, position: 'relative' }}>
      <div style={{ padding: '0 60px 40px', maxWidth: 1200 }}>
        {/* eyebrow row: Part N + kicker */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 16,
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <span style={{color: '#0F1B2D', fontWeight: 500}}>{eyebrow}</span>
          {kicker && <>
            <span style={{color: '#D7D0BF'}}>/</span>
            <span style={{color: '#8B93A1'}}>{kicker}</span>
          </>}
          {badge && <>
            <span style={{color: '#D7D0BF'}}>/</span>
            <span style={{
              color: '#0F1B2D',
              background: 'oklch(0.72 0.10 75)',
              padding: '2px 8px',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}>{badge}</span>
          </>}
        </div>

        {/* main title */}
        <div style={{
          fontFamily: '"IBM Plex Serif", Georgia, serif',
          fontSize: 46, fontWeight: 400, color: '#0F1B2D',
          letterSpacing: '-0.015em', lineHeight: 1.05,
          marginBottom: 18,
        }}>{name}</div>

        {/* rule + subtitle */}
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 24, maxWidth: 960}}>
          <div style={{
            width: 56, height: 2, background: '#0F1B2D',
            marginTop: 10, flexShrink: 0,
          }}/>
          {subtitle && (
            <div style={{
              fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
              fontSize: 14.5, fontWeight: 400, color: '#2A313D',
              lineHeight: 1.55, letterSpacing: '0.005em',
            }}>{subtitle}</div>
          )}
        </div>
      </div>
      {/* h-stack — clips offscreen, never wraps */}
      <div style={{
        display: 'flex', gap, padding: '0 60px',
        alignItems: 'flex-start', width: 'max-content',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Artboard — labeled card
// ─────────────────────────────────────────────────────────────
function DCArtboard({ label, children, width, height, style = {} }) {
  // Parse "F-dash · Workbench console · pre-meeting readiness"
  // into:  key="F-dash", rest="Workbench console · pre-meeting readiness"
  let key = '', rest = '';
  if (label) {
    const idx = label.indexOf('·');
    if (idx > -1) {
      key = label.slice(0, idx).trim();
      rest = label.slice(idx + 1).trim();
    } else {
      key = label;
    }
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {label && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0,
          paddingBottom: 10,
          display: 'flex', alignItems: 'baseline', gap: 10,
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontSize: 11, fontWeight: 600, color: '#0F1B2D',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '2px 8px', border: '1px solid #0F1B2D',
            borderRadius: 2, background: '#F4F1EA',
          }}>{key}</span>
          {rest && (
            <span style={{
              fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
              fontSize: 12, fontWeight: 400, color: '#555E6E',
              letterSpacing: '0.01em',
            }}>{rest}</span>
          )}
        </div>
      )}
      <div style={{
        borderRadius: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        width, height,
        background: '#fff',
        ...style,
      }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Post-it — absolute-positioned sticky note
// ─────────────────────────────────────────────────────────────
function DCPostIt({ children, top, left, right, bottom, rotate = -2, width = 180 }) {
  return (
    <div style={{
      position: 'absolute', top, left, right, bottom, width,
      background: DC.postitBg, padding: '14px 16px',
      fontFamily: '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
      fontSize: 14, lineHeight: 1.4, color: DC.postitText,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transform: `rotate(${rotate}deg)`,
      zIndex: 5,
    }}>{children}</div>
  );
}

Object.assign(window, { DesignCanvas, DCSection, DCArtboard, DCPostIt });

