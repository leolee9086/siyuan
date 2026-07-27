export { reloadSync } from "./reloadSync";
export { setRefDynamicText } from "./setRefDynamicText";
export { updateTitle } from "./updateTitle";
export { setTitle } from "../../util/processTitle";
export { downloadProgress } from "./downloadProgress";
export { lockScreen } from "./lockScreen";
export {rebuildDataIndex as refreshFileTree} from "../../util/file/rebuildDataIndex";

import { Constants } from "../../constants";
import { fetchPost } from "../../util/network/fetch";
import {exportLayout} from "../../layout/export/exportLayout";
import { getAllEditor } from "../../layout/getAll";
import { getDockByType } from "../../layout/tabUtil";
import { Files } from "../../layout/dock/Files";
import { isElectron } from "../../platform";
import { ipcSend } from "../../platform/electron/ipcRenderer";
import { hideMessage, showMessage } from "../message";
import { Dialog } from "../index";
import { isMobile } from "../../util/platform/functions";
import { confirmDialog } from "../confirmDialog";
import { escapeHtml } from "../../util/DOM/escape";
import { needSubscribe } from "../../util/platform/needSubscribe";
import { hideAllElements } from "../../protyle/ui/hideElements";
import { saveScroll } from "../../protyle/scroll/saveScroll";
import { isInAndroid, isInHarmony, isInIOS } from "../../protyle/util/compatibility";
import { Plugin } from "../../plugin";
import {rebuildDataIndex} from "../../util/file/rebuildDataIndex";

export const setDefRefCount = (data: {
    "blockID": string,
    "refCount": number,
    "rootRefCount": number,
    "rootID": string
}) => {
    getAllEditor().forEach(editor => {
        if (editor.protyle.block.rootID === data.rootID && editor.protyle.title) {
            const attrElement = editor.protyle.title.element.querySelector(".protyle-attr");
            const countElement = attrElement.querySelector(".protyle-attr--refcount");
            if (countElement) {
                if (data.rootRefCount === 0) {
                    countElement.remove();
                } else {
                    countElement.textContent = data.rootRefCount.toString();
                }
            } else if (data.rootRefCount > 0) {
                attrElement.insertAdjacentHTML("beforeend", `<div class="protyle-attr--refcount popover__block">${data.rootRefCount}</div>`);
            }
        }
        if (data.rootID === data.blockID) {
            return;
        }
        editor.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.blockID}"]`).forEach(item => {
            const countElement = item.lastElementChild?.querySelector(".protyle-attr--refcount");
            if (countElement) {
                if (data.refCount === 0) {
                    countElement.remove();
                } else {
                    countElement.textContent = data.refCount.toString();
                }
            } else if (data.refCount > 0) {
                const attrElement = item.lastElementChild;
                if (attrElement.childElementCount > 0) {
                    attrElement.lastElementChild.insertAdjacentHTML("afterend", `<div class="protyle-attr--refcount popover__block">${data.refCount}</div>`);
                } else {
                    attrElement.innerHTML = `<div class="protyle-attr--refcount popover__block">${data.refCount}</div>${Constants.ZWSP}`;
                }
            }
            if (data.refCount === 0) {
                item.removeAttribute("refcount");
            } else {
                item.setAttribute("refcount", data.refCount.toString());
            }
        });
    });

    let liElement;
    if (isMobile()) {
        liElement = window.siyuan.mobile.docks.file.element.querySelector(`li[data-node-id="${data.rootID}"]`);
    }
    if (!isMobile()) {
        liElement = (getDockByType("file").data.file as Files).element.querySelector(`li[data-node-id="${data.rootID}"]`);
    }
    if (liElement) {
        const counterElement = liElement.querySelector(".counter");
        if (counterElement) {
            if (data.rootRefCount === 0) {
                counterElement.remove();
            } else {
                counterElement.textContent = data.rootRefCount.toString();
            }
        } else if (data.rootRefCount > 0) {
            liElement.insertAdjacentHTML("beforeend", `<span class="popover__block counter b3-tooltips b3-tooltips__nw" aria-label="${window.siyuan.languages.ref}">${data.rootRefCount}</span>`);
        }
    }
};

