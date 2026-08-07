# 属性 Dock 标签切片（TikTocTak）

> **状态**：已完成，归档于 2026-08-07
> **归属**：[`文件属性Dock.shorterm.ttt.md`](../文件浏览Dock与Monaco编辑器/文件属性Dock.shorterm.ttt.md)
> **范围**：把标签定义、展示模型、属性控制器和 Vue 标签区域拆成可复用边界；不扩展到文件树、画廊或 Monaco 编辑器。

## 行为基线

- `assetmeta` 是唯一标签定义持久化入口；文件元数据标签数组仍由 `fileproperties` 批量更新。
- 汇总视图按文件去重计数；逐文件视图使用 `{rootID, path}`，删除/增加不能拼接绝对路径。
- 配置颜色来自标签定义快照；未配置颜色使用稳定回退，并复用现有颜色工具计算前景色。
- 标签结果打开、标签树和颜色检索是独立端口；本切片不以占位按钮宣称这些功能已完成。

## 完成项

- [x] 从 `useFileProperties` 提取属性读取/写入控制器，保持 revision 与部分失败行为。
- [x] 提取标签定义加载/串行更新控制器，保持过期响应抑制。
- [x] 提取 `FilePropertiesTagSection.vue`，属性面板只负责传递模型和命令。
- [x] 为提取后的端口补运行时组件测试和目标 lint；全库 P1+ lint 不纳入本切片。

## 实际证据（2026-08-07）

- 生产代码：`app/src/sforge/fileBrowser/FileProperties.loader.ts`、`FileProperties.updater.ts`、`FileTags.controller.ts`、`FilePropertiesTagSection.vue`；`useFileProperties.ts` 和 `FilePropertiesPanel.vue` 仅保留组合 Facade/宿主编排。
- 前端：`pnpm exec vitest --run test/sforge/fileBrowser`，13 个文件、33 个用例通过；目标 `vue-tsc` 路径 0 条诊断。
- 后端：`go test ./assetmeta ./filebrowser ./fileproperties ./api -run 'Test(Index|Advanced|Manager|BatchProperties|Properties|Inspect|Update|FileBrowser|TagDefinitions)' -count=1` 通过。
- 质量边界：新增/修改文件的 P0 lint 已清零；P4 注释/导出规则仍按父 TTT 的范围登记；`git diff --check` 通过。
- 后续切片：标签结果打开、标签树、颜色检索查询/UI、目录动作和所在笔记/来源入口由 [`标签结果打开与颜色检索.shorterm.ttt.md`](../文件浏览Dock与Monaco编辑器/标签结果打开与颜色检索.shorterm.ttt.md) 跟进。
