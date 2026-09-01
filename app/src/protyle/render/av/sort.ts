/**
 * S-Forge 墓碑文件（Tombstone）。
 * 本文件在本地分支被有意删除：架构重构（提交 a49ee89c13「refactor: isolate AV sorting lifecycle」）将属性视图排序拆分为独立领域模块，原单文件实现随重构移除。
 * 本地替代/迁移到：
 *   - app/src/protyle/render/av/sorting/index.ts —— 承接原 addSort、bindSortsEvent、getSortsHTML 三个导出；
 *   - app/src/protyle/render/av/sorting/menu.factory.ts、sorting.types.ts、imports —— 菜单工厂、领域类型与依赖网关；
 *   - 入口调用方为 app/src/protyle/render/av/openMenuPanel.click.sortsFilters.ts。
 * 上游 v3.8.0 对该文件的增量（经评审）：
 *   1. 排序选项 HTML 中的列名改为经 escapeHtml 转义后再拼接（防注入加固）。
 *   2. bindSortsEvent 改为按 Select 的 data-type 分发（sortColumn／sortOrder／sortDateEndpoint），替换原先按前邻图标类名猜测语义的判定。
 *   3. 新增日期列端点排序：日期类型列追加「开始／结束」下拉并写入 sort.dateEndpoint，切换排序列时按新旧列类型清理该字段。
 *   4. 切换排序列后重绘排序面板 HTML 并重新绑定事件（reRender 路径）。
 * 增量去向：
 *   - 以上四项均未移植：本地 sorting/index.ts 的 getSortOptionsHTML 仍直接内插 column.name；handleSortChange 沿用图标类名判定且不支持重绘；全仓无 dateEndpoint 引用。TODO 移植清单：转义加固 → getSortOptionsHTML；端点排序与 data-type 分发（含 i18n startDate／endDate 文案核对）→ handleSortChange 与 getSortsHTML。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
