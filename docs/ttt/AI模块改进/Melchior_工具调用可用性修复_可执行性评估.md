# Melchior 工具调用可用性修复 TTT 可执行性评估报告

> **评估时间**: 2026-03-15  
> **评估对象**: [`docs/ttt/AI模块改进/Melchior_工具调用可用性修复.ttt.md`](./Melchior_工具调用可用性修复.ttt.md)  
> **评估依据**: [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../../规程/tiktoctac文档(ttt)编写规程.procedure.md)

---

## 执行摘要

**总体可执行性评分**: 8.5/10 ⭐⭐⭐⭐

**核心结论**: 该 TTT 文档结构完整、技术路径清晰、验收标准明确，**高度可执行**。Phase 1 任务所需的代码基础设施已就绪，仅需补充缺失的工具定义和测试用例即可开始执行。

**关键发现**:
- ✅ 文档完全符合 TTT 编写规程要求
- ⚠️ 已确认存在"提示词-工具定义不一致"的高风险问题（提示词提到 `deliberation_signal` 但工具未定义）
- ✅ 后端代码架构支持快速实现
- ⚠️ 测试覆盖存在缺口，需补充异常场景测试

---

## 一、文档结构符合性评估

### 1.1 必需章节检查

| 章节 | 规程要求 | 实际情况 | 符合性 |
|------|---------|---------|--------|
| 文档头部 | 必须包含目标、量化指标、流程说明 | ✅ 完整 | ✅ 符合 |
| 核心原则 | 必须包含原则和验证检查清单 | ✅ 完整（6条原则+5项检查清单） | ✅ 符合 |
| 维护说明 | 必须包含归档流程说明 | ✅ 完整（5条维护规则） | ✅ 符合 |
| 近期计划 | 必须存在，不超过5个任务 | ✅ 1个任务（Phase 1） | ✅ 符合 |
| 中期计划 | 推荐存在 | ✅ 3个任务（Phase 2-4） | ✅ 符合 |
| 已归档 | 必须存在 | ✅ 2个已完成任务 | ✅ 符合 |

### 1.2 任务描述完整性

**Phase 1 任务结构**:
- ✅ 背景说明清晰
- ✅ 行动步骤明确（4个子步骤）
- ✅ 验收标准具体（4条标准）
- ✅ 参考文件完整（4个文件路径）
- ✅ 优先级合理（P0）

**符合规程要求**: 完全符合

---

## 二、Phase 1 技术可行性评估

### 2.1 代码基础设施现状

#### 工具定义框架 ✅
**位置**: `kernel/nerv/magi/config/config.go`

**现有工具构造函数**:
```go
// 第73-98行: BuildAvatarBuildToolDef()
// 第102-129行: BuildAvatarModifyToolDef()
// 第132-149行: BuildAvatarSynthesizeToolDef()
// 第152-175行: BuildSpeakToolDef()
```

**评估**: 工具定义模式已建立，可直接复用创建 `BuildDeliberationSignalToolDef()`

#### 配置管理机制 ✅
**位置**: `kernel/nerv/magi/config/manager.go`

**关键函数**:
- 第149-164行: `defaultMelchiorConfig()` - 默认配置构造
- 第261-270行: `applyRequiredAvatarTools()` - 工具自动补齐
- 第272-282行: `ensureToolRegistered()` - 工具注册检查

**评估**: 配置管理机制完善，支持默认配置和文件加载后的工具补齐

#### 工具调用解析 ⚠️
**位置**: `kernel/nerv/magi/coordinator/collector.go`

**现有实现** (第244-252行):
```go
// 检查是否有deliberation_signal工具调用（仅Melchior）
if sage.GetName() == "melchior" && result.HasToolCalls {
    if args, ok := result.ToolArgumentsByName["deliberation_signal"]; ok && len(args) > 0 {
        var signal types.DeliberationSignal
        if err := json.Unmarshal([]byte(args[0]), &signal); err == nil {
            response.RequiresDeliberation = signal.RequiresDeliberation
            response.DeliberationReason = signal.Reason
        }
    }
}
```

