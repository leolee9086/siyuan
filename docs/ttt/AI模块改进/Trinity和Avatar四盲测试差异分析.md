# Trinity和Avatar在四盲测试中的正确区别

## 关键理解

根据用户反馈和ATF数学模型：

### 相同点
1. **都使用IntegratedDescription**：相同的人格描述文档
2. **都在问卷测试场景**：不使用完整MAGI对话架构（无source标记、think_about等复杂机制）
3. **都独立作答**：四盲测试要求

### 差异点

**Trinity**：
- 知道自己是"Trinity"（简单身份声明）
- 可能有MAGI系统的某些基础认知
- 但在四盲测试时不能看到三贤人的答案

**Avatar**：
- 完全裸LLM
- 不知道MAGI架构
- 不知道自己是"Trinity"或任何特殊身份

## 当前PresetAnswerer的问题

```go
biased := clampLikert(base + entityLikertBias(entity, q.Domain))

func entityLikertBias(entity ATFEntity, domain Domain) int {
    // ...
    case EntityAvatar:
        return 0
    default: // Trinity
        return 0
}
```

**问题**：Trinity和Avatar都是0偏置，会给出完全相同的答案，导致C_ext≈1.0。

## 可能的解决方案

### 方案1：PresetAnswerer中添加微小差异
- Trinity: 偏置0
- Avatar: 偏置随机±0.1（模拟LLM的随机性）

### 方案2：OpenAIAnswerer中通过提示词差异
- Trinity: "你是Trinity。请根据以下人格描述作答：{IntegratedDescription}"
- Avatar: "请根据以下人格描述作答：{IntegratedDescription}"

### 方案3：温度参数差异
- Trinity: temperature=0.7（有一定创造性）
- Avatar: temperature=0.0（完全确定性）

## 用户的真实意图

用户说"avatar不注入同样提示词怎么实现测量裸LLM使用同一份提示词时的反应"，意思是：
- Avatar应该使用**相同的人格描述**（IntegratedDescription）
- 但Avatar是"裸LLM"，不应该有任何MAGI身份认知
- 差异应该来自于**是否有MAGI身份认知**，而不是人格描述本身

## 正确的实现

在问卷测试场景下：
- Trinity提示词：极简 + 身份声明 + IntegratedDescription
- Avatar提示词：极简 + IntegratedDescription（无身份声明）

**不需要**完整的MAGI对话架构（那是用于正常对话的）。
