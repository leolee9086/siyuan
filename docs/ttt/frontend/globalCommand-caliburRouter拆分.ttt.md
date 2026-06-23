# globalCommand caliburRouter 拆分.ttt

## 目标

将 `app/src/boot/globalEvent/command/global.ts` 从巨型条件分发函数拆分为基于 CaliburRouter 的命令路由入口，并保持原有 `globalCommand(command, app)` 对外签名与行为不变。

## 适用规程

- `docs/规程/代码质量/代码拆分与模块化.procedure.md`
- `docs/规程/代码质量/超长文件拆分.procedure.md`

## 任务项

- [x] 调研现有 CaliburRouter 用法与命令处理结构
- [x] 备份原始 `global.ts` 并确定拆分边界
- [x] 拆分移动端、桌面端、通用命令和最近关闭恢复逻辑
- [-] 验证 TypeScript 或 lint 检查结果
- [ ] 记录失败与完成情况

## 失败记录

- 使用 `Remove-Item` 删除过渡文件时终端按 `cmd` 解析，命令失败；已改用 `cmd /d /c del` 删除本次重构产生且已无外部引用的过渡文件。
- 首次执行 `pnpm run lint:file` 时未设置到 `app` 工作目录，导致未找到 `package.json`；已改为在 `app` 目录执行。
- `lint:file` 脚本只读取第一个文件参数，批量传参只检查了 `global.ts`；后续改为循环逐个文件检查。

## 兼容性判断

- `calibur-router` 兼容 Zod、Effect Schema 等库的意义不只是支持更多校验库，而是把路由核心从 ArkType 专用用法提升为独立的状态空间分发协议。
- 现状中 `matcher.ts`、`types.ts`、`setOps.ts` 都直接依赖 ArkType 的 `Type`、`extends`、`and`、`or`、`type("never")` 与错误对象形态；要兼容其它库，应该先抽象 schema adapter。
- Zod 可作为运行时匹配后端，但难以完整提供子集、交集和覆盖判断；Effect Schema 更接近完整集合推理后端，但仍需单独实现适配层。
- 适配器边界应主要提供集合操作语义，如匹配、子集、交集、并集、空集和描述信息；路由链、优先级、剩余分支和分发器组合仍应属于 `calibur-router` 核心。
- 除集合操作外，适配器还需提供类型提取和能力声明，否则无法同时支撑处理器参数推断与 Zod 这类弱集合后端的受限策略。
- 适配器实现的第一要点：仅支持不同 schema 后端中可形式化证明为集合代数的部分；无法纳入集合代数的特性不进入 CaliburRouter 的集合推理域。
- 为保证集合语义正确性，Zod 后端不得用未知结果继续执行集合推理；遇到无法可靠证明子集、交集、并集或空集语义的声明时，应在构建阶段显式报错。
- 后续实现顺序应先抽出 `calibur-core` / adapter interface，再迁移当前 ArkType 后端为默认实现；之后优先实现 `calibur-effect` 和 `calibur-jsonschema` 验证强集合/标准约束后端，最后实现受限版 `calibur-zod`。
- `calibur-jsonschema` 值得实现且优先级应高于 `calibur-zod`：JSON Schema 是标准化约束语言，较适合形式化为集合代数；但仍应限定支持范围，遇到无法可靠集合化的关键字或非规范扩展时构建期报错。
