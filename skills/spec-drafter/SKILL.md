---
name: spec-drafter
description: Transforms a natural language feature or product requirement into a structured PRD (Product Requirements Document). Use when a user describes a feature, user story, or product idea and needs it turned into a formal specification. Depends on product-knowledge-sync to pull the latest product knowledge before drafting. Pairs with spec-clarifier for resolving ambiguities after the initial draft.
---

# Spec Drafter

Transform a user's natural language requirement into a structured, business-readable PRD.

## Principles

- Focus on **WHAT** users need and **WHY** — never HOW to implement.
- Write for business stakeholders, not developers. No tech stack, APIs, or code structure.
- Make informed guesses to fill gaps; document assumptions explicitly.
- Use `[NEEDS CLARIFICATION: <question>]` markers sparingly — **maximum 3 total** — only for decisions that significantly change scope or have no reasonable default.
- Think like a tester: every vague requirement should fail the "testable and unambiguous" check.

## Workflow

### 0. Load Product Knowledge Context

Before parsing the requirement, load product knowledge context via the `product-knowledge-sync` skill.

1. 「调用 product-knowledge-sync 技能」。该技能处理产品类型检测、知识库配置持久化和同步。

2. After the sync completes, the skill returns all loaded `.md` file contents and the product type. Use the returned product knowledge throughout the remaining steps to:
   - Align terminology and domain concepts with what the product team has established
   - Avoid contradicting known product decisions or constraints
   - Fill gaps using documented product direction rather than generic defaults

### 1. Parse Input

Extract from the user's description:
- **Actors**: who uses this feature
- **Actions**: what they do
- **Data**: what information is involved
- **Constraints**: limitations, rules, or edge cases

If the description is empty, ask for it before proceeding.

### 2. Fill Gaps

For anything not explicitly stated:
- Apply industry-standard defaults (document in Assumptions section).
- Reserve `[NEEDS CLARIFICATION]` for critical, high-impact unknowns only.
- Prioritize clarifications: **scope > security/privacy > user experience > technical details**.

**Common reasonable defaults (do NOT ask about these):**
- Data retention: domain-standard practices
- Error handling: user-friendly messages with fallbacks
- Performance: standard web/mobile expectations
- Authentication: session-based or OAuth2
- Integration patterns: RESTful APIs unless specified otherwise

**Common areas that DO warrant clarification** (only if no reasonable default exists):
- Feature scope and boundaries (include/exclude specific use cases)
- 权限隔离与资源隔离：功能是否涉及新增操作能力，若是，需确认不同角色（admin、组管理员、普通用户等）的调用权限边界，以及不同角色的数据可见范围（全部资源 / 所属组内资源 / 仅自己创建的资源）。相关知识以知识库(kb)中的角色定义为准。
- Security/compliance requirements (when legally or financially significant)

### 3. Draft the PRD

Load `references/spec-template.md` and fill it with concrete details. Apply these rules:

**User Scenarios** — each must be:
- **Prioritized** (P1, P2, P3, …) with P1 being the most critical for an MVP
- Independently testable — if only this scenario were implemented, it would still deliver user value
- Documented with **Why this priority** (business/user rationale) and **Independent Test** (how to validate it alone)
- Covered for: primary (happy path), alternative flows, and key edge cases
- Include an **Edge Cases** subsection listing boundary conditions and error scenarios

> Write enough scenarios to fully cover the feature — aim for completeness, not minimalism.

**Functional Requirements** — each must be:
- Testable and unambiguous
- Written without implementation details
- Paired with specific acceptance criteria (checkboxes)

**Success Criteria** — each must be:
- Measurable (include metrics: time, %, count, rate)
- Technology-agnostic (no frameworks, databases, or tools)
- User-facing (describe outcomes, not system internals)
- Verifiable without knowing implementation details

> Good: "Users can complete checkout in under 3 minutes"  
> Good: "System supports 10,000 concurrent users"  
> Good: "95% of searches return results in under 1 second"  
> Bad: "API response time under 200ms" (implementation detail, use "Users see results instantly")  
> Bad: "Database can handle 1000 TPS" (use a user-facing metric instead)  
> Bad: "React components render efficiently" (framework-specific)  
> Bad: "Redis cache hit rate above 80%" (technology-specific)

**Assumptions** — each should be:
- Named (bold label) and explained with context/reasoning
- Covering all guesses made during gap-filling

Omit template sections that genuinely don't apply. Never leave "N/A".

### 4. Handle Clarifications

After drafting, check for `[NEEDS CLARIFICATION]` markers:

- If **0 markers**: proceed to step 5.
- If **>3 markers**: keep only the 3 highest-impact ones; make informed guesses for the rest.
- If **1–3 markers**: present each to the user as a structured question:

```markdown
## Question [N]: [Topic]

**Context**: [Quote the relevant spec section]

**What we need to know**: [The specific question]

**Options**:

| Option | Answer | Implications |
|--------|--------|--------------|
| A      | [Answer] | [What this means] |
| B      | [Answer] | [What this means] |
| Custom | Your own answer | Describe below |

**Your choice**: _
```

Present all questions together. Wait for responses. Update the spec and remove markers.

**Table formatting** — ensure clarification tables render correctly:
- Use consistent spacing with pipes aligned
- Each cell must have spaces around content: `| Content |` not `|Content|`
- Header separator must have at least 3 dashes: `|--------|`

### 5. Validate

Before delivering, verify:

- [ ] No implementation details (languages, frameworks, APIs, databases)
- [ ] Focused on user value and business needs
- [ ] Written for business stakeholders, not developers
- [ ] All mandatory sections completed (Overview, Problem Statement, Goals, User Scenarios & Testing, Functional Requirements, Success Criteria)
- [ ] Every User Scenario has a Priority label, **Why this priority**, and **Independent Test**
- [ ] Edge Cases subsection present under User Scenarios
- [ ] All acceptance scenarios are defined
- [ ] Scope is clearly bounded
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable and technology-agnostic
- [ ] Feature meets the measurable outcomes defined in Success Criteria
- [ ] No implementation details leak into Success Criteria
- [ ] 若功能涉及新增操作能力，「身份权限」已明确：各角色的调用权限边界、不同角色的数据可见范围，且与产品知识库中的角色定义无冲突
- [ ] `[NEEDS CLARIFICATION]` markers fully resolved
- [ ] Assumptions section documents all guesses, each with a name and reasoning

If items fail, fix them before delivering. Max 3 self-correction iterations.

### 6. Deliver

Output the completed PRD as a markdown document. Default output path: `docs/specs/spec-<FEATURE_SHORT_NAME>.md`, where `FEATURE_SHORT_NAME` is a concise kebab-case identifier derived from the feature name (e.g., `kvcache-aware`, `model-routing`, `user-auth`). Write to that path unless the user specifies a different one.

Report:
- Output file path
- What assumptions were made
- Any open questions worth revisiting later
- Suggestion to use `spec-clarifier` if further ambiguity refinement is needed
