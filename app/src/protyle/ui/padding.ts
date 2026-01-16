import { Constants } from "../../constants";
import { isMobile } from "../../util/functions";

/**
 * 计算非移动端的 padding
 */
const 计算非移动端Padding = (protyle: IProtyle): { left: number; right: number } => {
    let isFullWidth = protyle.wysiwyg.element.getAttribute(Constants.CUSTOM_SY_FULLWIDTH);
    if (!isFullWidth) {
        isFullWidth = window.siyuan.config.editor.fullWidth ? "true" : "false";
    }
    let padding = (protyle.element.clientWidth - Constants.SIZE_EDITOR_WIDTH) / 2;

    // 窄屏情况
    if (isFullWidth === "false" && padding > 96) {
        // 超宽屏调整 https://ld246.com/article/1668266637363
        if (padding > Constants.SIZE_EDITOR_WIDTH) {
            padding = protyle.element.clientWidth * .382 / 1.382;
        }
        padding = Math.ceil(padding);
        return { left: padding, right: padding };
    }

    if (protyle.element.clientWidth > Constants.SIZE_EDITOR_WIDTH) {
        return { left: 96, right: 96 };
    }
    return { left: 24, right: 16 };
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
    if (protyle.options.typewriterMode) {
        bottom = isMobile() ? window.innerHeight / 5 : protyle.element.clientHeight / 2;
    }

    if (isMobile()) {
        return { left: 24, right: 16, bottom, top: 16 };
    }

    const { left, right } = 计算非移动端Padding(protyle);
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

    const wysiwygPadding = protyle.options.backlinkData
        ? `4px ${paddingRight}px 4px ${paddingLeft}px`
        : `${padding.top}px ${paddingRight}px ${padding.bottom}px ${paddingLeft}px`;
    protyle.wysiwyg.element.style.padding = wysiwygPadding;

    if (protyle.options.render?.background && protyle.background) {
        const backgroundIa = protyle.background.element.querySelector(".protyle-background__ia");
        if (backgroundIa) {
            backgroundIa.setAttribute("style", `margin-left:${paddingLeft}px;margin-right:${paddingRight}px`);
        }
    }
    if (protyle.options.render?.title && protyle.title) {
        // pc 端 文档名 attr 过长和添加标签等按钮重合
        protyle.title.element.style.margin = `16px ${paddingRight}px 0 ${paddingLeft}px`;
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
