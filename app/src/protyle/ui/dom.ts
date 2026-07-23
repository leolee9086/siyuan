import { Constants } from "../../constants";
import { scrollEvent } from "../scroll/event";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { moveResize } from "../runtime/dialog.port";
import { isMobile } from "../../platform";
import { AVAttributePanel } from "../render/av/attributePanel";

/** 在非历史、非反链编辑器中创建并挂载数据库属性面板。 */
const 挂载数据库属性面板 = (protyle: IProtyle) => {
    const shouldMount = protyle.options.databaseAttr &&
        !protyle.options.action.includes(Constants.CB_GET_HISTORY) &&
        !protyle.options.backlinkData;
    if (!shouldMount) {
        return;
    }
    let topElement = protyle.contentElement.querySelector(".protyle-top");
    if (!topElement) {
        topElement = document.createElement("div");
        topElement.className = "protyle-top";
        protyle.contentElement.appendChild(topElement);
    }
    protyle.databaseAttributePanel = new AVAttributePanel(protyle);
    topElement.appendChild(protyle.databaseAttributePanel.element);
};

/**
 * 初始化 ContentElement 及其顶部区域。
 * 
 * @param {IProtyle} protyle - Protyle 实例
 */
const 初始化ProtyleContent = (protyle: IProtyle) => {
    protyle.contentElement = document.createElement("div");
    protyle.contentElement.className = "protyle-content";

    // 初始化顶部区域（背景和标题）
    const renderOptions = protyle.options.render;
    const 需要顶部区域 = renderOptions?.background || renderOptions?.title;
    // 只有在需要背景或标题渲染时才创建顶部区域容器
    if (需要顶部区域) {
        protyle.contentElement.innerHTML = '<div class="protyle-top"></div>';
    }
    const topElement = protyle.contentElement.firstElementChild;
    // 在顶部区域存在且开启背景渲染时，挂载背景组件
    if (renderOptions?.background && 需要顶部区域 && topElement && protyle.background) {
        topElement.appendChild(protyle.background.element);
    }
    // 在顶部区域存在且开启标题渲染时，挂载标题组件
    if (renderOptions?.title && 需要顶部区域 && topElement && protyle.title) {
        topElement.appendChild(protyle.title.element);
    }

    挂载数据库属性面板(protyle);
    if (protyle.wysiwyg) {
        protyle.contentElement.appendChild(protyle.wysiwyg.element);
    }
    // 非历史模式下，为 contentElement 绑定滚动事件监听
    if (protyle.options.action && !protyle.options.action.includes(Constants.CB_GET_HISTORY)) {
        scrollEvent(protyle, protyle.contentElement);
    }
};

/**
 * 挂载子组件（预览、上传、滚动、Gutter 等）。
 * @AIDONE 已创建 ESLint 规则 require-if-comment/require-if-comment，要求 if 语句前必须有注释说明
 * @param {IProtyle} protyle - Protyle 实例
 */
const 挂载子组件 = (protyle: IProtyle) => {
    const parentElement = protyle.element;
    if (protyle.contentElement) {
        parentElement.append(protyle.contentElement);
    }
    if (protyle.upload) {
        parentElement.appendChild(protyle.upload.element);
    }
    // 滚动组件需要渲染选项开启且有父元素容器时才挂载
    if (protyle.options.render?.scroll && protyle.scroll?.element.parentElement) {
        parentElement.appendChild(protyle.scroll.element.parentElement);
    }
    if (protyle.gutter) {
        parentElement.appendChild(protyle.gutter.element);
    }
    if (protyle.hint) {
        parentElement.appendChild(protyle.hint.element);
    }

    protyle.selectElement = document.createElement("div");
    protyle.selectElement.className = "protyle-select fn__none";
    const selectContainer = document.createElement("div");
    selectContainer.className = "protyle-select__container";
    selectContainer.appendChild(protyle.selectElement);
    parentElement.appendChild(selectContainer);
};

/**
 * 初始化 Toolbar 及其移动缩放功能。
 * 
 * @param {IProtyle} protyle - Protyle 实例
 */
const 初始化Toolbar = (protyle: IProtyle) => {
    if (!protyle.toolbar) {
        return;
    }
    protyle.element.appendChild(protyle.toolbar.element);
    protyle.element.appendChild(protyle.toolbar.subElement);
    // 非移动端下启用工具栏子面板的拖拽移动和缩放功能
    if (!isMobile) {
        // @内联回调 moveResize 的回调函数
        moveResize(protyle.toolbar.subElement, (type) => {
            // 回调是异步执行的，需要再次检查 toolbar 是否存在
            if (!protyle.toolbar) {
                return;
            }
            const subElement = protyle.toolbar.subElement;
            const pinElement = subElement.querySelector('.block__icons [data-type="pin"]');
            if (pinElement) {
                const useElement = pinElement.querySelector("svg use");
                useElement?.setAttribute("xlink:href", "#iconUnpin");
                pinElement.setAttribute("aria-label", siyuanI18n.unpin);
                subElement.firstElementChild?.setAttribute("data-drag", "true");
            }
            // 只有实际缩放而非移动时，才重新计算依赖子面板尺寸的内容。
            if (type !== "move" && protyle.toolbar.subElementResizeCB) {
                protyle.toolbar.subElementResizeCB();
            }
        });
    }
};

/**
 * 初始化 protyle 的 DOM 结构
 * 包括 contentElement、各种子组件的挂载。
 * 此函数会在编辑器启动时调用。
 * 
 * @param {IProtyle} protyle - Protyle 实例
 */
export const 初始化DOM结构 = (protyle: IProtyle) => {
    初始化ProtyleContent(protyle);
    挂载子组件(protyle);
    初始化Toolbar(protyle);

    if (protyle.highlight) {
        protyle.element.append(protyle.highlight.styleElement);
    }
};
