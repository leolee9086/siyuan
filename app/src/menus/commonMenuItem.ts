/**
 * S-Forge 墓碑文件（Tombstone）
 *
 * 本文件在本地分支被有意删除：架构重构，common menu 聚合模块按职责拆分为目录化子模块
 * （删除提交：4fa2b6e20e "refactor: remove common menu aggregate"，另见 3e4cfefa9a、9901fc6746）。
 *
 * 本地替代/迁移到：
 *   - openMenu       → app/src/menus/commonMenuItem/openMenu.ts
 *   - renameMenu     → app/src/menus/commonMenuItem/rename/renameMenu.factory.ts
 *   - movePathToMenu → app/src/menus/commonMenuItem/movePath/movePathToMenu.factory.ts
 *   - exportMd       → app/src/menus/commonMenuItem/export/exportMenu.factory.ts
 *   - bindAttrInput  → app/src/menus/commonMenuItem/fileAttr/bindAttrInput.ts
 *
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. 移除 Electron shell 与 processSiYuanUri 依赖，桌面/移动端「使用默认方式打开」统一为新的 openLink(app, src)（editor/openLink）。
 *   2. 资源打开菜单重构：以 getAssetExtension + isBrowserRenderableImagePath（util/imageURL）判定可预览；新模块 editor/assetOpen（DEFAULT_ASSET_OPEN/getAssetOpenGestures/TAssetOpenGesture）提供可配置手势快捷键（click/ctrl/alt/shift，经 updateHotkeyTip 渲染），并新增 insertBottom、openByBackground（后台标签）菜单项及 useDefault/showInFolder 重排。
 *   3. exportMd 导出请求新增 mergeDocHeadingMode / mergeContentHeadingMode 参数。
 *   4. movePathToMenu 签名扩展为 (paths: string[], sourceNotebookIds?: string[]) 并透传给移动对话框。
 *   5. 杂项：App 改为 type-only import；引入 updateHotkeyTip。
 *
 * 增量去向：
 *   - 第 3、4 项依赖上游后端新字段，本地基线尚无对应实现 → TODO port（待本地支持后移植至 export/exportMenu.factory.ts 与 movePath/movePathToMenu.factory.ts）。
 *   - 第 1、2 项依赖本地不存在的模块（editor/assetOpen.ts、util/imageURL.ts 均缺失，且本地 openLink 签名为 (protyle: IProtyle, ...)，与上游 (app, src) 不兼容）→ 暂不移植；如需手势配置功能须先在本地建立 assetOpen/imageURL 基础设施。
 *
 * 警告：上游版本的两个导入方在合并工作区仍引用本聚合路径——app/src/menus/protyle.ts 第 32 行 import {openMenu} from "./commonMenuItem"、
 * app/src/protyle/render/av/action.ts 第 5 行 import {openFileAttr} from "../../../menus/commonMenuItem"；两者本身同为 DU 冲突（本地已删除/重构），
 * 解决其冲突时必须改指向上表新模块（openFileAttr 现位于 app/src/menus/commonMenuItem/fileAttr/openFileAttr.ts），否则会因本墓碑仅含 export {} 而编译失败。
 *
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
