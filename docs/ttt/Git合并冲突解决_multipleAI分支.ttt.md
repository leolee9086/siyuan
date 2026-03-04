# Git合并冲突解决 - multipleAI分支

## 任务概述

**任务类型**: Git合并冲突解决
**创建时间**: 2026-03-04
**分支**: multipleAI
**状态**: 进行中
**适用规程**: [`docs/规程/版本管理/远程分支合并.procedure.md`](../规程/版本管理/远程分支合并.procedure.md)

## 背景

当前分支multipleAI正在进行merge操作，存在18个文件冲突需要解决。本地分支存在大规模重构，上游为增量式bugfix和新功能。

## 核心策略

以本地架构为骨架，系统性提取上游有价值变更（bugfix、新API、新功能）并融入本地架构。

## 冲突文件清单与分类

### P0 - 包管理文件（规程：逐个依赖分析）
- [x] `app/package.json` - both modified
  - 处理方式：共有依赖取较高版本，双方独有依赖均保留
- [x] `app/pnpm-lock.yaml` - both modified
  - 处理方式：删除后通过pnpm重新生成

### P1 - 核心入口和常量文件
- [x] `app/src/index.ts` - both modified
- [x] `app/src/boot/onGetConfig.ts` - both modified

### P2 - 窗口系统模块
- [x] `app/src/window/index.ts` - both modified
- [x] `app/src/window/onWindowsMsg.ts` - both modified
- [x] `app/src/mobile/index.ts` - both modified

### P3 - UI组件模块
- [x] `app/src/block/popover.ts` - both modified
- [x] `app/src/card/openCard.ts` - both modified
- [x] `app/src/protyle/header/Background.ts` - both modified
- [x] `app/src/dialog/processSystem.ts` - both modified

### P4 - 配置模块
- [x] `app/src/config/about.ts` - both modified
- [x] `app/src/config/editor.ts` - both modified
- [x] `app/src/config/search.ts` - both modified

### P5 - 工具函数与插件
- [x] `app/src/search/util.ts` - both modified
- [x] `app/src/util/file/mount.ts` - both modified
- [x] `app/src/plugin/API.ts` - both modified

### P6 - deleted by us（本地重构删除）
- [x] `app/src/util/pathName.ts` - deleted by us
  - 处理方式：确认本地重构已覆盖功能，按一对多文件映射流程提取上游变更

## 已暂存文件

以下文件已成功合并并暂存（共65+个文件）：
- GitHub相关文档（CONTRIBUTING, PR模板等）
- 多语言文件（ar_SA, de_DE, en_US等）
- 新增sk_SK语言文件
- 版本更新日志v3.5.9
- kernel相关Go文件
- 其他配置和源码文件

## 处理流程（遵循规程）

### 1. 备份原则

- 本地版本备份为 `.backup` 后缀
- 远程版本保存为 `.remote` 后缀
- 使用 `git show HEAD:<path>` 提取本地版本
- 使用 `git show MERGE_HEAD:<path>` 提取远程版本
- 备份文件与原文件同目录存放

### 2. 大规模重构文件冲突分析策略

对于本地有剧烈改动的文件：

1. **不得**试图分析文本差异（文本diff不可读）
2. 使用 `git log $(git merge-base HEAD MERGE_HEAD)..MERGE_HEAD -- <文件路径>` 获取上游commit列表
3. 逐个 `git show` 查看每个commit的实际修改意图
4. 先无条件接受本地版本恢复干净状态
5. 再逐个上游commit判断"已覆盖/需移植/需在子模块处理"

### 3. 上游有价值变更的系统性提取

对每个冲突文件：

1. **生成上游变更清单**：对比 `.remote` 与 `.backup`，列出实质性修改
2. **逐项判定**：标记为"已存在于本地"或"需要移植"
3. **执行移植**：将需要移植的变更融入本地代码
4. **记录**：在冲突解决记录中列出每项变更的处置结果

### 4. 一对多文件映射处理

当本地将单文件拆分为多个子模块时：

1. 获取上游版本（`.remote`）和合并基准版本（`.backup`）
2. 对比上游版本与基准版本，列出所有实质性变更
3. 逐项变更定位到对应的本地子模块
4. 在子模块中实施变更，适配本地架构
5. 在验证阶段逐项确认

## 合并后验证

### 基础验证

- [ ] 项目能正常构建
- [x] 无残留冲突标记（搜索 `[<]{7}` 正则）
- [ ] 本地特有功能标记完整（S-forge注释）

### 上游改进完整性验证

以 `.backup` 和 `.remote` 文件为基准，对每个冲突文件：

