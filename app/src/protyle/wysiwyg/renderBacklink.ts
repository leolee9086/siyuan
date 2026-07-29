import {removeLoading} from "../ui/loading";
import {fetchPost} from "../../util/network/fetch";
import {Constants} from "../../constants";
import {contentRendererRegistry} from "../../registry/contentRenderer/ContentRendererRegistry";
import {highlightRender} from "../render/highlightRender";
import {blockRender} from "../render/blockRender";
import {disabledForeverProtyle, disabledProtyle} from "../util/onGet";
import {avRender} from "../render/av/render";
import {isEncryptedBox} from "../../util/file/notebook/store";
import {genBreadcrumb, improveBreadcrumbAppearance} from "../breadcrumb/backlinkBreadcrumb";
import {foldPassiveType} from "./backlink/foldPassiveType";

export const renderBacklink = (protyle: IProtyle, backlinkData: {
    blockPaths: IBreadcrumb[],
    dom: string,
    expand: boolean
}[]) => {
    protyle.block.showAll = true;
    let html = "";
    backlinkData.forEach((item, index) => {
        html += genBreadcrumb(item.blockPaths, false, index) + setBacklinkFold(item.dom, item.expand);
    });
    protyle.wysiwyg.element.innerHTML = html;
    improveBreadcrumbAppearance(protyle.wysiwyg.element);
    contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
    highlightRender(protyle.wysiwyg.element);
    avRender(protyle.wysiwyg.element, protyle);
    blockRender(protyle, protyle.wysiwyg.element);
    removeLoading(protyle);
    if (window.siyuan.config.readonly || window.siyuan.config.editor.readOnly) {
        disabledProtyle(protyle);
    }
};

const setBacklinkFold = (html: string, expand: boolean) => {
    const tempDom = document.createElement("template");
    tempDom.innerHTML = html;
    foldPassiveType(expand, tempDom.content);
    return tempDom.innerHTML;
};

export const loadBreadcrumb = (protyle: IProtyle, element: HTMLElement) => {
    const getDocParam: IObject = {
        id: element.getAttribute("data-id"),
        size: Constants.SIZE_GET_MAX,
    };
    if (isEncryptedBox(protyle.notebookId)) {
        getDocParam.notebook = protyle.notebookId;
    }
    fetchPost("/api/filetree/getDoc", getDocParam, getResponse => {
        element.parentElement.querySelector(".protyle-breadcrumb__item--active").classList.remove("protyle-breadcrumb__item--active");
        element.classList.add("protyle-breadcrumb__item--active");
        let nextElement = element.parentElement.nextElementSibling;
        while (nextElement && !nextElement.classList.contains("protyle-breadcrumb__bar")) {
            const tempElement = nextElement;
            nextElement = nextElement.nextElementSibling;
            tempElement.remove();
        }
        element.parentElement.insertAdjacentHTML("afterend", setBacklinkFold(getResponse.data.content, true));
        contentRendererRegistry.renderBatch(element.parentElement.parentElement);
        avRender(element.parentElement.parentElement, protyle);
        blockRender(protyle, element.parentElement.parentElement);
        if (getResponse.data.isSyncing) {
            disabledForeverProtyle(protyle);
        } else if (window.siyuan.config.readonly || window.siyuan.config.editor.readOnly) {
            disabledProtyle(protyle);
        }
    });
};

export const getBacklinkHeadingMore = (moreElement: HTMLElement) => {
    let nextElement = moreElement.nextElementSibling;
    while (nextElement && !nextElement.classList.contains("protyle-breadcrumb__bar")) {
        nextElement.classList.remove("fn__none");
        nextElement = nextElement.nextElementSibling;
    }
    moreElement.remove();
};

export {genBreadcrumb, improveBreadcrumbAppearance};
