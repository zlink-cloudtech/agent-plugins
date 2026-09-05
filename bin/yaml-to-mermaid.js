#!/usr/bin/env node
/**
 * yaml-to-mermaid.js — 依赖图 YAML → Mermaid 转换器
 *
 * 用法：echo "$yaml" | node bin/yaml-to-mermaid.js
 * 输入：stdin — dependency-analyzer 输出的 YAML
 * 输出：stdout — Mermaid graph TB 格式（仅图本体，不含 ```mermaid 包裹）
 *
 * 约束：纯函数，零外部依赖，只读 stdin，只写 stdout。
 *       不关心 YAML 从哪来，不关心 Mermaid 用在哪。
 */

const { EOL } = require('node:os');

/**
 * 简版 YAML 解析（只解析 dependency-analyzer 输出的子集，不引入 js-yaml 依赖）
 */
function parseSimpleYaml(text) {
  const lines = text.split(EOL);
  const result = { nodes: [], edges: [], cycles: [], alerts: [] };

  let section = null;
  let current = null;
  let baseIndent = 0; // 基础缩进层级：无 dependency_graph 时为 0，有时为 2

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.startsWith('#')) continue;

    // 检测 dependency_graph 包装层，设置基础缩进
    if (line === 'dependency_graph:') { baseIndent = 2; continue; }

    // 动态计算缩进模式（基于 baseIndent）
    const indent0 = '';                                 // baseIndent + 0
    const indent2 = ' '.repeat(baseIndent);             // baseIndent + 0 = baseIndent
    const indent4 = ' '.repeat(baseIndent + 2);         // baseIndent + 2
    const indent6 = ' '.repeat(baseIndent + 4);         // baseIndent + 4

    // 切换 section 前，先推入当前正在构建的项
    if (line === indent2 + 'nodes:' || line === indent0 + 'nodes:' || line === indent2 + 'edges:' || line === indent0 + 'edges:' || line === indent2 + 'cycles:' || line === indent0 + 'cycles:' || line === indent2 + 'alerts:' || line === indent0 + 'alerts:') {
      if (current && current.id) result.nodes.push(current);
      if (current && current.from) result.edges.push(current);
      current = null;
      if (line.endsWith('nodes:')) section = 'nodes';
      else if (line.endsWith('edges:')) section = 'edges';
      else if (line.endsWith('cycles:')) section = 'cycles';
      else if (line.endsWith('alerts:')) section = 'alerts';
      continue;
    }

    if (line.match(new RegExp('^' + ' '.repeat(baseIndent + 2) + '- id:'))) {
      // 新节点开始前，先推入上一个节点（处理无空行分隔的连续节点）
      if (current && current.id) result.nodes.push(current);
      current = {};
      current.id = line.split('id:')[1].trim();
      section = 'node_item';
      continue;
    }

    if ((section === 'node_item' || section === 'nodes') && line.match(new RegExp('^' + ' '.repeat(baseIndent + 4) + '\\w+:'))) {
      const [k, ...v] = line.trim().split(':').map(s => s.trim());
      if (current && k) current[k] = v.join(':').replace(/"/g, '');
      continue;
    }

    if (section === 'node_item' && line === '' && current && current.id) {
      result.nodes.push(current);
      current = null;
      section = 'nodes';
      continue;
    }

    if ((section === 'edges' || section === 'edges_item') && line.match(new RegExp('^' + ' '.repeat(baseIndent + 2) + '- from:'))) {
      // 新边开始前，先推入上一条边
      if (current && current.from) result.edges.push(current);
      current = {};
      const m = line.match(/from:\s*(\S+)/);
      if (m) current.from = m[1];
      section = 'edges_item';
      continue;
    }

    if (section === 'edges_item' && line.match(new RegExp('^' + ' '.repeat(baseIndent + 4) + '\\w+:'))) {
      const [k, ...v] = line.trim().split(':').map(s => s.trim());
      if (current && k) current[k] = v.join(':').replace(/"/g, '');
      continue;
    }

    if (section === 'edges_item' && line === '' && current && current.from) {
      result.edges.push(current);
      current = null;
      section = 'edges';
      continue;
    }
  }
  // push last item
  if (current && current.id) result.nodes.push(current);
  if (current && current.from) result.edges.push(current);

  return result;
}

function escapeMermaid(text) {
  return String(text).replace(/"/g, '#quot;').replace(/</g, '#lt;');
}

/**
 * 仅从 dependency_graph 生成 Mermaid，不处理 cycles/alerts/parallel_groups
 *
 * 约束：输入 YAML 中有多少 edges，输出 Mermaid 就有多少箭头。
 *       不添加 YAML 中不存在的边（如 CI 全量覆盖边应在 dependency-analyzer 层面建模）。
 */
function generate(data) {
  const graph = data.dependency_graph || data;
  const lines = ['graph TB'];

  const repoGroups = new Map();
  (graph.nodes || []).forEach(n => {
    const r = n.repo || 'unknown';
    if (!repoGroups.has(r)) repoGroups.set(r, []);
    repoGroups.get(r).push(n);
  });

  let subgraphIdx = 0;
  for (const [repo, nodes] of repoGroups) {
    subgraphIdx++;
    lines.push(`  subgraph sg${subgraphIdx}["📦 ${escapeMermaid(repo)}"]`);
    nodes.forEach(n => {
      const priorityIcon = n.priority === 'P1' ? '🔴' : '🟡';
      const label = `${n.id}: ${escapeMermaid(n.name)}<br/>${priorityIcon} ${n.priority}`;
      lines.push(`    ${n.id}["${label}"]`);
    });
    lines.push('  end');
  }

  (graph.edges || []).forEach(e => {
    const label = `${e.type}: ${escapeMermaid(e.label || '')}`;
    lines.push(`  ${e.from} -->|"${label}"| ${e.to}`);
  });

  return lines.join(EOL);
}

// ── main ────────────────────────────────────────────────
let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { stdin += chunk; });
process.stdin.on('end', () => {
  try {
    const data = parseSimpleYaml(stdin);
    const mermaid = generate(data);
    process.stdout.write(mermaid + EOL);
  } catch (err) {
    console.error('yaml-to-mermaid: parse error:', err.message);
    process.exit(1);
  }
});
