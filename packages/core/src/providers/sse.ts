// Minimal SSE parser for streaming responses.
// Iterates `data: ...` lines from a fetch response body and yields parsed JSON
// (or the raw string for non-JSON lines like `[DONE]`).

export async function* parseSSE(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<{ event?: string; data: string }> {
  if (!response.body) throw new Error('Response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent: string | undefined;

  const abortHandler = () => reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', abortHandler);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let lineEnd: number;
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEnd).replace(/\r$/, '');
        buffer = buffer.slice(lineEnd + 1);

        if (line === '') {
          currentEvent = undefined;
          continue;
        }
        if (line.startsWith(':')) continue; // comment

        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          yield currentEvent ? { event: currentEvent, data } : { data };
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', abortHandler);
    reader.releaseLock();
  }
}
