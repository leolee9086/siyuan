import {focusBlock} from "../util/selection";
import {contentRendererRegistry} from "../../registry/contentRenderer/ContentRendererRegistry";
import {highlightRender} from "../render/highlightRender";
import {isInEmbedBlock} from "../util/hasClosest";
import {getViewFoldVisualEffects} from "../util/viewFoldVisual/port";
import {removeFoldHeading} from "../util/heading";
import {normalizeHTMLAssetIFrameBlockDOM} from "../../asset/html";
import {getAVLocateRenderer} from "../render/av/locate/renderer.port";
import {getTransactionTransformVisualEffects} from "./transaction/transformVisual/port";
import {scrollCenter} from "../../util/DOM/highlightById";
import {refreshSbs} from "./transaction/refreshSbs";
import {consumeGutterFoldRestore} from "../ui/gutterVisibility";

// 折叠事务完成后恢复块标（gutter），避免折叠后手柄残留旧状态 https://github.com/siyuan-note/siyuan/issues/18706
const restoreGutterAfterFold = (protyle: IProtyle, id: string) => {
    if (!consumeGutterFoldRestore(protyle.gutter.element, id)) {
        return;
    }
    window.requestAnimationFrame(() => {
        const nodeElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${id}"]`);
        if (nodeElement) {
            protyle.gutter.render(protyle, nodeElement);
        }
    });
};

export const syncFoldAndStyleAttrs = (element: Element, operation: IOperation) => {
    const attrs = JSON.parse(operation.data);
    const hasFold = Object.prototype.hasOwnProperty.call(attrs, "fold");
    const hasStyle = Object.prototype.hasOwnProperty.call(attrs, "style");
    if (!hasFold && !hasStyle) {
        return;
    }
    element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach(item => {
        if (hasFold) {
            if (attrs.fold === "1") {
                item.setAttribute("fold", "1");
            } else {
                item.removeAttribute("fold");
            }
        }
        if (hasStyle) {
            if (attrs.style) {
                item.setAttribute("style", attrs.style);
            } else {
                item.removeAttribute("style");
            }
        }
    });
};

export const removeUnfoldRepeatBlock = (html: string, protyle: IProtyle) => {
    const temp = document.createElement("template");
    temp.innerHTML = html;
    Array.from(temp.content.children).forEach(item => {
        protyle.wysiwyg.element.querySelector(`[data-node-id="${item.getAttribute("data-node-id")}"]`)?.remove();
    });
};

// 折叠标题在回放 HTML 中不可见：剥掉 fold="1" 标题的折叠子内容，仅保留可见骨架
export const getVisibleFoldHeadingHTML = (html: string) => {
    html = normalizeHTMLAssetIFrameBlockDOM(html);
    if (!html.includes('data-type="NodeHeading"') || !html.includes('fold="1"')) {
        return html;
    }

    const template = document.createElement("template");
    template.innerHTML = html;
    Array.from(template.content.querySelectorAll('[data-type="NodeHeading"][fold="1"]')).reverse().forEach(item => {
        removeFoldHeading(item);
    });
    return template.innerHTML;
};

export const processFold = (operation: IOperation, protyle: IProtyle) => {
    if (operation.action === "unfoldHeading" || operation.action === "foldHeading") {
        const gutterFoldElement = protyle.gutter.element.querySelector('[data-type="fold"]');
        if (gutterFoldElement) {
            gutterFoldElement.removeAttribute("disabled");
        }
        if (operation.action === "unfoldHeading") {
            const scrollTop = protyle.contentElement.scrollTop;
            const headingElements = Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`));
            headingElements.forEach(item => {
                const embedElement = isInEmbedBlock(item);
                if (embedElement) {
                    embedElement.removeAttribute("data-render");
                    getTransactionTransformVisualEffects().renderBlock(protyle, embedElement);
                    return;
                }
                item.removeAttribute("fold");
                if (!item.lastElementChild.classList.contains("protyle-attr")) {
                    item.lastElementChild.remove();
                }
                removeUnfoldRepeatBlock(operation.retData, protyle);
                item.insertAdjacentHTML("afterend", operation.retData);
                if (operation.data === "remove") {
                    // https://github.com/siyuan-note/siyuan/issues/2188
                    const selection = getSelection();
                    if (selection.rangeCount > 0 && item.contains(selection.getRangeAt(0).startContainer)) {
                        focusBlock(item.nextElementSibling, undefined, true);
                    }
                    item.remove();
                }
            });
            if (protyle.disabled) {
                getViewFoldVisualEffects().applyDisabledState(protyle);
            }
            contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
            highlightRender(protyle.wysiwyg.element);
            getAVLocateRenderer()(protyle.wysiwyg.element, protyle);
            getTransactionTransformVisualEffects().renderBlock(protyle, protyle.wysiwyg.element);
            refreshSbs(...headingElements);
            if (operation.context?.focusId) {
                const focusElement = protyle.wysiwyg.element.querySelector(`[data-node-id="${operation.context.focusId}"]`);
                focusBlock(focusElement);
                scrollCenter(protyle, focusElement);
            } else {
                protyle.contentElement.scrollTop = scrollTop;
                protyle.scroll.lastScrollTop = scrollTop;
            }
            restoreGutterAfterFold(protyle, operation.id);
            return;
        }
        protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`).forEach(item => {
            const embedElement = isInEmbedBlock(item);
            if (embedElement) {
                embedElement.removeAttribute("data-render");
                getTransactionTransformVisualEffects().renderBlock(protyle, embedElement);
            }
        });
        refreshSbs(...Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${operation.id}"]`)));
        // 折叠标题后未触发动态加载 https://github.com/siyuan-note/siyuan/issues/4168
        // 动态加载需串行，避免相同边界响应被重复追加 https://github.com/siyuan-note/siyuan/issues/18459
        const needsDynamicLoad = protyle.wysiwyg.element.lastElementChild.getAttribute("data-eof") !== "2" &&
            !protyle.scroll.element.classList.contains("fn__none") &&
            protyle.contentElement.scrollHeight - protyle.contentElement.scrollTop < protyle.contentElement.clientHeight * 2    // https://github.com/siyuan-note/siyuan/issues/7785
        ;
        if (!needsDynamicLoad || !protyle.scroll.loadDynamic(protyle, 2, {
            onFinish: () => restoreGutterAfterFold(protyle, operation.id),
        })) {
            restoreGutterAfterFold(protyle, operation.id);
        }
        return;
    }
};
