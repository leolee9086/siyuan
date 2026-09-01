/**
 * S-Forge 墓碑文件（Tombstone）——原 app/src/protyle/render/av/openDatabaseRow.ts
 * 本文件在本地分支被有意删除：架构重构「数据库行导航改经 AppFacade 门面分发」（删除提交 1d135a659e；本冲突为 modify/delete，DU）。
 * 本地替代/迁移到：
 *   - editor/open/databaseRow/openDatabaseRow.ts（openDesktopDatabaseRow：分离条目走 siyuan-database-row 自定义页签，绑定条目走 app.openBlock 编辑器预览）
 *   - editor/open/databaseRow/openDatabaseRowBlock.ts 与 databaseRowTab.guard.ts（行预览页签的打开动作与持久化身份守卫）
 *   - 分发入口 AppFacade.openDatabaseRow：app/AppFacade.types.ts、index.ts（桌面实现）、mobile/index.ts（移动端实现）
 *   - 现存调用方示例：protyle/render/av/action/click/dataType.ts、protyle/render/av/blockAttr.ts（protyle.app.openDatabaseRow(...)）
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. IDatabaseRowOpenData 新增搜索命中字段：keywords、matchedValueID、matchedKeyID。
 *   2. 新增 highlightDatabaseRow()：经 protyle/render/searchMarkRender 高亮命中单元格并滚动定位，移动端与桌面端均接入。
 *   3. 移动端 openMobileDetachedDatabaseRow 更名 openMobileDatabaseRow：新建幽灵 Protyle 承载高亮 styleElement，destroyCallback 清理。
 *   4. 桌面端新增 focusDatabaseRowPreview()（先 zoomOut 到绑定块再预览）；页签复用路径对非 Editor 页签改写 initdata 的 blockId/action。
 *   5. openDatabaseRowByData 改为 async 并返回 boolean，新增 options{position, keepAVPanel} 与 openStandalone 门（isDetached 或未开启 databaseAttrShow）。
 * 增量去向：TODO 移植清单（勿直接还原本文件，按条目并入新架构）：
 *   a) 条目 1+2：扩展 AppDatabaseRowNavigation 契约字段，并在 editor/open/databaseRow 接入 render/searchMarkRender（该模块本地已存在）。
 *   b) 条目 3：移动端 mobile/index.ts 的 openDatabaseRow 补充幽灵 Protyle 高亮与清理逻辑（如移动端需要搜索命中定位）。
 *   c) 条目 4+5：openStandalone 门、position/keepAVPanel 透传与 Custom 页签数据回填（model.update()）并入 AppFacade 导航契约；
 *      zoomOut 精细聚焦可暂缓（本地 app.openBlock({zoomIn:true}) 已近似覆盖）。
 * 警告：合并工作区中仍有三处旧导入会因本墓碑而失联，需各自迁移到 AppFacade 门面或移植上游调用点：
 *   - protyle/render/av/action.ts（自身同为 DU 冲突）第 53 行 import {openDatabaseRowByData}
 *   - protyle/render/av/relation.ts 第 25 行 import + 第 802 行调用
 *   - protyle/render/av/filteredTip.ts 第 4 行 import + 第 122 行调用（该文件为上游新增，本地基线不存在）
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */

export {};
