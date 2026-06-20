<p align="center">
  <img src="./apps/web/static/logo.png" width="132" alt="Tragents logo" />
</p>

<h1 align="center">Tragents</h1>

<p align="center">
  A local-first translation workbench for long text, product copy, i18n files, code comments, and subtitles.
</p>

<p align="center">
  <a href="./README_CN.md">中文</a>
  ·
  <a href="#run-locally">Run locally</a>
  ·
  <a href="#translation-modes">Modes</a>
  ·
  <a href="#community">Community</a>
</p>

<p align="center">
  <img alt="build" src="https://img.shields.io/github/actions/workflow/status/Marsfox-Studio/Tragents/ci.yml?branch=main&label=build&style=for-the-badge" />
  <img alt="release" src="https://img.shields.io/badge/release-v0.10.1-2f6fed?style=for-the-badge" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-111111?style=for-the-badge" />
  <img alt="svelte" src="https://img.shields.io/badge/Svelte-5.x-ff3e00?style=for-the-badge" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-11.x-f69220?style=for-the-badge" />
</p>

<p align="center">
  <video src="./packages/resources/demo.mp4" controls width="860"></video>
</p>

<p align="center">
  <a href="./packages/resources/demo.mp4">Watch the demo video</a>
</p>

---

Tragents is built for translation work where structure matters.

A sentence can go through one model and be done. A game locale file, a subtitle
track, a README, a chapter draft, or a repository full of comments needs more
care: chunking, review passes, placeholder checks, format-aware write-back,
glossary discipline, and a record of what happened. Tragents puts those steps
into a browser app you can run with your own keys.

The open-source web build has no hosted Tragents backend. Providers, projects,
glossaries, checkpoints, active tasks, and activity history live in the browser.

## What It Does

- Runs translation through configurable pipelines: translator, reviewer,
  consistency, and optional summarizer roles.
- Handles long-form text with chunking, context summaries, parallel chunk work,
  and provider-level concurrency limits.
- Translates structured formats without flattening everything into plain text.
- Carries project-level preferences into each run: tone, audience, scenario,
  constraints, glossary, and lightweight project memory.
- Preserves local project state with IndexedDB, including active tasks and
  activity logs.
- Exports and imports local backups, and can sync the same backup to your own
  private GitHub repository.
- Uses bring-your-own-key providers: Anthropic, OpenAI, and OpenAI-compatible
  endpoints.

## Translation Modes

| Mode | Intended input | What Tragents protects |
| --- | --- | --- |
| `text` | Short text, messages, UI copy | direct pipeline output |
| `long-form` | Books, papers, articles, drafts | chunk order, context, consistency |
| `document` | Markdown, HTML, LaTeX | document structure and markup |
| `i18n` | JSON, YAML, `.po`, Android XML, iOS `.strings`, `.properties`, Fluent | keys, placeholders, write-back shape |
| `code-docs` | TS/JS, Python, Go, Rust comments and docstrings | source code outside comments |
| `subtitles` | `.srt`, `.vtt` | cue numbers and timestamps |
| `ptp` | paragraph-by-paragraph project work | rows, checkpoints, per-row status |

## Pipeline Model

```text
detect or parse -> translate -> review -> consistency -> assemble
```

Each role can use a different provider and model. A fast setup can be one
translator. A careful setup can add reviewers, a summarizer for long input, and
a final consistency pass. Modes can have their own default pipeline, and a
single run can override it from the input area.

Provider support is intentionally simple:

- Anthropic
- OpenAI
- OpenAI-compatible endpoints, including local servers and hosted compatible APIs

Model IDs stay editable because compatible providers do not share one model
catalog.

## Local Data Boundary

Tragents does not send your project data to a Tragents server.

- API keys are encrypted with WebCrypto and stored in IndexedDB.
- Projects, glossaries, checkpoints, tasks, sessions, activity logs, and project
  memories are stored locally.
- Backup exports include workspace data but deliberately omit provider keys and
  GitHub tokens.
- Optional GitHub backup uses the GitHub Contents API from your browser. The
  token is encrypted locally and is never written into the backup JSON.
- Running tasks are reconciled after reload so stale streams do not look alive.
- The web app still sends translation content to the provider you choose.

## Run Locally

Requirements:

- Node.js 22.13+ (Node 24 recommended)
- pnpm 11+

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>.

Production build:

```bash
pnpm build
pnpm preview
```

Static output is written to `apps/web/build/`.

## Repository Layout

```text
apps/web/         SvelteKit app, routes, stores, IndexedDB, WebCrypto
packages/core/    providers, agents, parsers, modes, orchestrator
packages/shared/  shared types, prompts, constants
packages/ui/      theme tokens and small shared UI pieces
scripts/          project maintenance scripts
```

## Roadmap

| Version | Focus |
| --- | --- |
| v0.10 | Personalization, project memory, local backup, GitHub private-repo backup |
| v0.11 | Desktop shell, native file dialogs, OS keychain storage |
| v0.12 | VS Code workflow for i18n files and code comments |

Hosted API work is planned separately from the open-source BYOK build.

## Community

- linux.do: <https://linux.do/>
- X: [@AflydreamCat](https://x.com/AflydreamCat)
- Telegram channel: [@marsfox_offical](https://t.me/marsfox_offical)

## Star History

<a href="https://www.star-history.com/?repos=Marsfox-Studio%2FTragents&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Marsfox-Studio/Tragents&type=date&theme=dark&legend=bottom-right" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Marsfox-Studio/Tragents&type=date&legend=bottom-right" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Marsfox-Studio/Tragents&type=date&legend=bottom-right" />
 </picture>
</a>

## License

MIT. See [LICENSE](./LICENSE).
