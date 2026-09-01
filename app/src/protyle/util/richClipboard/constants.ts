/** 支持转换为富文本剪贴板资源占位符的图片扩展名。 */
export const richClipboardImageExts = /^(apng|avif|bmp|cur|gif|ico|jfif|jpe|jpeg|jpg|pjp|pjpeg|png|webp)$/i;

/** 剪贴板 HTML 中允许保留的属性白名单。 */
export const richClipboardAttributes = /^(align|alt|cellpadding|cellspacing|checked|colspan|controls|height|href|poster|rowspan|src|start|style|target|title|type|width)$/;

/** 被视为独立源行的 HTML 标签。 */
export const richClipboardLineTags = /^(H1|H2|H3|H4|H5|H6|P|PRE)$/;

/** 思源文本标记类型到标准 HTML 标签的有限映射。 */
export const richClipboardTextMarkTags = /^(a|code|em|kbd|mark|s|strong|sub|sup|u)$/;
