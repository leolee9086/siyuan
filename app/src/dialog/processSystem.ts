import {Constants} from "../constants";
import {fetchPost} from "../util/fetch";
import {exportLayout} from "../layout/export/exportLayout";
import {getAllEditor} from "../layout/getAll";
import {getDockByType} from "../layout/tabUtil";
import {Files} from "../layout/dock/Files";
import {ipcInvoke, ipcSend} from "../platform/electron/ipcRenderer";
import {isElectron} from "../platform";
import {hideMessage, showMessage} from "./message";
import {Dialog} from "./index";
import {isMobile} from "../util/functions";
import {confirmDialog} from "./confirmDialog";
import {escapeHtml} from "../util/DOM/escape";
import {needSubscribe} from "../util/platform/needSubscribe";
import {hideAllElements} from "../protyle/ui/hideElements";
import type { AppFacade } from "../app/AppFacade.types";
import {saveScroll} from "../protyle/scroll/saveScroll";
import {isInAndroid, isInHarmony, isInIOS, setStorageVal} from "../protyle/util/compatibility";
import {Plugin} from "../plugin";

export {progressLoading} from "./progressLoading";

export const setRefDynamicText = (data: {
    "blockID": string,
    "defBlockID": string,
    "refText": string,
    "rootID": string
}) => {
    getAllEditor().forEach(editor => {
        // 不能对比 rootId，否则嵌入块中的锚文本无法更新
        editor.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.blockID}"] span[data-type~="block-ref"][data-subtype="d"][data-id="${data.defBlockID}"]`).forEach(item => {
            item.innerHTML = data.refText;
        });
    });
};

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
        // 不能对比 rootId，否则嵌入块中的锚文本无法更新
        editor.protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.blockID}"]`).forEach(item => {
            // 不能直接查询，否则列表中会获取到第一个列表项的 attr https://github.com/siyuan-note/siyuan/issues/12738
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

    const liElement = isMobile()
        ? window.siyuan.mobile.docks.file.element.querySelector(`li[data-node-id="${data.rootID}"]`)
        : (getDockByType("file")?.data["file"] as Files)?.element.querySelector(`li[data-node-id="${data.rootID}"]`);
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

export const lockScreen = async (app: AppFacade) => {
    if (window.siyuan.config.readonly || window.siyuan.isPublish) {
        return;
    }
    app.plugins.forEach(item => {
        item.eventBus.emit("lock-screen");
    });
    if (!isMobile()) {
        exportLayout({
            errorExit: false,
            cb() {
                fetchPost("/api/system/logoutAuth");
            }
        });
        return;
    }
    if (window.siyuan.mobile.editor) {
        await saveScroll(window.siyuan.mobile.editor.protyle);
        fetchPost("/api/system/logoutAuth");
    }

};

// forceQuit 用于内核已断连、无法走 /api/system/exit 的场景：绕过内核 HTTP，直接通知宿主退出
// S-forge: 本地以运行时 isElectron 与平台封装替代上游 /// #if !BROWSER 条件编译
export const forceQuit = () => {
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
    // 浏览器/Docker 等纯 Web 环境无宿主可调，只能关闭当前页
    window.close();
};

const installNewVersion = (installPkgPath: string, setCurrentWorkspace: boolean) => {
    if (!installPkgPath) {
        showMessage(window.siyuan.languages._kernel[104], 7000, "error");
        return;
    }
    if (isElectron) {
        ipcInvoke<boolean>(Constants.SIYUAN_INSTALL_UPDATE, {
            port: location.port,
            setCurrentWorkspace,
        }).then((accepted) => {
            if (!accepted) {
                showMessage(window.siyuan.languages._kernel[104], 7000, "error");
            }
        }).catch(() => {
            showMessage(window.siyuan.languages._kernel[104], 7000, "error");
        });
        return;
    }
    fetchPost("/api/system/exit", {
        force: true,
        setCurrentWorkspace,
        execInstallPkg: 1,
    }, () => {
        forceQuit();
    });
};

