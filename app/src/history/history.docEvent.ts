import {confirmDialog} from "../dialog/confirmDialog";
import {Constants} from "../constants";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import {renderAssetsPreview} from "../asset/renderAssets";
import type {ProtyleDomain} from "../protyle/protyle.types";
import {onGet} from "../protyle/util/onGet";
import dayjs from "dayjs";
import {fetchPost} from "../util/network/fetch";
import {escapeAttr, escapeHtml} from "../util/DOM/escape";
import {Dialog} from "../dialog";
import {closeModel} from "../mobile/util/closePanel";
import {isSupportCSSHL, searchMarkRender} from "../protyle/render/searchMarkRender";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {renderDoc, renderRmNotebook, renderRepo} from "./history.render";
import type {IHistoryDocClickContext} from "./history.docEvent.types";
import {requireHistoryAttribute, requireHistoryElement} from "./history.dom";
import {getSiyuanConfig} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

const DOC_ROLLBACK_TYPES = ["assets", "doc", "av", "notebook"] as const;
type DocRollbackType = typeof DOC_ROLLBACK_TYPES[number];

const isDocRollbackType = (value: string | null): value is DocRollbackType =>
    DOC_ROLLBACK_TYPES.some((type) => type === value);

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
    const docElement = requireHistoryElement(
        firstPanelElement.querySelector<HTMLElement>('.history__text[data-type="docPanel"]'),
        "document history preview",
    );
    const assetElement = requireHistoryElement(
        firstPanelElement.querySelector<HTMLElement>('.history__text[data-type="assetPanel"]'),
        "asset history preview",
    );
    const mdElement = requireHistoryElement(
        firstPanelElement.querySelector<HTMLTextAreaElement>('.history__text[data-type="mdPanel"]'),
        "large document history preview",
    );
    const titleElement = requireHistoryElement(
        firstPanelElement.querySelector<HTMLElement>(".protyle-title__input"),
        "history preview title",
    );
    const historyElement = requireHistoryElement(
        element.querySelector<HTMLElement>('#historyContainer [data-type="doc"]'),
        "document history panel",
    );

    if (target.classList.contains("item")) {
        const tabBarElement = requireHistoryElement(target.parentElement, "history tab bar");
        requireHistoryElement(
            tabBarElement.querySelector<HTMLElement>(".item--focus"),
            "active history tab",
        ).classList.remove("item--focus");
        const historyContainer = requireHistoryElement(
            element.querySelector<HTMLElement>("#historyContainer"),
            "history panel container",
        );
        Array.from(historyContainer.children).forEach((child) => {
            const item = requireHistoryElement(
                child instanceof HTMLElement ? child : null,
                "history panel child",
            );
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
    } else if (target.classList.contains("b3-list-item__action") &&
        type === "rollback" &&
        isDocRollbackType(target.parentElement?.getAttribute("data-type") ?? null) &&
        !getSiyuanConfig().readonly) {
        const itemElement = requireHistoryElement(
            target.closest(".b3-list-item") as HTMLElement | null,
            "document history rollback item",
        );
        const dataType = requireHistoryAttribute(itemElement, "data-type") as DocRollbackType;
        const name = requireHistoryElement(
            itemElement.querySelector<HTMLElement>(".b3-list-item__text"),
            "document history rollback title",
        ).textContent.trim();
        let time: string;
        if (dataType === "notebook") {
            const notebookGroup = requireHistoryElement(itemElement.parentElement, "removed notebook history group");
            time = requireHistoryElement(
                notebookGroup.previousElementSibling,
                "removed notebook history timestamp",
            ).textContent.trim();
        } else {
            time = dayjs(parseInt(requireHistoryAttribute(itemElement, "data-created")) * 1000)
                .format("YYYY-MM-DD HH:mm:ss");
        }
        const confirmTip = siyuanI18n.rollbackConfirm.replace("${name}", name)
            .replace("${time}", time);
        confirmDialog("⚠️ " + siyuanI18n.rollback, confirmTip, () => {
            if (dataType === "assets") {
                fetchPost("/api/history/rollbackAssetsHistory", {
                    historyPath: requireHistoryAttribute(itemElement, "data-path")
                });
            } else if (dataType === "doc") {
                fetchPost("/api/history/rollbackDocHistory", {
                    historyPath: requireHistoryAttribute(itemElement, "data-path")
                });
            } else if (dataType === "av") {
                fetchPost("/api/history/rollbackAttributeViewHistory", {
                    historyPath: requireHistoryAttribute(itemElement, "data-path")
                });
            } else {
                fetchPost("/api/history/rollbackNotebookHistory", {
                    historyPath: requireHistoryAttribute(itemElement, "data-path")
                });
            }
        });
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "toggle") {
        const iconElement = requireHistoryElement(
            target.firstElementChild?.firstElementChild,
            "document history group toggle icon",
        );
        if (iconElement.classList.contains("b3-list-item__arrow--open")) {
            requireHistoryElement(
                target.nextElementSibling,
                "expanded document history group",
            ).classList.add("fn__none");
            iconElement.classList.remove("b3-list-item__arrow--open");
        } else {
            if (target.nextElementSibling && target.nextElementSibling.tagName === "UL") {
                target.nextElementSibling.classList.remove("fn__none");
                iconElement.classList.add("b3-list-item__arrow--open");
            } else {
                const inputElement = requireHistoryElement(
                    firstPanelElement.querySelector<HTMLInputElement>(".b3-text-field"),
                    "document history search input",
                );
                const opElement = requireHistoryElement(
                    firstPanelElement.querySelector<HTMLSelectElement>('.b3-select[data-type="opselect"]'),
                    "document history operation selector",
                );
                const typeElement = requireHistoryElement(
                    firstPanelElement.querySelector<HTMLSelectElement>('.b3-select[data-type="typeselect"]'),
                    "document history type selector",
                );
                const notebookElement = requireHistoryElement(
                    firstPanelElement.querySelector<HTMLSelectElement>('.b3-select[data-type="notebookselect"]'),
                    "document history notebook selector",
                );
                const created = requireHistoryAttribute(target, "data-created");
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
        requireHistoryElement(
            target.nextElementSibling,
            "removed notebook history group",
        ).classList.toggle("fn__none");
        requireHistoryElement(
            target.firstElementChild?.firstElementChild,
            "removed notebook history group toggle icon",
        ).classList.toggle("b3-list-item__arrow--open");
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (target.classList.contains("b3-list-item") &&
        type !== null &&
        ["assets", "doc", "av"].includes(type)) {
        const dataPath = requireHistoryAttribute(target, "data-path");
        if (type === "assets") {
            assetElement.classList.remove("fn__none");
            assetElement.innerHTML = renderAssetsPreview(dataPath);
        } else if (type === "doc") {
            const k = requireHistoryElement(
                firstPanelElement.querySelector<HTMLInputElement>(".b3-text-field"),
                "document history search input",
            ).value;
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
                    const historyOptions = historyEditor.protyle.options.history;
                    if (!historyOptions) {
                        throw new Error("History view invariant failed: editor history options");
                    }
                    historyOptions.created = requireHistoryAttribute(target, "data-created");
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
            const historyOptions = historyEditor.protyle.options.history;
            if (!historyOptions) {
                throw new Error("History view invariant failed: editor history options");
            }
            historyOptions.created = requireHistoryAttribute(target, "data-created");
            const attributeViewTitle = requireHistoryElement(
                target.querySelector<HTMLElement>(".b3-list-item__text"),
                "attribute view history title",
            ).textContent;
            onGet({
                data: {
                    data: {
                        content: `<div class="av" data-node-id="${Lute.NewNodeID()}" data-av-id="${attributeViewTitle}" data-type="NodeAttributeView" data-av-type="table"><div spellcheck="true"></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`,
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
        titleElement.textContent = requireHistoryElement(
            target.querySelector<HTMLElement>(".b3-list-item__text"),
            "history item title",
        ).textContent;
        const listElement = requireHistoryElement(
            hasClosestByClassName(target, "b3-list") as HTMLElement | null,
            "history item list",
        );
        listElement.querySelector<HTMLElement>(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
        target.classList.add("b3-list-item--focus");
        event.stopPropagation();
        event.preventDefault();
        return true;
    } else if (type === "jumpHistoryPage") {
        const currentPage = parseInt(requireHistoryAttribute(historyElement, "data-page"));
        const totalPage = parseInt(target.getAttribute("data-totalpage") || "1");

        if (totalPage > 1) {
            confirmDialog(
                siyuanI18n.jumpToPage.replace("${x}", totalPage.toString()),
                `<input class="b3-text-field fn__block" type="number" min="1" max="${totalPage}" value="${currentPage}">`,
                (confirmD) => {
                    if (!confirmD) {
                        throw new Error("History view invariant failed: page jump dialog");
                    }
                    const inputElement = requireHistoryElement(
                        confirmD.element.querySelector<HTMLInputElement>(".b3-text-field"),
                        "history page jump input",
                    );
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
        const currentPage = parseInt(requireHistoryAttribute(firstPanelElement, "data-page"));
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
