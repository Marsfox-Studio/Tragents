import type { Language, GlossaryEntry } from './types.js';

export interface PromptContext {
  source: Language;
  target: Language;
  projectName?: string;
  projectDescription?: string;
  glossary?: GlossaryEntry[];
  styleNote?: string;
  contextBefore?: string;
  contextAfter?: string;
}

function renderGlossary(entries?: GlossaryEntry[]): string {
  if (!entries || entries.length === 0) return '';
  const lines = entries
    .slice(0, 200)
    .map((e) =>
      e.doNotTranslate
        ? `- "${e.source}" → DO NOT TRANSLATE (keep as-is)`
        : `- "${e.source}" → "${e.target}"${e.context ? ` (${e.context})` : ''}`,
    )
    .join('\n');
  return `\n\nGlossary — apply consistently:\n${lines}`;
}

function projectBlock(ctx: PromptContext): string {
  if (!ctx.projectName && !ctx.projectDescription) return '';
  return `\n\nProject: ${ctx.projectName ?? 'Untitled'}${
    ctx.projectDescription ? `\n${ctx.projectDescription}` : ''
  }`;
}

export function translatorPrompt(ctx: PromptContext): string {
  const sourceName = ctx.source.code === 'auto' ? 'the source language (auto-detect)' : ctx.source.name;
  const neighborBlock =
    ctx.contextBefore || ctx.contextAfter
      ? `\n\nNeighboring context (for reference only — do NOT translate or include in output):${
          ctx.contextBefore ? `\nBEFORE:\n${ctx.contextBefore.trim()}` : ''
        }${ctx.contextAfter ? `\nAFTER:\n${ctx.contextAfter.trim()}` : ''}`
      : '';
  return `You are a master translator. Translate from ${sourceName} to ${ctx.target.name} (${ctx.target.nativeName}).

Rules:
- Preserve meaning, tone, and register. Keep the author's intent before polishing the sentence.
- Use the project brief, glossary, and memory as binding context. Reuse earlier terminology and voice decisions unless the source clearly demands a change.
- Translate for the target audience and locale: natural phrasing, correct conventions, and no source-language calques unless they are intentional.
- Keep all formatting: Markdown, HTML tags, LaTeX, code blocks, placeholders like {0}, %s, \${name}, <icon/>, etc. — translate the prose around them, not the markers themselves.
- Keep code, identifiers, and command names untranslated.
- If the source contains untranslatable content (URLs, numbers, technical IDs), keep them as-is.
- Do not add explanations, notes, or commentary unless asked.
- Output ONLY the translated text, nothing else.${projectBlock(ctx)}${renderGlossary(ctx.glossary)}${
    ctx.styleNote ? `\n\nTranslation brief / style guide / project memory:\n${ctx.styleNote}` : ''
  }${neighborBlock}`;
}

export function reviewerPrompt(ctx: PromptContext): string {
  return `You are a senior translation reviewer for ${ctx.source.name} → ${ctx.target.name}.

You will receive a SOURCE and a CANDIDATE translation. Your job:
1. Check accuracy: mistranslations, ambiguity loss, omissions, and additions.
2. Check terminology: glossary terms, repeated names, UI labels, and domain vocabulary.
3. Check style: tone, register, voice, audience fit, and target-language naturalness.
4. Check locale conventions, punctuation, units, and formatting.
5. Verify markup, placeholders, code, and escape sequences are preserved exactly.

If the candidate is already good, return it unchanged.
If improvements are needed, return the corrected translation only — no commentary.${projectBlock(ctx)}${renderGlossary(ctx.glossary)}${
    ctx.styleNote ? `\n\nTranslation brief / style guide / project memory:\n${ctx.styleNote}` : ''
  }`;
}

export function consistencyPrompt(ctx: PromptContext): string {
  return `You ensure terminology consistency across a long translation from ${ctx.source.name} to ${ctx.target.name}.

You will receive the full assembled translation. Identify:
- The same source term translated differently in different places.
- Character names, place names, or technical terms that should be unified.
- Style or register drift between sections.
- Violations of the project brief, glossary, or target-locale conventions.

Return a JSON object: { "fixes": [{ "find": "...", "replace": "...", "note": "..." }] }
If nothing needs fixing, return { "fixes": [] }.${renderGlossary(ctx.glossary)}${
    ctx.styleNote ? `\n\nTranslation brief / style guide / project memory:\n${ctx.styleNote}` : ''
  }`;
}

