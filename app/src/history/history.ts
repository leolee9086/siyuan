import { Dialog } from "../dialog";
import { Constants } from "../constants";
import { Protyle } from "../protyle";
import { disabledProtyle } from "../protyle/util/onGet";
import { fetchPost } from "../util/network/fetch";
import { escapeHtml } from "../util/DOM/escape";
import { isMobile } from "../util/platform/functions";
import { openModel } from "../mobile/menu/model";
import { App } from "../index";
import { resizeSide } from "./resizeSide";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { renderDoc, renderRepo } from "./history.render";
import { handleDocClick } from "./history.docEvent";
import { handleRepoClick } from "./history.repoEvent";

let historyEditor: Protyle | undefined;

/**
 * 清除历史编辑器实例引用。
 * - 作用：将模块级 historyEditor 变量置为 undefined，释放 Protyle 实例
 * - 意图：拆分后 history.docEvent.ts 无法直接访问模块级变量，通过此函数提供写入能力
 * - 调用时机：rebuildIndex 的 closeModel 分支中，关闭移动端面板后清理编辑器引用
 * @同步豁免: 遗留代码 - 仅执行简单赋值操作，无异步需求，且调用方为同步的 DOM 事件处理链
 */
export const clearHistoryEditor = () => {
    historyEditor = undefined;
};

