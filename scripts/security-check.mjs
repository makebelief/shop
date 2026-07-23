import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const testPort = 18187;
const baseUrl = `http://127.0.0.1:${testPort}`;
const appBundle = readFileSync("public/assets/app-clean.js", "utf8");
const serverSource = readFileSync("server.mjs", "utf8");
const netlifyConfig = readFileSync("netlify.toml", "utf8");
const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const stylesheet = readFileSync("public/assets/styles-secure.css", "utf8");
const catalogueImages = readdirSync("public/media/catalogue");

const forbiddenBundlePatterns = [
  "https://readdy.ai/api/form/",
  "qt();var Jt",
  "fn();var pn",
  "Is preview build:",
  "typeof window<`u`&&ne(window)",
  "[YOUR WHATSAPP NUMBER]",
  "https://readdy.ai/api/search-image",
];

for (const pattern of forbiddenBundlePatterns) {
  if (appBundle.includes(pattern)) {
    throw new Error(`Unsafe or preview-only bundle pattern remains: ${pattern}`);
  }
}

if (stylesheet.includes("@import") || stylesheet.includes("fonts.googleapis.com")) {
  throw new Error("The production stylesheet still imports third-party content.");
}

if (catalogueImages.length !== 174) {
  throw new Error(`Expected 174 catalogue images, found ${catalogueImages.length}.`);
}

const requiredPolicyDirectives = [
  "default-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "worker-src 'none'",
];

for (const directive of requiredPolicyDirectives) {
  if (!serverSource.includes(directive) ||
      !netlifyConfig.includes(directive) ||
      !JSON.stringify(vercelConfig).includes(directive)) {
    throw new Error(`Security policy is inconsistent across deployments: ${directive}`);
  }
}

const child = spawn(process.execPath, ["server.mjs"], {
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    NODE_ENV: "test",
    PORT: String(testPort),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let childError = "";
child.stderr.on("data", (chunk) => {
  childError += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The child process may still be binding its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Security test server did not start. ${childError}`);
}

function assertHeader(response, name, expected) {
  const actual = response.headers.get(name);
  if (!actual || (expected && !actual.includes(expected))) {
    throw new Error(`Missing or invalid ${name} header: ${actual}`);
  }
}

try {
  await waitForServer();

  const homepage = await fetch(`${baseUrl}/`);
  if (homepage.status !== 200) throw new Error(`Homepage returned ${homepage.status}`);

  assertHeader(homepage, "content-security-policy", "script-src 'self'");
  assertHeader(homepage, "cross-origin-opener-policy", "same-origin");
  assertHeader(homepage, "permissions-policy", "payment=()");
  assertHeader(homepage, "referrer-policy", "strict-origin-when-cross-origin");
  assertHeader(homepage, "strict-transport-security", "max-age=31536000");
  assertHeader(homepage, "x-content-type-options", "nosniff");
  assertHeader(homepage, "x-dns-prefetch-control", "off");
  assertHeader(homepage, "x-frame-options", "DENY");

  if (homepage.headers.has("server") || homepage.headers.has("x-powered-by")) {
    throw new Error("The server discloses implementation details.");
  }

  const html = await homepage.text();
  if (!html.includes("/assets/app-clean.js")) {
    throw new Error("The hardened application bundle is not deployed.");
  }

  const missingAsset = await fetch(`${baseUrl}/assets/missing.js`);
  if (missingAsset.status !== 404 ||
      !missingAsset.headers.get("content-type")?.startsWith("text/plain")) {
    throw new Error("Missing executable assets do not fail safely.");
  }

  const traversal = await fetch(`${baseUrl}/assets/%2e%2e/%2e%2e/server.mjs`);
  if (traversal.status !== 404 ||
      (await traversal.text()).includes("createServer")) {
    throw new Error("Path traversal protection failed.");
  }

  const disallowedMethod = await fetch(`${baseUrl}/`, { method: "POST" });
  if (disallowedMethod.status !== 405 ||
      disallowedMethod.headers.get("allow") !== "GET, HEAD") {
    throw new Error("Unexpected HTTP methods are not rejected.");
  }

  const oversizedUri = await fetch(`${baseUrl}/${"a".repeat(2200)}`);
  if (oversizedUri.status !== 414) {
    throw new Error(`Oversized URI returned ${oversizedUri.status}, expected 414.`);
  }

  const retiredRoute = await fetch(`${baseUrl}/bundles`);
  if (retiredRoute.status !== 404) {
    throw new Error(`Retired bundle route returned ${retiredRoute.status}, expected 404.`);
  }

  const health = await fetch(`${baseUrl}/health`);
  if (health.status !== 200 ||
      health.headers.get("cache-control") !== "no-store" ||
      (await health.json()).status !== "ok") {
    throw new Error("Health endpoint is not production-safe.");
  }

  console.log("Security checks passed.");
} finally {
  child.kill("SIGTERM");
}
