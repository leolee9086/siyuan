/**
 * S-Forge 墓碑文件（Tombstone）
 *
 * 本文件在本地分支被有意删除：架构重构（提交 98353ee65b「开始magi的前端临时实现」）
 * 将一次性 AI 对话框改为流式会话架构，旧实现已无调用方；
 * 本冲突的三方状态为 base 存在、本地删除（stage2 缺失）、上游 v3.8.0 修改（stage3 在）。
 *
 * 本地替代/迁移到：
 * - app/src/ai/chatStream.ts（同名入口 AIChat(protyle, element)，本地基线的现行实现）
 * - app/src/components/StreamChat.panel.vue（对话 UI，经 app/src/ai/imports.ts 以 AIChatDialog 挂载）
 * - 支撑模块：app/src/ai/chatStream.state.ts、app/src/ai/chatStream.utils.ts、app/src/ai/session/
 *
 * 上游 v3.8.0 对该文件的增量（经评审）：
 * 1. 提交逻辑改调同目录 editor 模块的 startAIWriting/clearAIEditorHistory，
 *    不再直接 fetchPost("/api/ai/chatGPT") 后以 ai/actions 的 fillContent 回填；
 * 2. 入口增加 isDisabledFeature("ai") 早退开关，参数类型由 Element 收窄为 HTMLElement；
 * 3. 新增空输入校验（showMessage kernel[142]），确认后先销毁对话框再处理；
 * 4. 「Clear context」语义改为 clearAIEditorHistory 加 clearContextSucc 提示。
 *
 * 增量去向：
 * - startAIWriting/clearAIEditorHistory：app/src/ai/editor.ts 第 729/736 行提供同名导出，直接对应；
 * - isDisabledFeature：app/src/protyle/util/compatibility.ts 第 448 行已有实现；
 * - clearContextSucc 清空提示：已并入 app/src/ai/actions*.ts 的 AI 菜单流程；
 * - 空输入校验与 kernel[142] 提示：未逐项移植，如需请在 StreamChat.panel.vue
 *   会话流程中补充（TODO 评审项）。结论：无需按上游恢复此文件。
 *
 * 警告：
 * - 合并残留引用：app/src/protyle/hint/index.ts 第 54 行仍
 *   import {AIChat} from "../../ai/chat"；本墓碑不导出任何符号，
 *   编译前须把该引用改指 ../../ai/chatStream 或删除该处用法；
 * - 同目录存在合并残留副本 chat.ts.remote 与 chat.ts.backup，待人工确认后清理。
 *
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
