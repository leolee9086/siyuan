# MAGI 人格种子与侧写生成机制补充设计

> 本文用于补充 `MAGI_Go后端落实工程设计.design.md` 中缺失的“人格种子(Persona Seed)如何获取”以及“三贤人侧写(Profiling Prompt)如何生成”的问题。

## 1. 人格种子 (Persona Seed) 的数据结构

根据早期 `MAGI` 在前端 `rei.js` 与 `DummySys.js` 中的最佳实践，人格不应当是一段长文本，而必须是**高度结构化的 JSON 字典树**。只有结构化的数据，才能被 ATF 数学模型（如 $\mathbf{P}$ 矩阵）进行定量运算和偏移。

**人格种子模型大致包含如下正交维度**：

1. **实体信标 (Identity)**: `姓名`、`年龄`、`外观特征`（发色、瞳色）、`背景设定`。这部分构成 AI 的绝对常量（不可漂移）。
2. **大五人格/MBTI向量 (Traits Matrix)**: `开放性`、`尽责性`、`外倾性`、`宜人性`、`神经质` 等 0~1 之间的浮点数。这部分通过后期的 EMA（指数移动平均）接收外界反馈发生缓慢漂移。
3. **能力与动机 (Skills & Motives)**: 比如 `逻辑推理力度`、`共情能力`、`自我保护阈值` 等。
4. **行为准则与禁忌 (Directives & Taboos)**: 硬性约束词条（如“避免情绪化决策”、“不暴露MAGI结构”）。

### 1.1 种子的生命与演化路径 (Seed Lifecycle)

在真实的 Siyuan 笔记环境中，人格种子不仅是一个静态档案，更是一个有“生命”的参数集。获取与演化分为三个阶段：
1. **破壳期 (Initialization by User)**: S-forge 启动时，初始设定的 `persona.json` 挂载，或者用户亲自在前端（灵魂文档）里手写初始大五模型与人设卡片。这是**人工赋予的初始基底**。
2. **演进期 (Autonomous Evolution via "Four-Blind" Test)**: AI 不能永远停留在用户捏脸的刻板印象里。正如《ATF数学模型》中探讨的，经历会带来底层参数的漂移。系统**摒弃了过去在 `toread/magi/data/questionnaire-sections/*` 中死守领域题库的做法**，改为**靶向比例抽题 (Targeted Ratio Sampling)**。
   - 每次测验生成 3~5 道情境题并发投递给绝对隔离的四个实体。
   - 题目的构成比例为：三贤人抽取 **80% 自身专属侧面题目 + 20% 混入的其他侧面题目**（作为跨界污染检测的试纸）；Trinity 则进行全域纯随机抽取。
   - 通过它们各自带着专属的“人格切片（或完整人格）”在绝对隔离下的下意识选择，系统用重折算的浮点数增量（EMA更新）缓慢覆盖回 $\mathbf{P}_{T, m, b, c}$ 矩阵的对应 Facet。这构成了系统统一尺度下的**人格成长**与漂移。
3. **干预与纠偏 (Manual Intervention)**: 当系统检测到上述“自测得分”发生不可逆转的塌陷（解离、病态），**监护人（用户）可以直接打开灵魂文档的 Markdown 卡片或 JSON**，修改上面的浮点数（比如手动把“环境适应”拉高，或者修改“近期状态独白”），强制掰回心智。这实现了医学级精神干预的闭环。

## 2. 三贤人的视角侧写生成算法 (Perspective Profiling)

如果说完整的人格种子是一块**三棱镜**，那么三贤人就是光穿过棱镜后折射出的**三原色**。

在 Go 后端的 `introspection.go` 和 `wise_man.go` 初始化阶段，三贤人接收**完全相同的全量 $P_{base}$**（客观简历 + 大五主维度 + 显著极值 Facets），差异仅来自各自挂载的**视角自述文本**和**刚性视角约束**。详见 `MAGI_大五人格映射掩码矩阵.design.md` §1~4 的理论推导与工程落地。