export const openHistory = (app: App) => {
    if (window.siyuan.config.readonly) {
        return;
    }
    const exitDialog = window.siyuan.dialogs.find((item) => {
        if (item.element.querySelector("#historyContainer")) {
            item.destroy();
            return true;
        }
    });
    if (exitDialog) {
        return;
    }

    const localHistory = window.siyuan.storage[Constants.LOCAL_HISTORY];
    let notebookSelectHTML = `<option value='%' ${localHistory.notebookId === "%" ? "selected" : ""}>${siyuanI18n.allNotebooks}</option>`;
    window.siyuan.notebooks.forEach((item) => {
        if (!item.closed) {
            notebookSelectHTML += ` <option value="${item.id}"${item.id === localHistory.notebookId ? " selected" : ""}>${escapeHtml(item.name)}</option>`;
        }
    });

    const contentHTML = `<div class="fn__flex-column" style="height: 100%;">
    <div class="layout-tab-bar fn__flex" ${isMobile() ? "" : 'style="border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0"'}>
        <div data-type="doc" class="item item--full item--focus"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.fileHistory}</span><span class="fn__flex-1"></span></div>
        <div data-type="notebook" style="min-width: 160px" class="item item--full"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.removedNotebook}</span><span class="fn__flex-1"></span></div>
        <div data-type="repo" class="item item--full"><span class="fn__flex-1"></span><span class="item__text">${siyuanI18n.dataSnapshot}</span><span class="fn__flex-1"></span></div>
    </div>
    <div class="fn__flex-1 fn__flex" id="historyContainer">
        <div data-type="doc" class="history__repo fn__block" data-init="true">
            <div class="history__action">
                <div class="block__icons">
                    <span data-type="docprevious" class="block__icon block__icon--show b3-tooltips b3-tooltips__e" disabled="disabled" aria-label="${siyuanI18n.previousLabel}"><svg><use xlink:href='#iconLeft'></use></svg></span>
                    <button class="b3-button b3-button--text ft__selectnone" data-type="jumpHistoryPage" data-totalpage="1">1</button>
                    <span data-type="docnext" class="block__icon block__icon--show b3-tooltips b3-tooltips__e" disabled="disabled" aria-label="${siyuanI18n.nextLabel}"><svg><use xlink:href='#iconRight'></use></svg></span>
                    <span class="fn__space"></span>
                    <span class="ft__on-surface fn__flex-shrink ft__selectnone fn__none">${siyuanI18n.pageCountAndHistoryCount}</span>
                    <span class="fn__space"></span>
                    <div class="fn__flex-1"></div>
                    <div style="position: relative">
                        <svg class="b3-form__icon-icon ft__on-surface"><use xlink:href="#iconSearch"></use></svg>
                        <input class="b3-text-field b3-form__icon-input ${isMobile() ? "fn__size96" : "fn__size200"}">
                    </div>
                    <span class="fn__space"></span>
                    <select data-type="typeselect" class="b3-select ${isMobile() ? "fn__size96" : "fn__size200"}">
                        <option value="0" ${localHistory.type === 0 ? "selected" : ""}>${siyuanI18n.docName}</option>
                        <option value="1" ${localHistory.type === 1 ? "selected" : ""}>${siyuanI18n.docNameAndContent}</option>
                        <option value="2" ${localHistory.type === 2 ? "selected" : ""}>${siyuanI18n.assets}</option>
                        <option value="4" ${localHistory.type === 4 ? "selected" : ""}>${siyuanI18n.database}</option>
                    </select>
                    <span class="fn__space"></span>
                    <select data-type="opselect" class="b3-select${isMobile() ? " fn__size96" : ""}">
                        <option value="all" ${localHistory.operation === "all" ? "selected" : ""}>${siyuanI18n.allOp}</option>
                        <option value="clean" ${localHistory.operation === "clean" ? "selected" : ""}>${siyuanI18n.historyClean}</option>
                        <option value="update" ${localHistory.operation === "update" ? "selected" : ""}>${siyuanI18n.historyUpdate}</option>
                        <option value="delete" ${localHistory.operation === "delete" ? "selected" : ""}>${siyuanI18n.historyDelete}</option>
                        <option value="format" ${localHistory.operation === "format" ? "selected" : ""}>${siyuanI18n.historyFormat}</option>
                        <option value="sync" ${localHistory.operation === "sync" ? "selected" : ""}>${siyuanI18n.historySync}</option>
                        <option value="replace" ${localHistory.operation === "replace" ? "selected" : ""}>${siyuanI18n.historyReplace}</option>
                        <option value="outline" ${localHistory.operation === "outline" ? "selected" : ""}>${siyuanI18n.historyOutline}</option>
                    </select>
                    <span class="fn__space"></span>
                    <select data-type="notebookselect" class="b3-select ${isMobile() ? "fn__size96" : "fn__size200"}">
                        ${notebookSelectHTML}
                    </select>
                    <span class="fn__space"></span>
                    <button data-type="rebuildIndex" class="b3-button b3-button--outline">${siyuanI18n.rebuildIndex}</button>
                </div>
            </div>
            <div class="fn__flex fn__flex-1 history__panel">
                <ul class="b3-list b3-list--background history__side" ${isMobile() ? "" : `style="width: ${localHistory.sideWidth}"`}>
                    <li class="b3-list--empty">${siyuanI18n.emptyContent}</li>
                </ul>
                <div class="history__resize"></div>
                <div class="fn__flex-column fn__flex-1">
                    <div class="protyle-title__input ft__center ft__breakword fn__none"></div>
                    <div class="fn__flex-1 history__text fn__none" data-type="assetPanel"></div>
                    <textarea class="fn__flex-1 history__text fn__none" data-type="mdPanel"></textarea>
                    <div class="fn__flex-1 history__text fn__none" style="padding: 0" data-type="docPanel"></div>
                </div>
            </div>
        </div>
        <ul data-type="notebook" style="padding: 8px 0;" class="fn__none b3-list b3-list--background">
            <li class="b3-list--empty">${siyuanI18n.emptyContent}</li>
        </ul>
        <div data-type="repo" class="fn__none history__repo">
            <div class="history__action">
                <div class="block__icons">
                    <span data-type="previous" class="block__icon block__icon--show b3-tooltips b3-tooltips__e" disabled="disabled" aria-label="${siyuanI18n.previousLabel}"><svg><use xlink:href='#iconLeft'></use></svg></span>
                    <button class="b3-button b3-button--text ft__selectnone" data-type="jumpRepoPage" data-totalpage="1">1</button>
                    <span data-type="next" class="block__icon block__icon--show b3-tooltips b3-tooltips__e" disabled="disabled" aria-label="${siyuanI18n.nextLabel}"><svg><use xlink:href='#iconRight'></use></svg></span>
                    <span class="fn__space"></span>
                    <span class="ft__on-surface fn__flex-shrink ft__selectnone fn__none">${siyuanI18n.pageCountAndSnapshotCount}</span>
                    <span class="fn__space"></span>
                    <div class="fn__flex-1"></div>
                    <select class="b3-select ${isMobile() ? "fn__size96" : "fn__size200"}">
                        <option value="getRepoSnapshots">${siyuanI18n.localSnapshot}</option>
                        <option value="getRepoTagSnapshots">${siyuanI18n.localTagSnapshot}</option>
                        <option value="getCloudRepoSnapshots">${siyuanI18n.cloudSnapshot}</option>
                        <option value="getCloudRepoTagSnapshots">${siyuanI18n.cloudTagSnapshot}</option>
                    </select>
                    <span class="fn__space"></span>
                    <button class="b3-button b3-button--outline" disabled data-type="compare">${siyuanI18n.compare}</button>
                    <span class="fn__space"></span>
                    <button class="b3-button b3-button--outline" data-type="genRepo">
                        <svg><use xlink:href="#iconAdd"></use></svg>${siyuanI18n.createSnapshot}
                    </button>
                </div>    
            </div>
            <ul class="b3-list b3-list--background fn__flex-1" style="padding: 8px 0">
                <li class="b3-list--empty">${siyuanI18n.emptyContent}</li>
            </ul>
        </div>
    </div>
</div>`;

    if (isMobile()) {
        openModel({
            html: contentHTML,
            icon: "iconHistory",
            title: siyuanI18n.dataHistory,
            bindEvent(element) {
                element.firstElementChild.setAttribute("style", "background-color:var(--b3-theme-background);height:100%");
                bindEvent(app, element.firstElementChild);
            }
        });
    } else {
        const dialog = new Dialog({
            content: contentHTML,
            width: "90vw",
            height: "80vh",
            containerClassName: "b3-dialog__container--theme",
            destroyCallback() {
                historyEditor = undefined;
            }
        });
        dialog.element.setAttribute("data-key", Constants.DIALOG_HISTORY);
        dialog.element.querySelector("input").focus();
        bindEvent(app, dialog.element, dialog);
        resizeSide(dialog.element.querySelector(".history__resize"), dialog.element.querySelector(".history__side"), "sideWidth");
    }
};

