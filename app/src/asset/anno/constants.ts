/** 属性视图标注模块常量集：包含 CSS 类名、操作类型和 DOM 属性名。拆分后可减少字符串字面量散落在各处，便于统一维护。 */
export const AnnoConstants = {
    CSS: {
        PDF_OUTER: "pdf__outer",
        COLOR_SQUARE: "color__square",
        PDF_RECT: "pdf__rect",
        PDF_VIEWER: "pdfViewer"
    },
    ACTION: {
        REMOVE: "remove",
        COPY: "copy",
        RELATE: "relate",
        TOGGLE: "toggle",
        DOWNLOAD: "download",
        EXPORT_PAGE: "export-page"
    },
    ATTR: {
        DATA_TYPE: "data-type",
        DATA_NODE_ID: "data-node-id"
    }
} as const;
