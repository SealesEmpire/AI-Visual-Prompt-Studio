export type PresetMediaType = "image" | "video" | "both";
export type PresetSource = "existing" | "image_catalog" | "video_catalog";
export type PresetVariant = "high" | "low" | "standard";
export type PresetCategory =
  | "content"
  | "style"
  | "camera"
  | "motion"
  | "utility"
  | "other";
export type PresetAvailability =
  | "available"
  | "not_installed"
  | "not_configured"
  | "incompatible"
  | "disabled"
  | "checking";

export interface GenerationPreset {
  id: string;
  displayName: string;
  mediaType: PresetMediaType;
  source: PresetSource;
  category?: PresetCategory;
  variant?: PresetVariant;
  providerId?: string;
  modelPath?: string;
  baseModel?: string;
  triggerWords?: string[];
  defaultStrength?: number;
  minStrength?: number;
  maxStrength?: number;
  compatibleModels?: string[];
  tags?: string[];
  enabled: boolean;
}

export interface PresetState {
  favorites: string[];
  recent: string[];
}

export interface AvailabilityContext {
  providerConfigured?: boolean;
  discoveryComplete?: boolean;
  installedPresetIds?: string[];
  modelId?: string;
  disabled?: boolean;
}

const imagePresetIds = [
  "None",
  "CockQwen_v3",
  "Eva_Qwen_V3",
  "Facial_Cumshots_V1",
  "HearmemanAl_V3_Breasts",
  "HearmemanAl_V4_Breasts",
  "Innie Pussy",
  "JTT2_5",
  "LumiNude Ola",
  "MEXX_QWEN_TG300",
  "Meta4",
  "MysticXXX",
  "Nsfw_Body_V10",
  "Nsfw_Body_V14",
  "OilySkin_V2",
  "PillowHump_2509",
  "PutItHere_V01",
  "PutItHere_V2",
  "Qwen4Play_v2",
  "QwenHentai_v3",
  "QwenSnofs_vl",
  "QwenSnofs_v1_1",
  "Qwen_Helm",
  "Qwen_NSFW_Betal",
  "Qwen_NSFW_Beta2",
  "Qwen_NSFW_Beta4",
  "Qwen_NSFW_Beta5",
  "Qwen_Real_Nud3s",
  "Qwen_Real_PS",
  "Real_Breast_Nipples",
  "SendDudes",
  "SendNudesLite",
  "SendNudes Pro_Beta",
  "Ultimate_Breast_Nipples",
  "ass_up_QWEN",
  "barbell_nipples_QWEN",
  "bfs_v2_face",
  "bfs_v2_focus_face",
  "bfs_v2_head",
  "big_nipples_QWEN",
  "bumpynipples",
  "cmslt_cum_on_her",
  "consistence_edit_vl",
  "consistence_edit_v2",
  "dlck_p3n1s_V1_1",
  "d33p7hroa7",
  "goblin_anal_v1",
  "horseshoe_nipple_rings",
  "jib_nudity_fixer",
  "jillin",
  "male_nude",
  "milk_juggs",
  "nood_b",
  "nsfw_adv_vl",
  "possy_lora_v1",
  "p3nis",
  "qwen_MCNL",
  "qwen_PENISLORA",
  "qwen_hand_grab",
  "qwen_uncensor",
  "reclining_nude",
  "remove_clothing",
  "royal_treatment_V3",
  "sabi_character",
  "snapchat_selfie",
  "uka_qwen",
  "ultimate_realistic_breast",
] as const;

