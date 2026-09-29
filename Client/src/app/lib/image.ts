// Prepare receipt photos for upload. Phone photos are often 3–20 MB, but serverless hosts cap request
// bodies (Vercel: 4.5 MB), so large images are downscaled and re-encoded as JPEG in the browser first.

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
// Base64 inflates by ~4/3; keep the JSON body comfortably under 4.5 MB
const MAX_DATA_URL_LENGTH = 4_000_000;
const PASSTHROUGH_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 2400; // plenty for receipt text; vision models downscale beyond this anyway

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode failed"));
    image.src = src;
  });
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  try {
    // Respects EXIF rotation so sideways phone photos come out upright
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    // Safari can decode HEIC through <img> even when createImageBitmap can't
    const image = await loadImage(await readAsDataUrl(file));
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  }
}

export async function prepareImageForUpload(file: File): Promise<{ dataUrl: string; filename: string; resized: boolean }> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That photo is over 20 MB. Please choose a smaller one.");
  }
  if (file.size <= PASSTHROUGH_BYTES && /^image\/(jpeg|png|webp)$/.test(file.type)) {
    return { dataUrl: await readAsDataUrl(file), filename: file.name, resized: false };
  }

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error(
      /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
        ? "This browser can't read HEIC photos. Take a screenshot of the receipt, or set the camera to 'Most Compatible'."
        : "Couldn't read this image. Try a JPG or PNG.",
    );
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't process the image on this device.");

  let edge = MAX_EDGE;
  let quality = 0.85;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, edge / Math.max(decoded.width, decoded.height));
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    context.fillStyle = "#ffffff"; // transparent PNGs become white, not black, as JPEG
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return { dataUrl, filename: file.name.replace(/\.[^.]+$/, "") + ".jpg", resized: true };
    }
    if (quality > 0.6) quality -= 0.1;
    else edge = Math.round(edge * 0.8);
  }
  throw new Error("Couldn't shrink this image enough to upload. Try cropping it to just the receipt.");
}
