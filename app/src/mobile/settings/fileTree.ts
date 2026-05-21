import { openModel } from "../menu/model";
import { fetchPost } from "../../util/network/fetch";
import { genNotebookOption } from "../../menus/onGetnotebookconf";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { SiYuanI18n } from "../../types/i18n.types";
const generateCheckboxHTML = (id: string, i18nKey: keyof SiYuanI18n, i18nTextKey: keyof SiYuanI18n, checked: boolean) => {
    return `<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n[i18nKey]}
        <div class="b3-label__text">${siyuanI18n[i18nTextKey]}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="${id}" type="checkbox"${checked ? " checked" : ""}/>
</label>`;
};

const generateNumberInputHTML = (id: string, i18nKey: keyof SiYuanI18n, i18nTextKey: keyof SiYuanI18n, value: number, min: number, max: number, suffix?: string) => {
    const suffixHTML = suffix ? `
        <span class="fn__space"></span>
        <span class="ft__on-surface fn__flex-center">${suffix}</span>` : "";

    return `<div class="b3-label">
    ${siyuanI18n[i18nKey]}
    <span class="fn__hr"></span>
    <div class="fn__flex">
        <input class="b3-text-field fn__flex-1" id="${id}" type="number" min="${min}" max="${max}" value="${value}">
        ${suffixHTML}
    </div>
    <div class="b3-label__text">${siyuanI18n[i18nTextKey]}</div>
</div>`;
};

const generateBlockNumberInputHTML = (id: string, i18nKey: keyof SiYuanI18n, i18nTextKey: keyof SiYuanI18n, value: number, min: number, max: number) => {
    return `<div class="b3-label">
    ${siyuanI18n[i18nKey]}
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="${id}" type="number" min="${min}" max="${max}" value="${value}">
    <div class="b3-label__text">${siyuanI18n[i18nTextKey]}</div>
</div>`;
};

const generateSavePathHTML = (id: string, i18nKey: keyof SiYuanI18n, i18nTextKey: keyof SiYuanI18n, boxId: string, boxValue: string, pathValue: string) => {
    return `<div class="b3-label">
    ${siyuanI18n[i18nKey]}

    <span class="fn__hr"></span>
    <select class="b3-select fn__block" id="${boxId}">${genNotebookOption(boxValue)}</select>
    <span class="fn__hr"></span>
    <input class="b3-text-field fn__block" id="${id}" value="${pathValue}">
    <div class="b3-label__text">${siyuanI18n[i18nTextKey]}</div>
</div>`;
};

const generateFileTreeHTML = (config: Config.IFileTree) => {
    return generateCheckboxHTML("allowCreateDeeper", "fileTree18", "fileTree19", config.allowCreateDeeper) +
        generateCheckboxHTML("removeDocWithoutConfirm", "fileTree3", "fileTree4", config.removeDocWithoutConfirm) +
        generateCheckboxHTML("useSingleLineSave", "fileTree20", "fileTree21", config.useSingleLineSave) +
        generateCheckboxHTML("createDocAtTop", "fileTree24", "fileTree25", config.createDocAtTop) +
        generateNumberInputHTML("largeFileWarningSize", "fileTree22", "fileTree23", config.largeFileWarningSize, 2, 10240, "MB") +
        generateBlockNumberInputHTML("maxListCount", "fileTree16", "fileTree17", config.maxListCount, 1, 10240) +
        generateBlockNumberInputHTML("recentDocsMaxListCount", "recentDocsMaxListCount", "recentDocsMaxListCountTip", config.recentDocsMaxListCount, 32, 256) +
        generateSavePathHTML("docCreateSavePath", "fileTree12", "fileTree13", "docCreateSaveBox", config.docCreateSaveBox, "") +
        generateSavePathHTML("refCreateSavePath", "fileTree5", "fileTree6", "refCreateSaveBox", config.refCreateSaveBox, config.refCreateSavePath) +
        generateSavePathHTML("shorthandSavePath", "fileTree26", "fileTree27", "shorthandSaveBox", config.shorthandSaveBox, "");
};

