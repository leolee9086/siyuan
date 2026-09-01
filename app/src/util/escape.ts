/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：refactor(util) 架构重构，字符串转义工具整体迁往 util/DOM 模块
 *   （本地删除提交 5d9719aa24「refactor(util): 迁移 network/navigation/platform/DOM/file/assets 批次文件」）。
 * 本地替代/迁移到：util/DOM/escape.ts
 *   （escapeHtml、escapeLessThans、escapeAttr、escapeAriaLabel、decodeHTML 五个导出全部迁入，
 *    调用方经 util/DOM/imports.ts 统一引用）。
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. 新增 stripSearchMark(html)：剥除内核插入的 <mark>/</mark> 搜索高亮标签；
 *   2. 新增 escapeSearchHighlight(html)：仅转义非高亮标签的 "<"，保留 <mark> 搜索高亮标签；
 *   3. 原有五个导出上游未改动，与基线一致。
 * 增量去向：TODO 未移植 —— 本仓库 app/src 中尚无这两个函数的实现与任何调用；
 *   若后续需要，应把两者移植进 util/DOM/escape.ts，
 *   上游调用点为 protyle/hint/index.ts 与 protyle/wysiwyg/renderBacklink.ts（搜索高亮渲染链路）。
 * 警告：
 *   - 合并工作区中仍有 29 个文件从旧路径 "../util/escape" 导入（多为尚未解决的上游侧文件），
 *     解决对应冲突时须改为引用 "../util/DOM/escape"，否则构建失败；
 *     写入本墓碑前，此处曾存在一个临时转发垫片（re-export ./DOM/escape 并内联两个新函数），
 *     按墓碑规程已将其移除，上述旧路径导入因此不再可编译；
 *   - 上游侧新增的 util/escape.test.ts 依赖 "./escape" 的上述两个新函数，在本墓碑状态下无法编译，
 *     应随增量移植一并处理或删除该测试。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
