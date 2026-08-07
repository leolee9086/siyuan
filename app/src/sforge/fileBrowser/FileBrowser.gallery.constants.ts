/** 独立文件资源瀑布流页签的稳定类型标识。 */
export const FILE_BROWSER_GALLERY_TAB_TYPE = "sforge-file-gallery";

/** 参考画廊使用的常见类型筛选；结果中出现的其它扩展名会由页签追加。 */
export const FILE_BROWSER_GALLERY_DEFAULT_EXTENSIONS = [
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico",
    ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".mov", ".pdf",
] as const;

/** 卡片可以投影的索引属性；不改变后端查询结果契约。 */
export const FILE_BROWSER_GALLERY_ATTRIBUTES = [
    {key: "dimensions", label: "尺寸"},
    {key: "size", label: "大小"},
    {key: "extension", label: "类型"},
    {key: "source", label: "来源"},
    {key: "importTime", label: "导入时间"},
    {key: "annotation", label: "注释"},
] as const;

export type FileBrowserGalleryAttribute = typeof FILE_BROWSER_GALLERY_ATTRIBUTES[number]["key"];

export const FILE_BROWSER_GALLERY_DEFAULT_ATTRIBUTES: readonly FileBrowserGalleryAttribute[] = [
    "dimensions", "size",
];
