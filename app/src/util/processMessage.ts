/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构批次迁移，
 *   提交「5d9719aa24 refactor(util): 迁移 network/navigation/platform/DOM/file/assets 批次文件」。
 * 本地替代/迁移到：app/src/util/network/processMessage.ts（工厂化重构：
 *   createProcessMessage({fetchPost}) 创建 + setProcessMessageUIDependencies 依赖注入；
 *   由 index.ts、mobile/index.ts、window/index.ts 创建并注册，layout/Model.ts 经 modelRegistry 调用）。
 * 上游 v3.8.0 对该文件的增量（经评审）：新增「reloadpublishpage」WebSocket 命令处理——
 *   当 window.siyuan.isPublish 为真时执行 window.location.reload() 并返回 false；
 *   为 base→stage3 的唯一增量块（+6 行），插入位置在既有「closepublishpage」分支之前。
 * 增量去向：尚未移植。TODO：在 app/src/util/network/processMessage.ts 的
 *   「closepublishpage」分支（约第 237 行）前补植上述逻辑；
 *   另注：本地无任何代码 import 旧路径，仅 app/src/util/README.md 残留过时文档链接。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
