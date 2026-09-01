/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构将其迁移至 util/file/ 领域模块（本地提交 5d9719aa24「refactor(util): 迁移 network/navigation/platform/DOM/file/assets 批次文件」）。
 * 本地替代/迁移到（相对 app/src/）：
 *   - fetchNewDailyNote / newDailyNote / mountHelp → util/file/mount.ts
 *   - newNotebook → util/file/notebookCreation/newNotebook/newNotebook.factory.ts
 *   - newEncryptedNotebook → util/file/notebookCreation/newEncryptedNotebook/newEncryptedNotebook.factory.ts
 *   - openEncryptedNotebook → util/file/notebookAccess/openEncryptedNotebook/openEncryptedNotebook.factory.ts
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. 新增 export importNotebook(file)：抽取 .sy.zip 导入的上传逻辑；
 *   2. newNotebook() 对话框新增 Markdown .zip / Markdown 文件 / Markdown 文件夹导入入口（/api/import/importZipMd、/api/import/importStdMd），输入框改用 data-type="notebook-name" 精确定位，并新增 createNotebookForImport 辅助函数；
 *   3. newEncryptedNotebook() 增加防重复弹窗与 pending 守卫，加密状态检查改为 state 字段分支（RecoveryRequired 与未启用分别提示不同文案）；
 *   4. openEncryptedNotebook() 增加按 notebook 的对话框去重 key，标题经 escapeHtml 转义；
 *   5. 类型调整：App 改为 type-only import，桌面端新增 node path 依赖。
 * 增量去向：
 *   - 已覆盖：Markdown/.sy 导入能力本地由 menus/fileTree/importMenu/importMenu.factory.ts 与 menus/dataMigration.ts 提供（UI 入口与上游不同，未并入 newNotebook 工厂）；App 类型已由新模块的 AppFacade/types 抽象取代。
 *   - TODO port：newEncryptedNotebook 的 RecoveryRequired 分支与防重复守卫；openEncryptedNotebook 的按 notebook 去重 key 与 escapeHtml 标题转义——需人工移植到对应 factory。
 * 警告：boot/onGetConfig.ts 第 23 行仍 import {mountHelp} from "../util/mount"，该引用已失效，需改为 "../util/file/mount"（主仓库同文件已不再使用此路径）。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
