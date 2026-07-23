import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const bundlePath = "public/assets/app-clean.js";
const mediaDirectory = "public/media/products";
const bundle = await readFile(bundlePath, "utf8");
const imageUrls = [
  ...new Set(
    bundle.match(/https:\/\/readdy\.ai\/api\/search-image\?[^`]+/g) ?? [],
  ),
];

if (imageUrls.length === 0) {
  console.log("No remote product images require localization.");
  process.exit(0);
}

await mkdir(mediaDirectory, { recursive: true });

const replacements = new Map();
let cursor = 0;
let downloadedBytes = 0;

function extensionFor(contentType, finalUrl) {
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/avif")) return ".avif";
  if (contentType.includes("image/gif")) return ".gif";
  if (contentType.includes("image/jpeg")) return ".jpg";

  const extension = extname(new URL(finalUrl).pathname).toLowerCase();
  return [".png", ".webp", ".avif", ".gif", ".jpg", ".jpeg"].includes(extension)
    ? extension
    : ".jpg";
}

async function fetchImage(imageUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(imageUrl, {
        headers: { "User-Agent": "Mitchy-Kitchen-Deployment/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Image download failed after 3 attempts: ${imageUrl}`, {
    cause: lastError,
  });
}

async function worker() {
  while (cursor < imageUrls.length) {
    const imageUrl = imageUrls[cursor];
    cursor += 1;

    const response = await fetchImage(imageUrl);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") &&
        contentType !== "binary/octet-stream" &&
        contentType !== "application/octet-stream") {
      throw new Error(`Unexpected image content type (${contentType}): ${imageUrl}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = createHash("sha256").update(imageUrl).digest("hex").slice(0, 20);
    const filename = `${hash}${extensionFor(contentType, response.url)}`;
    await writeFile(join(mediaDirectory, filename), bytes);

    downloadedBytes += bytes.length;
    replacements.set(imageUrl, `/media/products/${filename}`);
  }
}

await Promise.all(Array.from({ length: 12 }, () => worker()));

let localizedBundle = bundle;
for (const [remoteUrl, localUrl] of replacements) {
  localizedBundle = localizedBundle.replaceAll(remoteUrl, localUrl);
}
await writeFile(bundlePath, localizedBundle);

console.log(
  `Localized ${replacements.size} images (${(downloadedBytes / 1024 / 1024).toFixed(1)} MiB).`,
);
