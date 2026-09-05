# agent-plugins — Claude Code Plugin Context

PRD 工作流 + 系统设计技能包：提供从需求描述到可交付 PRD 的完整工具链，并将 PRD 转化为面向多服务架构的技术规格。

## 版本管理

修改本插件任何技能/Agent 的实现后，**必须**执行版本迭代：

1. 按语义化版本规则递增 `.claude-plugin/plugin.json` 中的 `version` 字段
2. 执行 `bash scripts/sync-version.sh` 将版本同步到 `README.md`
3. 执行 `npm run build` 重新生成 Claude / DSH 产物
4. 如需更新本地 marketplace 产物，执行 `npm run publish:marketplace:local`

版本号规则：功能新增/重大变更（MINOR +1）、Bug 修复/文案调整（PATCH +1）、不兼容变更（MAJOR +1）。

## 构建产物边界

本仓库是插件源码与构建逻辑的唯一真相源。`dist/claude` 与 `dist/dsh` 均为生成产物；`agent-plugin-marketplace` 只接收 Claude marketplace 产物，不承载业务源码。npm registry 是 `dist/dsh` 的发布通道，不是单独的制品目标。

`dist/dsh` 必须保持为 DeepSeek Harness 可安装 bundle 包：`package.json` 声明 `dsh.bundle.patch`，`cordis.patch.yml` 注册包内 `skills/` 为额外 `dsh-skill-filesystem` 根目录。发布到 npm registry 后，用户通过 `dsh plugin --profile <name> add @zlink-cloudtech/dsh-agent-plugins` 安装。

构建脚本必须把 `bin/`（含 `yaml-to-mermaid.js`，system-design 依赖图渲染使用）一并复制进 `dist/claude` 与 `dist/dsh` 产物。

## 标准功能动词

本插件技能文件中使用 `「」` 标注的功能动词短语替代平台特定工具名，解耦技能描述与运行平台。

| 动词 | 含义 |
|------|------|
| `「分发子任务」` | 将独立任务委托给子Agent执行 |
| `「委托[名称]Agent」` | 指定具体Agent执行子任务（插件内部Agent保留精确名称） |
| `「调用[名称]技能」` | 加载并执行一个已定义的技能 |
| `「向用户提问」` | 向用户呈现选项并收集决策 |
| `「写入文件」` | 创建或覆盖文件 |
| `「更新文件」` | 修改已有文件的局部内容 |
| `「在隔离环境中执行」` | 在独立的Git工作副本中执行子任务 |
| `「并行分发」` / `「串行分发」` | 指定多个子任务的执行方式 |
| `「查询仓库知识库」` | 对指定 GitHub 仓库提问，获取 AI 生成的上下文答案（DeepWiki） |
| `「读取仓库文档结构」` | 查看 GitHub 仓库的文档主题列表（DeepWiki） |
| `「读取仓库文档内容」` | 查看 GitHub 仓库的完整文档内容（DeepWiki） |

- 委托 prompt 代码块是发给子Agent的指令，不在其内做解耦替换
- 插件内部 Agent/Skill 名称（如 product-expert、feasibility-report-checker、architect、interface-designer）保留精确引用

## Available Agents

### PRD 工作流

- **product-expert**: 产品专家，分析需求与现有产品功能的关系（互补/替代/新增），检测历史决策冲突，提取未确认假设清单。自动加载 product-knowledge-sync 获取产品知识库。
- **system-architect**: 系统架构师，分析需求的技术依赖和架构影响，判断依赖是否满足、评估侵入程度、识别关键风险。自动读取 L0/L1 架构索引。
- **action-researcher**: 预研执行器，承接可行性报告中的"技术预研"和"风险缓解"类行动项，执行结构化技术预研以消除风险和不确定性，输出预研报告和 PRD 修改建议。由 spec-analysis Phase 5 自动触发或手动调用。

### 系统设计

- **architect**: 核心推演引擎，影响面分析 → 流程设计 → SR 拆分 → 假设识别，支持澄清回退与中期汇报。由 system-design 自动调用。
- **interface-designer**: 接口契约定义（REST API / CRD Schema / Prometheus 指标 / 协议头），含 OpenAI 兼容接口检查与数据模型字段补全。由 system-design 在 SR 稳定后自动调用。

## Available Skills

### PRD 工作流

- **product-knowledge-sync**: 根据产品类型同步对应的知识库，支持持久化配置以跳过后续询问
- **spec-drafter**: 将自然语言需求转换为结构化 PRD（产品需求文档）
- **spec-clarifier**: 对已有 PRD 进行歧义检测与澄清，最多提出 5 个关键问题并编码回文档
- **spec-checker**: 从结构规范、内容完整性、内容准确性三个维度对 PRD 进行质量评审打分
- **spec-analysis**: 对已澄清的 PRD 进行技术可行性分析，输出可行性报告：需求合理性检查、依赖分析、架构影响评估、复杂度评估、未确认假设清单、隐含 NFR 推导。内置 Phase 4 质量门，自动调用 feasibility-report-checker 评审并修复
- **feasibility-report-checker**: 对可行性分析报告进行独立质量评审，从覆盖完整性、行动可执行性、逻辑一致性三个维度打分，标记可自动修复项。可独立调用或由 spec-analysis Phase 4 自动触发

### 系统设计

- **system-design**: Controller 技能，将 PRD 转化为多服务技术规格：上下文加载、复杂度预判、Agent 委派（architect / interface-designer）、澄清循环、文档组装与验证
- **constitution-checker**: 按架构原则逐条检查设计合规性
- **dependency-analyzer**: SR 依赖图 + 循环检测 + 并行组（输出纯 YAML，供 Agent 解析和 `bin/yaml-to-mermaid.js` 渲染）
- **techspec-template**: 技术规格文档结构和填充规则
- **architecture-evolution-check**: 检测架构冲突，生成演进需求文档（后置技能）

## Typical Workflow

1. `product-knowledge-sync` — 加载产品知识库
2. `spec-drafter` — 根据需求描述生成初始 PRD
3. `spec-clarifier` — 澄清 PRD 中的歧义，完善细节
4. `spec-checker` — 评审 PRD 质量，输出评分和改进建议
5. `spec-analysis` — 技术可行性分析，判断是否具备进入系统设计阶段的条件
6. `action-researcher` — 对可行性报告中的"技术预研""风险缓解"类行动项执行预研验证，输出预研报告并反馈 PRD 修改建议
7. `system-design` — 将 PRD 转化为面向多服务架构的技术规格（委派 architect / interface-designer，衔接 dependency-analyzer 与 constitution-checker）
8. `architecture-evolution-check` — 可选：检测架构冲突，生成演进需求文档
