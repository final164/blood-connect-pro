/** Compress/resize an image file for prescription upload (client-side). */
export async function compressImageForAi(
  file: File,
  maxPx = 1600,
  quality = 0.78,
): Promise<{ mimeType: string; data: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const mimeType = "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const data = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return { mimeType, data, previewUrl: dataUrl };
}