**问题**:
- ⚠️ JSON 解析失败时静默忽略（`err == nil` 分支）
- ⚠️ 缺少错误日志记录
- ⚠️ 无法观测解析失败场景

**评估**: 基础逻辑正确，但错误处理不足

#### 测试框架 ⚠️
**位置**: `kernel/nerv/magi/coordinator/collector_test.go`

**现有测试**:
- ✅ 第109-126行: `TestCollectResponses_AllSuccess` - 全部成功场景
- ✅ 第128-145行: `TestCollectResponses_TwoSuccess` - 部分成功场景
- ✅ 第147-160行: `TestCollectResponses_OnlyOneSuccess` - 失败场景
- ✅ 第162-175行: `TestCollectResponses_Timeout` - 超时场景
- ✅ 第178-216行: `TestCollectSingleSageResponse_WithToolCalls` - 工具调用场景

**缺失测试**:
- ❌ 非法 JSON 参数场景
- ❌ 缺失必需字段场景
- ❌ 工具名不匹配场景

**评估**: 测试框架完善，但覆盖率不足

### 2.2 关键问题确认

#### 🔴 高风险：提示词-工具定义不一致 **已确认**

**证据**:
1. **提示词要求** (`kernel/nerv/magi/prompts/core.go` 第28行):
   ```
   当你判断某个决策需要慎重考虑时，可以调用deliberation_signal工具。
   ```

2. **默认配置** (`kernel/nerv/magi/config/manager.go` 第162行):
   ```go
   Tools: []ToolDef{BuildAvatarBuildToolDef()},
   ```
   仅包含 `buildAvatar` 工具，**缺失** `deliberation_signal`

3. **工具定义** (`kernel/nerv/magi/config/config.go`):
   **不存在** `BuildDeliberationSignalToolDef()` 函数

**影响**: 模型可能尝试调用未声明的工具，导致请求失败或行为异常

**修复优先级**: P0（必须立即修复）

---

## 三、Phase 1 任务可执行性分析

### 3.1 子任务分解

| 子任务 | 工作量估算 | 技术难度 | 依赖关系 | 可执行性 |
|--------|-----------|---------|---------|---------|
| 1. 核查工具定义现状 | 0.5h | 低 | 无 | ✅ 高 |
| 2. 创建工具定义 | 1h | 低 | 子任务1 | ✅ 高 |
| 3. 校验解析行为 | 1.5h | 中 | 子任务2 | ✅ 高 |
| 4. 补充测试用例 | 2h | 中 | 子任务3 | ✅ 高 |

**总工作量**: 约5小时  
**总体可执行性**: ✅ 高度可执行

### 3.2 实施路径建议

#### 步骤1: 创建工具定义函数
**文件**: `kernel/nerv/magi/config/config.go`  
**位置**: 第175行后（`BuildSpeakToolDef` 之后）

**实现要点**:
```go
const (
    // 添加工具名常量
    DeliberationSignalToolName = "deliberation_signal"
)

func BuildDeliberationSignalToolDef() ToolDef {
    return ToolDef{
        Type: "function",
        Function: ToolFunctionDef{
            Name: DeliberationSignalToolName,
            Description: "发出审慎决策信号，指示是否需要进入投票流程。",
            Parameters: map[string]interface{}{
                "type": "object",
                "properties": map[string]interface{}{
                    "requires_deliberation": map[string]interface{}{
                        "type": "boolean",
                        "description": "是否需要审慎决策",
                    },
                    "reason": map[string]interface{}{
                        "type": "string",
                        "description": "需要审慎决策的原因",
                    },
                },
                "required": []string{"requires_deliberation", "reason"},
            },
        },
    }
}
```

#### 步骤2: 修改默认配置
**文件**: `kernel/nerv/magi/config/manager.go`

**修改点1** - `defaultMelchiorConfig()` (第162行):
```go
Tools: []ToolDef{
    BuildAvatarBuildToolDef(),
    BuildDeliberationSignalToolDef(), // 新增
},
```

