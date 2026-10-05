# AI Visual Prompt Studio

A responsive workspace for developing visual prompts and browsing image and video presets. Optional server-side AI providers, PostgreSQL persistence, OAuth authentication, and S3-compatible asset storage are supported; without credentials, the application fails closed and does not simulate generation.

## Preview the application

Requires Node.js 20.9 or later.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the bottom navigation on mobile or the sidebar on desktop.

## Integrations

Copy `.env.example` to `.env.local` and configure only the integrations you intend to use. Persistent user data and generation require PostgreSQL and an OAuth provider; private generated assets require S3-compatible storage. Keep all credentials server-side.

Apply the schema with `npm run db:migrate`; it checks PostgreSQL connectivity, refuses to apply the initial migration over untracked existing application tables, records migration versions, and verifies ownership fields, indexes, foreign keys, and queue columns. Inspect migration state using `npm run db:migration-status`.

- **Authentication:** configure `NEXTAUTH_SECRET` and either a complete Google or GitHub OAuth client pair.
- **AI analysis and prompts:** configure `OPENAI_API_KEY`, `OPENAI_ANALYSIS_MODEL`, and `OPENAI_PROMPT_MODEL`. Image analysis is supported; video analysis is not.
- **Image generation:** configure `OPENAI_IMAGE_MODEL` and all S3 variables. The adapter checks configured models with the provider and persists returned image bytes.
- **RunPod video:** configure the API key, endpoint ID, input-template JSON, capability JSON, and exact allowed output hostnames. Capabilities are operator-declared and must reflect the real endpoint. The optional `RUNPOD_INSTALLED_PRESET_IDS_JSON` allowlist must be verified against the installed backend; preset use is rejected when installation is unknown. The endpoint is health-checked before reporting availability.
- **Generation worker:** run `npm run worker` in a separate process with `GENERATION_WORKER_URL` and `GENERATION_WORKER_SECRET`. Queued work persists in PostgreSQL; stale ambiguous submissions fail closed rather than being automatically duplicated.
- Install `ffprobe` on the generation server/worker to verify generated image dimensions and video container duration before storing assets; generation fails closed if it is unavailable.
- **Security:** `ENCRYPTION_KEY` is reserved for external-storage connection credentials and must be 32 bytes encoded as 64 hex characters.

Provider, auth, database, and storage credentials are not supplied by this repository. Do not consider an integration operational until it has been configured and exercised.

## Current application

- **Create:** private project source-media upload, prompt editing, image analysis, preset selection, Simple/Pro modes, persisted job history, progress, cancellation, retry, and settings reuse when required services are configured.
- **Preset manager:** searches and filters the existing registry, separates image/video presets, displays explicit variants, and stores favorites/recents in browser storage.
- **Library and projects:** account-backed persistence requires PostgreSQL and OAuth; browser prompt saving remains available as a fallback.
- **Generation API:** validates requests, records owner-scoped jobs, and dispatches only to configured providers. Unsupported video analysis, unowned references, and unavailable capabilities fail explicitly; no output is simulated.
- **Assets:** generated assets are stored in private S3-compatible storage and delivered via short-lived signed URLs after ownership checks. My Basket is not connected.
- **Preset availability:** remains unknown unless the provider reports installation. The static catalog metadata is not treated as proof of availability.

## Preset registry

`lib/presets/registry.ts` remains the single source for the supplied 67 image and 59 video identifiers. It includes media and compatibility filtering, case-insensitive search, favorite/recent state helpers, conservative availability resolution, and versioned JSON import/export.

Catalog entries contain identifiers only where no verified backend metadata is available. Catalog registration does not imply installation. JSON export includes only preset configuration fields, never provider credentials.

## Validation

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit`.
