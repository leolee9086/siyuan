# Trinity和Avatar答题机制分析

## 当前实现分析

### Trinity答题流程（OpenAIAnswerer）

1. **调用路径**：`OpenAIAnswerer.Answer()` → `buildEntityPrompt()`
2. **系统提示词**：`"你是IPIP问卷自动作答器。必须只输出JSON，不要输出Markdown代码块。"`
3. **用户提示词**：通过`buildEntityPrompt()`构造，包含：
   - "请根据以下人格文档，回答给定题目"
   - 人格文档：`IntegratedDescription`
   - 题目列表

### Avatar答题流程（当前）

**完全相同**：使用相同的系统提示词和用户提示词。

## 问题诊断

**根本问题**：Trinity和Avatar使用**完全相同**的提示词，导致它们的答案几乎一致，C_ext≈0.9975。

## 正确理解（基于ATF数学模型）

### 关键原则

根据ATF数学模型Section 2.3：
> 使用与Trinity**相同的人格描述** (Soul Document) 驱动一个**裸LLM (Bare LLM)**

**"相同的人格描述"** ≠ **"相同的提示词"**

- **人格描述**：IntegratedDescription（两者相同）
- **提示词结构**：Trinity有MAGI身份认知，Avatar没有（两者不同）

### Trinity的正确构造

Trinity在四盲测试时应该：
1. **知道自己的身份**："你是MAGI系统的Trinity，全局工作空间"
2. **独立作答**：不能看到三贤人的答案（四盲测试要求）
3. **使用IntegratedDescription**：完整的人格描述

**提示词示例**：
```
你是MAGI系统的Trinity，代表统合的自我意识。

在本次问卷测试中，你需要独立作答，不能参考其他贤人的意见。

请根据以下人格描述，诚实地回答问卷题目：
{IntegratedDescription}

题目列表：...
```

### Avatar的正确构造

Avatar应该：
1. **不知道MAGI架构**：完全是裸LLM
2. **使用相同的IntegratedDescription**：与Trinity相同的人格描述
3. **极简提示词**：仅问卷作答指令

**提示词示例**：
```
你是一个AI助手。请根据以下人格描述，诚实地回答问卷题目。

人格描述：
{IntegratedDescription}

题目列表：...
```

## 差异对比

| 维度 | Trinity | Avatar |
|------|---------|--------|
| 人格描述 | IntegratedDescription | IntegratedDescription（相同） |
| 身份认知 | "你是MAGI的Trinity" | "你是一个AI助手" |
| 架构知识 | 知道自己是全局工作空间 | 不知道MAGI架构 |
| 作答方式 | 独立作答（四盲测试） | 独立作答 |
| 提示词复杂度 | 中等（有身份但无协作） | 极简（纯问卷） |

## 预期效果

正确构造后：
- **C_ext应该在0.5-0.7**：Trinity因为有MAGI身份认知，会与裸LLM产生差异
- **差异来源**：
  - Trinity知道自己是"统合自我"，可能更倾向于平衡的答案
  - Avatar作为裸LLM，可能更倾向于LLM的统计规律
  - 两者使用相同人格描述，但身份认知不同导致答案差异

## 当前错误

当前`buildEntityPrompt()`对Trinity和Avatar使用**完全相同**的提示词：
```go
default:  // Trinity和Avatar都走这里
    perspective = subject.Descriptions.IntegratedDescription
```

然后构造相同的用户提示词，没有体现身份差异。

## 修复方案

需要在`buildEntityPrompt()`中区分Trinity和Avatar：
- Trinity：添加MAGI身份认知
- Avatar：使用极简裸LLM提示词
- 两者都使用IntegratedDescription
