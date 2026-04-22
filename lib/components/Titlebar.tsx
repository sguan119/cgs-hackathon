'use client';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function todayLabel(): string {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function Titlebar() {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="traffic">
        <span className="c" />
        <span className="m" />
        <span className="x" />
      </div>
      <div className="title">
        CGS Workbench <span className="dot">·</span> Acme Industrial{' '}
        <span className="dot">·</span>
        <span style={{ color: '#555E6E' }}>cgs-advisors.local</span>
      </div>
      <div className="right">Acme · M2 · {todayLabel()}</div>
    </div>
  );
}
