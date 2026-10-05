import assert from "node:assert/strict";
import { test } from "node:test";
import {
  exportRegistry,
  filterPresets,
  importRegistry,
  presetCatalog,
  resolveAvailability,
  searchPresets,
  updatePresetState,
} from "../../lib/presets/registry.ts";

test("registers the supplied identifiers and explicit video variants", () => {
  const ids = new Set(presetCatalog.map(({ id }) => id));
  assert.equal(ids.size, presetCatalog.length);
  assert.ok(ids.has("None"));
  assert.ok(ids.has("Qwen_NSFW_Betal"));
  assert.ok(ids.has("mql_casting_sex_doggy_kneel_diagona lly_behind_vagina_wan22_i2v_v1"));
  assert.ok(ids.has("mql_casting_sex_reverse_cowgirl_lie_fr ont_vagina_wan22_i2v_v1"));
  assert.ok(ids.has("wan2.2_i2v_low_ulitmate_pussy_asshol e"));
  assert.equal(presetCatalog.filter(({ mediaType }) => mediaType === "image").length, 67);
  assert.equal(presetCatalog.filter(({ mediaType }) => mediaType === "video").length, 59);
  assert.equal(presetCatalog.find(({ id }) => id === "JFJ Deepthroat").variant, "high");
  assert.equal(presetCatalog.find(({ id }) => id === "sid3l3g_transition_v2.0_L").variant, "low");
  assert.ok(presetCatalog.filter(({ mediaType }) => mediaType === "image").length > 0);
  assert.ok(presetCatalog.filter(({ mediaType }) => mediaType === "video").length > 0);
});

test("search is case-insensitive and filters by media and known compatibility", () => {
  assert.deepEqual(
    searchPresets(presetCatalog, "qWeN beta"),
    [presetCatalog.find(({ id }) => id === "Qwen_NSFW_Betal"),
      presetCatalog.find(({ id }) => id === "Qwen_NSFW_Beta2"),
      presetCatalog.find(({ id }) => id === "Qwen_NSFW_Beta4"),
      presetCatalog.find(({ id }) => id === "Qwen_NSFW_Beta5")],
  );
  assert.ok(filterPresets(presetCatalog, "image").every(({ mediaType }) => mediaType === "image"));
  const compatible = {
    id: "configured",
    displayName: "Configured",
    mediaType: "image",
    source: "existing",
    compatibleModels: ["model-a"],
    enabled: true,
  };
  assert.deepEqual(filterPresets([compatible], "image", ["model-b"]), []);
  assert.deepEqual(filterPresets([compatible], "image", ["MODEL-A"]), [compatible]);
  assert.deepEqual(filterPresets([presetCatalog[1]], "image", ["model-a"]), []);
});

test("availability remains checking until discovery confirms installation", () => {
  const preset = presetCatalog.find(({ id }) => id === "CockQwen_v3");
  assert.equal(resolveAvailability(preset, {}), "checking");
  assert.equal(resolveAvailability(preset, { providerConfigured: false }), "not_configured");
  assert.equal(
    resolveAvailability(preset, {
      providerConfigured: true,
      discoveryComplete: true,
      installedPresetIds: [],
    }),
    "not_installed",
  );
  assert.equal(
    resolveAvailability(preset, {
      providerConfigured: true,
      discoveryComplete: true,
      installedPresetIds: ["CockQwen_v3"],
    }),
    "available",
  );
});

test("tracks favorites and recents and exports only approved registry fields", () => {
  const favoriteState = updatePresetState({ favorites: [], recent: [] }, "CockQwen_v3", "favorite");
  const recentState = updatePresetState(favoriteState, "CockQwen_v3", "use");
  assert.deepEqual(recentState, { favorites: ["CockQwen_v3"], recent: ["CockQwen_v3"] });

  const exported = exportRegistry([{
    ...presetCatalog[1],
    providerId: "provider-a",
    apiKey: "must-not-export",
  }]);
  assert.equal(JSON.stringify(importRegistry(exported)).includes("apiKey"), false);
  assert.equal(JSON.stringify(importRegistry(exported)).includes("must-not-export"), false);
  assert.throws(
    () => importRegistry('{"registryVersion":1,"presets":[{"id":"x","displayName":"x","mediaType":"image","source":"existing","enabled":true,"apiKey":"secret"}]}'),
    /unsupported fields/,
  );
  assert.throws(
    () => importRegistry('{"registryVersion":1,"presets":[{"id":"x","displayName":"x","mediaType":"image","source":"existing","enabled":true,"minStrength":2,"maxStrength":1}]}'),
    /strength bounds/,
  );
});