export const kernelError = () => {
    if (document.querySelector("#errorLog")) {
        return;
    }
    let title = `💔 ${window.siyuan.languages.kernelFault0} <small>v${Constants.SIYUAN_VERSION}</small>`;
    let body = `<div>${window.siyuan.languages.kernelFault1}</div><div class="fn__hr"></div><div>${window.siyuan.languages.kernelFault2}</div>`;
    if (isInIOS()) {
        title = `🍵 ${window.siyuan.languages.pleaseWait} <small>v${Constants.SIYUAN_VERSION}</small>`;
        body = `<div>${window.siyuan.languages.reconnectPrompt}</div><div class="fn__hr"></div><div class="fn__flex"><div class="fn__flex-1"></div><button class="b3-button">${window.siyuan.languages.retry}</button></div>`;
    }
    const dialog = new Dialog({
        disableClose: true,
        title: title,
        width: isMobile() ? "92vw" : "520px",
        content: `<div class="b3-dialog__content">
<div class="ft__breakword">
    ${body}
</div>
</div>`
    });
    dialog.element.id = "errorLog";
    dialog.element.setAttribute("data-key", Constants.DIALOG_KERNELFAULT);
    const restartElement = dialog.element.querySelector(".b3-button");
    if (restartElement) {
        restartElement.addEventListener("click", () => {
            dialog.destroy();
            window.webkit.messageHandlers.startKernelFast.postMessage("startKernelFast");
        });
    }
};

export const exitSiYuan = async (setCurrentWorkspace = true) => {
    hideAllElements(["util"]);
    if (isMobile() && window.siyuan.mobile.editor) {
        await saveScroll(window.siyuan.mobile.editor.protyle);
    }
    fetchPost("/api/system/exit", {force: false, setCurrentWorkspace}, (response) => {
        if (response.code === 1) {
            const msgId = showMessage(response.msg, response.data.closeTimeout, "error");
            const buttonElement = document.querySelector(`#message [data-id="${msgId}"] button`);
            if (buttonElement) {
                buttonElement.addEventListener("click", () => {
                    fetchPost("/api/system/exit", {force: true, setCurrentWorkspace}, () => {
                        if (isElectron) {
                            ipcSend(Constants.SIYUAN_QUIT, location.port);
                            return;
                        }
                        if (isInAndroid()) {
                            window.JSAndroid.exit();
                            return;
                        }
                        if (isInIOS()) {
                            window.webkit.messageHandlers.exit.postMessage("");
                            return;
                        }
                        if (isInHarmony()) {
                            window.JSHarmony.exit();
                            return;
                        }
                    });
                });
            }
        } else if (response.code === 2) {
            hideMessage();

            if ("std" === window.siyuan.config.system.container) {
                ipcSend(Constants.SIYUAN_SHOW_WINDOW);
            }

            confirmDialog(window.siyuan.languages.updateVersion, response.msg, () => {
                fetchPost("/api/system/exit", {
                    force: true,
                    setCurrentWorkspace,
                    execInstallPkg: 2
                }, () => {
                    if (isElectron) {
                        setTimeout(() => {
                            ipcSend(Constants.SIYUAN_CMD, "hide");
                        }, 2000);
                        setTimeout(() => {
                            ipcSend(Constants.SIYUAN_QUIT, location.port);
                        }, 4000);
                    }
                });
            }, () => {
                fetchPost("/api/system/exit", {
                    force: true,
                    setCurrentWorkspace,
                    execInstallPkg: 1
                }, () => {
                    if (isElectron) {
                        ipcSend(Constants.SIYUAN_QUIT, location.port);
                    }
                });
            });
        } else {
            if (isElectron) {
                ipcSend(Constants.SIYUAN_QUIT, location.port);
                return;
            }
            if (isInAndroid()) {
                window.JSAndroid.exit();
                return;
            }
            if (isInIOS()) {
                window.webkit.messageHandlers.exit.postMessage("");
                return;
            }
            if (isInHarmony()) {
                window.JSHarmony.exit();
                return;
            }
        }
    });
};

