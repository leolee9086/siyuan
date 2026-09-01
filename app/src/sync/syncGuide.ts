import {isPaidUser, needSubscribe} from "../util/platform/needSubscribe";
import {showMessage} from "../dialog/message";
import {fetchPost} from "../util/network/fetch";
import {Dialog} from "../dialog";
import {confirmDialog} from "../dialog/confirmDialog";
import {isMobile} from "../util/platform/functions";
import {processSync} from "../dialog/processSystem";
import {platform} from "../platform";
import type { AppFacade } from "../app/AppFacade.types";
import {Constants} from "../constants";
import {getCloudURL} from "../config/util/about";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";

/** 引导打开同步设置；桌面打开设置面板，移动端经宿主 openSettings 路由到设置菜单。 */
const openSyncSetting = (app?: AppFacade) => {
    if (!app) {
        return;
    }
    app.openSettings("sync");
};

export const addCloudName = (cloudListElement: Element) => {
    const dialog = new Dialog({
        title: siyuanI18n.cloudSyncDir,
        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="main">
    <div class="b3-label__text">${siyuanI18n.reposTip}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_SYNCADDCLOUDDIR);
    const inputElement = dialog.element.querySelector("input") as HTMLInputElement;
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    dialog.bindInput(inputElement, () => {
        (btnsElement[1] as HTMLButtonElement).click();
    });
    inputElement.focus();
    inputElement.select();
    btnsElement[0].addEventListener("click", () => {
        dialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => {
        cloudListElement.innerHTML = '<img style="margin: 0 auto;display: block;width: 64px;height: 100%" src="/stage/loading-pure.svg">';
        fetchPost("/api/sync/createCloudSyncDir", {name: inputElement.value}, () => {
            dialog.destroy();
            renderSyncCloudList(cloudListElement, true);
        });
    });
};

export const bindSyncCloudListEvent = (cloudListElement: Element, cb?: () => void) => {
    cloudListElement.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        while (target && !target.isEqualNode(cloudListElement)) {
            const type = target.getAttribute("data-type");
            if (type) {
                switch (type) {
                    case "addCloud":
                        addCloudName(cloudListElement);
                        break;
                    case "removeCloud":
                        confirmDialog(siyuanI18n.deleteOpConfirm, `${siyuanI18n.confirmDeleteCloudDir} <i>${target.parentElement.getAttribute("data-name")}</i>`, () => {
                            cloudListElement.innerHTML = '<img style="margin: 0 auto;display: block;width: 64px;height: 100%" src="/stage/loading-pure.svg">';
                            fetchPost("/api/sync/removeCloudSyncDir", {name: target.parentElement.getAttribute("data-name")}, (response) => {
                                window.siyuan.config.sync.cloudName = response.data;
                                renderSyncCloudList(cloudListElement, true, cb);
                            });
                        }, undefined, true);
                        break;
                    case "selectCloud":
                        cloudListElement.innerHTML = '<img style="margin: 0 auto;display: block;width: 64px;height: 100%" src="/stage/loading-pure.svg">';
                        fetchPost("/api/sync/setCloudSyncDir", {name: target.getAttribute("data-name")}, () => {
                            window.siyuan.config.sync.cloudName = target.getAttribute("data-name");
                            renderSyncCloudList(cloudListElement, true, cb);
                        });
                        break;
                }
                event.preventDefault();
                event.stopPropagation();
                break;
            }
            target = target.parentElement;
        }
    });
};

