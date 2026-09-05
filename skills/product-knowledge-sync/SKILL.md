---
name: product-knowledge-sync
description: Synchronize product knowledge base for the current product type. Supports git clone/pull and local directory loading. Persists product type and knowledge base path to .agent-plugin-prd.json so future runs skip the question. Use when spec-drafter or spec-clarifier needs product context, when the user wants to refresh product knowledge docs, or when first configuring a project's product type.
---

# Product Knowledge Sync

Ensure the correct product knowledge base is available locally and persist the configuration for future use.

## Workflow

### Step 0: Check persisted config

Run `node <skill-dir>/scripts/config_manager.mjs read`. If it succeeds (exit 0):
- Parse the JSON output to get `productType` and `knowledgeBase`
- If `knowledgeBase` has `type` and `path`: skip to Step 3 (fully configured).
- If `knowledgeBase` is `false`: no knowledge base exists for this product. Return control to the caller with empty context — do NOT ask any questions.
- If `knowledgeBase` is `null`: remember `productType`, skip to Step 2-KB (product type known, KB not yet configured).

If it fails (exit 1): proceed to Step 1 (first-time setup).

### Step 1: Ask product type

Ask the user: "请选择产品类型："

Options:
- **ainative**
- **其他**

「向用户提问」。

**Strictly present the four options as defined above.** Do NOT infer or guess the product type from the user's request content, even if the message appears to contain product keywords (e.g., "acg-dev" is a CLI tool, not the ACG product type). Always let the user manually select.

After selection, remember the product type and proceed to Step 2.

### Step 2: Resolve knowledge base source

Based on the selected product type:

**If ACG:**
- KB type = `git`
- KB path = `https://github.com/zlink-cloudtech/scaffold-kb.git`
- KB local path = `scaffold-kb`
- Auto-persist: run `node <skill-dir>/scripts/config_manager.mjs write --project-dir <workspace-root> --product-type ACG --kb-type git --kb-path "https://github.com/zlink-cloudtech/scaffold-kb.git" --kb-local-path scaffold-kb`
- Proceed to Step 3.

**If ainative, or 其他:**
- Ask the user: "知识库配置："
  - Option 1: **跳过知识库** — skip this time, will ask again next run
  - Option 2: **无知识库** — no knowledge base exists, never ask again
  - Option 3: **输入自定义路径** — user provides a git URL or local directory path

- If "跳过知识库":
  - Persist product type: run `node <skill-dir>/scripts/config_manager.mjs write --project-dir <workspace-root> --product-type <TYPE> --skip-kb`
  - Return control to the caller with empty knowledge base context.

- If "无知识库":
  - Persist permanently: run `node <skill-dir>/scripts/config_manager.mjs write --project-dir <workspace-root> --product-type <TYPE> --no-kb`
  - Return control to the caller with empty knowledge base context.

- If "输入自定义路径": ask the user to provide the path (git URL or local filesystem path). Then detect the type:
  - If it starts with `git@`, `https://`, or ends with `.git` → KB type = `git`
  - Otherwise → KB type = `local`
  
  Then ask: "是否持久化该知识库配置，以便下次跳过询问？"
  
  - If **Yes**: run `node <skill-dir>/scripts/config_manager.mjs write --project-dir <workspace-root> --product-type <TYPE> --kb-type <git|local> --kb-path "<PATH>" [--kb-local-path <derived>]`
  - If **No**: persist product type only: run `node <skill-dir>/scripts/config_manager.mjs write --project-dir <workspace-root> --product-type <TYPE> --skip-kb`

### Step 2-KB: KB not yet configured (product type already known)

When config has `productType` set but `knowledgeBase` is null:

- The product type is already known from the persisted config. Do NOT re-ask for product type.
- Ask the user: "<productType> 的知识库配置："
  - Option 1: **跳过知识库** — skip this time, will ask again next run
  - Option 2: **无知识库** — no knowledge base exists, never ask again
  - Option 3: **输入自定义路径** — user provides a git URL or local directory path

- If "跳过知识库": return control to the caller with empty knowledge base context. Config already has `knowledgeBase: null`, no change needed.

- If "无知识库": run `node <skill-dir>/scripts/config_manager.mjs write --project-dir <workspace-root> --product-type <TYPE> --no-kb`. Return empty context.

- If "输入自定义路径": same flow as Step 2 (detect type, ask persist, write config).

### Step 3: Sync knowledge base

If KB type is `git` or `local`:

Run `bash <skill-dir>/scripts/sync_kb.sh <kb-type> <kb-path> [local-path]`.

- The script outputs the synced directory path as its last line. Capture it.
- Handle exit codes:
  - **Exit 0**: Sync succeeded or already up to date.
  - **Non-zero**: Tell the user the sync failed. For exit 3 (dirty tree/detached HEAD), suggest manually deleting the local directory and re-running.

If KB type is `none` (user skipped): skip to Step 5.

### Step 4: Load .md files

Find all `*.md` files under the synced directory (from Step 3). Read each one and compile the content.

For each file found, record: relative path and full content.

### Step 5: Return context to caller

Return to the calling skill with:
- The product type
- A list of loaded .md files (path + content) — or empty list if KB was skipped
- The synced directory path (if applicable)

The calling skill (spec-drafter / spec-clarifier) should use the loaded .md content as product knowledge context for all subsequent steps.

## Scripts

- `scripts/config_manager.mjs` — Read/write `.agent-plugin-prd.json` config
- `scripts/sync_kb.sh` — Clone/pull git repos or verify local directories

## ACG Built-in Defaults

For ACG product type, the default knowledge base is:
- **Repo**: `https://github.com/zlink-cloudtech/scaffold-kb.git`
- **Local dir**: `scaffold-kb`