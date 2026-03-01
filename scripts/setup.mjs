#!/usr/bin/env node
/**
 * ClawBody Setup Script
 *
 * One-click setup: checks prerequisites, installs dependencies,
 * and downloads the default VRM model.
 *
 * Run: node scripts/setup.mjs
 *   or: npm run setup
 */

import { existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const modelsDir = join(projectRoot, "public", "models");
const modelPath = join(modelsDir, "default.vrm");

// ── Helpers ──

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: "pipe", ...opts }).trim();
  } catch {
    return null;
  }
}

function check(label, ok) {
  if (ok) {
    console.log(`  ✅ ${label}`);
  } else {
    console.log(`  ❌ ${label}`);
  }
  return ok;
}

// ── 1. Check prerequisites ──

console.log("\n🔍 Checking prerequisites...\n");

const nodeVersion = run("node --version");
const nodeOk = check(
  `Node.js ${nodeVersion || "(not found)"}`,
  nodeVersion && parseInt(nodeVersion.replace("v", "")) >= 18,
);

const npmVersion = run("npm --version");
check(`npm ${npmVersion || "(not found)"}`, !!npmVersion);

const rustVersion = run("rustc --version");
const rustOk = check(
  `Rust ${rustVersion || "(not found)"}`,
  !!rustVersion,
);

const cargoVersion = run("cargo --version");
check(`Cargo ${cargoVersion || "(not found)"}`, !!cargoVersion);

// Platform-specific checks
const platform = process.platform;
if (platform === "linux") {
  const hasWebkit = run("pkg-config --exists webkit2gtk-4.1 2>&1 && echo ok");
  if (!hasWebkit) {
    console.log("\n⚠️  Linux detected — you need webkit2gtk-4.1 and other deps:");
    console.log("   sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential \\");
    console.log("     curl wget file libxdo-dev libssl-dev \\");
    console.log("     libayatana-appindicator3-dev librsvg2-dev\n");
  }
}

if (!nodeOk) {
  console.error("\n❌ Node.js 18+ is required. Install: https://nodejs.org/");
  process.exit(1);
}

if (!rustOk) {
  console.error("\n❌ Rust is required. Install:");
  console.error("   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh");
  process.exit(1);
}

// ── 2. Install npm dependencies ──

console.log("\n📦 Installing npm dependencies...\n");
try {
  execSync("npm install", { cwd: projectRoot, stdio: "inherit" });
} catch {
  console.error("❌ npm install failed");
  process.exit(1);
}

// ── 3. Download default VRM model ──

if (existsSync(modelPath)) {
  console.log("\n✅ Default VRM model already exists");
} else {
  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true });
  }

  const MODEL_URL =
    "https://cdn.jsdelivr.net/gh/pixiv/three-vrm@dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

  console.log("\n📦 Downloading test VRM model (~10MB)...");
  console.log(`   Source: ${MODEL_URL}`);

  try {
    execSync(`curl -L --progress-bar -o "${modelPath}" "${MODEL_URL}"`, {
      stdio: "inherit",
    });
    console.log("✅ Model downloaded to public/models/default.vrm");
  } catch {
    console.error("⚠️  Failed to download model. You can manually place a .vrm file at public/models/default.vrm");
    console.error("   Download from https://hub.vroid.com/ or create with VRoid Studio.");
  }
}

// ── Done ──

console.log("\n🎉 Setup complete! Run the app with:");
console.log("   cargo tauri dev\n");
console.log("   Or for frontend-only dev:");
console.log("   npm run dev\n");
