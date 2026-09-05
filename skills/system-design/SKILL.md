---
name: system-design
description: 将 PRD 转化为面向多服务架构的技术规格。编排 Architect Agent 推演 + Interface-Designer Agent 补充 + 辅助 Skill，产出技术规格文档。
---

# 系统设计

将 PRD 转化为技术规格（Technical Specification），包含 SR 拆解、流程设计、数据模型、接口契约。

## 原则

- 描述服务"做什么"（接口契约、验收条件），不涉及"怎么做"（那是 SDD 的职责）
- 接口契约是主输出：REST API、CRD Schema、Prometheus 指标、协议头必须明确定义
- 最多提 3 个澄清问题，只问影响接口设计、服务边界或数据模型归属的阻断级不确定点
- 技术规格是推演的产物，不是一次性填充的模板

## 工作流

### Step 0：加载上下文

读取 PRD 和可行性分析报告（`.md` 文件），读取 L0 `repos/arch-index.md` 和受影响服务的 L1。

从原始文档中提取封装为 C1 上下文包（不传给 Agent 原始文件路径）：

```
C1 = {
  prd: { 场景列表, FR列表, 约束(范围排除/Clarifications架构决策) },
  feasibility: { 已确认假设, 关键风险Top3-5, 隐含NFR列表 },
  architecture: { 服务拓扑(L0§1-2摘要), 涉及服务现有接口契约, constitution核心约束 }
}
```

**可行性报告阻断检查：**
- 文件不存在 → 提示用户，等待确认
- "未确认假设清单"有 `⚠️ 待确认` 条目 → 阻断，列出条目和影响
- 所有假设已确认 → 继续。提取关键风险和隐含 NFR 至 C1

### Step 0.5：复杂度预判

基于 C1 中的 FR 和受影响服务数判定 D1：
- 影响服务 ≤2 且无新增跨服务流程 → 单服务
- 其他 → 多服务

### Step 1：核心推演（委派 Architect Agent）

委派 architect Agent，传入 C1 + D1 + Q1（澄清结论，如有）。

Agent 返回：A1 影响面分析 + A2 流程设计 + A3 SR 草案 + A4 未确认假设 + A5 FR 覆盖核查 + A6 建议澄清问题 + 状态

### Step 2：澄清循环

maxRounds = 3，计数器 rounds = 0。

循环逻辑：
1. rounds++，接收 Agent 输出
2. 如状态 == DONE：退出循环，进入 Step 3
3. 如 rounds == 3：
   - 生成中期汇报：已稳定 SR / 阻断级假设 / 可后置假设 / 选项 A(继续+重置计数器)/B(接受可后置)/C(暂停存档)
   - 用户选 A → rounds = 0，继续
   - 用户选 B → 可后置假设标为 D-N 记录，退出循环
   - 用户选 C → 写入进度存档至 `.agent-plugin-design/sessions/<name>/`，退出
4. 从 A4/A6 中选一个阻断级假设（优先级：影响多 SR > Agent 建议排序 > SR 编号最小）
5. 向用户提问（含选项和推荐）
6. 记录答案至 Q1，重新委派 Architect Agent（修正模式，带增量 Q1）

### Step 3：接口契约补充（委派 Interface-Designer Agent）

SR 稳定后委派 interface-designer Agent，传入 C1(接口节选) + A3 + A2。

产出：I1 接口契约表 + I2 OpenAI 覆盖检查 + I3 接口变更汇总 + I4 数据模型字段表

### Step 4：依赖建模

调用 dependency-analyzer Skill，传入稳定版 SR，获取 YAML 格式的依赖分析结果（DEP_YAML）。

从 YAML 中提取关键信息：
- `cycles` 非空 → 告警，列出循环节点，标记为开放问题
- `alerts` 非空 → 逐条处理告警
- `parallel_groups` → 用于建议开发排期
- `critical_path_p1` → 用于 MVP 范围确认

YAML 原文保留不修改，供 Step 7 传给渲染脚本。

### Step 5：架构挑战检测

将设计产出与 constitution 原则对比，调 constitution-checker 逐条检查。

**触发架构分析的条件（满足任一）：**
- 需求突破现有服务边界
- 引入新基础设施组件
- 新增跨服务通信协议
- 现有组件能力明显不足

**去重原则：** 可行性报告已覆盖的挑战不重复输出。

