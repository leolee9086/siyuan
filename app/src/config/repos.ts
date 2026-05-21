import {fetchPost} from "../util/network/fetch";
import {showMessage} from "../dialog/message";
import {bindSyncCloudListEvent, getSyncCloudList} from "../sync/syncGuide";
import {processSync} from "../dialog/processSystem";
import {saveExportFile} from "../protyle/util/compatibility";
import {confirmDialog} from "../dialog/confirmDialog";
import {renderProvider, bindProviderEvent} from "./repos.provider";

export const repos = {
    element: undefined as Element,
    genHTML: () => {
        return `<div>
<div style="position: fixed;width: 800px;height: 434px;box-sizing: border-box;text-align: center;display: flex;align-items: center;justify-content: center;z-index: 1;" id="reposLoading">
    <img src="/stage/loading-pure.svg">
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${window.siyuan.languages.syncProvider}
        <div class="b3-label__text">${window.siyuan.languages.syncProviderTip}</div>
    </div>
    <span class="fn__space"></span>
    <select id="syncProvider" class="b3-select fn__flex-center fn__size200">
        <option value="0" ${window.siyuan.config.sync.provider === 0 ? "selected" : ""}>SiYuan</option>
        <option value="2" ${window.siyuan.config.sync.provider === 2 ? "selected" : ""}>S3</option>
        <option value="3" ${window.siyuan.config.sync.provider === 3 ? "selected" : ""}>WebDAV</option>
        <option class="${!["std", "docker"].includes(window.siyuan.config.system.container) ? "fn__none" : ""}" value="4" ${window.siyuan.config.sync.provider === 4 ? "selected" : ""}>${window.siyuan.languages.localFileSystem}</option>
    </select>
</div>
<div id="syncProviderPanel" class="b3-label">
    ${renderProvider(window.siyuan.config.sync.provider)}
</div>
<div id="reposData" class="b3-label">
    <div class="fn__flex">
        <div class="fn__flex-1">
            ${window.siyuan.languages.cloudStorage}
        </div>
        <div class="fn__flex-1">
            ${window.siyuan.languages.trafficStat}
        </div>
    </div>
</div>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${window.siyuan.languages.openSyncTip1}
        <div class="b3-label__text">${window.siyuan.languages.openSyncTip2}</div>
    </div>
    <span class="fn__space"></span>
    <input type="checkbox" id="reposCloudSyncSwitch"${window.siyuan.config.sync.enabled ? " checked='checked'" : ""} class="b3-switch fn__flex-center">
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${window.siyuan.languages.generateConflictDoc}
        <div class="b3-label__text">${window.siyuan.languages.generateConflictDocTip}</div>
    </div>
    <span class="fn__space"></span>
    <input type="checkbox" id="generateConflictDoc"${window.siyuan.config.sync.generateConflictDoc ? " checked='checked'" : ""} class="b3-switch fn__flex-center">
</label>
<div class="b3-label">
    <div class="fn__flex config__item">
        <div class="fn__flex-1">
            ${window.siyuan.languages.syncMode}
            <div class="b3-label__text">${window.siyuan.languages.syncModeTip}</div>
        </div>
        <span class="fn__space"></span>
        <select id="syncMode" class="b3-select fn__flex-center fn__size200">
            <option value="1" ${window.siyuan.config.sync.mode === 1 ? "selected" : ""}>${window.siyuan.languages.syncMode1}</option>
            <option value="2" ${window.siyuan.config.sync.mode === 2 ? "selected" : ""}>${window.siyuan.languages.syncMode2}</option>
            <option value="3" ${window.siyuan.config.sync.mode === 3 ? "selected" : ""}>${window.siyuan.languages.syncMode3}</option>
        </select>
    </div>
    <div class="fn__flex b3-label${(window.siyuan.config.sync.mode !== 1) ? " fn__none" : ""}">
        <div class="fn__flex-1">
            ${window.siyuan.languages.syncInterval}
            <div class="b3-label__text">${window.siyuan.languages.syncIntervalTip}</div>
        </div>
        <span class="fn__space"></span>
        <input type="number" min="30" max="43200" id="syncInterval" class="b3-text-field fn__flex-center" value="${window.siyuan.config.sync.interval}" >
        <span class="fn__space"></span>        
        <span class="fn__flex-center ft__on-surface">${window.siyuan.languages.second}</span> 
    </div>
    <label class="fn__flex b3-label${(window.siyuan.config.sync.mode !== 1 || window.siyuan.config.system.container === "docker" || window.siyuan.config.sync.provider !== 0) ? " fn__none" : ""}">
        <div class="fn__flex-1">
            ${window.siyuan.languages.syncPerception}
            <div class="b3-label__text">${window.siyuan.languages.syncPerceptionTip}</div>
        </div>
        <span class="fn__space"></span>
        <input type="checkbox" id="syncPerception"${window.siyuan.config.sync.perception ? " checked='checked'" : ""} class="b3-switch fn__flex-center">
    </label>
</div>
<div class="b3-label">
    <div class="fn__flex config__item">
        <div class="fn__flex-1">
            ${window.siyuan.languages.cloudSyncDir}
            <div class="b3-label__text">${window.siyuan.languages.cloudSyncDirTip}</div>
        </div>
        <div class="fn__space"></div>
        <button class="b3-button b3-button--outline fn__flex-center fn__size200" data-action="config">
            <svg><use xlink:href="#iconSettings"></use></svg>${window.siyuan.languages.config}
        </button>
    </div>
    <div id="reposCloudSyncList" class="fn__none b3-label"><img style="margin: 0 auto;display: block;width: 64px;height: 100%" src="/stage/loading-pure.svg"></div>
</div>
<div class="b3-label fn__flex">
    <div class="fn__flex-center">${window.siyuan.languages.cloudBackup}</div>
    <div class="b3-list-item__meta fn__flex-center">${window.siyuan.languages.cloudBackupTip}</div>
</div>
</div>`;
    },
    bindEvent: () => {
        bindProviderEvent(repos.element);
        const switchElement = repos.element.querySelector("#reposCloudSyncSwitch") as HTMLInputElement;
        switchElement.addEventListener("change", () => {
            if (switchElement.checked && window.siyuan.config.sync.cloudName === "") {
                switchElement.checked = false;
                showMessage(window.siyuan.languages._kernel[123]);
                return;
            }
            fetchPost("/api/sync/setSyncEnable", {enabled: switchElement.checked}, () => {
                window.siyuan.config.sync.enabled = switchElement.checked;
                processSync();
            });
        });
        const syncIntervalElement = repos.element.querySelector("#syncInterval") as HTMLInputElement;
        syncIntervalElement.addEventListener("change", () => {
            let interval = parseInt(syncIntervalElement.value);
            if (30 > interval) {
                interval = 30;
            }
            if (43200 < interval) {
                interval = 43200;
            }
            syncIntervalElement.value = interval.toString();
            fetchPost("/api/sync/setSyncInterval", {interval: interval}, () => {
                window.siyuan.config.sync.interval = interval;
                processSync();
            });
        });
        const syncPerceptionElement = repos.element.querySelector("#syncPerception") as HTMLInputElement;
        syncPerceptionElement.addEventListener("change", () => {
            fetchPost("/api/sync/setSyncPerception", {enabled: syncPerceptionElement.checked}, () => {
                window.siyuan.config.sync.perception = syncPerceptionElement.checked;
                processSync();
            });
        });
        const switchConflictElement = repos.element.querySelector("#generateConflictDoc") as HTMLInputElement;
        switchConflictElement.addEventListener("change", () => {
            fetchPost("/api/sync/setSyncGenerateConflictDoc", {enabled: switchConflictElement.checked}, () => {
                window.siyuan.config.sync.generateConflictDoc = switchConflictElement.checked;
            });
        });
        const syncModeElement = repos.element.querySelector("#syncMode") as HTMLSelectElement;
        syncModeElement.addEventListener("change", () => {
            fetchPost("/api/sync/setSyncMode", {mode: parseInt(syncModeElement.value, 10)}, () => {
                if (syncModeElement.value === "1" && window.siyuan.config.sync.provider === 0 && window.siyuan.config.system.container !== "docker") {
                    syncPerceptionElement.parentElement.classList.remove("fn__none");
                } else {
                    syncPerceptionElement.parentElement.classList.add("fn__none");
                }
                if (syncModeElement.value === "1") {
                    syncIntervalElement.parentElement.classList.remove("fn__none");
                } else {
                    syncIntervalElement.parentElement.classList.add("fn__none");
                }
                window.siyuan.config.sync.mode = parseInt(syncModeElement.value, 10);
            });
        });
        const syncConfigElement = repos.element.querySelector("#reposCloudSyncList");
        const syncProviderElement = repos.element.querySelector("#syncProvider") as HTMLSelectElement;
        syncProviderElement.addEventListener("change", () => {
            fetchPost("/api/sync/setSyncProvider", {provider: parseInt(syncProviderElement.value, 10)}, (response) => {
                if (response.code === 1) {
                    showMessage(response.msg);
                    syncProviderElement.value = "0";
                    window.siyuan.config.sync.provider = 0;
                } else {
                    window.siyuan.config.sync.provider = parseInt(syncProviderElement.value, 10);
                }
                repos.element.querySelector("#syncProviderPanel").innerHTML = renderProvider(window.siyuan.config.sync.provider);
                bindProviderEvent(repos.element);
                syncConfigElement.innerHTML = "";
                syncConfigElement.classList.add("fn__none");
                if (window.siyuan.config.sync.mode !== 1 || window.siyuan.config.system.container === "docker" || window.siyuan.config.sync.provider !== 0) {
                    syncPerceptionElement.parentElement.classList.add("fn__none");
                } else {
                    syncPerceptionElement.parentElement.classList.remove("fn__none");
                }
                if (window.siyuan.config.sync.mode !== 1) {
                    syncIntervalElement.parentElement.classList.add("fn__none");
                } else {
                    syncIntervalElement.parentElement.classList.remove("fn__none");
                }
            });
        });
        const loadingElement = repos.element.querySelector("#reposLoading") as HTMLElement;
        loadingElement.style.width = repos.element.clientWidth + "px";
        loadingElement.style.height = repos.element.clientHeight + "px";
        bindSyncCloudListEvent(syncConfigElement);
        repos.element.firstElementChild.addEventListener("click", (event) => {
            let target = event.target as HTMLElement;
            while (target && target !== repos.element) {
                const action = target.getAttribute("data-action");
                if (action === "config") {
                    if (syncConfigElement.classList.contains("fn__none")) {
                        getSyncCloudList(syncConfigElement, true);
                        syncConfigElement.classList.remove("fn__none");
                    } else {
                        syncConfigElement.classList.add("fn__none");
                    }
                    break;
                } else if (action === "togglePassword") {
                    const isEye = target.firstElementChild.getAttribute("xlink:href") === "#iconEye";
                    target.firstElementChild.setAttribute("xlink:href", isEye ? "#iconEyeoff" : "#iconEye");
                    target.previousElementSibling.setAttribute("type", isEye ? "text" : "password");
                    break;
                } else if (action === "exportData") {
                    fetchPost(target.getAttribute("data-type") === "s3" ? "/api/sync/exportSyncProviderS3" : "/api/sync/exportSyncProviderWebDAV", {}, response => {
                        saveExportFile(response.data.zip);
                    });
                    break;
                } else if (action === "purgeData") {
                    confirmDialog("♻️ " + window.siyuan.languages.cloudStoragePurge, `<div class="b3-typography">${window.siyuan.languages.cloudStoragePurgeConfirm}</div>`, () => {
                        fetchPost("/api/repo/purgeCloudRepo");
                    });
                    break;
                }
                target = target.parentElement;
            }
        });
    },
};
