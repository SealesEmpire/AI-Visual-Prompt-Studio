# AI Visual Prompt Studio

A responsive workspace for developing visual prompts and browsing image and video presets. Generation, AI analysis, projects, and external storage are intentionally shown as unconfigured until real integrations are connected.

## Preview the application

Requires Node.js 20.9 or later.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use the bottom navigation on mobile or the sidebar on desktop.

## Current application

- **Create:** browser-local image/video previews, prompt editing and saving, image/video selection, preset selection, and Simple/Pro modes.
- **Preset manager:** searches and filters the existing registry, separates image/video presets, displays explicit variants, and stores favorites/recents in browser storage.
- **Library:** lists prompts saved in this browser. Project database and generated asset storage are not connected.
- **Generation API:** validates prompt requests and preset IDs server-side. Since no provider is registered, generation returns `GENERATION PROVIDER NOT CONFIGURED`; no output is simulated.
- **Integrations:** provider, project persistence, AI analysis, backend model discovery, and My Basket storage are interfaces/placeholders only.

## Preset registry

`lib/presets/registry.ts` remains the single source for the supplied 67 image and 59 video identifiers. It includes media and compatibility filtering, case-insensitive search, favorite/recent state helpers, conservative availability resolution, and versioned JSON import/export.

Catalog entries contain identifiers only where no verified backend metadata is available. Catalog registration does not imply installation. Favorites, recents, and saved prompts currently use this browser's local storage; user accounts and cross-device persistence are not configured. JSON export includes only preset configuration fields, never provider credentials.

## Validation

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit`.
