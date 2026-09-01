/**
 * S-Forge 墓碑文件（Tombstone）。
 * 三方索引：base＝1bc4918f4b（978 行）；上游 v3.8.0＝d6ba7977d1（1402 行，+620/-191）；stage2 不存在（本地删除）。
 * 本文件在本地分支被有意删除：架构重构「拆分 AV_action」（s-forge 提交 8f9ff44226），单文件拆分为 render/av/action/ 目录模块。
 * 本地替代/迁移到（路径相对 app/src/protyle/render/av/）：
 * - action/click.ts：avClick（另经 action/index.ts 桶导出）
 * - action/contextmenu.ts：avContextmenu（另经 action/index.ts 桶导出）
 * - action/duplicate.ts：duplicateCompletely（另经 action/index.ts 桶导出）
 * - action/name.ts：updateAVName
 * - action/animation.ts：updateAttrViewCellAnimation
 * - col/structure/presentation.ts：removeAttrViewColPresentation（原 removeAttrViewColAnimation 的更名迁移）
 * 上游 v3.8.0 对该文件的增量（经评审）：
 * 1. avClick 新增模板链接拦截、av-selection-edit/delete/more 批量字段操作入口、画廊封面打开、卡片封面摆位事件、Shift 范围选择与 Alt 全组折叠等点击分支；
 * 2. avContextmenu 支持无行调用（rowElement 可空＋options.blockElement/anchorElement），行信息取自 virtualScroll 选中集，新增 detached 行建文档绑定、多行解绑与动态字段编辑子菜单；
 * 3. 复制类菜单改用 itemLink 生成数据库条目链接（含 Markdown 形式），addToDatabase 改为对象参数式 openSearchAV；
 * 4. 新增导出 updateAttrViewColAnimation（列改名／图标跨视图动画），removeAttrViewColAnimation 扩展为按 avID 清理全部同源视图及属性面板；updateAVName 事务回调刷新数据库属性面板；
 * 5. duplicateCompletely 复制时保留当前视图、可见视图属性与 data-av-type，并把首次渲染推迟到插入事务回调之后。
 * 增量去向：尚未移植（TODO port）。移植目标是 action/{click,contextmenu,name,animation,duplicate}.ts 以及 col/、virtualScroll.ts 等拆分模块；
 * 其依赖的上游新模块 attributeValue、batchEdit、coverPosition、rangeSelect、groupFold、itemLink、kanban/groupMenu、viewVisibility 本地不存在，移植时需一并语义移植或等效实现。
 * 警告：合并克隆中仍有以下 6 个文件以旧路径「render/av/action」导入符号；由于本墓碑文件在模块解析时会遮蔽 action/ 目录的桶导出，
 * 这些导入必须改为显式子路径（参照 protyle/util/insertHTML.ts 使用「render/av/action/name」「render/av/action/animation」的写法）：
 * - app/src/boot/globalEvent/keydown/editKeydown/imports.ts（duplicateCompletely → action/duplicate）
 * - app/src/protyle/gutter/buildGutterCopyMenu.ts（duplicateCompletely → action/duplicate）
 * - app/src/protyle/gutter/bindEvent.ts（avContextmenu → action 或 action/contextmenu）
 * - app/src/protyle/hint/index.ts（updateAttrViewCellAnimation → action/animation）
 * - app/src/protyle/wysiwyg/index.click.ts（avClick → action 或 action/click）
 * - app/src/protyle/wysiwyg/index.contextmenu.ts（avContextmenu → action 或 action/contextmenu）
 * 另见 app/src/menus/commonMenuItem.ts 顶部注释：其自身同为 DU 冲突（本地已删除／重构）。
 * 提示：请勿恢复此文件内容；后续分析本冲突只需阅读本墓碑。
 */
export {};
