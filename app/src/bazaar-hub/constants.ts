/**
 * 用途：集市广场主 Tab 的唯一类型标识。
 * 使用范围：register.ts 注册与 open.ts 查找/打开该 Tab。
 */
/** 导出 BAZAAR_HUB_TAB_TYPE 供 bazaar-hub 模块复用 */
export const BAZAAR_HUB_TAB_TYPE = "bazaar-hub";

/**
 * 用途：发布设置 Tab 的唯一类型标识。
 * 使用范围：register.ts 注册与 open.ts 查找/打开该 Tab。
 */
/** 导出 BAZAAR_PUBLISH_TAB_TYPE 供 bazaar-hub 模块复用 */
export const BAZAAR_PUBLISH_TAB_TYPE = "bazaar-publish-settings";

/**
 * 用途：第三方源页面 Tab 的唯一类型标识。
 * 使用范围：register.ts 注册与 open.ts 查找/打开该 Tab。
 */
/** 导出 BAZAAR_SOURCE_TAB_TYPE 供 bazaar-hub 模块复用 */
export const BAZAAR_SOURCE_TAB_TYPE = "bazaar-source-tab";

/**
 * 用途：集市广场 Tab 内部切换源的自定义事件名。
 * 使用范围：open.ts 触发事件，initHub.ts 监听并切换当前源。
 */
/** 导出 BAZAAR_HUB_SET_SOURCE_EVENT 供 bazaar-hub 模块复用 */
export const BAZAAR_HUB_SET_SOURCE_EVENT = "bazaar-hub:set-source";
