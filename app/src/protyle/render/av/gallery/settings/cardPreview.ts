/** 用途：拖动设置滑杆时实时同步卡片预览样式；使用范围：尺寸与宽高比滑杆；解耦评估：同域唯一预览实现，画廊与看板共用。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const updateCardPreview = (nodeElement: Element, property: string, value: string) => {
    const selector = nodeElement.getAttribute("data-av-type") === "kanban" ? ".av__kanban" : ".av__gallery";
    nodeElement.querySelectorAll<HTMLElement>(selector).forEach(item => {
        item.style.setProperty(property, value);
    });
};
