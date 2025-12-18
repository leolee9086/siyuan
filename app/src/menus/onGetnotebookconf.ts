import {Dialog} from "../dialog";
import {fetchPost} from "../util/fetch";
import {isMobile} from "../util/functions";
import {escapeHtml} from "../util/escape";
import {writeText} from "../protyle/util/compatibility";
import {showMessage} from "../dialog/message";
import {openModel} from "../mobile/menu/model";
import {Constants} from "../constants";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

declare interface INotebookConf {
    name: string,
    box: string,
    conf: {
        refCreateSavePath: string
        docCreateSavePath: string
        dailyNoteSavePath: string
        refCreateSaveBox: string;
        docCreateSaveBox: string;
        dailyNoteTemplatePath: string
    }
}

export const genNotebookOption = (id: string, notebookId?: string) => {
    let html = `<option value="">${siyuanI18n.currentNotebook}</option>`;
    const helpIds: string[] = [];
    Object.keys(Constants.HELP_PATH).forEach((key: "zh_CN") => {
        helpIds.push(Constants.HELP_PATH[key]);
    });
    window.siyuan.notebooks.forEach((item) => {
        if (helpIds.includes(item.id) || item.id === notebookId) {
            return;
        }
        html += `<option value="${item.id}" ${id === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`;
    });
    return html;
};

export const onGetnotebookconf = (data: INotebookConf) => {
    const titleHTML = `<div class="fn__flex">${escapeHtml(data.name)}
<div class="fn__space"></div>
<button class="b3-button b3-button--small fn__flex-center">${siyuanI18n.copy} ID</button></div>`;
    const contentHTML = `<div class="b3-dialog__content" style="background-color: var(--b3-theme-background);">
<div class="b3-label config__item">
    ${siyuanI18n.fileTree12}
    <div class="b3-label__text">${siyuanI18n.fileTree13}</div>
    <span class="fn__hr"></span>
    <div class="fn__flex">
        <select style="min-width: 200px" class="b3-select" id="docCreateSaveBox">${genNotebookOption(data.conf.docCreateSaveBox, data.box)}</select>
        <div class="fn__space"></div>
        <input class="b3-text-field fn__flex-1" id="docCreateSavePath" value="">
    </div>
</div>
<div class="b3-label config__item">
    ${siyuanI18n.fileTree5}
    <div class="b3-label__text">${siyuanI18n.fileTree6}</div>
    <span class="fn__hr"></span>
    <div class="fn__flex">
        <select style="min-width: 200px" class="b3-select" id="refCreateSaveBox">${genNotebookOption(data.conf.refCreateSaveBox, data.box)}</select>
        <div class="fn__space"></div>
        <input class="b3-text-field fn__flex-1" id="refCreateSavePath" value="">
    </div>
</div>
<div class="b3-label">
    ${siyuanI18n.fileTree11}
    <div class="b3-label__text">${siyuanI18n.fileTree14}</div>
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__flex-center fn__block" id="dailyNoteSavePath" value="">
    <div class="fn__hr"></div>
    <div class="b3-label__text">${siyuanI18n.fileTree15}</div>
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__flex-center fn__block" id="dailyNoteTemplatePath" value="${data.conf.dailyNoteTemplatePath}">
</div></div>`;
    if (isMobile()) {
        openModel({
            title: titleHTML,
            icon: "iconSettings",
            html: `<div>${contentHTML}</div>`,
            bindEvent() {
                bindSettingEvent(document.querySelector("#model"), data);
            }
        });
    } else {
        const dialog = new Dialog({
            width: "80vw",
            title: titleHTML,
            content: contentHTML
        });
        dialog.element.setAttribute("data-key", Constants.DIALOG_NOTEBOOKCONF);
        bindSettingEvent(dialog.element, data);
    }
};

const bindSettingEvent = (contentElement: Element, data: INotebookConf) => {
    contentElement.querySelector(".b3-button--small").addEventListener("click", () => {
        writeText(data.box);
        showMessage(siyuanI18n.copied);
    });
    const dailyNoteSavePathElement = contentElement.querySelector("#dailyNoteSavePath") as HTMLInputElement;
    dailyNoteSavePathElement.value = data.conf.dailyNoteSavePath;
    const docCreateSavePathElement = contentElement.querySelector("#docCreateSavePath") as HTMLInputElement;
    docCreateSavePathElement.value = data.conf.docCreateSavePath;
    const refCreateSavePathElement = contentElement.querySelector("#refCreateSavePath") as HTMLInputElement;
    refCreateSavePathElement.value = data.conf.refCreateSavePath;
    const dailyNoteTemplatePathElement = contentElement.querySelector("#dailyNoteTemplatePath") as HTMLInputElement;
    dailyNoteTemplatePathElement.value = data.conf.dailyNoteTemplatePath;
    contentElement.querySelectorAll("input, select").forEach((item) => {
        item.addEventListener("change", () => {
            fetchPost("/api/notebook/setNotebookConf", {
                notebook: data.box,
                conf: {
                    refCreateSavePath: refCreateSavePathElement.value,
                    refCreateSaveBox: (contentElement.querySelector("#refCreateSaveBox") as HTMLInputElement).value,
                    docCreateSaveBox: (contentElement.querySelector("#docCreateSaveBox") as HTMLInputElement).value,
                    docCreateSavePath: docCreateSavePathElement.value,
                    dailyNoteSavePath: dailyNoteSavePathElement.value,
                    dailyNoteTemplatePath: dailyNoteTemplatePathElement.value,
                }
            });
        });
    });
};