export const renderSyncCloudList = (cloudListElement: Element, reload = false, cb?: () => void) => {
    if (!reload && cloudListElement.firstElementChild.tagName !== "IMG") {
        return;
    }
    cloudListElement.innerHTML = '<img style="margin: 0 auto;display: block;width: 64px;height: 100%" src="/stage/loading-pure.svg">';
    fetchPost("/api/sync/listCloudSyncDir", {}, (response) => {
        let syncListHTML: string;
        if (response.code === 1) {
            syncListHTML = `<ul>
    <li class="b3-list--empty ft__error">
        ${response.msg}
    </li>
    <li class="b3-list--empty">
        ${siyuanI18n.cloudConfigTip}
    </li>
</ul>`;
        } else {
            const syncListParts: string[] = ['<div class="fn__hr"></div><ul class="b3-list b3-list--background" style="overflow: auto;">'];
            response.data.syncDirs.forEach((item: { hSize: string, cloudName: string, updated: string }) => {
                if (platform === "browser-mobile") {
                    syncListParts.push(`<li data-type="selectCloud" data-name="${item.cloudName}" class="b3-list-item b3-list-item--two">
    <div class="b3-list-item__first" data-name="${item.cloudName}">
        <input type="radio" name="cloudName"${item.cloudName === response.data.checkedSyncDir ? " checked" : ""}/>
        <span class="fn__space"></span>
        <span>${item.cloudName}</span>
        <span class="fn__flex-1 fn__space"></span>
        <span data-type="removeCloud" class="b3-list-item__action">
            <svg><use xlink:href="#iconTrashcan"></use></svg>
        </span>
    </div>
    <div class="b3-list-item__meta fn__flex">
        <span class="fn__space"></span>
        <span class="fn__space"></span>
        <span class="fn__space"></span>
        <span>${item.hSize}</span>
        <span class="fn__space"></span>
        <span>${item.updated}</span>
    </div>
</li>`);
                }
                if (platform !== "browser-mobile") {
                    syncListParts.push(`<li data-type="selectCloud" data-name="${item.cloudName}" class="b3-list-item b3-list-item--narrow b3-list-item--hide-action">
<input type="radio" name="cloudName"${item.cloudName === response.data.checkedSyncDir ? " checked" : ""}/>
<span class="fn__space"></span>
<span>${item.cloudName}</span>
<span class="fn__space"></span>
<span class="ft__on-surface">${item.hSize}</span>
<span class="b3-list-item__meta">${item.updated}</span>
<span class="fn__flex-1 fn__space"></span>
<span data-type="removeCloud" class="b3-tooltips b3-tooltips__w b3-list-item__action${(window.siyuan.config.sync.provider === 2 || window.siyuan.config.sync.provider === 3) ? " fn__none":""}" aria-label="${siyuanI18n.delete}">
    <svg><use xlink:href="#iconTrashcan"></use></svg>
</span></li>`);
                }
            });
            syncListParts.push("</ul>");
            if (![2, 3].includes(window.siyuan.config.sync.provider)) {
                syncListParts.push(`<div class="fn__hr"></div>
<div class="fn__flex">
    <button class="b3-button b3-button--outline" data-type="addCloud"><svg><use xlink:href="#iconAdd"></use></svg>${siyuanI18n.addAttr}</button>
    <div class="fn__flex-1"></div>
</div>`);
            }
            syncListHTML = syncListParts.join("");
        }
        cloudListElement.innerHTML = syncListHTML;
        cb?.();
    });
};

export const syncGuide = (app?: AppFacade) => {
    if (window.siyuan.config.readonly) {
        return;
    }
    if (app && document.querySelector("#barSync")?.classList.contains("toolbar__item--active")) {
        return;
    }
    if (window.siyuan.config.sync.provider === 0 && needSubscribe("")) {
        if (!isMobile() && app) {
            app.openSettings("sync");
        }
        showMessage(siyuanI18n._kernel[29].replaceAll("${accountServer}", getCloudURL("")));
        return;
    } else if (!isPaidUser()) {
        if (!isMobile() && app) {
            app.openSettings("sync");
        }
        showMessage(siyuanI18n._kernel[214].replaceAll("${accountServer}", getCloudURL("")));
        return;
    }
    if (!window.siyuan.config.sync.enabled && window.siyuan.config.sync.provider !== 0) {
        openSyncSetting(app);
        return;
    }
    if (!window.siyuan.config.repo.key) {
        setKey(true);
        return;
    }
    if (!window.siyuan.config.sync.enabled) {
        setSync();
        return;
    }
    syncNow();
};

