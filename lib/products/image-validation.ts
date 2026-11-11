export const IMAGE_MAX_SIZE = 3 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export function imageMetadataError(size: number, type: string) {
  if (size <= 0) return "Selecione uma imagem não vazia.";
  if (size > IMAGE_MAX_SIZE) return "A foto deve ter no máximo 3 MB.";
  if (!(IMAGE_TYPES as readonly string[]).includes(type)) return "Envie uma foto JPEG, PNG ou WebP.";
  return null;
}
export function detectImageType(bytes: Uint8Array): typeof IMAGE_TYPES[number] | null {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR") return "image/png";
  if (bytes.length >= 16 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(String.fromCharCode(...bytes.slice(12, 16)))) return "image/webp";
  return null;
}
export function imageContentError(bytes: Uint8Array, type: string) {
  return imageMetadataError(bytes.length, type) ?? (detectImageType(bytes) === type ? null : "O conteúdo do arquivo não corresponde a uma imagem JPEG, PNG ou WebP do tipo informado.");
}
export function imageExtension(type: string) { return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp"; }