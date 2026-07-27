import {Constants} from "../../constants";
import {showMessage} from "../../dialog/message";
import {isMobile} from "../platform/functions";
import {platform} from "../../platform";
import {fetchPost, fetchSyncPost} from "../network/fetch";
import {Dialog} from "../../dialog";
import {getOpenNotebookCount} from "./pathName";
import {setStorageVal} from "../../protyle/util/compatibility";
import {openFileById} from "../../editor/utils.openFileById";
import {openMobileFileById} from "../../mobile/editor";
import type { AppFacade } from "../../app/AppFacade.types";
import {siyuanI18n} from "../siyuanEnvironments/i18n.getI18n.environment";

export const fetchNewDailyNote = (app: AppFacade, notebook: string) => {
    fetchPost("/api/filetree/createDailyNote", {
        notebook,
        app: Constants.SIYUAN_APPID,
    }, (response) => {
        if (platform === "browser-mobile") {
            openMobileFileById(app, response.data.id, [Constants.CB_GET_SCROLL, Constants.CB_GET_FOCUS]);
            return;
        }
        openFileById({app, id: response.data.id, action: [Constants.CB_GET_SCROLL, Constants.CB_GET_FOCUS]});
    });
};

export const newDailyNote = (app: AppFacade) => {
    const exit = window.siyuan.dialogs.find(item => {
        if (item.element.getAttribute("data-key") === Constants.DIALOG_DIALYNOTE) {
            item.destroy();
            return true;
        }
    });
    if (exit) {
        return;
    }
    const openCount = getOpenNotebookCount();
    if (openCount === 0) {
        showMessage(siyuanI18n?.newFileTip);
        return;
    }
    if (openCount === 1) {
        let notebookId = "";
        window.siyuan.notebooks.find(item => {
            if (!item.closed) {
                notebookId = item.id;
            }
        });
        fetchNewDailyNote(app, notebookId);
        return;
    }
    const localNotebookId = window.siyuan.storage[Constants.LOCAL_DAILYNOTEID];
    const localNotebookIsOpen = window.siyuan.notebooks.find((item) => {
        if (item.id === localNotebookId && !item.closed) {
            return true;
        }
    });
    if (localNotebookId && localNotebookIsOpen && !isMobile()) {
        fetchNewDailyNote(app, localNotebookId);
    } else {
        let optionsHTML = "";
        window.siyuan.notebooks.forEach(item => {
            if (!item.closed) {
                optionsHTML += `<option value="${item.id}">${item.name}</option>`;
            }
        });
        const dialog = new Dialog({
            positionId: Constants.DIALOG_DIALYNOTE,
            title: siyuanI18n.plsChoose,
            content: `<div class="b3-dialog__content">
    <select class="b3-select fn__block">${optionsHTML}</select>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
            width: isMobile() ? "92vw" : "520px",
        });
        dialog.element.setAttribute("data-key", Constants.DIALOG_DIALYNOTE);
        const btnsElement = dialog.element.querySelectorAll(".b3-button");
        const selectElement = dialog.element.querySelector(".b3-select") as HTMLSelectElement;
        selectElement.value = localNotebookId;
        btnsElement[0].addEventListener("click", () => {
            dialog.destroy();
        });
        btnsElement[1].addEventListener("click", () => {
            const notebook = selectElement.value;
            window.siyuan.storage[Constants.LOCAL_DAILYNOTEID] = notebook;
            setStorageVal(Constants.LOCAL_DAILYNOTEID, window.siyuan.storage[Constants.LOCAL_DAILYNOTEID]);
            fetchNewDailyNote(app, notebook);
            dialog.destroy();
        });
    }
};

export const mountHelp = () => {
    const notebookId = Constants.HELP_PATH[window.siyuan.config.appearance.lang];
    fetchPost("/api/notebook/removeNotebook", {notebook: notebookId}, () => {
        fetchPost("/api/notebook/openNotebook", {
            notebook: notebookId,
            app: Constants.SIYUAN_APPID,
        });
    });
};

export const openEncryptedNotebook = (app: AppFacade, notebookId: string, name: string) => {
    const dialog = new Dialog({
        title: window.siyuan.languages.unlockEncryptedNotebook.replace("${x}", name),
        content: `<div class="b3-dialog__content">
    <input type="password" placeholder="${window.siyuan.languages.masterPassword}" class="b3-text-field fn__block">
    <div class="fn__hr--b"></div>
    <div>${window.siyuan.languages.encryptedNotebookRiskTip}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px"
    });
    const btnsElement = dialog.element.querySelectorAll<HTMLButtonElement>(".b3-button");
    const inputElement = dialog.element.querySelector("input");
    dialog.bindInput(inputElement, () => {
        btnsElement[1].dispatchEvent(new CustomEvent("click"));
    });
    btnsElement[0].addEventListener("click", () => {
        dialog.destroy();
    });
    btnsElement[1].addEventListener("click", async () => {
        const password = inputElement.value;
        if (!password) {
            return false;
        }
        btnsElement[1].disabled = true;
        // 原子化解锁并挂载：UnlockBox 成功后立即 Mount，Mount 失败则后端自动 LockBox 回滚，避免 DEK 残留
        const response = await fetchSyncPost("/api/notebook/unlockAndOpenNotebook", {
            notebook: notebookId,
            password
        });
        if (response.code === 0) {
            dialog.destroy();
        } else {
            btnsElement[1].disabled = false;
            inputElement.value = "";
            inputElement.focus();
        }
    });
};