const syncNow = () => {
    if (window.siyuan.config.sync.mode !== 3) {
        fetchPost("/api/sync/performSync", {});
        return;
    }
    const manualDialog = new Dialog({
        title: siyuanI18n.chooseSyncDirection,
        content: `<div class="b3-dialog__content">
    <label class="fn__flex b3-label">
        <input type="radio" name="upload" value="true">
        <span class="fn__space"></span>
        <div>
            ${siyuanI18n.uploadData2Cloud}
            <div class="b3-label__text">${siyuanI18n.uploadData2CloudTip}</div>
        </div>
    </label>
    <label class="fn__flex b3-label">
        <input type="radio" name="upload" value="false">
        <span class="fn__space"></span>
        <div>
            ${siyuanI18n.downloadDataFromCloud}
            <div class="b3-label__text">${siyuanI18n.downloadDataFromCloudTip}</div>
        </div>
    </label>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    manualDialog.element.setAttribute("data-key", Constants.DIALOG_SYNCCHOOSEDIRECTION);
    const btnsElement = manualDialog.element.querySelectorAll(".b3-button");
    btnsElement[0].addEventListener("click", () => {
        manualDialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => {
        const uploadElement = manualDialog.element.querySelector("input[name=upload]:checked") as HTMLInputElement;
        if (!uploadElement) {
            showMessage(siyuanI18n.plsChoose);
            return;
        }
        fetchPost("/api/sync/performSync", {upload: uploadElement.value === "true"});
        manualDialog.destroy();
    });
};

const setSync = (key?: string, dialog?: Dialog) => {
    if (key) {
        window.siyuan.config.repo.key = key;
    }
    if (!window.siyuan.config.sync.enabled) {
        const listHTML = `<div class="b3-dialog__content">
    <div class="ft__on-surface">${siyuanI18n.syncConfGuide3}</div>
    <div class="fn__hr--b"></div>
    <div style="display: flex;flex-direction: column;height: 40vh;">
        <img style="margin: 0 auto;display: block;width: 64px;height: 100%" src="/stage/loading-pure.svg">
    </div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button" disabled>${siyuanI18n.openSyncTip1}</button>
</div>`;
        if (dialog) {
            dialog.element.querySelector(".b3-dialog__header").innerHTML = "🗂️ " + siyuanI18n.cloudSyncDir;
            dialog.element.querySelector(".b3-dialog__body").innerHTML = listHTML;
        } else {
            dialog = new Dialog({
                title: "🗂️ " + siyuanI18n.cloudSyncDir,
                content: listHTML,
                width: isMobile() ? "92vw" : "520px",
            });
        }
        dialog.element.setAttribute("data-key", Constants.DIALOG_SYNCCHOOSEDIR);
        const contentElement = dialog.element.querySelector(".b3-dialog__content").lastElementChild;
        const btnElement = dialog.element.querySelector(".b3-button") as HTMLButtonElement;
        const updateOpenSyncBtn = () => {
            btnElement.disabled = !contentElement.querySelector("input[checked]");
        };
        bindSyncCloudListEvent(contentElement, updateOpenSyncBtn);
        renderSyncCloudList(contentElement, false, updateOpenSyncBtn);
        btnElement.addEventListener("click", () => {
            dialog.destroy();
            fetchPost("/api/sync/setSyncEnable", {enabled: true}, () => {
                window.siyuan.config.sync.enabled = true;
                processSync();
                confirmDialog("🔄 " + siyuanI18n.syncConfGuide4, siyuanI18n.syncConfGuide5, () => {
                    syncNow();
                });
            });
        });
    } else {
        if (dialog) {
            dialog.destroy();
        }
        confirmDialog("🔄 " + siyuanI18n.syncConfGuide4, siyuanI18n.syncConfGuide5, () => {
            syncNow();
        });
    }
};

export const setKey = (isSync: boolean, cb?: () => void) => {
    const dialog = new Dialog({
        title: "🔑 " + siyuanI18n.syncConfGuide1,
        content: `<div class="b3-dialog__content ft__center">
    <img style="width: 260px" src="/stage/images/sync-guide.svg"/>
    <div class="fn__hr--b"></div>
    <div class="ft__on-surface">${siyuanI18n.syncConfGuide2}</div>
    <div class="fn__hr--b"></div>
    <input class="b3-text-field fn__block ft__center" placeholder="${siyuanI18n.passphrase}">
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block ft__center" placeholder="${siyuanI18n.reEnterPassphrase}">
</div>
<div class="b3-dialog__action">
    <label style="display: inline-flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="confirmPassword">
        <span class="fn__space"></span>
        ${siyuanI18n.confirmPassword}
    </label>
    <span class="fn__flex-1"></span>
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button>
    <span class="fn__space"></span>
    <button class="b3-button b3-button--text" id="initKeyByPW" disabled>
        ${siyuanI18n.confirm}
    </button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_SETPASSWORD);
    dialog.element.querySelector(".b3-button--cancel").addEventListener("click", () => {
        dialog.destroy();
    });
    const genBtnElement = dialog.element.querySelector("#initKeyByPW");
    dialog.element.querySelector("#confirmPassword").addEventListener("change", function () {
        if (this.checked) {
            genBtnElement.removeAttribute("disabled");
        } else {
            genBtnElement.setAttribute("disabled", "disabled");
        }
    });
    const inputElements = dialog.element.querySelectorAll(".b3-text-field") as NodeListOf<HTMLInputElement>;
    genBtnElement.addEventListener("click", () => {
        if (!inputElements[0].value || !inputElements[1].value) {
            showMessage(siyuanI18n._kernel[142]);
            return;
        }
        if (inputElements[0].value !== inputElements[1].value) {
            showMessage(siyuanI18n.passwordNoMatch);
            return;
        }
        confirmDialog("🔑 " + siyuanI18n.genKeyByPW, siyuanI18n.initRepoKeyTip, () => {
            if (!isSync) {
                dialog.destroy();
            }
            fetchPost("/api/repo/initRepoKeyFromPassphrase", {pass: inputElements[0].value}, (response) => {
                window.siyuan.config.repo.key = response.data.key;
                if (cb) {
                    cb();
                }
                if (isSync) {
                    setSync(response.data.key, dialog);
                }
            });
        });
    });
    inputElements[0].focus();
};