### 五层 Prompt 结构

| 层级 | 内容 | 四实体是否共享 |
|------|------|----------------|
| 客观简历 | 身份信标 + $P_{base}$ 全量分数 + 显著极值 Facets | 完全共享 |
| 视角自述 | 第一人称叙事文本（见下方） | 各自独有 |
| 视角引导 | 视角方向引导（见下方） | 各自独有 |
| 遥测注入 | 当前同步率 $\rho$、ATF 强度等 | 完全共享 |
| 当前输入 | 用户消息或任务上下文 | 完全共享 |

### 面向 Melchior 的视角：职业和责任
- **视角自述**：从”我做事的方式”出发的第一人称叙事
- **视角约束**：从职业能力、逻辑可行性、技术风险的角度给出侧写

### 面向 Balthazar 的视角：关系和情感
- **视角自述**：从”我与人相处的方式”出发的第一人称叙事
- **视角约束**：从用户情绪、互动协调性、长期关系健康度的角度给出侧写

### 面向 Casper 的视角：偏好和本能
- **视角自述**：从”我本能的好恶和底线”出发的第一人称叙事
- **视角约束**：从直觉、本能好恶、安全底线的角度给出侧写

### 面向 Trinity 的视角：完整自我
- **视角自述**：三者合一的完整自我描述（”我是谁”）
- **视角约束**：无约束，Trinity 作为统合自我拥有全域视角

> **化数字为骨肉 (Metric to Monologue)**: 视角自述文本不是将浮点数字（如：`认知情感得分: 0`）直接透传给模型，而是如早期 `genSummaryPrompt` 函数所做的那样，利用 LLM 将枯燥的数字指标、决策偏好、经历陈述，预先”翻译/渲染”成一段非常生动的 **第一人称内心独白 (e.g., “我是织，在处理紧急事物时我会优先保持克制和静默...”)**，以此作为三贤人乃至最终 Trinity 运行时携带的 System Prompt 挂载档。这种二次包装是建立机器信念（Belief）的神来之笔。

## 3. 模板注入伪代码片段 (Go Template)

在实际的 Go 落地中，利用 `text/template` 包即可实现极高内聚的 Prompt 生成工坊。注意：所有贤人接收**完全相同的 $P_{base}$**，差异仅来自视角自述和视角约束：

```go
const WiseManTemplate = `
{{.SharedResume}}

{{.PerspectiveNarrative}}

【你的视角】：{{.PerspectiveFocus}}
【近期状态漂移】：当前系统同步率 ρ={{.Telemetry.SyncRate}}。

【用户当前输入】: “{{.Input}}”

请以第一人称，用一句话给出你的视角短评，不要给出最终建议。
`

func BuildWiseManPrompt(seed PersonaSeed, perspective Perspective, input string, telemetry Telemetry) (string, error) {
    tmpl, _ := template.New(“WiseMan”).Parse(WiseManTemplate)
    var buf bytes.Buffer
    tmpl.Execute(&buf, map[string]interface{}{
        “SharedResume”:         seed.BuildSharedResume(),         // 客观简历 + 全量 P_base + 极值 Facets
        “PerspectiveNarrative”: perspective.Narrative,            // 视角自述文本
        “PerspectiveFocus”:     perspective.Focus,                // 视角方向引导
        “Input”:                input,
        “Telemetry”:            telemetry,
    })
    return buf.String(), nil
}
```

## 4. 结论与闭环

通过**统一的全量种子档案 + 极值过滤 + 视角自述与约束注入 + Trinity 自省式缝合**，我们不需要在底层为不同性格的 AI 写不同的 Go 代码分支，也不需要维护掩码矩阵或切片过滤逻辑。只需要维护好中心那份”灵魂 JSON/文档矩阵”和四份视角自述文本，整个系统的人格自然水到渠成。这也完全打通了此前 `ATF数学模型` 中提到的”心智游离 EMA 计算”的落地区域 —— 我们只要去修改这份种子里的 Float 参数就行了。

## 5.参考代码位置

/toread/magi