export const exitSiYuan = async (setCurrentWorkspace = true) => {
    hideAllElements(["util"]);
    if (isMobile() && window.siyuan.mobile.editor) {
        await saveScroll(window.siyuan.mobile.editor.protyle);
    }
    fetchPost("/api/system/exit", {force: false, setCurrentWorkspace}, (response) => {
        if (response.code === 1) { // 同步执行失败
            const msgId = showMessage(response.msg, response.data.closeTimeout, "error");
            const buttonElement = document.querySelector(`#message [data-id="${msgId}"] button`);
            if (buttonElement) {
                buttonElement.addEventListener("click", () => {
                    if (response.data.installPkgPath) {
                        installNewVersion(response.data.installPkgPath, setCurrentWorkspace);
                        return;
                    }
                    fetchPost("/api/system/exit", {force: true, setCurrentWorkspace}, () => {
                        forceQuit();
                    });
                });
            }
        } else if (response.code === 2) { // 提示新安装包
            hideMessage();

            if ("std" === window.siyuan.config.system.container && isElectron) {
                ipcSend(Constants.SIYUAN_SHOW_WINDOW);
            }

            confirmDialog(window.siyuan.languages.updateVersion, response.msg, () => {
                installNewVersion(response.data.installPkgPath, setCurrentWorkspace);
            }, () => {
                fetchPost("/api/system/exit", {
                    force: true,
                    setCurrentWorkspace,
                    execInstallPkg: 1 // 0：默认检查新版本，1：不返回安装包，2：返回安装包路径并退出
                }, () => {
                    forceQuit();
                });
            });
        } else { // 正常退出
            forceQuit();
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
    <button class="b3-button">${window.siyuan.languages.rebuildDataIndex}</button>
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
        refreshFileTree();
        dialog.destroy();
    });
};

export const refreshFileTree = (cb?: () => void) => {
    window.siyuan.storage[Constants.LOCAL_FILEPOSITION] = {};
    setStorageVal(Constants.LOCAL_FILEPOSITION, window.siyuan.storage[Constants.LOCAL_FILEPOSITION]);
    fetchPost("/api/system/rebuildDataIndex", {}, () => {
        if (cb) {
            cb();
        }
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

export const downloadProgress = (data: { id: string, percent: number }) => {
    const bazaarSideElement = document.querySelector("#configBazaarReadme .item__side");
    if (!bazaarSideElement) {
        return;
    }
    if (data.id !== bazaarSideElement.getAttribute("data-repourl")) {
        return;
    }
    const installBtnElement = bazaarSideElement.querySelector('[data-type="install"]') as HTMLElement;
    const updateBtnElement = bazaarSideElement.querySelector('[data-type="install-t"]') as HTMLElement;
    if (!installBtnElement && !updateBtnElement) {
        return;
    }
    const progressHTML = `<span style="width: ${data.percent * 100}%"></span>`;
    if (data.percent >= 1) {
        installBtnElement?.parentElement.classList.add("fn__none");
        updateBtnElement?.parentElement.classList.add("fn__none");
    } else {
        if (installBtnElement) {
            installBtnElement.classList.add("b3-button--progress");
            installBtnElement.innerHTML = progressHTML;
        }
        if (updateBtnElement) {
            updateBtnElement.classList.add("b3-button--progress");
            updateBtnElement.innerHTML = progressHTML;
        }
    }
};

export const processSync = (data?: IWebSocketData, plugins?: Plugin[]) => {
    if (data?.code === 1) {
        window.dispatchEvent(new CustomEvent("siyuan-sync-success"));
    }
    if (isMobile()) {
        const menuSyncUseElement = document.querySelector("#menuSyncNow use");
        const barSyncUseElement = document.querySelector("#toolbarSync use");
        if (!data) {
            if (!window.siyuan.config.sync.enabled || (0 === window.siyuan.config.sync.provider && needSubscribe(""))) {
                menuSyncUseElement?.setAttribute("xlink:href", "#iconCloudOff");
                barSyncUseElement?.setAttribute("xlink:href", "#iconCloudOff");
            } else {
                menuSyncUseElement?.setAttribute("xlink:href", "#iconCloudSucc");
                barSyncUseElement?.setAttribute("xlink:href", "#iconCloudSucc");
            }
            return;
        }
        menuSyncUseElement?.parentElement.classList.remove("fn__rotate");
        barSyncUseElement?.parentElement.classList.remove("fn__rotate");
        if (data.code === 0) {  // syncing
            menuSyncUseElement?.parentElement.classList.add("fn__rotate");
            barSyncUseElement?.parentElement.classList.add("fn__rotate");
            menuSyncUseElement?.setAttribute("xlink:href", "#iconRefresh");
            barSyncUseElement?.setAttribute("xlink:href", "#iconRefresh");
        } else if (data.code === 2) {    // error
            menuSyncUseElement?.setAttribute("xlink:href", "#iconCloudError");
            barSyncUseElement?.setAttribute("xlink:href", "#iconCloudError");
        } else if (data.code === 1) {   // success
            menuSyncUseElement?.setAttribute("xlink:href", "#iconCloudSucc");
            barSyncUseElement?.setAttribute("xlink:href", "#iconCloudSucc");
        }
    } else {
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
        if (data.code === 0) {  // syncing
            iconElement.classList.add("toolbar__item--active");
            iconElement.firstElementChild.classList.add("fn__rotate");
            useElement.setAttribute("xlink:href", "#iconRefresh");
        } else if (data.code === 2) {    // error
            iconElement.classList.remove("toolbar__item--active");
            useElement.setAttribute("xlink:href", "#iconCloudError");
        } else if (data.code === 1) {   // success
            iconElement.classList.remove("toolbar__item--active");
            useElement.setAttribute("xlink:href", "#iconCloudSucc");
        }
    }
    plugins?.forEach((item) => {
        if (data.code === 0) {
            item.eventBus.emit("sync-start", data);
        } else if (data.code === 1) {
            item.eventBus.emit("sync-end", data);
        } else if (data.code === 2) {
            item.eventBus.emit("sync-fail", data);
        }
    });
};

export { kernelError } from "./processSystem/index";