1. 对比 `.remote` 与 `.backup`，列出上游全部实质性改进
2. 在解决后的文件中逐项确认每项改进已包含
3. 对于一对多映射文件，在每个相关子模块中分别确认

### 验证产出

每批验证生成验证报告，包含：

- 每个文件的上游改进项列表
- 每项改进的验证结果（✅已包含 / ❌缺失）
- 缺失项的修复方案

## 注释标记规范

本地分支特有的改进使用以下格式标记：

```typescript
// S-forge: 简要描述改进内容
```

对于多行改进：

```typescript
// S-forge: 开始 - 简要描述
...代码...
// S-forge: 结束
```

## 执行记录

### 2026-03-04 初始化
- [x] 检查git状态，识别18个冲突文件
- [x] 查找并学习远程分支合并规程
- [x] 创建TTT文档，按规程要求分类冲突文件
- [x] 制定处理流程和验证计划

### 待执行任务

#### 阶段1：备份与准备
- [x] 为所有冲突文件创建 `.backup` 和 `.remote` 备份
- [x] 确认merge base：`git merge-base HEAD MERGE_HEAD`

#### 阶段2：P0 包管理文件
- [x] 处理 `app/package.json`：分析依赖差异
- [x] 删除 `app/pnpm-lock.yaml`，标记待重新生成

#### 阶段3：P1 核心入口
- [x] 分析 `app/src/index.ts` 上游commit历史
- [x] 提取上游变更清单并移植
- [x] 分析 `app/src/boot/onGetConfig.ts` 上游commit历史
- [x] 提取上游变更清单并移植

#### 阶段4：P2-P5 功能模块（按批次）
- [x] 窗口系统模块（3个文件）
- [x] UI组件模块（4个文件）
- [x] 配置模块（3个文件）
- [x] 工具函数与插件（3个文件）

#### 阶段5：P6 deleted by us
- [x] 分析 `app/src/util/pathName.ts` 上游变更
- [x] 定位本地重构后的对应模块
- [x] 移植上游变更到对应模块

#### 阶段6：验证与清理
- [ ] 执行基础验证
- [ ] 生成上游改进完整性验证报告
- [ ] 重新生成 `pnpm-lock.yaml`
- [ ] 清理所有 `.backup` 和 `.remote` 文件
- [ ] 执行 `git commit` 完成合并

## 冲突解决记录

（每个文件处理完成后在此记录）

### package.json
- 状态：已处理
- 上游变更：`version 3.5.8 -> 3.5.9`，`packageManager 10.30.1 -> 10.30.3`，`electron 39.6.1 -> 39.7.0`
- 处置结果：保留本地包结构与脚本，吸收上游版本升级；包名保留 `s-forge`

### pnpm-lock.yaml
- 状态：已处理（待重生）
- 处理方式：冲突文件已删除，待执行 `pnpm install` 重新生成

### 2026-03-04 冲突解决执行
- [x] 18个冲突文件完成 `.backup/.remote` 备份
- [x] 所有冲突文件完成语义合并并 `git add`，`git diff --diff-filter=U` 为空
- [x] `deleted by us` 文件 `app/src/util/pathName.ts` 保持删除并迁移上游 `redirectToCheckAuth` 改动至 `app/src/util/file/pathName.ts`
- [x] 关键上游改动已移植：浮窗延迟配置（editor/popover/search keys）、`openEmoji` 插件API、搜索预览背景渲染、锁屏流程改动
- [x] 二次核对 `.remote/.backup` 完成，发现并补齐遗漏项：`app/src/util/file/mount.ts` 新增 `replaceFileName` 规范化笔记本名称
- [ ] TypeScript 基础校验通过（当前 `pnpm -C app exec tsc --noEmit` 报 `TS2688: Cannot find type definition file for './src/types'`）

## 相关规程与文档

- [`docs/规程/版本管理/远程分支合并.procedure.md`](../规程/版本管理/远程分支合并.procedure.md) - 主要规程
- [`.roo/rules/规程.md`](../../.roo/rules/规程.md) - 元规程
- [`.roo/rules/负面记录.md`](../../.roo/rules/负面记录.md) - 避免重复错误

## 注意事项

1. **不得**试图分析大规模重构文件的文本差异
2. **必须**使用git log和git show分析上游commit意图
3. **必须**为每个冲突文件创建备份
4. **必须**系统性提取上游有价值变更
5. **必须**在验证阶段逐项确认上游改进已包含
6. 合并完成前**不得**删除备份文件
7. 如需中止合并可执行 `git merge --abort`
