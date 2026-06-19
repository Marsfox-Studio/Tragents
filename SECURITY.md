# Security

Tragents is a local-first BYOK application. The open-source web build does not
run a Tragents-hosted translation backend, but it does send translation content
to whichever model provider the user configures.

## Reporting

Please report security issues privately first.

- Contact the maintainer through X [@AflydreamCat](https://x.com/AflydreamCat)
  or the Telegram channel [@marsfox_offical](https://t.me/marsfox_offical).
- Do not open a public issue with exploit details, API keys, or private data.

## Local Secrets

API keys are encrypted with WebCrypto and stored in IndexedDB. This protects
against casual disk inspection, but it does not protect against malicious code
running in the same browser origin.

Do not commit local folders such as `.codex/`, `.claude/`, `.agents/`, or any
`.env*` files.
