/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  // Inline non-NEXT_PUBLIC_ env at build time so the static bundle can
  // read them via `process.env.*` inside client code. The demo runs as a
  // single-host Tauri install; do not reuse this pattern for web deploys.
  // When `.env.local` is absent at build time, these resolve to `undefined`
  // and the preflight page surfaces "missing env var" — that is the
  // intended UX, not a failure mode.
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_EMBED_MODEL: process.env.OPENAI_EMBED_MODEL,
    // Phase 2A e2e stub gate. When '1' the recall panel skips real embed /
    // Claude / OpenAI calls and renders canned autocomplete data. Default
    // unset — production builds behave normally.
    NEXT_PUBLIC_USE_STUB_CHAIN: process.env.NEXT_PUBLIC_USE_STUB_CHAIN,
  },
};

module.exports = nextConfig;
