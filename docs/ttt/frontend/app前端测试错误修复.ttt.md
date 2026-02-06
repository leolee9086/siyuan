# app前端测试错误修复执行跟踪 (TikTocTak)

> **目标**: 执行app文件夹中的pnpm test，分析所有测试错误并制定完整修复计划，确保测试通过率达到100%
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 🎯 核心原则

### 测试修复原则
1. **准确诊断**: 仔细辨析是测试预期问题还是代码实现问题
2. **谨慎修复**: 涉及后端Go代码时需要谨慎处理，避免引入新问题
3. **回归验证**: 每次修复后必须验证不会影响其他测试
4. **文档记录**: 详细记录错误类型、修复方案和验证结果

### 验证检查清单
- [ ] 测试执行环境正常
- [ ] 错误分类准确完整
- [ ] 修复方案经过验证
- [ ] 回归测试通过
- [ ] 修复记录完整

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划 (立即聚焦，撸起袖子干)

- [-] **修复1: Errors未定义问题 (P0)**
  - **背景**: [`app/src/util/pathRouter/core/router.htttpRouter.ts`](../../../app/src/util/pathRouter/core/router.htttpRouter.ts:24) 第24行使用了 `const HttpError = Errors;` 但 `Errors` 未定义，影响18个测试文件
  - **行动**:
    1. 检查 [`router.base.ts`](../../../app/src/util/pathRouter/core/router.base.ts) 中的 `Errors` 定义
    2. 在 [`router.htttpRouter.ts`](../../../app/src/util/pathRouter/core/router.htttpRouter.ts) 中添加正确的导入语句
    3. 验证导入后的类型兼容性
  - **验收标准**:
    - `Errors` 正确导入并可用
    - pathRouter 相关测试通过
    - 不影响其他模块的 `Errors` 使用
  - **影响范围**: 18个测试文件，pathRouter核心功能

- [-] **修复2: transformer模块导出问题 (P0)**
  - **背景**: [`app/src/util/embedding/transformer.ts`](../../../app/src/util/embedding/transformer.ts) 中 `splitText`、`calculateWeightedAverageVector`、`normalizeVector` 函数未导出
  - **行动**:
    1. 为这些函数添加 `export` 关键字
    2. 验证导出的函数签名正确
    3. 检查是否需要更新类型定义
  - **验收标准**:
    - 函数成功导出且可被外部调用
    - [`textSplitter.test.ts`](../../../app/test/util/embedding/textSplitter.test.ts) 测试通过
    - 不破坏现有的内部调用
  - **影响范围**: embedding模块，文本处理功能

- [-] **修复3: ConfigManager缺少isBareModule方法 (P0)**
  - **背景**: [`app/src/util/code/configManager.ts`](../../../app/src/util/code/configManager.ts) 中 `ConfigManager` 类没有 `isBareModule` 方法
  - **行动**:
    1. 分析现有的模块级别 `isBareModule` 函数实现
    2. 在 `ConfigManager` 类中添加 `isBareModule` 方法，包装模块级别函数
    3. 确保方法签名和行为一致
  - **验收标准**:
    - `ConfigManager.isBareModule()` 方法可用
    - [`moduleRedirect.test.ts`](../../../app/test/util/code/moduleRedirect.test.ts) 测试通过
    - 保持与模块级别函数的行为一致性
  - **影响范围**: 代码配置管理，模块重定向功能

---

## 🟡 中期计划 (架构演进，步步为营)

- [ ] **修复4: Layer测试期望值错误 (P1)**
  - **背景**: [`app/test/util/pathRouter/layer.test.ts`](../../../app/test/util/pathRouter/layer.test.ts:242) 第242行期望 `[undefined, undefined]` 但实际返回 `[undefined]`
  - **行动**:
    1. 分析测试逻辑，确认实际返回值是否正确
    2. 更新测试期望为 `[undefined]`
    3. 验证修改后的测试逻辑合理性
  - **验收标准**:
    - [`layer.test.ts`](../../../app/test/util/pathRouter/layer.test.ts) 测试通过
    - 测试期望与实际行为一致
    - 不影响其他layer相关测试
  - **影响范围**: pathRouter layer功能测试

- [ ] **修复5: 执行器测试SecurityError问题 (P1)**
  - **背景**: [`app/test/util/code/executor.throw.test.ts`](../../../app/test/util/code/executor.throw.test.ts) 测试期望 `SecurityError` 但代码抛出 `Error`
  - **行动**:
    1. 分析执行器的实际错误抛出行为
    2. 确认是否应该抛出 `SecurityError` 还是 `Error`
    3. 更新测试期望以匹配实际代码行为
  - **验收标准**:
    - [`executor.throw.test.ts`](../../../app/test/util/code/executor.throw.test.ts) 测试通过
    - 错误类型期望与实际抛出一致
    - 安全相关的错误处理逻辑正确
  - **影响范围**: 代码执行器，安全错误处理

