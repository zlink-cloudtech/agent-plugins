#!/usr/bin/env node
/** Manage .agent-plugin-prd.json configuration for product knowledge base persistence. */

import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const CONFIG_FILENAME = ".agent-plugin-prd.json";

function configPath(projectDir) {
  return resolve(projectDir, CONFIG_FILENAME);
}

async function cmdRead(args) {
  const path = configPath(args.projectDir);
  let data;
  try {
    const raw = await readFile(path, "utf-8");
    data = JSON.parse(raw);
  } catch {
    console.error(`[config] No config found at ${path}`);
    process.exit(1);
  }
  if (!data.productType || !("knowledgeBase" in data)) {
    console.error(`[config] Config at ${path} is missing required fields`);
    process.exit(1);
  }
  const kb = data.knowledgeBase;
  if (kb != null && kb !== false) {
    if (!kb.type || !kb.path) {
      console.error("[config] knowledgeBase missing 'type' or 'path'");
      process.exit(1);
    }
  }
  console.log(JSON.stringify(data));
}

async function cmdWrite(args) {
  const path = configPath(args.projectDir);
  let kb;
  if (args.noKb) {
    kb = false;
  } else if (args.skipKb) {
    kb = null;
  } else {
    kb = { type: args.kbType, path: args.kbPath };
    if (args.kbLocalPath) {
      kb.localPath = args.kbLocalPath;
    }
  }
  const data = {
    productType: args.productType,
    knowledgeBase: kb,
  };
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`[config] Written to ${path}`);
}

async function cmdExists(args) {
  const path = configPath(args.projectDir);
  try {
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw);
    if (data.productType && "knowledgeBase" in data) {
      process.exit(0);
    }
  } catch {
    // file not found or invalid json
  }
  process.exit(1);
}

const args = (() => {
  const o = { projectDir: process.cwd() };
  const a = process.argv.slice(2);
  if (a.length === 0) {
    console.error("Usage: config_manager.mjs <read|write|exists> [options]");
    process.exit(1);
  }
  o.command = a[0];
  for (let i = 1; i < a.length; i++) {
    switch (a[i]) {
      case "--project-dir": o.projectDir = a[++i]; break;
      case "--product-type": o.productType = a[++i]; break;
      case "--skip-kb": o.skipKb = true; break;
      case "--no-kb": o.noKb = true; break;
      case "--kb-type": o.kbType = a[++i]; break;
      case "--kb-path": o.kbPath = a[++i]; break;
      case "--kb-local-path": o.kbLocalPath = a[++i]; break;
    }
  }
  return o;
})();

switch (args.command) {
  case "read": await cmdRead(args); break;
  case "write": await cmdWrite(args); break;
  case "exists": await cmdExists(args); break;
  default:
    console.error(`Unknown command: ${args.command}`);
    process.exit(1);
}
