export const acceptedMediaTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export function isSupportedMediaType(mimeType: string): boolean {
  return acceptedMediaTypes.includes(mimeType as (typeof acceptedMediaTypes)[number]);
}

export function isVideoMediaType(mimeType: string): boolean {
  return mimeType.startsWith("video/") && isSupportedMediaType(mimeType);
}
