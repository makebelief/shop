import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  "public/index.html",
  "public/assets/app-clean.js",
  "public/assets/styles-secure.css",
  "public/assets/vendor.js",
  "public/brand/mitchy-kitchen-logo.png",
  "public/media/catalogue",
  "public/404.html",
  "server.mjs",
];

const missingFiles = requiredFiles.filter((file) => !existsSync(resolve(file)));
if (missingFiles.length > 0) {
  console.error(`Missing required files:\n${missingFiles.join("\n")}`);
  process.exit(1);
}

if (existsSync(resolve("public/assets/app-production.js"))) {
  console.error("The unused legacy application bundle is publicly exposed.");
  process.exit(1);
}

const appBundle = readFileSync(resolve("public/assets/app-clean.js"), "utf8");
if (appBundle.includes("/preview/26adace4-3114-4e4c-be2a-b554913429aa/12316763")) {
  console.error("The app bundle still contains the temporary preview base path.");
  process.exit(1);
}

if (!appBundle.includes("/brand/mitchy-kitchen-logo.png")) {
  console.error("The application is not configured to use the local brand logo.");
  process.exit(1);
}

if (!appBundle.includes("whatsapp:`254759516056`")) {
  console.error("The production WhatsApp number is missing from the application.");
  process.exit(1);
}

const catalogueImages = readdirSync(resolve("public/media/catalogue"))
  .filter((file) => /\.(?:jpe?g|png|webp)$/i.test(file));
if (catalogueImages.length !== 174) {
  console.error(`Expected 174 catalogue images, found ${catalogueImages.length}.`);
  process.exit(1);
}

if (!appBundle.includes("/media/catalogue/0001-2500.jpg")) {
  console.error("The uploaded product catalogue is not active in the application.");
  process.exit(1);
}

if (appBundle.includes("{path:`/bundles`")) {
  console.error("The retired product-bundle route is still active.");
  process.exit(1);
}

if (appBundle.includes("{path:`/delivery-info`") || appBundle.includes("{path:`/returns`")) {
  console.error("A retired delivery or returns-policy route is still active.");
  process.exit(1);
}

const retiredPolicyLinks = [
  "{label:`Delivery Information`,to:`/delivery-info`",
  "{label:`Returns & Refunds`,to:`/returns`",
  "{label:`Returns Policy`,to:`/returns`",
];
const retiredPolicyLink = retiredPolicyLinks.find((link) => appBundle.includes(link));
if (retiredPolicyLink) {
  console.error(`A retired policy navigation link remains: ${retiredPolicyLink}`);
  process.exit(1);
}

const prohibitedPaymentClaims = [
  "M-Pesa STK push",
  "Debit / Credit Card",
  "Secure checkout with M-Pesa",
];
const paymentClaim = prohibitedPaymentClaims.find((claim) => appBundle.includes(claim));
if (paymentClaim) {
  console.error(`Misleading automated-payment claim remains: `);
  process.exit(1);
}

const prohibitedProductionPatterns = [
  "https://readdy.ai/api/form/",
  "Is preview build:",
  "qt();var Jt",
  "fn();var pn",
];
const productionPattern = prohibitedProductionPatterns.find(
  (pattern) => appBundle.includes(pattern),
);
if (productionPattern) {
  console.error(`Preview-only or external submission code remains: ${productionPattern}`);
  process.exit(1);
}

console.log("Production structure check passed.");
