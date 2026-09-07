#!/usr/bin/env node

import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'dist', 'claude');
const pluginJsonPath = path.join(repoRoot, '.claude-plugin', 'plugin.json');
const plugin = JSON.parse(await fs.readFile(pluginJsonPath, 'utf8'));

const marketplaceRepo = process.env.MARKETPLACE_REPO
  ? path.resolve(process.env.MARKETPLACE_REPO)
  : path.resolve(repoRoot, '..', 'agent-plugin-marketplace');
const targetDir = path.join(marketplaceRepo, 'plugins', plugin.name);

await assertExists(sourceDir, 'Claude artifact is missing. Run npm run build:claude first.');
await assertExists(path.join(sourceDir, 'build-meta.json'), 'Claude build metadata is missing. Run npm run build:claude first.');
await assertExists(marketplaceRepo, `Marketplace repo does not exist: ${marketplaceRepo}`);

await fs.rm(targetDir, { recursive: true, force: true });
await fs.mkdir(path.dirname(targetDir), { recursive: true });
await fs.cp(sourceDir, targetDir, { recursive: true, dereference: false });

const buildMeta = JSON.parse(await fs.readFile(path.join(targetDir, 'build-meta.json'), 'utf8'));
await fs.writeFile(
  path.join(targetDir, 'artifact-manifest.json'),
  `${JSON.stringify({
    name: plugin.name,
    version: plugin.version,
    artifactType: 'claude-marketplace',
    sourceRepo: readSourceRepoUrl(plugin.name),
    buildMeta,
  }, null, 2)}\n`,
);

console.log(`Published ${plugin.name} v${plugin.version} artifact to ${path.relative(process.cwd(), targetDir)}`);

function readSourceRepoUrl(fallback) {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const github = url.match(/^(?:git@github\.com:|https:\/\/github\.com\/)(.+?)\.git$/);
    if (github) return `https://github.com/${github[1]}`;
    return url;
  } catch {
    return fallback;
  }
}

async function assertExists(filePath, message) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
  } catch {
    throw new Error(message);
  }
}