/** 用途：读取创建协议常量；使用范围：普通笔记本对话框；解耦评估：经本域网关直达协议声明。 */
import {Constants} from "./imports";
/** 用途：实例化标准对话框；使用范围：普通笔记本创建组合边界；解耦评估：具体类仅停留在工厂。 */
import {Dialog} from "./imports";
/** 用途：发送创建和导入请求；使用范围：普通笔记本创建动作；解耦评估：经本域网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：读取宿主 homeDir；使用范围：Obsidian 目录选择；解耦评估：经本域网关直达严格环境入口。 */
import {getSiyuanConfig} from "./imports";
/** 用途：读取真实语言表新增文案；使用范围：导入选项标题；解耦评估：经本域网关直达严格环境入口。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：执行 Vault 导入；使用范围：Electron Obsidian 入口；解耦评估：经本域网关直达唯一导入流程。 */
import {importObsidianVault} from "./imports";
/** 用途：打开原生目录选择器；使用范围：Electron Obsidian 入口；解耦评估：经本域网关直达 IPC。 */
import {ipcInvoke} from "./imports";
/** 用途：判定 Electron 宿主；使用范围：控制 Obsidian 入口；解耦评估：经本域网关直达平台状态。 */
import {isElectron} from "./imports";
/** 用途：判定移动布局；使用范围：对话框尺寸；解耦评估：经本域网关直达平台环境。 */
import {isMobile} from "./imports";
/** 用途：规范笔记本名称；使用范围：普通创建提交；解耦评估：经本域网关直达名称规则。 */
import {replaceFileName} from "./imports";
/** 用途：读取创建文案；使用范围：普通创建对话框；解耦评估：经本域网关直达国际化环境。 */
import {siyuanI18n} from "./imports";
/** 用途：校验笔记本名称；使用范围：普通创建提交；解耦评估：经本域网关直达名称规则。 */
import {validateName} from "./imports";
/** 用途：描述完整 Dialog；使用范围：内部事件与注册状态；解耦评估：依赖完整抽象而非具体类。 */
import type {IDialog} from "./imports";

/**
 * 作用：严格获取创建对话框必需控件。
 * 意图：DOM 模板与事件绑定不一致时立即销毁并显式失败，避免半初始化实例。
 * 调用时机：各创建子流程绑定事件前调用。
 */
const requireDialogElement = <TElement extends Element>(dialog: IDialog, selector: string) => {
    const element = dialog.element.querySelector<TElement>(selector);
    if (!element) {
        dialog.destroy();
        throw new Error(`Notebook creation dialog is missing required control: ${selector}`);
    }
    return element;
};

/** 提交经过名称规则校验的普通笔记本创建请求。 */
const submitNotebookCreation = (dialog: IDialog, nameElement: HTMLInputElement) => {
    let name = nameElement.value;
    if (!validateName(name)) {
        return false;
    }
    name = replaceFileName(name);
    fetchPost("/api/notebook/createNotebook", {name});
    dialog.destroy();
};

/**
 * 作用：绑定名称提交、回车确认与取消动作。
 * 意图：集中维护普通笔记本创建请求及名称规则。
 * 调用时机：创建对话框 DOM 完成后调用。
 */
const bindCreateAction = (dialog: IDialog) => {
    const cancelElement = requireDialogElement<HTMLElement>(dialog, '[data-type="cancel"]');
    const confirmElement = requireDialogElement<HTMLElement>(dialog, '[data-type="confirm"]');
    const nameElement = requireDialogElement<HTMLInputElement>(dialog, "input");
    dialog.bindInput(nameElement, () => confirmElement.dispatchEvent(new CustomEvent("click")));
    cancelElement.addEventListener("click", () => dialog.destroy());
    confirmElement.addEventListener("click", () => submitNotebookCreation(dialog, nameElement));
};

/** 切换导入选项，并同步无障碍展开状态与箭头。 */
const toggleImportOptions = (toggleElement: HTMLElement, optionsElement: HTMLElement, arrowElement: SVGElement) => {
    const expanded = optionsElement.classList.toggle("fn__none") === false;
    toggleElement.setAttribute("aria-expanded", expanded.toString());
    arrowElement.classList.toggle("b3-list-item__arrow--open", expanded);
};

/** 将 Enter 与空格键转换为同一元素的标准点击激活。 */
const activateElementByKeyboard = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") {
        return;
    }
    if (!(event.currentTarget instanceof HTMLElement)) {
        throw new Error("Notebook creation keyboard event has no HTMLElement target");
    }
    event.preventDefault();
    event.currentTarget.click();
};

