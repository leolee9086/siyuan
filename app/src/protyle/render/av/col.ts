/**
 * S-Forge 墓碑文件（Tombstone）
 * 本文件在本地分支被有意删除：架构重构「移除重复的属性视图列实现」（s-forge 提交 318703137e），原约 1957 行单文件已拆分为 col/ 目录模块。
 * 本地替代/迁移到：
 *   - getColId → col/identity/resolve.ts
 *   - getEditHTML / bindEditEvent → col/edit/render.ts
 *   - showColMenu → col/menu/menu.factory.ts（配套 col.showColMenu.items / col.showColMenu.actions / col.showColMenu.types）
 *   - addCol → col/add/menu.factory.ts
 *   - duplicateCol / removeCol → col/structure/operations.ts（removeColByMenu 在 col/structure/removeByMenu.ts）
 *   - getColNameByType / getColIconByType → col/col.typeUtils.ts
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. 新增导出 setFreezeColumn / autoFitAVColumns / showAVColumnWidthMenu：列冻结改读 data-freeze 并抽出独立函数；新增列宽右键菜单（自适应、同左右列宽、全部均分、同步到其他视图，替代原 syncColWidth 菜单项）；
 *   2. XSS 加固：getEditHTML 中 icon/desc/color/name 等模板插值补 escapeAttr / escapeHtml；
 *   3. date/created/updated 列编辑菜单新增 dateFormat 入口，genColDataByType 与 removeCol/addCol 事务携带 format 字段（依赖上游新模块 ./dateFormat）；
 *   4. 隐藏列菜单项增加 fieldVisibility 快捷入口（openFieldVisibility），duplicate 文案改 duplicateCopy，relation 列菜单新增筛选入口；
 *   5. addAttrViewColAnimation 改为渲染真实空单元格（renderCell / genAVAttributeRowHTML / createEmptyAVValue）；重命名列改走 updateAttrViewColAnimation；back-relation 拉取增加 isConnected 异步守卫。
 * 增量去向：冻结与列宽事务本地已有等价能力（col/col.showColMenu.actions.ts 与 col.showColMenu.items.ts 中的 setAttrViewColPin、syncAttrViewTableColWidth），
 *   无需整体恢复本文件；其余上游增量为待移植清单（TODO port）：escapeAttr 补齐、dateFormat 菜单项、fieldVisibility 入口、空单元格渲染动画、relation 筛选入口、autoFitAVColumns 自动列宽。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
