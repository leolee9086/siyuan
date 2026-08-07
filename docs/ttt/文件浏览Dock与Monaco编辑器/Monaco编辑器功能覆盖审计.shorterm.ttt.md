# Monaco 编辑器功能覆盖审计 (TikTocTak)

> **归属**: [文件浏览Dock与Monaco编辑器.ttt.md](../文件浏览Dock与Monaco编辑器.ttt.md)
> **目标**: 以 `D:\dev\.references\siyuan-plugin-monaco-editor` 的 `edce237dab4ef807be3b8647087543bcb87d1ca7` 为基线，逐项覆盖其文件资源管理器、块编辑器、Vditor、差异和设置能力。

## 许可证与致谢

- 参考仓库许可证为 GNU Affero General Public License v3 或更高版本，代码引用前必须完成许可证兼容性审查。
- 产品文档和源码入口必须明确致谢：`Zuoqiu-Yingyi/siyuan-plugin-monaco-editor`，链接 `https://github.com/Zuoqiu-Yingyi/siyuan-plugin-monaco-editor`；Monaco Editor 另注明 `https://github.com/microsoft/monaco-editor` 及实际版本。
- 只借鉴行为契约和必要适配，不复制无关兼容层；每个借鉴文件在代码注释或文档中标出来源。

## 覆盖矩阵

| 功能域 | 参考入口 | 目标实现 | 状态 |
| --- | --- | --- | --- |
| Explorer 根/树/图标/提示/选择 | `src/components/ExplorerDock.svelte`、`src/explorer/{index,icon,tooltip,select}.ts`、共享 `FileTree/Root/Node` | 文件浏览 Dock 的常驻多根递归树 | 已完成树专项审计，待实现 |
| 右键菜单与动作 | `src/explorer/menu.ts`、`src/components/UploadDialog.svelte` | 统一 file operation command | 待实现 |
| 拖动移动、批量上传、外拖下载 | `src/explorer/filetree.ts`、组件 DnD | 后端原子操作、打包下载和进度 | 待实现 |
| 本地文件编辑 | `src/handlers/local.ts`、`Editor*.svelte` | capability 授权的文本文档页签 | 待实现 |
| 网络文件查看 | `src/handlers/network.ts` | 只读网络文档模型，明确来源和保存限制 | 待实现 |
| Markdown/Kramdown 块编辑 | `src/handlers/block.ts`、`history.ts` | 复用 Lute/块 API，支持差异和保存 | 待实现 |
| 代码片段、收集箱、文件/文档历史、快照 | `src/handlers/{snippet,inbox,history,snapshot}.ts` | 统一只读/可写编辑模型和差异模型 | 待实现 |
| Vditor 编辑/预览和资源上传 | `src/components/Vditor*.svelte`、`vditor/*` | 保持现有 Protyle/资源上传边界，按需求接入 | 待实现 |
| 保存、自动保存、Alt+Z、编辑方案 | `src/configs/*`、`Editor.svelte` | 统一 editor preferences 和保存状态机 | 待实现 |
| 编码/语言识别、补全、KaTeX | `src/editor/language.ts`、`markdown/*` | 编辑器文档协议与语言服务适配 | 待实现 |
| 设置、开关、重置 | `src/components/Settings.svelte` | S-Forge 配置 schema 和持久化 | 待实现 |

## 完成条件

- [ ] 每个功能行有代码证据、S-Forge 目标文件和可执行测试。
- [ ] 只读模型不暴露保存入口；保存失败、外部修改和大文件限制可见。
- [ ] 许可证、版本、链接和源码致谢在产品文档中固定。

## Explorer 目录树专项证据

- 参考版本固定为插件 `edce237dab4ef807be3b8647087543bcb87d1ca7`（`package.json` 版本 `0.2.5`）以及共享组件仓库对应提交 `176dcb488342734f43d788cb246611cc3d5c29e6`，避免用共享组件当前 HEAD 代替插件发布时语义。
- `ExplorerDock.svelte` 创建常驻工作空间根，把 `Explorer` 放入树上下文，并把刷新、全部折叠、打开、菜单、折叠/展开和完整拖拽事件接入共享 `FileTree.svelte`；刷新只递归更新已经加载的节点，全部折叠递归更新每个已创建节点。
- `src/explorer/index.ts` 以完整路径为节点 ID，并维护 `Set` 与 `Map<path,node stores>`；根节点初始折叠，目录第一次展开时通过 `readDir` 懒加载，节点分别持有 `focus/folded/children/count/symlink/dragging/dragover` 等状态。刷新目录替换直接子项；递归刷新跳过 `children === undefined` 的未加载节点。
- `resources2nodes` 先目录后文件生成递归节点，目录加载后显示总数及文件夹/文件数量提示，文本提示同时展示相对路径和更新时间；`icon.ts` 按根、展开目录、文件名和复合扩展名选择 Material 图标，`tooltip.ts` 为思源工作区特殊资源提供语义提示，`select.ts` 维护单选焦点。
- 发布时共享 `Node.svelte` 是真正的递归主体：每节点拥有独立 store，递归渲染 `children`，使用 B3 列表类、折叠箭头、菜单按钮、符号链接标记、计数器、焦点样式和树辅助线，并把所有节点事件逐层转发。`FileTree.svelte`/`Root.svelte` 只负责多根和根列表容器。
- 拖拽链覆盖树内移动、拖入文件/目录上传、浏览器拖出下载、静态资源多 MIME 超链接载荷以及目录悬停 500ms 自动展开；目录不能移入自身或后代，移动后同时刷新源目录和目标目录。
- `src/explorer/menu.ts` 按根/目录/文件过滤完整菜单，包含新建、当前/递归刷新、多种打开方式、系统定位、复制名称/相对路径/完整路径/编辑与预览链接、历史差异、桌面复制/导出、浏览器上传/下载、重命名和删除；创建与重命名检查空名、非法名和同名冲突。`data`、`repo`、`.lock` 的编辑/移动/重命名/删除受权限矩阵约束，受保护操作要求输入完整路径二次确认。
- S-Forge `app/src/util/file/tree/Tree.ts` 可复用 B3 视觉、基本焦点、右键/拖拽分发和展开 ID 语义，但其输入绑定思源块树且以整棵 `innerHTML` 重绘为核心，没有节点级异步加载、分页、错误和并发修订状态。文件浏览域需要专用递归 Vue 节点模型，同时沿用现有样式和宿主菜单，不能把通用 `Tree` 的存在当作 Monaco 行为已实现。
