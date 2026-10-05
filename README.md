# AI-Visual-Prompt-Studio
Multimodal AI application for image/video analysis, prompt building, image generation, video generation, long-form scene generation, LoRA preset management, and direct asset delivery.

## Preset registry

`lib/presets/registry.ts` provides a provider-agnostic registry core and the supplied image/video preset identifiers. It includes media and compatibility filtering, case-insensitive search, favorite/recent state helpers, availability resolution, and versioned JSON import/export.

Catalog entries contain identifiers only where no verified backend metadata is available. Consumers must use backend discovery and provider configuration to resolve availability; catalog registration does not imply installation. Favorite/recent state is returned as data for the host application to persist per user. JSON export includes only preset configuration fields, never provider credentials.

Run the focused checks with:

```sh
node --experimental-strip-types --test tests/presets/registry.test.mjs
```
