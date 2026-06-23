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
