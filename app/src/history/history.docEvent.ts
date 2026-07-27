import {confirmDialog} from "../dialog/confirmDialog";
import {Constants} from "../constants";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import {renderAssetsPreview} from "../asset/renderAssets";
import type {ProtyleDomain} from "../protyle/protyle.types";
import {onGet} from "../protyle/util/onGet";
import * as dayjs from "dayjs";
import {fetchPost} from "../util/network/fetch";
import {escapeAttr, escapeHtml} from "../util/DOM/escape";
import {isMobile} from "../util/platform/functions";
import {Dialog} from "../dialog";
import {closeModel} from "../mobile/util/closePanel";
import {isSupportCSSHL, searchMarkRender} from "../protyle/render/searchMarkRender";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {renderDoc, renderRmNotebook, renderRepo} from "./history.render";
import type {IHistoryDocClickContext} from "./history.docEvent.types";

export const handleDocClick = (
    context: IHistoryDocClickContext<ProtyleDomain, Dialog>,
): boolean => {
    const {
        target,
        type,
        event,
        element,
        firstPanelElement,
        historyEditor,
        dialog,
        clearHistoryEditor,
    } = context;
    const docElement = firstPanelElement.querySelector('.history__text[data-type="docPanel"]') as HTMLElement;
    const assetElement = firstPanelElement.querySelector('.history__text[data-type="assetPanel"]');
    const mdElement = firstPanelElement.querySelector('.history__text[data-type="mdPanel"]') as HTMLTextAreaElement;
    const titleElement = firstPanelElement.querySelector(".protyle-title__input") as HTMLElement;
    const historyElement = element.querySelector('#historyContainer [data-type="doc"]');

    if (target.classList.contains("item")) {
        target.parentElement.querySelector(".item--focus").classList.remove("item--focus");
        Array.from(element.querySelector("#historyContainer").children).forEach((item: HTMLElement) => {
            if (item.getAttribute("data-type") === type) {
                item.classList.remove("fn__none");
                item.classList.add("fn__block");
                target.classList.add("item--focus");
                if (item.getAttribute("data-init") !== "true") {
                    if (type === "notebook") {
                        renderRmNotebook(item);
                    } else if (type === "repo") {
                        renderRepo(item, 1);
                    }
                }
            } else {
                item.classList.add("fn__none");
                item.classList.remove("fn__block");
            }
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (target.classList.contains("b3-list-item__action") && type === "rollback" && !window.siyuan.config.readonly) {
        const dataType = target.parentElement.getAttribute("data-type");
        let name = target.previousElementSibling.previousElementSibling.textContent.trim();
        let time = dayjs(parseInt(target.parentElement.getAttribute("data-created")) * 1000).format("YYYY-MM-DD HH:mm:ss");
        if (dataType === "notebook") {
            time = target.parentElement.parentElement.previousElementSibling.textContent.trim();
        } else if (dataType === "repoitem") {
            name = siyuanI18n.workspaceData;
            time = (isMobile() ? target.parentElement.parentElement : target.parentElement).querySelector("span[data-type='hCreated']").textContent.trim();
        }
        const confirmTip = siyuanI18n.rollbackConfirm.replace("${name}", name)
            .replace("${time}", time);
        confirmDialog("⚠️ " + siyuanI18n.rollback, confirmTip, () => {
            if (dataType === "assets") {
                fetchPost("/api/history/rollbackAssetsHistory", {
                    historyPath: target.parentElement.getAttribute("data-path")
                });
            } else if (dataType === "doc") {
                fetchPost("/api/history/rollbackDocHistory", {
                    notebook: target.parentElement.getAttribute("data-notebook-id"),
                    historyPath: target.parentElement.getAttribute("data-path")
                });
            } else if (dataType === "av") {
                fetchPost("/api/history/rollbackAttributeViewHistory", {
                    historyPath: target.parentElement.getAttribute("data-path")
                });
            } else if (dataType === "notebook") {
                fetchPost("/api/history/rollbackNotebookHistory", {
                    historyPath: target.parentElement.getAttribute("data-path")
                });
            } else {
                fetchPost("/api/repo/checkoutRepo", {
                    id: target.parentElement.getAttribute("data-id")
                });
            }
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "more") {
        target.parentElement.parentElement.querySelectorAll(".b3-list-item__meta").forEach(item => {
            item.classList.toggle("fn__none");
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "toggle") {
        const iconElement = target.firstElementChild.firstElementChild;
        if (iconElement.classList.contains("b3-list-item__arrow--open")) {
            target.nextElementSibling.classList.add("fn__none");
            iconElement.classList.remove("b3-list-item__arrow--open");
        } else {
            if (target.nextElementSibling && target.nextElementSibling.tagName === "UL") {
                target.nextElementSibling.classList.remove("fn__none");
                iconElement.classList.add("b3-list-item__arrow--open");
            } else {
                const inputElement = firstPanelElement.querySelector(".b3-text-field") as HTMLInputElement;
                const opElement = firstPanelElement.querySelector('.b3-select[data-type="opselect"]') as HTMLSelectElement;
                const typeElement = firstPanelElement.querySelector('.b3-select[data-type="typeselect"]') as HTMLSelectElement;
                const notebookElement = firstPanelElement.querySelector('.b3-select[data-type="notebookselect"]') as HTMLSelectElement;
                const created = target.getAttribute("data-created");
                fetchPost("/api/history/getHistoryItems", {
                    notebook: notebookElement.value,
                    query: inputElement.value,
                    op: opElement.value,
                    type: parseInt(typeElement.value),
                    created
                }, (response) => {
                    iconElement.classList.add("b3-list-item__arrow--open");
                    let html = "";
                    let ariaLabel = "";
                    response.data.items.forEach((docItem: {
                        title: string,
                        path: string,
                        op: string,
                        notebook: string
                    }) => {
                        let chipClass = " b3-chip b3-chip--list ";
                        if (docItem.op === "clean") {
                            chipClass += "b3-chip--primary ";
                            ariaLabel = siyuanI18n.historyClean;
                        } else if (docItem.op === "update") {
                            chipClass += "b3-chip--info ";
                            ariaLabel = siyuanI18n.historyUpdate;
                        } else if (docItem.op === "delete") {
                            chipClass += "b3-chip--error ";
                            ariaLabel = siyuanI18n.historyDelete;
                        } else if (docItem.op === "format") {
                            chipClass += "b3-chip--pink ";
                            ariaLabel = siyuanI18n.historyFormat;
                        } else if (docItem.op === "sync") {
                            chipClass += "b3-chip--success ";
                            ariaLabel = siyuanI18n.historySync;
                        } else if (docItem.op === "replace") {
                            chipClass += "b3-chip--secondary ";
                            ariaLabel = siyuanI18n.historyReplace;
                        } else if (docItem.op === "outline") {
                            chipClass += "b3-chip--warning ";
                            ariaLabel = siyuanI18n.historyOutline;
                        }
                        html += `<li data-notebook-id="${docItem.notebook}" data-created="${created}" data-type="${typeElement.value === "4" ? "av" : (typeElement.value === "2" ? "assets" : "doc")}" data-path="${docItem.path}" class="b3-list-item b3-list-item--hide-action" style="padding-left: 22px">
    <span class="${opElement.value === "all" ? "" : "fn__none"}${chipClass}ariaLabel" data-position="6south" aria-label="${ariaLabel}">${docItem.op.substring(0, 1).toUpperCase()}</span>
    <span class="b3-list-item__text" title="${escapeAttr(docItem.title)}">${escapeHtml(docItem.title)}</span>
    <span class="fn__space"></span>
    <span class="b3-list-item__action ariaLabel" data-type="rollback" data-position="6south" aria-label="${siyuanI18n.rollback}">
        <svg><use xlink:href="#iconUndo"></use></svg>
    </span>
</li>`;
                    });
                    target.insertAdjacentHTML("afterend", `<ul>${html}</ul>`);
                });
            }
        }
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "rmtoggle") {
        target.nextElementSibling.classList.toggle("fn__none");
        target.firstElementChild.firstElementChild.classList.toggle("b3-list-item__arrow--open");
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (target.classList.contains("b3-list-item") && ["assets", "doc", "av"].includes(type)) {
        const dataPath = target.getAttribute("data-path");
        if (type === "assets") {
            assetElement.classList.remove("fn__none");
            assetElement.innerHTML = renderAssetsPreview(dataPath);
        } else if (type === "doc") {
            const k = (firstPanelElement.querySelector(".b3-text-field") as HTMLInputElement).value;
            fetchPost("/api/history/getDocHistoryContent", {
                historyPath: dataPath,
                highlight: !isSupportCSSHL(),
                k
            }, (response) => {
                if (response.data.isLargeDoc) {
                    mdElement.value = response.data.content;
                    mdElement.classList.remove("fn__none");
                    docElement.classList.add("fn__none");
                } else {
                    mdElement.classList.add("fn__none");
                    docElement.classList.remove("fn__none");
                    historyEditor.protyle.options.history.created = target.dataset.created;
                    onGet({
                        data: response,
                        protyle: historyEditor.protyle,
                        action: [Constants.CB_GET_HISTORY, Constants.CB_GET_HTML],
                    });
                    searchMarkRender(historyEditor.protyle, k.split(" "));
                }
            });
        } else if (type === "av") {
            mdElement.classList.add("fn__none");
            docElement.classList.remove("fn__none");
            historyEditor.protyle.options.history.created = target.dataset.created;
            onGet({
                data: {
                    data: {
                        content: `<div class="av" data-node-id="${Lute.NewNodeID()}" data-av-id="${target.querySelector(".b3-list-item__text").textContent}" data-type="NodeAttributeView" data-av-type="table"><div spellcheck="true"></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`,
                        id: Lute.NewNodeID(),
                        rootID: Lute.NewNodeID(),
                    },
                    msg: "",
                    code: 0
                },
                protyle: historyEditor.protyle,
                action: [Constants.CB_GET_HISTORY, Constants.CB_GET_HTML],
            });
        }
        titleElement.classList.remove("fn__none");
        titleElement.textContent = target.querySelector(".b3-list-item__text").textContent;
        let currentItem = hasClosestByClassName(target, "b3-list") as HTMLElement;
        if (currentItem) {
            currentItem = currentItem.querySelector(".b3-list-item--focus");
            if (currentItem) {
                currentItem.classList.remove("b3-list-item--focus");
            }
        }
        target.classList.add("b3-list-item--focus");
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "jumpHistoryPage") {
        const currentPage = parseInt(historyElement.getAttribute("data-page"));
        const totalPage = parseInt(target.getAttribute("data-totalpage") || "1");

        if (totalPage > 1) {
            confirmDialog(
                siyuanI18n.jumpToPage.replace("${x}", totalPage),
                `<input class="b3-text-field fn__block" type="number" min="1" max="${totalPage}" value="${currentPage}">`,
                (confirmD) => {
                    const inputElement = confirmD.element.querySelector(".b3-text-field") as HTMLInputElement;
                    if (inputElement.value === "") {
                        return;
                    }
                    let page = parseInt(inputElement.value);
                    page = Math.max(1, Math.min(page, totalPage));
                    renderDoc(firstPanelElement, page);
                }
            );
        }
        return true;
    } else if ((type === "docprevious" || type === "docnext") && target.getAttribute("disabled") !== "disabled") {
        const currentPage = parseInt(firstPanelElement.getAttribute("data-page"));
        renderDoc(firstPanelElement, type === "docprevious" ? currentPage - 1 : currentPage + 1);
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "rebuildIndex") {
        fetchPost("/api/history/reindexHistory");
        if (dialog) {
            dialog.destroy();
        } else {
            closeModel();
            clearHistoryEditor();
        }
        event.stopPropagation();
        event.preventDefault();
        return true;
    }
    return false;
};
