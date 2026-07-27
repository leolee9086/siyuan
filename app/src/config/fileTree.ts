import { fetchPost } from "../util/network/fetch";
import { genNotebookOption } from "../menus/onGetnotebookconf";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import {openFile} from "../editor/open/openFile";

// 内部设置 Tab 类型常量
export const INTERNAL_FILETREE_TAB_TYPE = "internal-settings-filetree";

export const fileTree = {
    genHTML: () => {
        return `
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.openInNewTab}
        <div class="b3-label__text">${siyuanI18n.openInNewTab}</div>
    </div>
    <span class="fn__space"></span>
<button id="editButton" class="b3-button b3-button--outline fn__flex-center fn__size200" style="position: relative">
        <svg><use xlink:href="#iconEdit"></use></svg>${siyuanI18n.edit}
    </button>
    </label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.selectOpen}
        <div class="b3-label__text">${siyuanI18n.fileTree2}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="alwaysSelectOpenedFile" type="checkbox"${getSiyuanConfig().fileTree.alwaysSelectOpenedFile ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.fileTree7}
        <div class="b3-label__text">${siyuanI18n.fileTree8}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="openFilesUseCurrentTab" type="checkbox"${getSiyuanConfig().fileTree.openFilesUseCurrentTab ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.fileTree9}
        <div class="b3-label__text">${siyuanI18n.fileTree10}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="closeTabsOnStart" type="checkbox"${getSiyuanConfig().fileTree.closeTabsOnStart ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.noSplitScreenWhenOpenTab}
        <div class="b3-label__text">${siyuanI18n.noSplitScreenWhenOpenTabTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="noSplitScreenWhenOpenTab" type="checkbox"${getSiyuanConfig().fileTree.noSplitScreenWhenOpenTab ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.fileTree18}
        <div class="b3-label__text">${siyuanI18n.fileTree19}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="allowCreateDeeper" type="checkbox"${getSiyuanConfig().fileTree.allowCreateDeeper ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.fileTree3}
        <div class="b3-label__text">${siyuanI18n.fileTree4}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="removeDocWithoutConfirm" type="checkbox"${getSiyuanConfig().fileTree.removeDocWithoutConfirm ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.fileTree20}
        <div class="b3-label__text">${siyuanI18n.fileTree21}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="useSingleLineSave" type="checkbox"${getSiyuanConfig().fileTree.useSingleLineSave ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.fileTree24}
        <div class="b3-label__text">${siyuanI18n.fileTree25}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="createDocAtTop" type="checkbox"${getSiyuanConfig().fileTree.createDocAtTop ? " checked" : ""}/>
</label>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.fileTree22}
        <div class="b3-label__text">${siyuanI18n.fileTree23}</div>
    </div>
    <span class="fn__space"></span>
    <div class="fn__size200 fn__flex-center fn__flex">
        <input class="b3-text-field fn__flex-1" id="largeFileWarningSize" type="number" min="2" max="10240" value="${getSiyuanConfig().fileTree.largeFileWarningSize}">
        <span class="fn__space"></span>
        <span class="ft__on-surface fn__flex-center">MB</span>
    </div>
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.fileTree16}
        <div class="b3-label__text">${siyuanI18n.fileTree17}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="maxListCount" type="number" min="1" max="10240" value="${getSiyuanConfig().fileTree.maxListCount}">
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.tabLimit}
        <div class="b3-label__text">${siyuanI18n.tabLimit1}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="maxOpenTabCount" type="number" min="1" max="32" value="${getSiyuanConfig().fileTree.maxOpenTabCount}">
</div>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${window.siyuan.languages.recentDocsMaxListCount}
        <div class="b3-label__text">${window.siyuan.languages.recentDocsMaxListCountTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="recentDocsMaxListCount" type="number" min="32" max="256" value="${window.siyuan.config.fileTree.recentDocsMaxListCount}">
</div>
<div class="b3-label config__item">
    ${siyuanI18n.fileTree12}
    <div class="b3-label__text">${siyuanI18n.fileTree13}</div>
    <span class="fn__hr"></span>
    <div class="fn__flex">
        <select style="min-width: 200px" class="b3-select" id="docCreateSaveBox">${genNotebookOption(getSiyuanConfig().fileTree.docCreateSaveBox)}</select>
        <div class="fn__space"></div>
        <input class="b3-text-field fn__flex-1" id="docCreateSavePath" value="">
    </div>
</div>
<div class="b3-label config__item">
    ${siyuanI18n.fileTree5}
    <div class="b3-label__text">${siyuanI18n.fileTree6}</div>
    <span class="fn__hr"></span>
    <div class="fn__flex">
        <select style="min-width: 200px" class="b3-select" id="refCreateSaveBox">${genNotebookOption(getSiyuanConfig().fileTree.refCreateSaveBox)}</select>
        <div class="fn__space"></div>
        <input class="b3-text-field fn__flex-1" id="refCreateSavePath" value="${getSiyuanConfig().fileTree.refCreateSavePath}">
    </div>
</div>`;
    },
    _send(element: HTMLElement) {
        // 限制页签最大打开数量为 `32` https://github.com/siyuan-note/siyuan/issues/6303
        let inputMaxOpenTabCount = parseInt((element.querySelector("#maxOpenTabCount") as HTMLInputElement).value);
        if (32 < inputMaxOpenTabCount) {
            inputMaxOpenTabCount = 32;
            (element.querySelector("#maxOpenTabCount") as HTMLInputElement).value = "32";
        }
        if (1 > inputMaxOpenTabCount) {
            inputMaxOpenTabCount = 1;
            (element.querySelector("#maxOpenTabCount") as HTMLInputElement).value = "1";
        }

        fetchPost("/api/setting/setFiletree", {
            sort: getSiyuanConfig().fileTree.sort,
            alwaysSelectOpenedFile: (element.querySelector("#alwaysSelectOpenedFile") as HTMLInputElement).checked,
            refCreateSavePath: (element.querySelector("#refCreateSavePath") as HTMLInputElement).value,
            refCreateSaveBox: (element.querySelector("#refCreateSaveBox") as HTMLInputElement).value,
            docCreateSavePath: (element.querySelector("#docCreateSavePath") as HTMLInputElement).value,
            docCreateSaveBox: (element.querySelector("#docCreateSaveBox") as HTMLInputElement).value,
            openFilesUseCurrentTab: (element.querySelector("#openFilesUseCurrentTab") as HTMLInputElement).checked,
            closeTabsOnStart: (element.querySelector("#closeTabsOnStart") as HTMLInputElement).checked,
            noSplitScreenWhenOpenTab: (element.querySelector("#noSplitScreenWhenOpenTab") as HTMLInputElement).checked, // S-forge: 采纳远程新增字段，保留本地element参数风格
            allowCreateDeeper: (element.querySelector("#allowCreateDeeper") as HTMLInputElement).checked,
            removeDocWithoutConfirm: (element.querySelector("#removeDocWithoutConfirm") as HTMLInputElement).checked,
            useSingleLineSave: (element.querySelector("#useSingleLineSave") as HTMLInputElement).checked,
            createDocAtTop: (element.querySelector("#createDocAtTop") as HTMLInputElement).checked,
            largeFileWarningSize: parseInt((element.querySelector("#largeFileWarningSize") as HTMLInputElement).value),
            maxListCount: parseInt((element.querySelector("#maxListCount") as HTMLInputElement).value),
            maxOpenTabCount: inputMaxOpenTabCount,
            recentDocsMaxListCount: parseInt((element.querySelector("#recentDocsMaxListCount") as HTMLInputElement).value),
        }, response => {
            getSiyuanConfig().fileTree = response.data;
        });
    },
    bindEvent: (element: HTMLElement) => {
        (element.querySelector("#docCreateSavePath") as HTMLInputElement).value = getSiyuanConfig().fileTree.docCreateSavePath;
        (element.querySelector("#refCreateSavePath") as HTMLInputElement).value = getSiyuanConfig().fileTree.refCreateSavePath;
        element.querySelectorAll("input, select").forEach((item) => {
            item.addEventListener("change", () => {
                fileTree._send(element);
            });
        });
        element.querySelectorAll("button").forEach((item) => {
            item.addEventListener("click", async () => {
                // 直接使用新的 Tab 类型，无需通过伪造 Plugin
                await openFile({
                    app: window.siyuan.ws.app,
                    custom: {
                        title: siyuanI18n.fileTree,
                        icon: "#iconFiles",
                        id: INTERNAL_FILETREE_TAB_TYPE
                    }
                });
            });
        });
    }
};
