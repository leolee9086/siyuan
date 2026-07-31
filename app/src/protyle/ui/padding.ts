import { Constants } from "../../constants";
import { isMobile } from "../../util/platform/functions";

/** 计算编辑器内容区域的水平边距，供 Protyle 与数据库属性面板复用。 */
export const getEditorHorizontalPadding = (width: number, fullWidth: boolean) => {
    let left = 24;
    let right = 16;
    let padding = (width - Constants.SIZE_EDITOR_WIDTH) / 2;
    // 超宽屏采用黄金比例缩放，避免编辑区在极宽窗口中失去可读宽度。
    if (!fullWidth && padding > 96 && padding > Constants.SIZE_EDITOR_WIDTH) {
        padding = width * .382 / 1.382;
    }
    // 窄屏/非全宽模式使用对称边距。
    if (!fullWidth && padding > 96) {
        padding = Math.ceil(padding);
        left = padding;
        right = padding;
        return {left, right};
    }
    // 全宽编辑器在宽窗口中保留固定 96px 边距，避免内容紧贴宿主边缘。
    if (width > Constants.SIZE_EDITOR_WIDTH) {
        left = 96;
        right = 96;
    }
    return {left, right};
};

/**
 * 获取编辑器的 padding 配置。
 * 包括上下左右边距，会根据移动端/桌面端、打字机模式等进行调整。
 * 
 * @param {IProtyle} protyle - Protyle 实例
 * @returns {Object} 包含 left, right, bottom, top 的对象
 */
export const getPadding = (protyle: IProtyle) => {
    let bottom = 16;
    // 打字机模式需要扩大底部空间，使当前行可滚动到可视区域中部。
    if (protyle.options.typewriterMode) {
        bottom = isMobile() ? window.innerHeight / 5 : protyle.element.clientHeight / 2;
    }

    if (isMobile()) {
        return { left: 24, right: 16, bottom, top: 16 };
    }

    const fullWidthAttr = protyle.wysiwyg.element.getAttribute(Constants.CUSTOM_SY_FULLWIDTH);
    const fullWidth = fullWidthAttr ? fullWidthAttr === "true" : window.siyuan.config.editor.fullWidth;
    const {left, right} = getEditorHorizontalPadding(protyle.element.clientWidth, fullWidth);
    return { left, right, bottom, top: 16 };
};

/**
 * 设置并应用编辑器的 padding 样式。
 * 同时会更新背景和标题的边距。
 * 
 * @param {IProtyle} protyle - Protyle 实例
 * @returns {Object} 包含 width 变化值的对象
 */
export const setPadding = (protyle: IProtyle) => {
    if (protyle.options.action.includes(Constants.CB_GET_HISTORY)) {
        return {
            width: 0,
            padding: 0
        };
    }
    const padding = getPadding(protyle);
    const paddingLeft = padding.left;
    const paddingRight = padding.right;
    const backlinkBottomElement = protyle.contentElement.querySelector<HTMLElement>(".sy__backlink--bottom");
    const backlinkBottomVisible = backlinkBottomElement !== null && !backlinkBottomElement.classList.contains("fn__none");

    const paddingBottom = backlinkBottomVisible && protyle.options.typewriterMode ? 16 : padding.bottom;
    const wysiwygPadding = protyle.options.backlinkData
        ? `4px ${paddingRight}px 4px ${paddingLeft}px`
        : `${padding.top}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`;
    protyle.wysiwyg.element.style.padding = wysiwygPadding;

    const backgroundIa = protyle.background?.element.querySelector(".protyle-background__ia");
    // 仅在宿主声明渲染背景且背景信息区已挂载时同步水平边距。
    if (protyle.options.render?.background && backgroundIa) {
        backgroundIa.setAttribute("style", `margin-left:${paddingLeft}px;margin-right:${paddingRight}px`);
    }
    // 仅为启用标题渲染且标题实例存在的编辑器同步标题边距。
    if (protyle.options.render?.title && protyle.title) {
        // pc 端 文档名 attr 过长和添加标签等按钮重合
        protyle.title.element.style.margin = `16px ${paddingRight}px 0 ${paddingLeft}px`;
    }
    // 数据库属性面板与正文共用同一水平内容边界。
    if (protyle.databaseAttributePanel) {
        protyle.databaseAttributePanel.element.style.margin = `8px ${paddingRight}px 8px ${paddingLeft}px`;
    }
    if (backlinkBottomElement) {
        backlinkBottomElement.style.padding = `0 ${paddingRight}px 16px ${paddingLeft}px`;
        backlinkBottomElement.style.marginBottom = backlinkBottomVisible && protyle.options.typewriterMode
            ? `${Math.max(padding.bottom - 16, 0)}px`
            : "";
    }

    // https://github.com/siyuan-note/siyuan/issues/15021
    protyle.element.style.setProperty("--b3-width-protyle", protyle.element.clientWidth + "px");
    protyle.element.style.setProperty("--b3-width-protyle-content", protyle.contentElement.clientWidth + "px");
    const realWidth = protyle.wysiwyg.element.getAttribute("data-realwidth");
    const wysiwygElement = protyle.wysiwyg.element;
    const newWidth = wysiwygElement.clientWidth - paddingLeft - paddingRight;
    wysiwygElement.setAttribute("data-realwidth", newWidth.toString());
    protyle.element.style.setProperty("--b3-width-protyle-wysiwyg", newWidth.toString() + "px");
    return {
        width: realWidth ? Math.abs(parseFloat(realWidth) - newWidth) : 0,
    };
};
