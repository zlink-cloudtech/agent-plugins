#!/usr/bin/env bash
# sync-version.sh — 从 plugin.json 同步版本号到 README.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_JSON="$REPO_DIR/.claude-plugin/plugin.json"
README="$REPO_DIR/README.md"

if [ ! -f "$PLUGIN_JSON" ]; then
  echo "错误：未找到 $PLUGIN_JSON"
  exit 1
fi

if [ ! -f "$README" ]; then
  echo "错误：未找到 $README"
  exit 1
fi

VERSION=$(grep -o '"version"\s*:\s*"[^"]*"' "$PLUGIN_JSON" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')

if [ -z "$VERSION" ]; then
  echo "错误：无法从 plugin.json 提取版本号"
  exit 1
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/📦 版本: v[0-9]\+\.[0-9]\+\.[0-9]\+/📦 版本: v$VERSION/" "$README"
else
  sed -i "s/📦 版本: v[0-9]\+\.[0-9]\+\.[0-9]\+/📦 版本: v$VERSION/" "$README"
fi

echo "已同步版本 v$VERSION 到 README.md"
