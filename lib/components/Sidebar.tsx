'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type ActiveId =
  | 'dashboard'
  | 'datahub'
  | 'diagnostic'
  | 'continuity'
  | 'meeting'
  | 'preread'
  | 'realtime'
  | 'post'
  | null;

// TODO: Phase 2+ — read `current_client` from lib/store and thread through
// `<SubNav>` when active === 'meeting' to reveal preread / realtime / post
// sub-items. Phase 1 hardcodes "Acme Industrial" in the titlebar and never
// enters those sub-routes.

function deriveActive(pathname: string | null): ActiveId {
  if (!pathname) return null;
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/datahub')) return 'datahub';
  if (pathname.startsWith('/diagnostic')) return 'diagnostic';
  if (pathname.startsWith('/continuity')) return 'continuity';
  if (pathname.startsWith('/meeting')) return 'meeting';
  return null;
}

export function Sidebar() {
  const pathname = usePathname();
  const active = deriveActive(pathname);

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="mark">
          <span className="glyph" />
          CGS Workbench
        </div>
        <div className="sub">Agentic AI · v0.4</div>
      </div>

      <div className="nav-section">
        <div className="label">Workspace</div>
        <Link href="/dashboard/" className={'nav-item ' + (active === 'dashboard' ? 'active' : '')}>
          <span className="num">§5</span>
          Dashboard
          <span className="sub-label">14</span>
        </Link>
        <Link href="/datahub/" className={'nav-item ' + (active === 'datahub' ? 'active' : '')}>
          <span className="num">§7</span>
          Data Hub
          <span className="sub-label">3</span>
        </Link>
      </div>

      <div className="nav-section">
        <div className="label">Active engagement · Acme Industrial</div>
        <Link
          href="/diagnostic/"
          className={'nav-item ' + (active === 'diagnostic' ? 'active' : '')}
        >
          <span className="num">§2</span>
          Diagnostic Agent
        </Link>
        <Link href="/meeting/" className={'nav-item ' + (active === 'meeting' ? 'active' : '')}>
          <span className="num">§3</span>
          Meeting Recall
        </Link>
        <Link
          href="/continuity/"
          className={'nav-item ' + (active === 'continuity' ? 'active' : '')}
        >
          <span className="num">§6</span>
          Continuity Agent
        </Link>
      </div>

      <div
        style={{
          margin: '8px 12px 12px',
          padding: '10px 12px',
          border: '1px dashed var(--rule)',
          borderRadius: 3,
          background: 'rgba(15,27,45,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--navy)',
              padding: '1px 5px',
              border: '1px solid var(--navy)',
              borderRadius: 2,
              letterSpacing: '0.04em',
            }}
          >
            ⌘K
          </span>
          <span
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 11.5,
              color: 'var(--navy)',
              fontWeight: 500,
            }}
          >
            Ask recall
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 9.5,
            color: 'var(--slate)',
            lineHeight: 1.5,
            letterSpacing: '0.02em',
          }}
        >
          Summon from any app · stays
          <br />
          on top · client-invisible
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="row">
          <span>Fellow</span>
          <span className="val">D. Park</span>
        </div>
        <div className="row">
          <span>Corpus</span>
          <span className="val">1.07 TB · synced</span>
        </div>
        <div className="row">
          <span>Mode</span>
          <span className="val">Pre-RFP</span>
        </div>
      </div>
    </div>
  );
}
