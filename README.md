# Fintech Pre-Deployment Compliance Checklist Generator

> **Agent-generated prototype.** Built automatically by a daily-product agent on 2026-10-07. Not reviewed line-by-line; read the code before relying on it.

A web app for fintech founders to describe an AI fraud/credit/AML system (use case, data types, region) and instantly get a tailored compliance checklist covering privacy, governance, explainability, bias, security, regulatory reporting, vendor risk and consumer redress. It also lets users paste or upload a sample CSV to compute a class-imbalance check on the label column, flagging risk from low to critical.

## Features
- Form-driven checklist generator covering 7 regions (India, Nigeria, Kenya, Indonesia, Brazil, Philippines, Other), 4 use cases and 6 data types
- Deterministic rules engine merges base + use-case + data-type + region specific checklist items with severity tags
- Rules-based narrative summary of the checklist via ai-provider.js (defaults to AI_PROVIDER=rules, no network/API key needed)
- CSV class-imbalance analyzer: auto-detects label column, computes class counts, imbalance ratio and risk level with warnings
- History of generated checklist runs stored in a local JSON file, viewable and re-loadable from the UI
- Sample demo CSV bundled in fixtures/ and loadable from the UI with one click

## Run
```bash
npm install
npm start        # http://localhost:3000 (PORT to change). Mock mode when no credentials are set.
npm run lint
npm test         # smoke test
```

## Configuration
| Variable | Purpose |
|---|---|
| `PORT` | HTTP port for the server (default 3000) |
| `DB_FILE` | Path to the JSON data file used for storing checklist runs (default ./db.json) |
| `MOCK_MODE` | Set to 1 to force mock mode (no external calls); default behavior with no keys |
| `AI_PROVIDER` | Which AI backend to use: rules|anthropic|openai|ollama (default rules) |
| `ANTHROPIC_API_KEY` | API key for Anthropic Claude, only used if AI_PROVIDER=anthropic |
| `OPENAI_API_KEY` | API key for OpenAI, only used if AI_PROVIDER=openai |
| `OLLAMA_HOST` | Base URL for a local Ollama server, only used if AI_PROVIDER=ollama |
| `OLLAMA_MODEL` | Model name to request from Ollama, only used if AI_PROVIDER=ollama |

Copy `.env.example` to `.env` and fill in only what you need. With nothing set the app runs in mock mode.

Choices made for this build: auth=`none`, AI provider default=`rules` (auto-falls back to rules), data store=`json`, deploy=`github-only`.

## What was tested
- Syntax lint of all JS files and a smoke test that starts the server in **mock mode with no credentials** and checks these routes return the expected status: `GET /health`, `GET /`, `GET /api/meta`, `GET /api/history`, `POST /api/checklist`, `POST /api/csv-check`.
- Mock behavior: The app has no required external services. MOCK_MODE=1 (or missing AI provider keys) is the default and uses the built-in rules function in ai-provider.js to generate the checklist narrative, and a local db.json (or configured DB_FILE) for storage — fully usable with zero credentials and no network.

## Not tested
- Anything outside mock mode: the automated checks ran with no credentials and no live services.
- Remote AI providers (anthropic / openai / ollama) via `ai-provider.js`: not exercised, only the `rules` fallback was.
- Security hardening, load, and browser UI beyond HTTP status checks.

## Limitations
- Checklist content is a static rules-based mapping, not legal advice and not verified against current regulator texts
- CSV parser is a minimal hand-written parser (no quoted-comma edge-case guarantees, no streaming for huge files)
- No authentication; anyone with access to the server can view/create all runs
- No real regulatory database integration; region rules are illustrative, hand-curated summaries only
- Remote AI providers (Anthropic/OpenAI/Ollama) are wired through ai-provider.js but untested in this build; only the rules path is exercised

## Origin
Idea: There's no lightweight way to check an AI fraud/credit model against regional regulatory and data-risk factors before launch.
Why now: Recent papers propose a context-aware pre-deployment regulatory framework for Nigerian fintech and flag phishing and class-imbalance risks specific to that context.
Signals:
- http://arxiv.org/abs/2609.24016v1
- http://arxiv.org/abs/2609.28305v1
- http://arxiv.org/abs/2610.05825v1
