# 可行性报告评审报告

> 评审日期：{{date}}
> 被评审报告：{{report_file}}

## 评审总览

| 维度 | 权重 | 得分 | 满分 | 加权得分 |
|------|------|------|------|----------|
| 覆盖完整性 | 40% | {{coverage_score}} | 5 | {{coverage_weighted}} |
| 行动可执行性 | 35% | {{actionability_score}} | 5 | {{actionability_weighted}} |
| 逻辑一致性 | 25% | {{consistency_score}} | 5 | {{consistency_weighted}} |
| **加权总分** | | | | **{{total_score}}** / 10 |

**评审等级**：{{grade}}

---

## 一、覆盖完整性（权重 40%）

### 1.1 待确认假设覆盖（20%）

| 待确认假设 ID | 假设内容摘要 | 是否有对应行动 | 行动 ID | 状态 |
|--------------|------------|:---:|---------|------|
{{assumption_coverage_rows}}

**得分**：{{assumption_coverage_score}} / 5

### 1.2 风险覆盖（12%）

| 风险编号 | 风险摘要 | 是否有对应行动 | 行动 ID / 接受声明 | 状态 |
|---------|---------|:---:|------------------|------|
{{risk_coverage_rows}}

**得分**：{{risk_coverage_score}} / 5

### 1.3 风险建议流入（8%）

| 风险编号 | 内嵌建议摘要 | 是否流入 §九 | 对应行动 ID | 状态 |
|---------|------------|:---:|-----------|------|
{{risk_advice_flow_rows}}

**得分**：{{risk_advice_flow_score}} / 5

---

## 二、行动可执行性（权重 35%）

### 2.1 目的纯度（15%）

| 行动 ID | 行动项摘要 | 是否存在实现类内容 | 问题 |
|---------|----------|:---:|------|
{{purpose_purity_rows}}

**得分**：{{purpose_purity_score}} / 5

### 2.2 类型匹配度（10%）

| 行动 ID | 行动项摘要 | 类型 | 执行建议 | 是否匹配 | 问题 |
|---------|----------|------|---------|:---:|------|
{{type_match_rows}}

**得分**：{{type_match_score}} / 5

### 2.3 状态与排序（10%）

| 检查项 | 结果 | 问题 |
|--------|:---:|------|
| 所有行动项状态初始为"待处理" | {{status_init}} | {{status_init_issue}} |
| 阻塞项排在前面 | {{blocking_order}} | {{blocking_order_issue}} |
| 优先级排序正确 | {{priority_order}} | {{priority_order_issue}} |

**得分**：{{status_sort_score}} / 5

---

## 三、逻辑一致性（权重 25%）

### 3.1 结论与假设/风险状态一致（15%）

| 检查项 | 结果 | 说明 |
|--------|:---:|------|
| 有待确认假设 + 无已完成行动 → 结论为"有条件通过" | {{conclusion_gate}} | {{conclusion_gate_detail}} |
| 有阻塞项 → 结论非"可行" | {{blocking_gate}} | {{blocking_gate_detail}} |
| "不可行"结论有明确理由 | {{infeasible_gate}} | {{infeasible_gate_detail}} |

**得分**：{{conclusion_consistency_score}} / 5

### 3.2 交付路径与风险匹配（10%）

| 检查项 | 结果 | 说明 |
|--------|:---:|------|
| 阻塞风险在交付路径中有缓解措施 | {{mitigation_match}} | {{mitigation_match_detail}} |
| MVP 拆分遵循"阻塞风险优先" | {{mvp_order}} | {{mvp_order_detail}} |

**得分**：{{delivery_match_score}} / 5

---

## 修复建议汇总

### 可自动修复项

{{auto_fixable_items}}

### 需手动修复项

{{manual_fix_items}}

---

**评审结论**：{{review_conclusion}}