export const transactionError = (msg?: string) => {
    if (document.getElementById("transactionError")) {
        return;
    }
    const dialog = new Dialog({
        disableClose: true,
        title: `${window.siyuan.languages.stateExcepted} v${Constants.SIYUAN_VERSION}`,
        content: `<div class="b3-dialog__content" style="max-height: calc(100vh - 182px)" id="transactionError">
    ${window.siyuan.languages.rebuildIndexTip}
    ${msg ? `<div class="fn__hr"></div>${escapeHtml(msg.trim())}` : ""}
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--text">${window.siyuan.languages._kernel[97]}</button>
    <div class="fn__space"></div>
    <button class="b3-button">${window.siyuan.languages.rebuildIndex}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_STATEEXCEPTED);
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    btnsElement[0].addEventListener("click", () => {
        if (isMobile()) {
            exitSiYuan();
            return;
        }
        exportLayout({
            errorExit: true,
            cb: exitSiYuan
        });
    });
    btnsElement[1].addEventListener("click", () => {
        rebuildDataIndex();
        dialog.destroy();
    });
};

let statusTimeout: number;
export const progressStatus = (data: IWebSocketData) => {
    const msgElement = document.querySelector("#status .status__msg");
    if (msgElement) {
        clearTimeout(statusTimeout);
        msgElement.innerHTML = data.msg;
        statusTimeout = window.setTimeout(() => {
            msgElement.innerHTML = "";
        }, 12000);
    }
};

export const progressLoading = (data: IWebSocketData) => {
	// 结束消息应当是幂等的，不能因为页面没有进度 DOM 而先创建一个再删除。
	if (data.code === 2) {
		document.getElementById("progress")?.remove();
		return;
	}
	let progressElement = document.getElementById("progress");
    if (!progressElement) {
        document.body.insertAdjacentHTML("beforeend", `<div id="progress" style="z-index: ${++window.siyuan.zIndex}"></div>`);
        progressElement = document.getElementById("progress");
    }
    if (data.code === 0) {
        progressElement.innerHTML = `<div class="b3-dialog__scrim" style="opacity: 1"></div>
<div class="b3-dialog__loading">
    <div style="text-align: right">${data.data.current}/${data.data.total}</div>
    <div style="margin: 8px 0;height: 8px;border-radius: var(--b3-border-radius);overflow: hidden;background-color:#fff;"><div style="width: ${data.data.current / data.data.total * 100}%;transition: var(--b3-transition);background-color: var(--b3-theme-primary);height: 8px;"></div></div>
    <div class="ft__breakword">${escapeHtml(data.msg)}</div>
</div>`;
    } else if (data.code === 1) {
        if (progressElement.lastElementChild) {
            progressElement.lastElementChild.lastElementChild.innerHTML = escapeHtml(data.msg);
        } else {
            progressElement.innerHTML = `<div class="b3-dialog__scrim" style="opacity: 1"></div>
<div class="b3-dialog__loading">
    <div style="margin: 8px 0;height: 8px;border-radius: var(--b3-border-radius);overflow: hidden;background-color:#fff;"><div style="background-color: var(--b3-theme-primary);height: 8px;background-image: linear-gradient(-45deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.2) 75%, transparent 75%, transparent);animation: stripMove 450ms linear infinite;background-size: 50px 50px;"></div></div>
    <div class="ft__breakword">${escapeHtml(data.msg)}</div>
</div>`;
        }
    }
};

export const progressBackgroundTask = (tasks: { action: string }[]) => {
    const backgroundTaskElement = document.querySelector(".status__backgroundtask");
    if (!backgroundTaskElement) {
        return;
    }
    if (tasks.length === 0) {
        backgroundTaskElement.classList.add("fn__none");
        if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
            window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_STATUS_BACKGROUND_TASK) {
            window.siyuan.menus.menu.remove();
        }
    } else {
        backgroundTaskElement.classList.remove("fn__none");
        backgroundTaskElement.setAttribute("data-tasks", JSON.stringify(tasks));
        backgroundTaskElement.innerHTML = tasks[0].action + '<div class="fn__progress"><div></div></div>';
    }
};

export const bootSync = () => {
    fetchPost("/api/sync/getBootSync", {}, response => {
        if (response.code === 1) {
            const dialog = new Dialog({
                width: isMobile() ? "92vw" : "50vw",
                title: "🌩️ " + window.siyuan.languages.bootSyncFailed,
                content: `<div class="b3-dialog__content">${response.msg}</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.syncNow}</button>
</div>`
            });
            dialog.element.setAttribute("data-key", Constants.DIALOG_BOOTSYNCFAILED);
            const btnsElement = dialog.element.querySelectorAll(".b3-button");
            btnsElement[0].addEventListener("click", () => {
                dialog.destroy();
            });
            btnsElement[1].addEventListener("click", () => {
                if (btnsElement[1].getAttribute("disabled")) {
                    return;
                }
                btnsElement[1].setAttribute("disabled", "disabled");
                fetchPost("/api/sync/performBootSync", {}, (syncResponse) => {
                    if (syncResponse.code === 0) {
                        dialog.destroy();
                    }
                    btnsElement[1].removeAttribute("disabled");
                });
            });
        }
    });
};

export const processSync = (data?: IWebSocketData, plugins?: Plugin[]) => {
    if (isMobile()) {
        const menuSyncUseElement = document.querySelector("#menuSyncNow use");
        const barSyncUseElement = document.querySelector("#toolbarSync use");
        if (!data) {
            if (!window.siyuan.config.sync.enabled || (0 === window.siyuan.config.sync.provider && needSubscribe(""))) {
                menuSyncUseElement?.setAttribute("xlink:href", "#iconCloudOff");
                barSyncUseElement.setAttribute("xlink:href", "#iconCloudOff");
            } else {
                menuSyncUseElement?.setAttribute("xlink:href", "#iconCloudSucc");
                barSyncUseElement.setAttribute("xlink:href", "#iconCloudSucc");
            }
        }
        if (data) {
            menuSyncUseElement?.parentElement.classList.remove("fn__rotate");
            barSyncUseElement.parentElement.classList.remove("fn__rotate");
            if (data.code === 0) {
                menuSyncUseElement?.parentElement.classList.add("fn__rotate");
                barSyncUseElement.parentElement.classList.add("fn__rotate");
                menuSyncUseElement?.setAttribute("xlink:href", "#iconRefresh");
                barSyncUseElement.setAttribute("xlink:href", "#iconRefresh");
            } else if (data.code === 2) {
                menuSyncUseElement?.setAttribute("xlink:href", "#iconCloudError");
                barSyncUseElement.setAttribute("xlink:href", "#iconCloudError");
            } else if (data.code === 1) {
                menuSyncUseElement?.setAttribute("xlink:href", "#iconCloudSucc");
                barSyncUseElement.setAttribute("xlink:href", "#iconCloudSucc");
            }
        }
    }
    if (!isMobile()) {
        const iconElement = document.querySelector("#barSync");
        if (!iconElement) {
            return;
        }
        const useElement = iconElement.querySelector("use");
        if (!data) {
            iconElement.classList.remove("toolbar__item--active");
            if (!window.siyuan.config.sync.enabled || (0 === window.siyuan.config.sync.provider && needSubscribe(""))) {
                useElement.setAttribute("xlink:href", "#iconCloudOff");
            } else {
                useElement.setAttribute("xlink:href", "#iconCloudSucc");
            }
            return;
        }
        iconElement.firstElementChild.classList.remove("fn__rotate");
        if (data.code === 0) {
            iconElement.classList.add("toolbar__item--active");
            iconElement.firstElementChild.classList.add("fn__rotate");
            useElement.setAttribute("xlink:href", "#iconRefresh");
        } else if (data.code === 2) {
            iconElement.classList.remove("toolbar__item--active");
            useElement.setAttribute("xlink:href", "#iconCloudError");
        } else if (data.code === 1) {
            iconElement.classList.remove("toolbar__item--active");
            useElement.setAttribute("xlink:href", "#iconCloudSucc");
        }
    }
    plugins.forEach((item) => {
        if (data.code === 0) {
            item.eventBus.emit("sync-start", data);
        } else if (data.code === 1) {
            item.eventBus.emit("sync-end", data);
        } else if (data.code === 2) {
            item.eventBus.emit("sync-fail", data);
        }
    });
};