/** 上传用户选择的 SiYuan 笔记本压缩包并关闭创建对话框。 */
const importSiYuanNotebook = (dialog: IDialog, importInput: HTMLInputElement) => {
    const file = importInput.files?.[0];
    if (!file) {
        return;
    }
    const formData = new FormData();
    formData.append("file", file);
    dialog.destroy();
    fetchPost("/api/import/importSYNotebook", formData);
};

/**
 * 作用：绑定导入选项折叠与 SiYuan 压缩包上传。
 * 意图：将导入交互与普通名称创建分离，同时共享同一对话框生命周期。
 * 调用时机：创建对话框 DOM 完成后调用。
 */
const bindImportOptions = (dialog: IDialog) => {
    const toggleElement = requireDialogElement<HTMLElement>(dialog, '[data-type="toggle-import"]');
    const optionsElement = requireDialogElement<HTMLElement>(dialog, '[data-type="import-options"]');
    const arrowElement = requireDialogElement<SVGElement>(dialog, '[data-type="import-arrow"]');
    toggleElement.addEventListener("click", () => toggleImportOptions(toggleElement, optionsElement, arrowElement));
    toggleElement.addEventListener("keydown", activateElementByKeyboard);
    const importInput = requireDialogElement<HTMLInputElement>(dialog, '[data-type="import-sy"] .b3-form__upload');
    importInput.addEventListener("change", () => importSiYuanNotebook(dialog, importInput));
};

/** 打开单例目录选择器，并将有效 Vault 路径交给唯一导入流程。 */
const selectObsidianVault = async (dialog: IDialog) => {
    if (dialog.element.hasAttribute("data-selecting-obsidian-vault")) {
        return;
    }
    dialog.element.setAttribute("data-selecting-obsidian-vault", "true");
    try {
        const localPath = await ipcInvoke<{filePaths: string[]}>(Constants.SIYUAN_GET, {
            cmd: "showOpenDialog",
            singleton: "obsidianVault",
            defaultPath: getSiyuanConfig().system.homeDir,
            properties: ["openDirectory"],
        });
        if (localPath.filePaths.length === 0) {
            return;
        }
        dialog.destroy();
        const vaultPath = localPath.filePaths[0];
        if (vaultPath === undefined) {
            throw new Error("Obsidian directory selection returned no path");
        }
        await importObsidianVault(vaultPath);
    } finally {
        dialog.element.removeAttribute("data-selecting-obsidian-vault");
    }
};

/**
 * 作用：绑定 Electron 原生目录选择和 Obsidian Vault 导入。
 * 意图：把宿主专属流程隔离在平台门禁之后，并阻止重复目录选择。
 * 调用时机：仅 Electron 创建对话框完成后调用。
 */
const bindObsidianImport = (dialog: IDialog) => {
    const importElement = requireDialogElement<HTMLElement>(dialog, '[data-type="import-obsidian"]');
    importElement.addEventListener("click", () => void selectObsidianVault(dialog));
    importElement.addEventListener("keydown", activateElementByKeyboard);
};

/** @同步豁免: UI构建 */
export const newNotebook = () => {
    const languages = getSiyuanLanguages();
    const importObsidianHTML = isElectron
        ? '<div class="b3-list-item fn__pointer" data-type="import-obsidian" role="button" tabindex="0"><svg class="b3-list-item__graphic"><use xlink:href="#iconObsidian"></use></svg><span class="b3-list-item__text">Obsidian Vault</span></div>'
        : "";
    const dialog = new Dialog({
        title: siyuanI18n.newNotebook,
        content: `<div class="b3-dialog__content">
    <input placeholder="${siyuanI18n.notebookName}" class="b3-text-field fn__block">
    <div class="fn__hr"></div>
    <div class="b3-label__text fn__pointer fn__flex" style="align-items: center;gap: 4px" data-type="toggle-import" role="button" tabindex="0" aria-expanded="false"><svg class="b3-list-item__arrow" style="display: block;flex: none;height: 14px;width: 14px" data-type="import-arrow"><use xlink:href="#iconRight"></use></svg><span style="line-height: 20px">${languages.importFromMoreApps}</span></div>
    <div class="b3-list--background fn__none" data-type="import-options" style="padding-top: 8px">
        <label class="b3-list-item fn__pointer" data-type="import-sy"><svg class="b3-list-item__graphic"><use xlink:href="#iconSiYuan"></use></svg><span class="b3-list-item__text">SiYuan .sy.zip</span><input class="b3-form__upload" type="file" accept="application/zip"></label>
        ${importObsidianHTML}
    </div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" data-type="cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text" data-type="confirm">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_CREATENOTEBOOK);
    bindCreateAction(dialog);
    bindImportOptions(dialog);
    if (isElectron) {
        bindObsidianImport(dialog);
    }
};