**无挑战时：** 跳过该节。**有挑战时：** 生成差距分析表和选型决策。

同时检测 E2 架构演进信号（突破服务边界/新增基础设施/与 constitution 冲突/需改造现有组件），如触发则标记，供后置 architecture-evolution-check 使用。

### Step 6：澄清（≤3 个问题）

检查是否有遗漏的不确定点。最多 3 个，每次一个。0 个则直接进入 Step 7。

### Step 7：生成技术规格文档

**7a. 渲染依赖图：** 将 Step 4 获取的 DEP_YAML 通过 `yaml-to-mermaid.js` 脚本转换为 Mermaid：

```bash
echo "$DEP_YAML" | yaml-to-mermaid.js
```

脚本返回 Mermaid 文本（不含 ```mermaid 包裹），Controller 用其拼接最终文档中的 Mermaid 块。

**7b. 组装文档：** 调用 techspec-template 获取模板和填充规则，整合所有上游产物填充生成文档。传入参数含：DEP_YAML（原始 YAML）+ DEP_MERMAID（脚本输出）。

**头部生成：** 文档头部的版本范围描述从 `DEP_YAML.doc_header.version_range` 直接引用，不得手工编写。

输出路径：`docs/specs/techspec-<FEATURE_SHORT_NAME>.md`

**7c. 一致性校验：** 在文档生成完成后，对以下项执行校验。校验以 DEP_YAML 为权威来源：

| 校验项 | 检查逻辑 | 失败时 |
|--------|---------|--------|
| 头部版本范围 | 文档头部"版本范围"是否与 `DEP_YAML.doc_header.version_range` 一致？ | 自动用 YAML 覆盖 |
| SR 版本分配 | 需求矩阵表中每行的版本列是否与 `DEP_YAML.version_assignments` 匹配？ | 自动修正版本列 |
| 关键路径可达 | `critical_path_p1.path` 中每对相邻节点，edges 中是否存在连接它们的边（任意 type）？ | 追加"开放问题"告警条目 |
| D-N 去重 | 关键决策表中是否有两条记录的核心约束相同、影响范围重叠？ | 自动合并为一条 |
| Mermaid 一致性 | Mermaid 图中是否存在 YAML edges 中没有的边？ | 从 YAML 重新生成 Mermaid |

**7d. 自动修正：** Step 7c 中标记为"自动"的失败项，直接修正文档对应的文本/表格/Mermaid，不向用户告警。仅关键路径不可达一项例外——追加到"开放问题"而非修改 YAML 数据。

### Step 8：验证

交付前检查清单：
- [ ] 每个 SR 只归属一个服务/子模块
- [ ] 没有 SR 描述内部实现
- [ ] 关键决策记录节存在且完整
- [ ] D-N 记录无重复：7c 自动合并后语义无变化
- [ ] FR 全覆盖验证表无遗漏
- [ ] 所有验收条件 BDD 格式
- [ ] 关键流程时序图覆盖 P1 SR happy path
- [ ] 数据模型字段表完整
- [ ] 所有跨服务接口已在接口契约变更汇总中出现
- [ ] 依赖图无循环依赖
- [ ] 7c 自动校验全部通过（或已自动修正）
- [ ] 开放问题中无意外新增项
- [ ] 可行性报告 NFR 已映射至 SR 约束
- [ ] 可行性报告关键风险已映射至开放问题或 SR 约束

### Step 9：交付

交付报告：
- 输出文件路径
- SR 总数及各服务分布
- FR 覆盖率
- 关键决策记录数
- 关键流程时序图/数据模型实体/接口数量
- 是否触发架构分析
- 架构演进信号（有/无）
- 建议下一步：如有 E2 信号，建议执行 architecture-evolution-check

### Step 10：后置 — 架构演进检测（可选）

如有 E2 信号，提醒用户执行 `/architecture-evolution-check <techspec路径>`。

## 进度存档

暂停时写入 `.agent-plugin-design/sessions/<name>/`：
- `state.json`：rounds、maxRounds、当前阶段
- `sr-draft.md`：A3
- `assumptions.md`：A4
- `qa-log.md`：Q1
- `flow-design.md`：A2
- `context.json`：PRD路径、可行性报告路径引用

恢复时检测存档目录 → 询问用户 → 加载跳过复杂度预判 → 进入修正模式。