const videoPresets: ReadonlyArray<readonly [string, PresetVariant?]> = [
  ["BBC Blowjob Extreme"],
  ["BBC Deepthroat"],
  ["Balls Sucking"],
  ["Biggest Cock (size)"],
  ["Blink_Squatting_Cowgirl_Position_I2V"],
  ["Creampie CRM"],
  ["Cum (generic)"],
  ["Cunnilingus"],
  ["Doggy Front View v2"],
  ["Doggy Slider"],
  ["FOV Slider (camera)"],
  ["Facesplash Cumshot"],
  ["Fingering"],
  ["French Kiss"],
  ["Fucked From Behind"],
  ["General NSFW Booster"],
  ["Handjob"],
  ["JFJ Deepthroat", "high"],
  ["Mating Press"],
  ["Oral Insertion"],
  ["PENISLORA_22_i2v_HIGH_e320", "high"],
  ["PENISLORA_22_i2v_LOW_e496", "low"],
  ["POV Blowjob", "high"],
  ["POV Missionary"],
  ["Penetration Insert"],
  ["Pornmaster Creampie"],
  ["Pornmaster_wan 2.2_14b_12V_bukkake_v1.4"],
  ["Prone Bone"],
  ["Pussy Helper"],
  ["Reverse Cowgirl v2"],
  ["Reverse Suspended Congress"],
  ["Smashcut (camera)"],
  ["Standing Upright Sex"],
  ["Throat V2"],
  ["Twerking"],
  ["Ultimate Deepthroat"],
  ["WAN-2.2-12V-Double-Blowjob"],
  ["WAN-2.2-12V-HandjobBlowjob Combo"],
  ["WAN-2.2-12V-Sensual Teasing Blowjob"],
  ["¡GOON_Blink_Blowjob_I2V"],
  ["iGoon - Blink_Back_Doggystyle"],
  ["iGoon - Blink_Facial_I2V"],
  ["iGoon - Blink_Front_Doggystyle_12V"],
  ["iGoon - Blink_Missionary_I2V"],
  ["iGoon_Blink_Missionary_I2V", "high"],
  ["iGoon_Blink_Titjob_I2V"],
  ["lips-bj"],
  ["mql_casting_sex_doggy_kneel_diagona lly_behind_vagina_wan22_i2v_v1"],
  ["mql_casting_sex_reverse_cowgirl_lie_fr ont_vagina_wan22_i2v_v1"],
  ["mql_casting_sex_spoon_wan22_i2v_v1"],
  ["mql_massage_tits_wan22_i2v_v1"],
  ["mql_panties_aside_wan22_i2v_v1"],
  ["sfbehind_v2.1"],
  ["sid3l3g_transition_v2.0_H", "high"],
  ["sid3l3g_transition_v2.0_L", "low"],
  ["wan2.2_i2v_high_ulitmate_pussy_assho le", "high"],
  ["wan2.2_i2v_low_ulitmate_pussy_asshol e", "low"],
  ["wan22-mouthfull-140epoc-high-k3nk", "high"],
  ["wan22-mouthfull-152epoc-low-k3nk", "low"],
];

const makePreset = (
  id: string,
  source: PresetSource,
  mediaType: PresetMediaType,
  variant?: PresetVariant,
): GenerationPreset => ({
  id,
  displayName: id,
  source,
  mediaType,
  ...(variant ? { variant } : {}),
  enabled: true,
});

export const presetCatalog: readonly GenerationPreset[] = [
  ...imagePresetIds.map((id) =>
    makePreset(id, "image_catalog", "image"),
  ),
  ...videoPresets.map(([id, variant]) =>
    makePreset(id, "video_catalog", "video", variant),
  ),
];