**修改点2** - `applyRequiredAvatarTools()` (第265行后):
```go
ensureToolRegistered(&cfg.Melchior, BuildDeliberationSignalToolDef())
```

#### 步骤3: 增强错误处理
**文件**: `kernel/nerv/magi/coordinator/collector.go`

**修改点** - `buildSageResponse()` (第244-252行):
```go
if sage.GetName() == "melchior" && result.HasToolCalls {
    if args, ok := result.ToolArgumentsByName["deliberation_signal"]; ok && len(args) > 0 {
        var signal types.DeliberationSignal
        if err := json.Unmarshal([]byte(args[0]), &signal); err != nil {
            // 新增：记录解析失败
            logging.LogWarnf("Melchior deliberation_signal 参数解析失败: %v, 原始参数: %s", err, args[0])
        } else {
            response.RequiresDeliberation = signal.RequiresDeliberation
            response.DeliberationReason = signal.Reason
        }
    }
}
```

#### 步骤4: 补充测试用例
**文件**: `kernel/nerv/magi/coordinator/collector_test.go`

**新增测试**:
1. `TestCollectSingleSageResponse_WithInvalidToolArgs` - 非法 JSON
2. `TestCollectSingleSageResponse_WithMissingToolArgs` - 缺失字段
3. `TestCollectSingleSageResponse_WithoutDeliberationTool` - 未调用工具

### 3.3 验收标准达成路径

| 验收标准 | 达成方式 | 验证方法 |
|---------|---------|---------|
| 代码中存在工具定义构造函数 | 步骤1 | 搜索 `BuildDeliberationSignalToolDef` |
| 默认配置可检索到该工具名 | 步骤2 | 单元测试或配置打印 |
| 测试覆盖3个用例 | 步骤4 | 运行 `go test` 并检查覆盖率 |
| 不改动前端职责 | 全流程 | 确认无 `app/src/magi` 修改 |

---

## 四、风险与依赖评估

### 4.1 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 | 状态 |
|------|------|------|---------|------|
| 提示词-工具定义不一致 | 高 | 高 | Phase 1 修复 | 🔴 已确认 |
| 工具参数解析脆弱 | 中 | 中 | 增强错误处理+测试 | 🟡 部分存在 |
| 状态字段误导 | 低 | 中 | 状态组合测试 | 🟢 可控 |
| 测试不稳定 | 低 | 低 | 使用 mock 客户端 | 🟢 已解决 |

### 4.2 依赖关系检查

| 依赖项 | 类型 | 状态 | 影响 |
|--------|------|------|------|
| MAGI后端迁移.ttt.md | 前置依赖 | ✅ 存在 | 无阻塞 |
| MAGI_三贤人机制完善.ttt.md | 并行任务 | ✅ 存在 | 需协调 |
| Go 测试框架 | 技术依赖 | ✅ 就绪 | 无阻塞 |
| logging 包 | 技术依赖 | ✅ 已引入 | 无阻塞 |

---

## 五、规程符合性检查

### 5.1 强制性规则（不得违反）

| 规则 | 要求 | 实际情况 | 符合性 |
|------|------|---------|--------|
| 验收标准完整性 | 不得省略验收标准 | ✅ 4条验收标准 | ✅ 符合 |
| 成果文件列表 | 不得省略成果文件 | ✅ 已归档任务包含成果文件 | ✅ 符合 |
| 单任务在途 | 不得同时多个进行中 | ✅ 当前无进行中任务 | ✅ 符合 |

### 5.2 建议性规则（不应违反）

| 规则 | 要求 | 实际情况 | 符合性 |
|------|------|---------|--------|
| 近期计划数量 | 不应超过5个任务 | ✅ 1个任务 | ✅ 符合 |
| P2任务位置 | 不应在近期计划 | ✅ 近期仅P0任务 | ✅ 符合 |
| 成果文件记录 | 不应省略 | ✅ 已归档任务有记录 | ✅ 符合 |

### 5.3 原则性规则（不宜违反）

