#!/usr/bin/env bash
# Sync a knowledge base repository or verify a local directory.
#
# Usage:
#   sync_kb.sh <kb-type> <kb-path> [local-path]
#
#   kb-type: "git" or "local"
#   kb-path: Git URL (for git type) or local directory path (for local type)
#   local-path: Directory name for git clone (default: derived from repo name)
#
# Returns the synced directory path on stdout (last line).

set -euo pipefail

KB_TYPE="${1:-}"
KB_PATH="${2:-}"
KB_LOCAL_PATH="${3:-}"

if [ -z "$KB_TYPE" ] || [ -z "$KB_PATH" ]; then
    echo "Usage: sync_kb.sh <kb-type> <kb-path> [local-path]" >&2
    exit 1
fi

# --- Local directory type ---
if [ "$KB_TYPE" = "local" ]; then
    if [ ! -d "$KB_PATH" ]; then
        echo "[sync] ERROR: Local path '$KB_PATH' does not exist or is not a directory." >&2
        exit 1
    fi
    MD_COUNT=$(find "$KB_PATH" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)
    if [ "$MD_COUNT" -eq 0 ]; then
        echo "[sync] WARNING: No .md files found in '$KB_PATH'." >&2
    else
        echo "[sync] Found $MD_COUNT .md files in '$KB_PATH'." >&2
    fi
    echo "$KB_PATH"
    exit 0
fi

# --- Git type ---
if [ "$KB_TYPE" != "git" ]; then
    echo "[sync] ERROR: Unknown kb-type '$KB_TYPE'. Must be 'git' or 'local'." >&2
    exit 1
fi

REPO_URL="$KB_PATH"

if [ -z "$KB_LOCAL_PATH" ]; then
    KB_LOCAL_PATH=$(basename "$REPO_URL" .git)
fi
TARGET_DIR="$KB_LOCAL_PATH"

cleanup_msg() {
    echo "" >&2
    echo "[sync] ERROR: $1" >&2
    echo "[sync] Cannot safely auto-sync. Please manually resolve by:" >&2
    echo "  rm -rf $TARGET_DIR" >&2
    echo "  Then re-run this skill." >&2
}

if [ ! -d "$TARGET_DIR" ]; then
    echo "[sync] Directory '$TARGET_DIR' not found, cloning..." >&2
    git clone "$REPO_URL" "$TARGET_DIR" || {
        cleanup_msg "Clone failed."
        exit 1
    }
    echo "[sync] Clone completed." >&2
    echo "$TARGET_DIR"
    exit 0
fi

echo "[sync] Directory '$TARGET_DIR' exists, checking state..." >&2
cd "$TARGET_DIR"

DIRTY=0
LOCAL_CHANGES=$(git status --porcelain 2>/dev/null || true)
if [ -n "$LOCAL_CHANGES" ]; then
    echo "[sync] WARNING: Working tree has uncommitted changes:" >&2
    echo "$LOCAL_CHANGES" >&2
    DIRTY=1
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "UNKNOWN")
if [ "$CURRENT_BRANCH" = "HEAD" ]; then
    echo "[sync] WARNING: Detached HEAD state." >&2
    DIRTY=1
fi

if [ "$DIRTY" -eq 1 ]; then
    cleanup_msg "Local repository has been modified (uncommitted changes, branch switch, or detached HEAD)."
    exit 3
fi

git fetch origin || {
    cleanup_msg "Fetch failed."
    exit 1
}

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u} 2>/dev/null) || {
    cleanup_msg "No upstream tracking branch configured."
    exit 1
}

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "[sync] Already up to date. Nothing to do." >&2
    echo "$TARGET_DIR"
    exit 0
fi

BASE=$(git merge-base HEAD @{u})

if [ "$LOCAL" = "$BASE" ]; then
    echo "[sync] Remote has updates. Pulling..." >&2
    git pull --rebase || {
        cleanup_msg "Pull failed."
        exit 1
    }
    echo "[sync] Updated to latest." >&2
    echo "$TARGET_DIR"
    exit 0
fi

if [ "$REMOTE" = "$BASE" ]; then
    echo "[sync] Local is ahead of remote. Skipping." >&2
    echo "$TARGET_DIR"
    exit 0
fi

cleanup_msg "Local and remote have diverged (conflict)."
exit 2