export function searchPresets(
  presets: readonly GenerationPreset[],
  query: string,
): GenerationPreset[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...presets];

  return presets.filter((preset) => {
    const searchable = [
      preset.displayName,
      preset.id,
      preset.category,
      preset.providerId,
      preset.baseModel,
      ...(preset.tags ?? []),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function filterPresets(
  presets: readonly GenerationPreset[],
  mediaType: PresetMediaType,
  compatibleModelIds?: readonly string[],
): GenerationPreset[] {
  const compatible = compatibleModelIds
    ? new Set(compatibleModelIds.map(normalizeIdentifier))
    : undefined;

  return presets.filter((preset) => {
    if (
      preset.mediaType !== "both" &&
      preset.mediaType !== mediaType
    ) {
      return false;
    }
    return (
      !compatible ||
      !preset.compatibleModels ||
      preset.compatibleModels.some((model) =>
        compatible.has(normalizeIdentifier(model)),
      )
    );
  });
}

export function resolveAvailability(
  preset: GenerationPreset,
  context: AvailabilityContext,
): PresetAvailability {
  if (!preset.enabled || context.disabled) return "disabled";
  if (context.providerConfigured === false) return "not_configured";
  if (context.providerConfigured !== true) return "checking";

  if (
    context.modelId &&
    preset.compatibleModels &&
    !preset.compatibleModels.some(
      (model) =>
        normalizeIdentifier(model) ===
        normalizeIdentifier(context.modelId!),
    )
  ) {
    return "incompatible";
  }
  if (!context.discoveryComplete) return "checking";
  if (!context.installedPresetIds) return "checking";

  const installed = new Set(context.installedPresetIds.map(normalizeIdentifier));
  return installed.has(normalizeIdentifier(preset.id))
    ? "available"
    : "not_installed";
}

export function updatePresetState(
  state: PresetState,
  presetId: string,
  action: "favorite" | "unfavorite" | "use",
  recentLimit = 20,
): PresetState {
  const favorites = new Set(state.favorites);
  let recent = [...state.recent];

  if (action === "favorite") favorites.add(presetId);
  if (action === "unfavorite") favorites.delete(presetId);
  if (action === "use") {
    recent = [presetId, ...recent.filter((id) => id !== presetId)].slice(
      0,
      Math.max(0, recentLimit),
    );
  }
  return { favorites: [...favorites], recent };
}

export function exportRegistry(
  presets: readonly GenerationPreset[],
): string {
  const portablePresets = presets.map((preset) => ({
    id: preset.id,
    displayName: preset.displayName,
    mediaType: preset.mediaType,
    source: preset.source,
    ...(preset.category ? { category: preset.category } : {}),
    ...(preset.variant ? { variant: preset.variant } : {}),
    ...(preset.providerId ? { providerId: preset.providerId } : {}),
    ...(preset.modelPath ? { modelPath: preset.modelPath } : {}),
    ...(preset.baseModel ? { baseModel: preset.baseModel } : {}),
    ...(preset.triggerWords ? { triggerWords: [...preset.triggerWords] } : {}),
    ...(preset.defaultStrength !== undefined
      ? { defaultStrength: preset.defaultStrength }
      : {}),
    ...(preset.minStrength !== undefined
      ? { minStrength: preset.minStrength }
      : {}),
    ...(preset.maxStrength !== undefined
      ? { maxStrength: preset.maxStrength }
      : {}),
    ...(preset.compatibleModels
      ? { compatibleModels: [...preset.compatibleModels] }
      : {}),
    ...(preset.tags ? { tags: [...preset.tags] } : {}),
    enabled: preset.enabled,
  }));
  return JSON.stringify({ registryVersion: 1, presets: portablePresets }, null, 2);
}

export function importRegistry(json: string): GenerationPreset[] {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed) || parsed.registryVersion !== 1 || !Array.isArray(parsed.presets)) {
    throw new Error("Invalid preset registry export");
  }
  return parsed.presets.map(parsePreset);
}

function parsePreset(value: unknown): GenerationPreset {
  if (!isRecord(value)) throw new Error("Invalid preset entry");
  const allowedKeys = new Set([
    "id",
    "displayName",
    "mediaType",
    "source",
    "category",
    "variant",
    "providerId",
    "modelPath",
    "baseModel",
    "triggerWords",
    "defaultStrength",
    "minStrength",
    "maxStrength",
    "compatibleModels",
    "tags",
    "enabled",
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new Error("Preset entry contains unsupported fields");
  }
  if (
    typeof value.id !== "string" ||
    typeof value.displayName !== "string" ||
    !["image", "video", "both"].includes(String(value.mediaType)) ||
    !["existing", "image_catalog", "video_catalog"].includes(
      String(value.source),
    ) ||
    typeof value.enabled !== "boolean"
  ) {
    throw new Error("Invalid preset entry");
  }
  if (
    (value.category !== undefined &&
      !["content", "style", "camera", "motion", "utility", "other"].includes(
        String(value.category),
      )) ||
    (value.variant !== undefined &&
      !["high", "low", "standard"].includes(String(value.variant)))
  ) {
    throw new Error("Invalid preset metadata");
  }
  for (const key of ["providerId", "modelPath", "baseModel"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new Error("Invalid preset metadata");
    }
  }
  for (const key of ["triggerWords", "compatibleModels", "tags"] as const) {
    if (
      value[key] !== undefined &&
      (!Array.isArray(value[key]) ||
        value[key].some((item) => typeof item !== "string"))
    ) {
      throw new Error("Invalid preset metadata");
    }
  }
  for (const key of [
    "defaultStrength",
    "minStrength",
    "maxStrength",
  ] as const) {
    if (
      value[key] !== undefined &&
      (typeof value[key] !== "number" || !Number.isFinite(value[key]))
    ) {
      throw new Error("Invalid preset metadata");
    }
  }
  if (
    (value.minStrength !== undefined &&
      value.maxStrength !== undefined &&
      (value.minStrength as number) > (value.maxStrength as number)) ||
    (value.defaultStrength !== undefined &&
      ((value.minStrength !== undefined &&
        (value.defaultStrength as number) < (value.minStrength as number)) ||
        (value.maxStrength !== undefined &&
          (value.defaultStrength as number) > (value.maxStrength as number))))
  ) {
    throw new Error("Invalid preset strength bounds");
  }
  return {
    id: value.id,
    displayName: value.displayName,
    mediaType: value.mediaType as PresetMediaType,
    source: value.source as PresetSource,
    ...(value.category ? { category: value.category as PresetCategory } : {}),
    ...(value.variant ? { variant: value.variant as PresetVariant } : {}),
    ...(value.providerId ? { providerId: value.providerId as string } : {}),
    ...(value.modelPath ? { modelPath: value.modelPath as string } : {}),
    ...(value.baseModel ? { baseModel: value.baseModel as string } : {}),
    ...(value.triggerWords
      ? { triggerWords: value.triggerWords as string[] }
      : {}),
    ...(value.defaultStrength !== undefined
      ? { defaultStrength: value.defaultStrength as number }
      : {}),
    ...(value.minStrength !== undefined
      ? { minStrength: value.minStrength as number }
      : {}),
    ...(value.maxStrength !== undefined
      ? { maxStrength: value.maxStrength as number }
      : {}),
    ...(value.compatibleModels
      ? { compatibleModels: value.compatibleModels as string[] }
      : {}),
    ...(value.tags ? { tags: value.tags as string[] } : {}),
    enabled: value.enabled,
  };
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().replaceAll("\\", "/").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
