/**
 * Downloads a free VRM model for testing.
 *
 * Uses the official VRM1_Constraint_Twist_Sample.vrm from the
 * @pixiv/three-vrm examples (MIT licensed, hosted on GitHub).
 *
 * Run: node scripts/download-model.mjs
 *   or: npm run setup
 */

import { existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const modelsDir = join(__dirname, "..", "public", "models");
const modelPath = join(modelsDir, "default.vrm");

if (existsSync(modelPath)) {
  console.log("✅ Model already exists at public/models/default.vrm");
  process.exit(0);
}

if (!existsSync(modelsDir)) {
  mkdirSync(modelsDir, { recursive: true });
}

// Official three-vrm example model via jsDelivr CDN (~10MB)
// Source: https://github.com/pixiv/three-vrm/tree/dev/packages/three-vrm/examples/models
const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/pixiv/three-vrm@dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

console.log("📦 Downloading test VRM model (~10MB)...");
console.log(`   Source: ${MODEL_URL}`);

try {
  execSync(`curl -L --progress-bar -o "${modelPath}" "${MODEL_URL}"`, {
    stdio: "inherit",
  });
  console.log("✅ Model downloaded to public/models/default.vrm");
} catch {
  console.error(
    "❌ Failed to download model. Please manually place a .vrm file at public/models/default.vrm"
  );
  console.error(
    "   You can download one from https://hub.vroid.com/ or create one with VRoid Studio."
  );
  process.exit(1);
}