| 规则 | 要求 | 实际情况 | 建议 |
|------|------|---------|------|
| 归档及时性 | 不宜延迟归档 | ✅ 已完成任务已归档 | 保持 |
| 计划调整频率 | 不宜频繁调整 | ✅ 计划稳定 | 保持 |

---

## 六、改进建议

### 6.1 文档层面

#### 建议1: 细化 Phase 1 子任务状态跟踪
**当前**: Phase 1 包含4个子步骤，但无独立状态标记  
**建议**: 在 TTT 中为每个子步骤添加独立的 checkbox

**示例**:
```markdown
- [ ] **Phase 1: 后端链路基线核查与配置缺口修复 (P0)**
  - [x] 1.1 核查工具定义现状
  - [ ] 1.2 创建工具定义函数
  - [ ] 1.3 修改默认配置
  - [ ] 1.4 增强错误处理
  - [ ] 1.5 补充测试用例
```

#### 建议2: 补充回滚方案
**当前**: 缺少修改失败时的回滚说明  
**建议**: 在 Phase 1 中添加"回滚方案"小节

### 6.2 技术层面

#### 建议1: 添加配置验证函数
**位置**: `kernel/nerv/magi/config/manager.go`  
**目的**: 启动时检查工具定义完整性

```go
func (cm *ConfigManager) ValidateToolDefinitions() error {
    // 检查 Melchior 是否包含 deliberation_signal
    // 检查 Trinity 是否包含 speak
    // ...
}
```

#### 建议2: 添加集成测试
**位置**: 新建 `kernel/nerv/magi/integration_test.go`  
**目的**: 端到端验证工具调用链路

---

## 七、执行建议

### 7.1 立即可执行

✅ **Phase 1 可以立即开始执行**

**理由**:
1. 代码基础设施完善
2. 技术路径清晰
3. 工作量可控（约5小时）
4. 无外部依赖阻塞

### 7.2 执行顺序

**推荐顺序**:
1. 创建工具定义 → 2. 修改配置 → 3. 增强错误处理 → 4. 补充测试

**理由**: 从底层到上层，便于逐步验证

### 7.3 验证检查点

| 检查点 | 时机 | 验证方法 |
|--------|------|---------|
| 工具定义正确性 | 步骤1完成后 | 编译通过 + 代码审查 |
| 配置加载成功 | 步骤2完成后 | 单元测试 |
| 解析逻辑健壮 | 步骤3完成后 | 异常场景测试 |
| 整体功能完整 | 步骤4完成后 | 全量测试通过 |

---

## 八、总结

### 8.1 可执行性评分明细

| 维度 | 得分 | 权重 | 加权得分 |
|------|------|------|---------|
| 文档结构完整性 | 10/10 | 20% | 2.0 |
| 技术可行性 | 9/10 | 30% | 2.7 |
| 验收标准明确性 | 9/10 | 20% | 1.8 |
| 风险可控性 | 7/10 | 15% | 1.05 |
| 依赖关系清晰性 | 9/10 | 15% | 1.35 |
| **总分** | **8.5/10** | **100%** | **8.9** |

### 8.2 核心结论

1. **文档质量**: 优秀，完全符合 TTT 编写规程
2. **技术准备**: 良好，代码基础设施完善
3. **执行风险**: 可控，已识别的风险有明确缓解措施
4. **建议行动**: 立即开始执行 Phase 1

### 8.3 关键成功因素

- ✅ 工具定义模式已建立，可快速复用
- ✅ 配置管理机制完善，支持自动补齐
- ✅ 测试框架就绪，便于快速验证
- ✅ 问题定位准确，修复路径清晰

### 8.4 注意事项

- ⚠️ 修改配置时需同时更新默认配置和自动补齐逻辑
- ⚠️ 增强错误处理时需添加日志，便于问题排查
- ⚠️ 补充测试时需覆盖异常场景，避免遗漏
- ⚠️ 完成后需更新 TTT 文档状态，保持同步

---

**评估人**: Roo (Code Mode)  
**评估日期**: 2026-03-15  
**文档版本**: 1.0