const handleInputChange = (modelMainElement: HTMLElement, config: Config.IFileTree) => {
    const docCreateSavePathElement = modelMainElement.querySelector("#docCreateSavePath") as HTMLInputElement;
    const refCreateSavePathElement = modelMainElement.querySelector("#refCreateSavePath") as HTMLInputElement;
    const refCreateSaveBoxElement = modelMainElement.querySelector("#refCreateSaveBox") as HTMLInputElement;
    const shorthandSavePathElement = modelMainElement.querySelector("#shorthandSavePath") as HTMLInputElement;
    const shorthandSaveBoxElement = modelMainElement.querySelector("#shorthandSaveBox") as HTMLInputElement;
    const docCreateSaveBoxElement = modelMainElement.querySelector("#docCreateSaveBox") as HTMLInputElement;
    const allowCreateDeeperElement = modelMainElement.querySelector("#allowCreateDeeper") as HTMLInputElement;
    const removeDocWithoutConfirmElement = modelMainElement.querySelector("#removeDocWithoutConfirm") as HTMLInputElement;
    const useSingleLineSaveElement = modelMainElement.querySelector("#useSingleLineSave") as HTMLInputElement;
    const createDocAtTopElement = modelMainElement.querySelector("#createDocAtTop") as HTMLInputElement;
    const largeFileWarningSizeElement = modelMainElement.querySelector("#largeFileWarningSize") as HTMLInputElement;
    const maxListCountElement = modelMainElement.querySelector("#maxListCount") as HTMLInputElement;
    const recentDocsMaxListCountElement = modelMainElement.querySelector("#recentDocsMaxListCount") as HTMLInputElement;

    fetchPost("/api/setting/setFiletree", {
        sort: config.sort,
        alwaysSelectOpenedFile: config.alwaysSelectOpenedFile,
        refCreateSavePath: refCreateSavePathElement.value,
        refCreateSaveBox: refCreateSaveBoxElement.value,
        shorthandSavePath: shorthandSavePathElement.value,
        shorthandSaveBox: shorthandSaveBoxElement.value,
        docCreateSavePath: docCreateSavePathElement.value,
        docCreateSaveBox: docCreateSaveBoxElement.value,
        openFilesUseCurrentTab: config.openFilesUseCurrentTab,
        closeTabsOnStart: config.closeTabsOnStart,
        allowCreateDeeper: allowCreateDeeperElement.checked,
        removeDocWithoutConfirm: removeDocWithoutConfirmElement.checked,
        useSingleLineSave: useSingleLineSaveElement.checked,
        createDocAtTop: createDocAtTopElement.checked,
        largeFileWarningSize: parseInt(largeFileWarningSizeElement.value),
        maxListCount: parseInt(maxListCountElement.value),
        recentDocsMaxListCount: parseInt(recentDocsMaxListCountElement.value),
        maxOpenTabCount: config.maxOpenTabCount,
    }, response => {
        const config = getSiyuanConfig();
        config.fileTree = response.data;
    });
};

const bindFileTreeEvents = (modelMainElement: HTMLElement, config: Config.IFileTree) => {
    const docCreateSavePathElement = modelMainElement.querySelector("#docCreateSavePath") as HTMLInputElement;
    const refCreateSavePathElement = modelMainElement.querySelector("#refCreateSavePath") as HTMLInputElement;
    const shorthandSavePathElement = modelMainElement.querySelector("#shorthandSavePath") as HTMLInputElement;

    docCreateSavePathElement.value = config.docCreateSavePath;
    refCreateSavePathElement.value = config.refCreateSavePath;
    shorthandSavePathElement.value = config.shorthandSavePath;

    const inputElements = modelMainElement.querySelectorAll("input, select");
    for (const item of inputElements) {
        item.addEventListener("change", () => {
            handleInputChange(modelMainElement, config);
        });
    }
};

export const initFileTree = () => {
    const config = getSiyuanConfig().fileTree;

    openModel({
        title: siyuanI18n.fileTree,
        icon: "iconFiles",
        html: generateFileTreeHTML(config),
        bindEvent(modelMainElement: HTMLElement) {
            bindFileTreeEvents(modelMainElement, config);
        }
    });
};