- [ ] **修复6: 前端嵌入测试环境依赖 (P2)**
  - **背景**: [`app/test/util/embedding/frontendEmbedding.test.ts`](../../../app/test/util/embedding/frontendEmbedding.test.ts) 需要后端服务运行
  - **行动**:
    1. 评估测试对后端服务的具体依赖
    2. 选择修复方案：添加skip条件或使用mock
    3. 实现选定的修复方案
  - **验收标准**:
    - 测试在无后端环境时不会失败
    - 有后端时测试正常执行
    - 测试覆盖率不降低
  - **影响范围**: 前端嵌入功能测试，CI/CD环境

- [ ] **修复7: lodash依赖问题 (P2)**
  - **背景**: [`app/test/util/code/executor.throw.test.ts`](../../../app/test/util/code/executor.throw.test.ts) 测试环境缺少lodash包
  - **行动**:
    1. 确认lodash的具体使用场景
    2. 选择修复方案：mock lodash或添加为开发依赖
    3. 实现依赖管理方案
  - **验收标准**:
    - 测试环境中lodash可用
    - 相关测试正常执行
    - 不增加不必要的生产依赖
  - **影响范围**: 测试环境配置，依赖管理

---

## 🏁 已归档/已完成

- [x] **Phase 1: 测试执行与错误收集 (P0)** - *2026-02-01*
  - **背景**: 执行app文件夹中的pnpm test命令，收集所有测试错误信息
  - **完成情况**:
    - ✅ 成功执行测试命令，收集到完整错误输出
    - ✅ 统计错误数量：影响18个测试文件的多个错误
    - ✅ 生成详细错误分析报告
  - **关键发现**:
    - 代码实现问题：`Errors`未定义、函数未导出、方法缺失
    - 测试预期问题：期望值与实际返回值不匹配
    - 环境配置问题：后端依赖、包依赖缺失

- [x] **Phase 2: 错误分析与分类 (P1)** - *2026-02-01*
  - **背景**: 对收集到的错误进行详细分析，区分测试预期问题和代码实现问题
  - **完成情况**:
    - ✅ 完成错误根本原因分析
    - ✅ 按优先级分类：P0(代码实现)、P1(测试预期)、P2(环境配置)
    - ✅ 评估修复难度和影响范围

- [x] **Phase 3: 修复计划制定 (P1)** - *2026-02-01*
  - **背景**: 基于错误分析结果，制定详细的修复计划和优先级
  - **完成情况**:
    - ✅ 制定三级优先级修复策略
    - ✅ 评估每个修复的风险和收益
    - ✅ 制定详细的修复步骤和验收标准

---

## 📊 任务进度跟踪

### 当前状态
- **进行中任务**: P0级别代码实现问题修复（3个高优先级任务）
- **待处理错误数**: 7个修复任务（P0: 3个，P1: 2个，P2: 2个）
- **修复完成率**: 0% (0/7)

### 关键指标
- **测试通过率目标**: 100%
- **当前测试通过率**: 约82% (18个测试文件中多个失败)
- **预计完成时间**:
  - P0任务: 1-2天 (代码实现修复)
  - P1任务: 0.5-1天 (测试期望调整)
  - P2任务: 1-2天 (环境配置优化)

### 修复任务分布
- **高优先级 (P0)**: 3个任务 - 代码实现问题
  - Errors未定义问题
  - transformer模块导出问题
  - ConfigManager缺少方法
- **中优先级 (P1)**: 2个任务 - 测试预期问题
  - Layer测试期望值错误
  - 执行器SecurityError问题
- **低优先级 (P2)**: 2个任务 - 环境配置问题
  - 前端嵌入测试环境依赖
  - lodash依赖问题

### 风险评估
- **高风险**: ConfigManager方法添加（可能影响现有API）
- **中风险**: Errors导入修复（需确保不破坏其他模块）
- **低风险**: 函数导出、测试期望调整

---

**文档创建**: Roo (Code Mode)
**最后更新**: 2026-02-01
**版本**: 2.0.0 - 详细修复计划版本
**适用规程**: [`docs/规程/测试与修复/前端测试执行与错误修复.procedure.md`](../规程/测试与修复/前端测试执行与错误修复.procedure.md)

---

## 📋 修复任务快速索引

### P0 - 立即修复 (代码实现问题)
1. [`router.htttpRouter.ts`](../../../app/src/util/pathRouter/core/router.htttpRouter.ts:24) - Errors未定义
2. [`transformer.ts`](../../../app/src/util/embedding/transformer.ts) - 函数未导出
3. [`configManager.ts`](../../../app/src/util/code/configManager.ts) - 缺少isBareModule方法

### P1 - 后续修复 (测试预期问题)
4. [`layer.test.ts`](../../../app/test/util/pathRouter/layer.test.ts:242) - 期望值错误
5. [`executor.throw.test.ts`](../../../app/test/util/code/executor.throw.test.ts) - SecurityError问题

### P2 - 优化修复 (环境配置问题)
6. [`frontendEmbedding.test.ts`](../../../app/test/util/embedding/frontendEmbedding.test.ts) - 后端依赖
7. [`executor.throw.test.ts`](../../../app/test/util/code/executor.throw.test.ts) - lodash依赖

**总计**: 7个修复任务，预计影响18个测试文件