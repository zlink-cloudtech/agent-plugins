---
name: dependency-analyzer
description: 从 SR 列表推导依赖图、检测循环依赖、识别可并行开发组。被 system-design Controller 在 SR 稳定后调用。输出为纯 YAML 格式，供 Agent 解析和 yaml-to-mermaid.js 脚本渲染。
---

# 依赖分析

输入 SR 列表，输出结构化 YAML（含依赖图、并行组、关键路径、告警）。**只输出 YAML，不输出 ASCII 图或 Markdown 表格。**

## 分析步骤

1. **构建依赖图**：遍历 SR，识别每个 SR 的"依赖接口"和"对外接口"引用。方向为"被依赖 → 依赖方"
2. **循环检测**：从每个节点出发做 DFS，已访问节点出现在递归栈中则为循环依赖
3. **并行组划分**：无互相依赖的 SR 归入同一组。同一服务的多个 SR 默认需串行
4. **关键路径**：从无依赖的 SR 出发，计算包含**所有优先级**的实际最长可达路径（不排除非 P1 中间节点——否则路径可能断裂不可走通）。在路径列表中标注每个节点的优先级，P1 节点用 `**` 标记。
5. **全量覆盖型依赖**：当一个 SR（如 CI）的 prerequisite 为"全部"或覆盖所有其他 parallel_groups 时，自动为其生成到所有前序组节点的 `deploy` 类型边。
6. **版本分配**：基于 SR 的 `priority` 和 `version` 字段（来自 architect 输出），推导 `version_assignments` 和 `doc_header.version_range`。

## 输出格式（YAML，唯一格式）

```yaml
# 依赖分析结果 — Agent 可信数据源
dependency_graph:
  nodes:
    - id: SR-1
      name: "模型路由表 CRD"
      repo: agent-scaffold
      priority: P1
    - id: SR-2
      name: "Provider 适配器接口"
      repo: service-cluster
      priority: P1
  edges:
    - from: SR-1        # 被依赖方
      to: SR-2          # 依赖方
      type: interface   # interface | data | deploy
      label: "消费 CRD Schema"

cycles: []              # 循环依赖列表，空数组 = 无循环；有则列出 {nodes: [SR-X, SR-Y], description: "..."}

parallel_groups:
  - group: A
    sr_ids: [SR-1, SR-3]
    prerequisite: null  # null 表示无前置条件
  - group: B
    sr_ids: [SR-2]
    prerequisite: "组 A 接口契约确定"

critical_path_p1:
  path: [SR-1, SR-2, SR-6]   # 包含所有优先级节点，不跳过中间非 P1 节点
  estimated_sr_count: 3

alerts: []              # 告警列表，空数组 = 无告警；有则列出 {level: warning|error, node: SR-X, message: "..."}

# 版本分配（从 iteration_suggestions 和 SR priority 推导）
version_assignments:
  - version: "v0.1-MVP-1"
    sr_ids: [SR-1, SR-2, SR-7]
  - version: "v0.2-MVP-2"
    sr_ids: [SR-6, SR-9, SR-10, SR-11, SR-12]

# 文档头部版本范围摘要（Controller 可直接使用）
doc_header:
  version_range: "v0.1 — MVP-1 覆盖 SR-1, SR-2, SR-7（核心执行），MVP-2覆盖 SR-6, SR-9~SR-12（容器编排+镜像）"
```

## 约束

- 只输出 YAML 块，不输出其他格式
- `cycles` 和 `alerts` 即使为空也必须输出 `[]`（方便 Agent 判空）
- `version_assignments` 和 `doc_header` 为必填字段——即使只有一个版本也需输出
- `prerequisite` 无前置时写 `null`；全量覆盖时写 `all`
- `type` 枚举：`interface`（接口契约依赖）/ `data`（数据模型依赖）/ `deploy`（部署顺序依赖）
