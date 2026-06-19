// SPA mode — all rendering happens in the browser. We hit LLM APIs and
// IndexedDB directly client-side; there is no server.
export const ssr = false;
export const prerender = true;
