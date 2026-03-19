/**
 * 导出预览页签常量
 */

/** TabRegistry 中注册的页签类型标识 */
export const EXPORT_PREVIEW_TAB_TYPE = "export-preview";

/** 普通导出预览类型 */
export const EXPORT_PREVIEW_DEFAULT_TYPE = "default";

/** 图片导出预览类型 */
export const EXPORT_PREVIEW_IMAGE_TYPE = "image";

/** 导出预览页签内部切换预览类型的事件名 */
export const EXPORT_PREVIEW_SET_TYPE_EVENT = "export-preview:set-type";

/** 默认操作按钮列表（桌面端） */
export const DEFAULT_ACTIONS: IPreviewAction[] = [
    "desktop", "tablet", "mobile", "mp-wechat", "zhihu", "yuque", "image",
];
