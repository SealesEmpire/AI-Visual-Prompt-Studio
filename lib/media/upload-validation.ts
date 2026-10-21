const allowedExtensions = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".webm", "video/webm"],
]);

export function hasAllowedMediaNameAndType(name: string, mimeType: string): boolean {
  const dot = name.lastIndexOf(".");
  const extension = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const hasUnsafeCharacter = [...name].some((character) =>
    character === "/" || character === "\\" || character.charCodeAt(0) < 32,
  );
  return name.length <= 255 && !hasUnsafeCharacter && allowedExtensions.get(extension) === mimeType;
}

export function hasValidMediaSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 &&
      bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  }
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp") {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP";
  }
  if (mimeType === "video/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    return bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp";
  }
  return false;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