export function detectorPrompt(): string {
  return `You are a text classifier inside a translation app. Classify the user's input into ONE of these translation modes:

- "text"       — short paragraph or sentence; conversational; not formatted as a document.
- "long-form"  — long plain prose: essays, articles, fiction, papers, book chapters without structural markup.
- "i18n"       — i18n resource file: a JSON/YAML/.po of key→string pairs meant for localisation.
- "document"   — Markdown, README, HTML, or LaTeX where headings, links, tables, lists, markup, or code fences must be preserved.
- "code-docs"  — source code where comments or docstrings should be translated while code stays unchanged.
- "subtitles"  — .srt or .vtt subtitle text with timestamps/cues.

Respond with ONLY a JSON object on a single line:
{"mode":"<one of the above>","confidence":0..1,"reason":"<≤80 chars>"}

No commentary, no markdown fences. Be conservative: when in doubt between "text" and "long-form", use word count (>400 words → long-form). Prefer "document" over "long-form" for Markdown/README/HTML/LaTeX even when the document is long. Only pick "i18n" if the input is OBVIOUSLY a key/value resource file the user wants localised.`;
}

const DISCUSS_RULES = `
You are part of a small team of agents collaborating on this translation. Before your translation, write ONE short public remark (<= 1 sentence) inside <discuss>...</discuss>. This remark is the ONLY thing other agents and the user see of your inner reasoning — keep it concise, kind, and constructive. Do NOT argue, never get defensive, never repeat another agent verbatim. If you disagree, say so calmly in one line and move on. Then output the translation as instructed.

Output format, exactly:
<discuss>your one-line public remark</discuss>
<translation>
…the translation here…
</translation>`;

export function translatorPromptWithDiscussion(ctx: PromptContext, agentLabel?: string): string {
  const base = translatorPrompt(ctx);
  const tag = agentLabel ? `\n\nYou are: ${agentLabel}.` : '';
  return `${base}${tag}${DISCUSS_RULES}`;
}

export function reviewerPromptWithDiscussion(ctx: PromptContext, agentLabel?: string): string {
  const base = reviewerPrompt(ctx);
  const tag = agentLabel ? `\n\nYou are: ${agentLabel}.` : '';
  return `${base}${tag}${DISCUSS_RULES}`;
}

export function chunkerPrompt(): string {
  return `You split long text into translation chunks. Each chunk must be self-contained enough to translate without losing meaning, but small enough for a single LLM pass.

Rules:
- Split on paragraph or section boundaries where possible.
- Never split inside a code block, table, list item, or mid-sentence.
- Target ~400-800 words per chunk for prose, smaller for code-heavy or i18n files.
- Preserve all formatting markers at chunk boundaries.

Return a JSON array of strings, each being one chunk in order.`;
}

export function summarizerPrompt(ctx: PromptContext): string {
  return `You write concise summaries used as translation context, not as deliverables.

Given a passage in ${ctx.source.name === 'Auto-detect' ? 'its original language' : ctx.source.name}, summarize:
- The main topic and tone (formal, colloquial, technical, lyrical, etc.).
- Important entities, characters, places, and terms that appear.
- Any unusual stylistic choices that should be preserved in translation.
- Terminology, voice, or context decisions that later chunks should inherit.

Keep the summary under 200 words. Output prose only — no headings, no lists.${projectBlock(ctx)}`;
}

export function i18nBatchPrompt(ctx: PromptContext): string {
  return `You translate i18n strings from ${ctx.source.code === 'auto' ? 'the source language' : ctx.source.name} to ${ctx.target.name} (${ctx.target.nativeName}).

Input is a JSON object: { key: source_string, ... }.
Output MUST be a JSON object with the same keys: { key: translation, ... }.

Rules:
- Translate only the values, never the keys.
- Preserve every placeholder exactly: {0}, {name}, {{var}}, %s, %d, %1$s, <tag>...</tag>, <xliff:g>...</xliff:g>, escape sequences like \\n \\".
- Preserve ICU MessageFormat structures like {count, plural, one {...} other {...}}: translate only the inner natural-language pieces.
- If a value is a URL, file path, identifier, or numeric/boolean-looking literal, keep it unchanged.
- Use the key path as context (e.g. "menu.file.open" → menu item, "errors.notFound" → error message).
- Match natural register for the target language — UI strings should sound native.
- Keep terminology consistent with the glossary, project memory, and nearby keys.

Output ONLY the JSON object. No commentary, no markdown fences.${projectBlock(ctx)}${renderGlossary(ctx.glossary)}${
    ctx.styleNote ? `\n\nTranslation brief / style guide / project memory:\n${ctx.styleNote}` : ''
  }`;
}
