import { Constants } from "../../constants";
import { setAccessAuthCode } from "../../config/util/about";
import { Dialog } from "../../dialog";
import { fetchPost } from "../../util/network/fetch";
import { confirmDialog } from "../../dialog/confirmDialog";
import { showMessage } from "../../dialog/message";
import {
    isInMobileApp,
    isIPad,
    saveExportFile,
    writeText
} from "../../protyle/util/compatibility";
import { exitSiYuan, processSync } from "../../dialog/processSystem";
import { pathPosix } from "../../util/file/pathName";
import { openModel } from "../menu/model";
import { setKey } from "../../sync/syncGuide";
import { isBrowser } from "../../util/platform/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment"; // S-forge: 本地i18n统一导入
import {hasClosestByClassName} from "../../protyle/util/hasClosest";

export const initAbout = () => {
    openModel({
        title: siyuanI18n.about,
        icon: "iconInfo",
        html: `<div>
<div class="b3-label${window.siyuan.config.readonly ? " fn__none" : ""}">
    <label class="fn__flex">
        <div class="fn__flex-1">
            ${siyuanI18n.about11}
            <div class="b3-label__text">${siyuanI18n.about12}</div>
        </div>
        <div class="fn__space"></div>
        <input class="b3-switch fn__flex-center" id="networkServe" type="checkbox"${window.siyuan.config.system.networkServe ? " checked" : ""}>
    </label>
    <label class="b3-label fn__flex${window.siyuan.config.system.networkServe ? "" : " fn__none"}${(window.siyuan.config.system.networkServeTLS && window.siyuan.config.system.networkServe) ? "" : " b3-label--noborder"}">
        <div class="fn__flex-1">
            ${window.siyuan.languages.networkServeTLS}
            <div class="b3-label__text">${window.siyuan.languages.networkServeTLSTip}</div>
            <div class="b3-label__text">${window.siyuan.languages.networkServeTLSTip2}</div>
        </div>
        <div class="fn__space"></div>
        <input class="b3-switch fn__flex-center" id="networkServeTLS" type="checkbox"${window.siyuan.config.system.networkServeTLS ? " checked" : ""}${!window.siyuan.config.system.networkServe ? " disabled" : ""}>
    </label>
    <div class="b3-label${(window.siyuan.config.system.networkServeTLS && window.siyuan.config.system.networkServe) ? "" : " fn__none"}">
        ${window.siyuan.languages.exportCACert}
        <div class="fn__hr"></div>
        <button class="b3-button b3-button--outline fn__block" id="exportCACert">
            <svg><use xlink:href="#iconUpload"></use></svg>${window.siyuan.languages.export}
        </button>
        <div class="b3-label__text">${window.siyuan.languages.exportCACertTip}</div>
    </div>
    <div class="b3-label${(window.siyuan.config.system.networkServeTLS && window.siyuan.config.system.networkServe) ? "" : " fn__none"}">
        ${window.siyuan.languages.exportCABundle}
        <div class="fn__hr"></div>
        <button class="b3-button b3-button--outline fn__block" id="exportCABundle">
            <svg><use xlink:href="#iconUpload"></use></svg>${window.siyuan.languages.export}
        </button>
        <div class="b3-label__text">${window.siyuan.languages.exportCABundleTip}</div>
    </div>
    <div class="b3-label${(window.siyuan.config.system.networkServeTLS && window.siyuan.config.system.networkServe) ? "" : " fn__none"}">
        ${window.siyuan.languages.importCABundle}
        <div class="fn__hr"></div>
        <button class="b3-button b3-button--outline fn__block" id="importCABundle">
            <svg><use xlink:href="#iconDownload"></use></svg>${window.siyuan.languages.import}
        </button>
        <div class="b3-label__text">${window.siyuan.languages.importCABundleTip}</div>
    </div>
</div>
<div class="b3-label">
        ${siyuanI18n.about2}
        <div class="fn__hr"></div>
        <a target="_blank" href="${"http://127.0.0.1:" + location.port}?openExternal" class="b3-button b3-button--outline fn__block">
            <svg><use xlink:href="#iconLink"></use></svg>${window.siyuan.languages.about4}
        </a>
        <div class="b3-label__text">${window.siyuan.languages.about3.replace("${port}", location.port)}</div>
        <div class="fn__hr"></div>
        ${(() => {
            const serverAddrs: string[] = [];
            for (const serverAddr of window.siyuan.config.serverAddrs) {
                if (!serverAddr.trim()) {
                    break;
                }
                serverAddrs.push(`<code class="fn__code">${serverAddr}</code>`);
            }
            return `<div class="b3-label__text">${serverAddrs.join(" ")}</div>`;
        })()}
        <div class="fn__hr"></div>
        <div class="b3-label__text">${siyuanI18n.about18}</div>
</div>
<div class="b3-label${(window.siyuan.config.readonly || (isBrowser() && !isIPad() && !isInMobileApp())) ? " fn__none" : ""}">
    ${siyuanI18n.about5}
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" id="authCode">
        <svg><use xlink:href="#iconLock"></use></svg>${siyuanI18n.config}
    </button>
    <div class="b3-label__text">${siyuanI18n.about6}</div>
</div>
<div class="b3-label${window.siyuan.config.readonly ? " fn__none" : ""}">
    ${siyuanI18n.dataRepoKey}
    <div class="fn__hr"></div>
    <div class="${window.siyuan.config.repo.key ? "fn__none" : ""}">
        <button class="b3-button b3-button--outline fn__block" id="importKey">
            <svg><use xlink:href="#iconDownload"></use></svg>${siyuanI18n.importKey}
        </button>
        <div class="fn__hr"></div>
        <button class="b3-button b3-button--outline fn__block" id="initKey">
            <svg><use xlink:href="#iconLock"></use></svg>${siyuanI18n.genKey}
        </button>
        <div class="fn__hr"></div>
        <button class="b3-button b3-button--outline fn__block" id="initKeyByPW">
            <svg><use xlink:href="#iconKey"></use></svg>${siyuanI18n.genKeyByPW}
        </button>
    </div>
    <div class="${window.siyuan.config.repo.key ? "" : "fn__none"}">
        <button class="b3-button b3-button--outline fn__block" id="copyKey">
            <svg><use xlink:href="#iconCopy"></use></svg>${siyuanI18n.copyKey}
        </button>
        <div class="fn__hr"></div>
        <button class="b3-button b3-button--outline fn__block" id="removeKey">
            <svg><use xlink:href="#iconUndo"></use></svg>${siyuanI18n.resetRepo}
        </button>
    </div>
    <div class="b3-label__text">${siyuanI18n.dataRepoKeyTip1}</div>
    <div class="b3-label__text ft__error">${siyuanI18n.dataRepoKeyTip2}</div>
</div>
<div class="b3-label${window.siyuan.config.readonly ? " fn__none" : ""}">
    ${siyuanI18n.dataRepoPurge}
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" id="purgeRepo">
        <svg><use xlink:href="#iconTrashcan"></use></svg>${siyuanI18n.purge}
    </button>
    <div class="b3-label__text">${siyuanI18n.dataRepoPurgeTip}</div>
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" style="padding-right: 64px;" id="indexRetentionDays" min="1" type="number" class="b3-text-field" value="${window.siyuan.config.repo.indexRetentionDays}">
    <div class="b3-label__text">${siyuanI18n.dataRepoAutoPurgeIndexRetentionDays}</div>
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" style="padding-right: 64px;" id="retentionIndexesDaily" min="1" type="number" class="b3-text-field" value="${window.siyuan.config.repo.retentionIndexesDaily}">
    <div class="b3-label__text">${siyuanI18n.dataRepoAutoPurgeRetentionIndexesDaily}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.vacuumDataIndex}
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" id="vacuumDataIndex">
       <svg><use xlink:href="#iconRefresh"></use></svg>${siyuanI18n.vacuumDataIndex}
    </button>
    <div class="b3-label__text">${siyuanI18n.vacuumDataIndexTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.rebuildDataIndex}
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" id="rebuildDataIndex">
       <svg><use xlink:href="#iconRefresh"></use></svg>${siyuanI18n.rebuildDataIndex}
    </button>
    <div class="b3-label__text">${siyuanI18n.rebuildDataIndexTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.clearTempFiles}
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" id="clearTempFiles">
       <svg><use xlink:href="#iconTrashcan"></use></svg>${siyuanI18n.clearTempFiles}
    </button>
    <div class="b3-label__text">${siyuanI18n.clearTempFilesTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.systemLog}
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" id="exportLog">
       <svg><use xlink:href="#iconUpload"></use></svg>${siyuanI18n.export}
    </button>
    <div class="b3-label__text">${siyuanI18n.systemLogTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.export} Data
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" id="exportData">
       <svg><use xlink:href="#iconUpload"></use></svg>${siyuanI18n.export}
    </button>
    <div class="b3-label__text">${siyuanI18n.exportDataTip}</div>
</div>
<div class="b3-label${window.siyuan.config.readonly ? " fn__none" : ""}">
    <div class="fn__flex">
        ${siyuanI18n.import} Data
    </div>
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" style="position: relative">
        <input id="importData" class="b3-form__upload" type="file">
        <svg><use xlink:href="#iconDownload"></use></svg> ${siyuanI18n.import}
    </button>
    <div class="b3-label__text">${siyuanI18n.importDataTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.exportConf}
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" id="exportConf">
       <svg><use xlink:href="#iconUpload"></use></svg>${siyuanI18n.export}
    </button>
    <div class="b3-label__text">${siyuanI18n.exportConfTip}</div>
</div>
<div class="b3-label${window.siyuan.config.readonly ? " fn__none" : ""}">
    <div class="fn__flex">
        ${siyuanI18n.importConf}
    </div>
    <div class="fn__hr"></div>
    <button class="b3-button b3-button--outline fn__block" style="position: relative">
        <input id="importConf" class="b3-form__upload" type="file">
        <svg><use xlink:href="#iconDownload"></use></svg> ${siyuanI18n.import}
    </button>
    <div class="b3-label__text">${siyuanI18n.importConfTip}</div>
</div>
<div class="b3-label${(!window.siyuan.config.readonly && isInMobileApp()) ? "" : " fn__none"}">
    ${siyuanI18n.workspaceList}
    <div class="fn__hr"></div>
    <button id="openWorkspace" class="b3-button b3-button--outline fn__block">${siyuanI18n.openBy}...</button>
    <div class="fn__hr"></div>
    <ul id="workspaceDir" class="b3-list b3-list--background"></ul>
    <div class="fn__hr"></div>
    <button id="creatWorkspace" class="b3-button fn__block">${siyuanI18n.new}</button>
</div>
<div class="b3-label${window.siyuan.config.readonly ? " fn__none" : ""}">
    ${siyuanI18n.about13}
    <div class="fn__hr"></div>
    <div class="b3-form__icon">
        <input class="b3-text-field fn__block" id="token" style="padding-right: 64px;" value="${window.siyuan.config.api.token}">
        <button class="b3-button b3-button--text" id="tokenCopy" style="position: absolute;right: 0;height: 28px;">
            <svg><use xlink:href="#iconCopy"></use></svg>${siyuanI18n.copy}
        </button>
    </div>
    <div class="b3-label__text" id="tokenTip">${siyuanI18n.about14.replace("${token}", window.siyuan.config.api.token)}</div>
</div>
<div class="b3-label">
    <div class="config-about__logo">
        <img src="/stage/icon.png">
        <span class="fn__space"></span>
        <div>
            <span>${siyuanI18n.siyuanNote}</span>
            <span class="fn__space"></span>
            <span class="ft__on-surface">v${Constants.SIYUAN_VERSION}</span>
            <br>
            <span class="ft__on-surface">${siyuanI18n.slogan}</span>
        </div>
    </div>
    <div style="color:var(--b3-theme-surface);font-family: cursive;">会泽百家&nbsp;至公天下</div>
    ${window.siyuan.languages.about1} ${"harmony" === window.siyuan.config.system.container ? " • " + window.siyuan.languages.feedback + " 845765@qq.com" : ""}
</div>
</div>`,
        bindEvent(modelMainElement: HTMLElement) {
            const workspaceDirElement = modelMainElement.querySelector("#workspaceDir");
            genWorkspace(workspaceDirElement);
            const importKeyElement = modelMainElement.querySelector("#importKey");
            modelMainElement.firstElementChild.addEventListener("click", (event) => {
                let target = event.target as HTMLElement;
                while (target && (target !== modelMainElement)) {
                    if (target.id === "authCode") {
                        setAccessAuthCode();
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "importKey") {
                        const passwordDialog = new Dialog({
                            title: "🔑 " + siyuanI18n.key,
                            content: `<div class="b3-dialog__content">
    <textarea spellcheck="false" style="resize: vertical;"  class="b3-text-field fn__block" placeholder="${siyuanI18n.keyPlaceholder}"></textarea>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
                            width: "92vw",
                        });
                        passwordDialog.element.setAttribute("data-key", Constants.DIALOG_PASSWORD);
                        const textAreaElement = passwordDialog.element.querySelector("textarea");
                        textAreaElement.focus();
                        const btnsElement = passwordDialog.element.querySelectorAll(".b3-button");
                        btnsElement[0].addEventListener("click", () => {
                            passwordDialog.destroy();
                        });
                        btnsElement[1].addEventListener("click", () => {
                            fetchPost("/api/repo/importRepoKey", { key: textAreaElement.value }, (response) => {
                                window.siyuan.config.repo.key = response.data.key;
                                importKeyElement.parentElement.classList.add("fn__none");
                                importKeyElement.parentElement.nextElementSibling.classList.remove("fn__none");
                                passwordDialog.destroy();
                            });
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "initKey") {
                        confirmDialog("🔑 " + siyuanI18n.genKey, siyuanI18n.initRepoKeyTip, () => {
                            fetchPost("/api/repo/initRepoKey", {}, (response) => {
                                window.siyuan.config.repo.key = response.data.key;
                                importKeyElement.parentElement.classList.add("fn__none");
                                importKeyElement.parentElement.nextElementSibling.classList.remove("fn__none");
                            });
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "initKeyByPW") {
                        setKey(false, () => {
                            importKeyElement.parentElement.classList.add("fn__none");
                            importKeyElement.parentElement.nextElementSibling.classList.remove("fn__none");
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "copyKey") {
                        showMessage(siyuanI18n.copied);
                        writeText(window.siyuan.config.repo.key);
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "removeKey") {
                        confirmDialog("⚠️ " + siyuanI18n.resetRepo, siyuanI18n.resetRepoTip, () => {
                            fetchPost("/api/repo/resetRepo", {}, () => {
                                window.siyuan.config.repo.key = "";
                                window.siyuan.config.sync.enabled = false;
                                processSync();
                                importKeyElement.parentElement.classList.remove("fn__none");
                                importKeyElement.parentElement.nextElementSibling.classList.add("fn__none");
                            });
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "purgeRepo") {
                        confirmDialog("♻️ " + siyuanI18n.dataRepoPurge, siyuanI18n.dataRepoPurgeConfirm, () => {
                            fetchPost("/api/repo/purgeRepo");
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "tokenCopy") {
                        showMessage(siyuanI18n.copied);
                        writeText(window.siyuan.config.api.token);
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "vacuumDataIndex") {
                        fetchPost("/api/system/vacuumDataIndex", {}, () => {
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "rebuildDataIndex") {
                        fetchPost("/api/system/rebuildDataIndex", {}, () => {
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "clearTempFiles") {
                        fetchPost("/api/system/clearTempFiles", {}, () => {
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "exportLog") {
                        fetchPost("/api/system/exportLog", {}, (response) => {
                            saveExportFile(response.data.zip);
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "openWorkspace") {
                        fetchPost("/api/system/getMobileWorkspaces", {}, (response) => {
                            let selectHTML = "";
                            response.data.forEach((item: string, index: number) => {
                                selectHTML += `<option value="${item}"${index === 0 ? ' selected="selected"' : ""}>${pathPosix().basename(item)}</option>`;
                            });
                            const openWorkspaceDialog = new Dialog({
                                title: siyuanI18n.openBy,
                                content: `<div class="b3-dialog__content">
    <select class="b3-text-field fn__block">${selectHTML}</select>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
                                width: "92vw",
                            });
                            openWorkspaceDialog.element.setAttribute("data-key", Constants.SIYUAN_OPEN_WORKSPACE);
                            const btnsElement = openWorkspaceDialog.element.querySelectorAll(".b3-button");
                            btnsElement[0].addEventListener("click", () => {
                                openWorkspaceDialog.destroy();
                            });
                            btnsElement[1].addEventListener("click", () => {
                                const openPath = openWorkspaceDialog.element.querySelector("select").value;
                                if (openPath === window.siyuan.config.system.workspaceDir) {
                                    openWorkspaceDialog.destroy();
                                    return;
                                }
                                confirmDialog(siyuanI18n.confirm, `${pathPosix().basename(window.siyuan.config.system.workspaceDir)} -> ${pathPosix().basename(openPath)}?`, () => {
                                    fetchPost("/api/system/setWorkspaceDir", {
                                        path: openPath
                                    }, () => {
                                        exitSiYuan(false);
                                    });
                                });
                            });
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.id === "creatWorkspace") {
                        const createWorkspaceDialog = new Dialog({
                            title: siyuanI18n.new,
                            content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
                            width: "92vw",
                        });
                        createWorkspaceDialog.element.setAttribute("data-key", Constants.DIALOG_CREATEWORKSPACE);
                        const inputElement = createWorkspaceDialog.element.querySelector("input");
                        inputElement.focus();
                        const btnsElement = createWorkspaceDialog.element.querySelectorAll(".b3-button");
                        btnsElement[0].addEventListener("click", () => {
                            createWorkspaceDialog.destroy();
                        });
                        btnsElement[1].addEventListener("click", () => {
                            fetchPost("/api/system/createWorkspaceDir", {
                                path: pathPosix().join(pathPosix().dirname(window.siyuan.config.system.workspaceDir), inputElement.value)
                            }, () => {
                                genWorkspace(workspaceDirElement);
                                createWorkspaceDialog.destroy();
                            });
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.getAttribute("data-type") === "remove") {
                        const removePath = target.parentElement.getAttribute("data-path");
                        fetchPost("/api/system/removeWorkspaceDir", { path: removePath }, () => {
                            genWorkspace(workspaceDirElement);
                            confirmDialog(siyuanI18n.deleteOpConfirm, siyuanI18n.removeWorkspacePhysically.replace("${x}", removePath), () => {
                                fetchPost("/api/system/removeWorkspaceDirPhysically", { path: removePath });
                            }, undefined, true);
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    } else if (target.classList.contains("b3-list-item") && !target.classList.contains("b3-list-item--focus")) {
                        confirmDialog(siyuanI18n.confirm, `${pathPosix().basename(window.siyuan.config.system.workspaceDir)} -> ${pathPosix().basename(target.getAttribute("data-path"))}?`, () => {
                            fetchPost("/api/system/setWorkspaceDir", {
                                path: target.getAttribute("data-path")
                            }, () => {
                                exitSiYuan(false);
                            });
                        });
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    }
                    target = target.parentElement;
                }
            });
            const networkServeElement = modelMainElement.querySelector("#networkServe") as HTMLInputElement;
            const networkServeTLSElement = modelMainElement.querySelector("#networkServeTLS") as HTMLInputElement;
            const networkServeContainElement = hasClosestByClassName(networkServeElement, "b3-label") as HTMLElement;
            networkServeElement.addEventListener("change", () => {
                networkServeTLSElement.disabled = !networkServeElement.checked;
                if (!networkServeElement.checked) {
                    networkServeTLSElement.checked = false;
                }
                Array.from(networkServeContainElement.children).forEach((item: HTMLElement, index) => {
                    if (index === 1) {
                        if (networkServeElement.checked) {
                            item.classList.remove("fn__none");
                        } else {
                            item.classList.add("fn__none");
                        }
                    } else if (index > 1) {
                        if (networkServeTLSElement.checked) {
                            item.classList.remove("fn__none");
                        } else {
                            item.classList.add("fn__none");
                        }
                    }
                });
                if (networkServeTLSElement.checked) {
                    networkServeTLSElement.parentElement.classList.remove("b3-label--noborder");
                } else {
                    networkServeTLSElement.parentElement.classList.add("b3-label--noborder");
                }
                fetchPost("/api/system/setNetworkServe", {networkServe: networkServeElement.checked}, () => {
                    exitSiYuan();
                });
            });
            networkServeTLSElement.addEventListener("change", () => {
                Array.from(networkServeContainElement.children).forEach((item: HTMLElement, index) => {
                    if (index > 1) {
                        if (networkServeTLSElement.checked) {
                            item.classList.remove("fn__none");
                        } else {
                            item.classList.add("fn__none");
                        }
                    }
                });
                if (networkServeTLSElement.checked) {
                    networkServeTLSElement.parentElement.classList.remove("b3-label--noborder");
                } else {
                    networkServeTLSElement.parentElement.classList.add("b3-label--noborder");
                }
                fetchPost("/api/system/setNetworkServeTLS", {networkServeTLS: networkServeTLSElement.checked}, () => {
                    exitSiYuan();
                });
            });
            modelMainElement.querySelector("#exportCACert")?.addEventListener("click", () => {
                fetchPost("/api/system/exportTLSCACert", {}, (response) => {
                    saveExportFile(response.data.path);
                });
            });
            modelMainElement.querySelector("#exportCABundle")?.addEventListener("click", () => {
                fetchPost("/api/system/exportTLSCABundle", {}, (response) => {
                    saveExportFile(response.data.path);
                });
            });
            modelMainElement.querySelector("#importCABundle")?.addEventListener("click", () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".zip";
                input.onchange = () => {
                    if (input.files && input.files[0]) {
                        const formData = new FormData();
                        formData.append("file", input.files[0]);
                        fetch("/api/system/importTLSCABundle", {
                            method: "POST",
                            body: formData,
                        }).then(res => res.json()).then((response) => {
                            if (response.code === 0) {
                                showMessage(window.siyuan.languages.importCABundleSuccess);
                            } else {
                                showMessage(response.msg, 6000, "error");
                            }
                        });
                    }
                };
                input.click();
            });
            const tokenElement = modelMainElement.querySelector("#token") as HTMLInputElement;
            tokenElement.addEventListener("change", () => {
                fetchPost("/api/system/setAPIToken", { token: tokenElement.value }, () => {
                    window.siyuan.config.api.token = tokenElement.value;
                    modelMainElement.querySelector("#tokenTip").innerHTML = siyuanI18n.about14.replace("${token}", window.siyuan.config.api.token);
                });
            });
            const indexRetentionDaysElement = modelMainElement.querySelector("#indexRetentionDays") as HTMLInputElement;
            indexRetentionDaysElement.addEventListener("change", () => {
                fetchPost("/api/repo/setRepoIndexRetentionDays", { days: parseInt(indexRetentionDaysElement.value) }, () => {
                    window.siyuan.config.repo.indexRetentionDays = parseInt(indexRetentionDaysElement.value);
                });
            });
            const retentionIndexesDailyElement = modelMainElement.querySelector("#retentionIndexesDaily") as HTMLInputElement;
            retentionIndexesDailyElement.addEventListener("change", () => {
                fetchPost("/api/repo/setRetentionIndexesDaily", { indexes: parseInt(retentionIndexesDailyElement.value) }, () => {
                    window.siyuan.config.repo.retentionIndexesDaily = parseInt(retentionIndexesDailyElement.value);
                });
            });
        }
    });
};

const genWorkspace = (workspaceDirElement: Element) => {
    fetchPost("/api/system/getWorkspaces", {}, (response) => {
        let html = "";
        response.data.forEach((item: IWorkspace) => {
            html += `<li data-path="${item.path}" class="b3-list-item b3-list-item--narrow${window.siyuan.config.system.workspaceDir === item.path ? " b3-list-item--focus" : ""}">
    <span class="b3-list-item__text">${pathPosix().basename(item.path)}</span>
    <span data-type="remove" class="b3-list-item__action">
        <svg><use xlink:href="#iconMin"></use></svg>
    </span>
</li>`;
        });
        workspaceDirElement.innerHTML = html;
    });
};
