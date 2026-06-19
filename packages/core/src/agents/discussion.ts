// Discussion-output parser
//
// Models emit:
//   <discuss>…short public remark…</discuss>
//   <translation>
//   …translation body…
//   </translation>
//
// We capture the remark exactly once, stream the translation body so the
// UI keeps its typewriter effect, and tolerate models that ignore the
// wrappers (treat the raw text as the translation).

export interface DiscussionParserOptions {
  onRemark: (remark: string) => void;
  onTranslationDelta?: (delta: string) => void;
}

export interface DiscussionParser {
  push(text: string): void;
  end(): void;
  translation(): string;
}

export function createDiscussionParser(opts: DiscussionParserOptions): DiscussionParser {
  let buffer = '';
  let remarkFired = false;
  let translationStarted = false;
  let translationBody = '';
  let sawAnyTag = false;

  function tryEmitRemark() {
    if (remarkFired) return;
    const start = buffer.indexOf('<discuss>');
    if (start < 0) return;
    const end = buffer.indexOf('</discuss>', start + 9);
    if (end < 0) return;
    const remark = buffer.slice(start + 9, end).trim();
    sawAnyTag = true;
    remarkFired = true;
    if (remark) opts.onRemark(remark);
    buffer = buffer.slice(end + 10);
  }

  function tryStreamTranslation() {
    if (!translationStarted) {
      const open = buffer.indexOf('<translation>');
      if (open < 0) return;
      sawAnyTag = true;
      translationStarted = true;
      buffer = buffer.slice(open + 13);
    }
    if (translationStarted) {
      const close = buffer.indexOf('</translation>');
      if (close >= 0) {
        const piece = buffer.slice(0, close);
        if (piece) {
          translationBody += piece;
          opts.onTranslationDelta?.(piece);
        }
        buffer = buffer.slice(close + 14);
        translationStarted = false;
      } else {
        // Hold a small tail in case a closing tag is split across deltas.
        const safe = buffer.length - 14;
        if (safe > 0) {
          const piece = buffer.slice(0, safe);
          translationBody += piece;
          opts.onTranslationDelta?.(piece);
          buffer = buffer.slice(safe);
        }
      }
    }
  }

  return {
    push(text) {
      buffer += text;
      tryEmitRemark();
      tryStreamTranslation();
    },
    end() {
      tryEmitRemark();
      tryStreamTranslation();
      if (!sawAnyTag) {
        if (buffer) {
          translationBody += buffer;
          opts.onTranslationDelta?.(buffer);
        }
        buffer = '';
      } else if (translationStarted) {
        if (buffer) {
          translationBody += buffer;
          opts.onTranslationDelta?.(buffer);
        }
        buffer = '';
      }
    },
    translation() {
      return translationBody;
    },
  };
}
