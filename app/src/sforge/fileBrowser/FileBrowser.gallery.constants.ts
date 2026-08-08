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

/** 资源画廊的显示模式；表格模式复用列表虚拟化，只替换行投影。 */
export const FILE_BROWSER_GALLERY_VIEW_MODES = [
    {value: "masonry", label: "瀑布流视图", icon: "#iconGallery"},
    {value: "grid", label: "网格视图", icon: "#iconLayoutGrid"},
    {value: "justified", label: "对齐视图", icon: "#iconImage"},
    {value: "list", label: "列表视图", icon: "#iconList"},
    {value: "table", label: "表格视图", icon: "#iconTable"},
] as const;

export type FileBrowserGalleryViewMode = typeof FILE_BROWSER_GALLERY_VIEW_MODES[number]["value"];
