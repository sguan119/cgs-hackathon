#!/usr/bin/env node
// One-shot helper: append Phase 4 CSS blocks to app/globals.css.
// Not run by default; kept for re-application after a clean checkout.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET = path.join(ROOT, 'app', 'globals.css');
const MARKER = '/* §4.1 dashboard */';

const CSS = `

${MARKER}
.dashboard-page { max-width: 1320px; }
.dashboard-panel {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 300ms ease-out, transform 300ms ease-out;
  will-change: opacity, transform;
  margin-bottom: 18px;
}
.dashboard-panel[data-visible='1'] { opacity: 1; transform: translateY(0); }
.dashboard-timer-chip {
  position: fixed; top: 46px; right: 24px;
  font-family: var(--mono); font-size: 11px;
  color: var(--gold-ink); letter-spacing: 0.04em;
  z-index: 10; pointer-events: none;
  background: var(--paper); border: 1px solid var(--rule);
  padding: 2px 8px; border-radius: 2px;
}
.dashboard-client-switcher {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 10px 0; margin-bottom: 14px;
  border-bottom: 1px solid var(--rule-2);
}
.dashboard-client-switcher-kicker {
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  letter-spacing: 0.08em; text-transform: uppercase; margin-right: 8px;
}
.dashboard-client-chip {
  font-family: var(--sans); font-size: 12px; color: var(--charcoal);
  background: transparent; border: 1px solid var(--rule);
  padding: 3px 10px; border-radius: 2px;
  display: inline-flex; align-items: center; gap: 6px;
}
.dashboard-client-chip.is-active {
  font-family: var(--serif); font-size: 13px; color: var(--paper);
  background: var(--navy); border-color: var(--navy);
}
.dashboard-client-chip-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--gold); display: inline-block;
}
.dashboard-client-chip-stage {
  font-family: var(--mono); font-size: 9.5px; color: var(--mist); letter-spacing: 0.04em;
}
.dashboard-client-chip.is-active .dashboard-client-chip-stage { color: rgba(244,241,234,0.55); }
.dashboard-client-switcher-add {
  margin-left: auto;
  font-family: var(--mono); font-size: 10.5px; color: var(--slate); letter-spacing: 0.04em;
}
.dashboard-client-tags { margin-top: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dashboard-header-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.dashboard-header-next { color: var(--navy); }
.dashboard-context-banner {
  display: flex; gap: 16px; padding: 10px 16px;
  background: var(--navy); color: var(--paper); border-radius: 2px;
  margin-bottom: 18px; align-items: center;
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.04em;
  opacity: 0; transition: opacity 300ms ease-out;
}
.dashboard-context-banner[data-visible='1'] { opacity: 1; }
.dashboard-context-banner strong { color: #fff; }
.dashboard-context-banner-dot { background: var(--sage); }
.dashboard-context-banner-meta { margin-left: auto; color: var(--gold); }
.dashboard-stage-track { display: flex; align-items: center; margin: 6px 0; padding-bottom: 20px; }
.dashboard-stage-step { display: inline-flex; align-items: center; gap: 10px; flex: 1; position: relative; }
.dashboard-stage-dot {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--paper); border: 1.5px solid var(--rule); flex: 0 0 auto;
}
.dashboard-stage-dot.is-active { background: var(--crimson); border-color: var(--crimson); }
.dashboard-stage-dot.is-past { background: var(--navy); border-color: var(--navy); }
.dashboard-stage-label {
  font-family: var(--mono); font-size: 10px; color: var(--mist);
  letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; white-space: nowrap;
}
.dashboard-stage-label.is-active { color: var(--crimson-ink); font-weight: 600; }
.dashboard-stage-label.is-past { color: var(--navy); }
.dashboard-stage-rule { flex: 1; height: 1.5px; background: var(--rule); min-width: 24px; }
.dashboard-stage-rule.is-past { background: var(--navy); }
.dashboard-grid-2 { display: grid; grid-template-columns: 1.5fr 1fr; gap: 18px; margin-bottom: 18px; }
.dashboard-timeline-body { padding: 0 !important; }
.dashboard-timeline-row {
  display: grid; grid-template-columns: 54px 1fr 110px; gap: 14px;
  padding: 11px 16px; border-top: 1px solid var(--rule-2);
  align-items: center; cursor: pointer; text-align: left;
  background: transparent; border-left: none; border-right: none; border-bottom: none;
  width: 100%; font: inherit; color: inherit;
}
.dashboard-timeline-row:first-child { border-top: none; }
.dashboard-timeline-row:hover { background: rgba(15,27,45,0.03); }
.dashboard-timeline-t {
  font-family: var(--mono); font-size: 10.5px; color: var(--slate);
  display: flex; flex-direction: column; gap: 2px;
}
.dashboard-timeline-badge { font-size: 9px; color: var(--mist); letter-spacing: 0.08em; }
.dashboard-timeline-label {
  font-family: var(--serif); font-size: 13.5px; color: var(--ink);
  font-weight: 500; line-height: 1.35; display: block;
}
.dashboard-timeline-sub {
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  margin-top: 3px; letter-spacing: 0.02em; display: block;
}
.dashboard-timeline-route {
  font-family: var(--mono); font-size: 10px; color: var(--navy);
  text-align: right; white-space: nowrap;
}
.dashboard-alerts-body { padding: 14px; }
.dashboard-alert {
  padding: 10px 14px; background: var(--paper);
  border: 1px solid var(--rule); border-left: 3px solid var(--gold);
  border-radius: 2px; margin-bottom: 8px;
}
.dashboard-alert-high { border-left-color: var(--crimson); }
.dashboard-alert-kicker {
  font-family: var(--mono); font-size: 9.5px; color: var(--gold-ink);
  letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;
}
.dashboard-alert-high .dashboard-alert-kicker { color: var(--crimson-ink); }
.dashboard-alert-text { font-family: var(--serif); font-size: 12.5px; color: var(--ink); line-height: 1.5; }
.dashboard-alert-source {
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  margin-top: 6px; letter-spacing: 0.04em;
}
.dashboard-signals-body { padding: 0 !important; }
.dashboard-signal-row {
  display: grid; grid-template-columns: 60px 1fr 50px; gap: 14px;
  padding: 9px 16px; border-top: 1px solid var(--rule-2); align-items: center;
}
.dashboard-signal-row:first-child { border-top: none; }
.dashboard-signal-t { font-family: var(--mono); font-size: 11px; color: var(--slate); }
.dashboard-signal-headline { font-family: var(--serif); font-size: 13px; color: var(--ink); }
.dashboard-signal-relevance {
  font-family: var(--mono); font-size: 10px; color: var(--sage-ink); text-align: right;
}
.thesis-memory { margin-top: 18px; }
.thesis-memory-toggle { font-family: var(--mono); font-size: 11px; }
.thesis-memory-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.thesis-memory-image {
  width: 100%; max-width: 800px; height: auto; display: block;
  animation: thesis-fade-in 250ms ease-out;
  border: 1px solid var(--rule-2); background: var(--paper);
}
.thesis-memory-caption {
  font-family: var(--mono); font-size: 10.5px; color: var(--slate);
  margin: 0; letter-spacing: 0.04em;
}
@keyframes thesis-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* §4.4 data hub push animation */
.datahub-page { max-width: 1320px; }
.datahub-header-tags { margin-top: 8px; display: flex; gap: 8px; align-items: center; }
.datahub-header-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.datahub-uploads { margin-bottom: 18px; }
.datahub-uploads-body { padding: 0 !important; }
.datahub-upload-row {
  display: grid; grid-template-columns: 1fr 90px 90px 110px;
  padding: 10px 16px; border-top: 1px solid var(--rule-2);
  align-items: center; gap: 12px;
}
.datahub-upload-row:first-child { border-top: none; }
.datahub-upload-name { font-family: var(--serif); font-size: 13px; color: var(--ink); }
.datahub-upload-size, .datahub-upload-rows { font-family: var(--mono); font-size: 10.5px; color: var(--slate); }
.datahub-crm { margin-bottom: 18px; }
.datahub-crm-body { padding: 0 !important; overflow: hidden; }
.datahub-crm-head {
  display: grid; grid-template-columns: 1.4fr 1fr 0.7fr 0.7fr 1.2fr 0.9fr 60px;
  padding: 10px 16px; background: rgba(15,27,45,0.03);
  font-family: var(--mono); font-size: 9.5px; color: var(--slate);
  letter-spacing: 0.08em; text-transform: uppercase;
  border-bottom: 1px solid var(--rule);
}
.datahub-crm-row-group.is-expanded { background: rgba(15,27,45,0.02); }
.datahub-crm-row {
  display: grid; grid-template-columns: 1.4fr 1fr 0.7fr 0.7fr 1.2fr 0.9fr 60px;
  padding: 10px 16px; border-top: 1px solid var(--rule-2);
  align-items: center; gap: 8px; font-size: 12.5px;
}
.datahub-crm-name {
  font-family: var(--serif); color: var(--ink); font-weight: 500;
  display: flex; gap: 6px; align-items: center;
}
.datahub-crm-flag { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--crimson); }
.datahub-crm-mono { font-family: var(--mono); font-size: 11px; color: var(--slate); }
.datahub-crm-stage { font-family: var(--mono); font-size: 10.5px; color: var(--slate); }
.datahub-stage-signal { color: var(--crimson-ink); }
.datahub-stage-retainer { color: var(--sage-ink); }
.datahub-crm-expand {
  font-family: var(--mono); font-size: 10.5px; color: var(--navy);
  text-align: right; cursor: pointer; text-decoration: underline;
}
.datahub-folder {
  padding: 8px 16px 14px 44px;
  border-top: 1px solid var(--rule-2);
  background: rgba(15,27,45,0.02);
}
.datahub-folder-kicker {
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px;
}
.datahub-folder-file {
  display: grid; grid-template-columns: 20px 1fr auto; gap: 10px;
  padding: 5px 0; align-items: baseline; border-top: 1px dotted var(--rule-2);
}
.datahub-folder-file:first-child { border-top: none; }
.datahub-folder-icon {
  font-family: var(--mono); font-size: 12px; color: var(--slate);
  text-align: center; font-weight: 600;
}
.datahub-folder-name { font-family: var(--serif); font-size: 12.5px; color: var(--ink); }
.datahub-folder-meta { font-family: var(--mono); font-size: 10px; color: var(--slate); letter-spacing: 0.02em; }
.distribute-strip {
  display: flex; gap: 24px; align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--rule); border-radius: 2px; background: var(--paper);
  margin-bottom: 18px;
}
.distribute-push { font-family: var(--mono); font-size: 11px; }
.distribute-lights { display: flex; gap: 32px; align-items: center; }
.distribute-lights-cell { display: flex; align-items: center; gap: 10px; position: relative; }
.distribute-light {
  position: relative; width: 12px; height: 12px;
  border-radius: 50%; background: var(--sage);
  opacity: 0.25; flex: 0 0 auto;
}
.distribute-light::after {
  content: ''; position: absolute; inset: -6px;
  border-radius: 50%; border: 2px solid var(--sage); opacity: 0;
}
.distribute-strip[data-state='dim'] .distribute-light { opacity: 0.25; }
.distribute-strip[data-state='active'] .distribute-light {
  animation: distribute-light-on 400ms ease-out forwards;
  animation-delay: calc(var(--idx) * 400ms);
}
.distribute-strip[data-state='active'] .distribute-light::after {
  animation: distribute-glow 600ms ease-out forwards;
  animation-delay: calc(var(--idx) * 400ms);
}
.distribute-label { font-family: var(--mono); font-size: 10.5px; color: var(--slate); letter-spacing: 0.04em; }
.distribute-status {
  margin-left: auto;
  font-family: var(--mono); font-size: 10.5px; color: var(--slate);
  letter-spacing: 0.04em; transition: color 300ms ease-out;
}
.distribute-strip[data-state='active'] .distribute-status { color: var(--sage-ink); }
@keyframes distribute-light-on {
  from { opacity: 0.25; transform: scale(0.8); }
  to   { opacity: 1;    transform: scale(1); }
}
@keyframes distribute-glow {
  0%   { opacity: 0;   transform: scale(0.2); }
  50%  { opacity: 0.6; transform: scale(1.2); }
  100% { opacity: 0;   transform: scale(1); }
}

/* §4.5 meeting split */
.meeting-page.meeting-split {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  padding: 24px; height: calc(100vh - 80px); max-width: none;
}
.meeting-split-pane {
  position: relative; background: var(--navy);
  border: 1px solid var(--rule); border-radius: 2px;
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.meeting-split-right { background: var(--paper); }
.meeting-zoom-video, .meeting-zoom-fallback {
  width: 100%; height: 100%; object-fit: cover; background: var(--navy);
}
.meeting-zoom-fallback {
  display: flex; align-items: center; justify-content: center; gap: 14px;
  color: var(--paper); font-family: var(--mono); font-size: 14px; letter-spacing: 0.14em;
}
.meeting-zoom-fallback .live-dot {
  background: var(--crimson); animation: meeting-pulse 2s ease-in-out infinite;
}
@keyframes meeting-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
.meeting-deck {
  width: 100%; max-width: 680px; aspect-ratio: 16 / 9;
  background: #fff; border: 1px solid var(--rule);
  box-shadow: var(--shadow-md); padding: 36px 40px;
  display: flex; flex-direction: column;
}
.meeting-deck-title {
  font-family: var(--serif); font-size: 22px; color: var(--navy); font-weight: 600;
  border-bottom: 1px solid var(--rule); padding-bottom: 12px; margin-bottom: 18px;
}
.meeting-deck-bullets {
  list-style: disc outside; padding-left: 22px; margin: 0;
  font-family: var(--serif); font-size: 14px; color: var(--ink); line-height: 1.7;
}
.meeting-deck-bullets li { margin-bottom: 8px; }
.meeting-deck-footer {
  margin-top: auto;
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  letter-spacing: 0.1em;
  border-top: 1px solid var(--rule); padding-top: 10px;
}

/* §4.3 continuity E1 / E4 / E5 */
.continuity-e1 { margin-bottom: 14px; }
.continuity-e1-body { padding: 14px 16px; }
.continuity-e1-row {
  display: grid; grid-template-columns: 120px 1fr; gap: 12px;
  padding: 6px 0; border-top: 1px dotted var(--rule-2); font-size: 12.5px;
}
.continuity-e1-row:first-child { border-top: none; }
.continuity-e1-kicker {
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  letter-spacing: 0.08em; text-transform: uppercase;
}
.continuity-e1-value { font-family: var(--serif); color: var(--ink); }
.continuity-e1-summary {
  margin: 14px 0 0; padding-top: 10px; border-top: 1px solid var(--rule);
  font-family: var(--serif); font-size: 12.5px; color: var(--charcoal); line-height: 1.55;
}
.continuity-e4-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.continuity-e4-card { margin-bottom: 0; }
.continuity-e4-body { padding: 14px 16px; }
.continuity-e4-quote {
  background: rgba(15,27,45,0.03); border: 1px solid var(--rule-2);
  padding: 10px 12px;
  font-family: var(--serif); font-size: 12px; color: var(--ink);
  white-space: pre-wrap; margin: 0 0 12px;
}
.continuity-e4-kicker {
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  letter-spacing: 0.08em; text-transform: uppercase;
  margin-top: 8px; margin-bottom: 4px;
}
.continuity-e4-shifts {
  list-style: none; padding: 0; margin: 0 0 6px;
  display: flex; flex-wrap: wrap; gap: 10px;
  font-family: var(--mono); font-size: 11px; color: var(--charcoal);
}
.continuity-e4-arrow { margin-right: 4px; }
.continuity-e4-arrow.dir-up { color: var(--sage-ink); }
.continuity-e4-arrow.dir-down { color: var(--crimson-ink); }
.continuity-e4-arrow.dir-flat { color: var(--slate); }
.continuity-e4-inertia, .continuity-e4-coupling {
  font-family: var(--serif); font-size: 12px; color: var(--ink);
}
.continuity-e4-friction { margin-top: 8px; }
.continuity-e5-grid { display: flex; flex-direction: column; gap: 14px; }
.continuity-e5-body { padding: 14px 16px; }
.continuity-e5-diff { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px; }
.continuity-e5-diff-col {
  background: rgba(15,27,45,0.03); border: 1px solid var(--rule-2); padding: 10px 12px;
}
.continuity-e5-kicker {
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px;
}
.continuity-e5-value {
  font-family: var(--serif); font-size: 12.5px; color: var(--ink); line-height: 1.5;
}
.continuity-e5-actions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.continuity-e5-action-btn {
  width: 100%; text-align: left; display: flex; flex-direction: column; gap: 4px;
  padding: 10px 12px; background: var(--paper);
  border: 1px solid var(--rule); border-radius: 2px;
  cursor: pointer; font: inherit; color: inherit;
}
.continuity-e5-action.is-selected .continuity-e5-action-btn {
  border-color: var(--navy); background: rgba(15,27,45,0.05);
}
.continuity-e5-action-title {
  font-family: var(--serif); font-size: 13px; color: var(--ink); font-weight: 500;
}
.continuity-e5-action-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.continuity-e5-action-why {
  font-family: var(--serif); font-size: 11.5px; color: var(--slate); line-height: 1.5;
}
.continuity-e5-empty {
  padding: 16px; background: var(--paper); border: 1px dashed var(--rule);
  font-family: var(--mono); font-size: 11px; color: var(--slate); letter-spacing: 0.04em;
}

/* §4.2 diagnostic wheel reveal + F1-F5 */
.diagnostic-wheel-sector-reveal {
  transition: fill 400ms ease-out;
  transition-delay: calc(var(--seq-idx, 0) * 400ms);
}
.diagnostic-f4-list, .diagnostic-f5-list {
  list-style: none; padding: 0; margin: 12px 0 0;
  display: flex; flex-direction: column; gap: 10px;
}
.diagnostic-f4-card, .diagnostic-f5-card {
  padding: 10px 14px; border: 1px solid var(--rule); border-radius: 2px;
  background: var(--paper);
}
.diagnostic-f4-title, .diagnostic-f5-title {
  font-family: var(--serif); font-size: 13px; color: var(--ink); font-weight: 500;
}
.diagnostic-f4-meta, .diagnostic-f5-meta {
  font-family: var(--mono); font-size: 10px; color: var(--slate);
  letter-spacing: 0.04em; margin-top: 4px;
}
.diagnostic-f4-body, .diagnostic-f5-body {
  font-family: var(--serif); font-size: 12.5px; color: var(--charcoal);
  line-height: 1.5; margin-top: 6px;
}
`;

const prior = fs.readFileSync(TARGET, 'utf8');
if (prior.includes(MARKER)) {
  console.log('Phase 4 CSS already present; skipping.');
  process.exit(0);
}
fs.writeFileSync(TARGET, prior + CSS);
console.log('Phase 4 CSS appended.');
