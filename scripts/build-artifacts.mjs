#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');

const targetArg = parseTargetArg(process.argv.slice(2));
const targets = targetArg === 'all' ? ['claude', 'dsh'] : [targetArg];

const plugin = await readJson(path.join(repoRoot, '.claude-plugin', 'plugin.json'));
const sourceCommit = readGitCommit();

await fs.mkdir(distRoot, { recursive: true });

for (const target of targets) {
  await buildTarget(target);
}

async function buildTarget(target) {
  switch (target) {
    case 'claude':
      await buildClaudeArtifact();
      break;
    case 'dsh':
      await buildDshArtifact();
      break;
    default:
      throw new Error(`Unknown target: ${target}`);
  }
}

async function buildClaudeArtifact() {
  const targetDir = path.join(distRoot, 'claude');
  await resetDir(targetDir);
  await copyRequired('.claude-plugin', path.join(targetDir, '.claude-plugin'));
  await copyRequired('skills', path.join(targetDir, 'skills'));
  await copyRequired('agents', path.join(targetDir, 'agents'));
  await copyIfExists('bin', path.join(targetDir, 'bin'));
  await copyIfExists('README.md', path.join(targetDir, 'README.md'));
  await writeBuildMeta(targetDir, 'claude-marketplace');
}

async function buildDshArtifact() {
  const targetDir = path.join(distRoot, 'dsh');
  await resetDir(targetDir);
  await copyRequired('skills', path.join(targetDir, 'skills'));
  await copyRequired('agents', path.join(targetDir, 'agents'));
  await copyIfExists('bin', path.join(targetDir, 'bin'));
  await copyIfExists('README.md', path.join(targetDir, 'README.md'));
  await fs.writeFile(
    path.join(targetDir, 'cordis.patch.yml'),
    [
      '# Generated DSH bundle patch for agent-plugins.',
      '# Installed through `dsh plugin --profile <name> add <package>`.',
      '# The package-owned skills directory is registered as an additional filesystem skill root.',
      '- id: skill-filesystem',
      "  name: '@deepseek-ai/dsh-skill-filesystem'",
      '  config:',
      '    customSkillDirs:',
      '      - !!js "process.getBuiltinModule(\'node:url\').fileURLToPath(new URL(\'skills/\', baseUrl))"',
      '',
    ].join('\n'),
  );
  await writeJson(path.join(targetDir, 'package.json'), {
    name: '@zlink-cloudtech/dsh-agent-plugins',
    version: plugin.version,
    description: `${plugin.description} DSH bundle artifact.`,
    type: 'module',
    license: plugin.license ?? 'MIT',
    publishConfig: {
      access: 'public',
    },
    exports: {
      './cordis.patch.yml': './cordis.patch.yml',
      './package.json': './package.json',
    },
    files: ['cordis.patch.yml', 'skills', 'agents', 'bin', 'README.md', 'agent-plugins.json', 'build-meta.json'],
    keywords: [...new Set([...(plugin.keywords ?? []), 'dsh', 'deepseek-harness', 'bundle'])],
    dsh: {
      bundle: {
        patch: './cordis.patch.yml',
      },
    },
  });
  await writeJson(path.join(targetDir, 'agent-plugins.json'), {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    artifactType: 'dsh-bundle',
    skillsRoot: 'skills',
    agentsRoot: 'agents',
    packageName: '@zlink-cloudtech/dsh-agent-plugins',
    patch: 'cordis.patch.yml',
  });
  await writeBuildMeta(targetDir, 'dsh-bundle');
}

async function writeBuildMeta(targetDir, target) {
  const artifactHash = await hashDirectory(targetDir);
  await writeJson(path.join(targetDir, 'build-meta.json'), {
    plugin: plugin.name,
    version: plugin.version,
    target,
    sourceCommit,
    builtAt: new Date().toISOString(),
    artifactHash,
  });
}

function parseTargetArg(args) {
  const targetFlag = args.find((arg) => arg.startsWith('--target='));
  if (!targetFlag) return 'all';
  const target = targetFlag.slice('--target='.length);
  if (!target) throw new Error('Missing --target value');
  return target;
}

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function copyRequired(sourceRelative, destination) {
  const source = path.join(repoRoot, sourceRelative);
  await assertExists(source);
  await fs.cp(source, destination, { recursive: true, dereference: false });
}

async function copyIfExists(sourceRelative, destination) {
  const source = path.join(repoRoot, sourceRelative);
  try {
    await fs.access(source, fsConstants.F_OK);
  } catch {
    return;
  }
  await fs.cp(source, destination, { recursive: true, dereference: false });
}

async function assertExists(filePath) {
  try {
    await fs.access(filePath, fsConstants.F_OK);
  } catch {
    throw new Error(`Required path does not exist: ${path.relative(repoRoot, filePath)}`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readGitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

async function hashDirectory(dir) {
  const hash = createHash('sha256');
  const files = await listFiles(dir);
  for (const file of files) {
    if (path.basename(file) === 'build-meta.json') continue;
    const relativePath = path.relative(dir, file).split(path.sep).join('/');
    hash.update(relativePath);
    hash.update('\0');
    hash.update(await fs.readFile(file));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}