const bindEvent = (app: App, element: Element, dialog?: Dialog) => {
    const firstPanelElement = element.querySelector("#historyContainer [data-type=doc]") as HTMLElement;
    firstPanelElement.querySelectorAll(".b3-select").forEach((itemElement) => {
        itemElement.addEventListener("change", () => {
            renderDoc(firstPanelElement, 1);
        });
    });
    firstPanelElement.querySelector(".b3-text-field").addEventListener("input", (event: KeyboardEvent) => {
        if (event.isComposing) {
            return;
        }
        renderDoc(firstPanelElement, 1);
    });
    firstPanelElement.querySelector(".b3-text-field").addEventListener("compositionend", () => {
        renderDoc(firstPanelElement, 1);
    });
    const docElement = firstPanelElement.querySelector('.history__text[data-type="docPanel"]') as HTMLElement;
    renderDoc(firstPanelElement, 1);
    historyEditor = new Protyle(app, docElement, {
        blockId: "",
        history: {
            created: ""
        },
        action: [Constants.CB_GET_HISTORY],
        render: {
            background: false,
            gutter: false,
            breadcrumb: false,
            breadcrumbDocName: false,
        },
        typewriterMode: false,
    });
    disabledProtyle(historyEditor.protyle);
    const repoElement = element.querySelector('#historyContainer [data-type="repo"]');
    const repoSelectElement = repoElement.querySelector(".b3-select") as HTMLSelectElement;
    repoSelectElement.addEventListener("change", () => {
        renderRepo(repoElement, 1);
        const btnElement = element.querySelector(".b3-button[data-type='compare']");
        btnElement.setAttribute("disabled", "disabled");
        btnElement.removeAttribute("data-ids");
    });
    element.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(element)) {
            const type = target.getAttribute("data-type");
            if (handleDocClick(target, type, event, element, firstPanelElement, historyEditor, dialog)) {
                break;
            }
            if (handleRepoClick(target, type, event, app, element, repoElement, repoSelectElement)) {
                break;
            }
            target = target.parentElement;
        }
    });
};
