/** 用途：复用应用标准 Dialog；使用范围：文件树写操作的输入边界。 */
import {Dialog} from "../../dialog";
import {confirmDialog} from "../../dialog/confirmDialog";
/** 用途：防止路径和根名称进入 innerHTML；使用范围：操作对话框文案。 */
import {escapeAttr, escapeHtml} from "../../util/DOM/escape";
import type {FileBrowserRoot} from "./FileBrowser.types";

export interface FileBrowserCopyDestination {
    rootID: string;
    path: string;
}

interface TextDialogOptions {
    title: string;
    label: string;
    value?: string;
    placeholder?: string;
}

/** 使用应用统一的破坏性确认框，并把取消/关闭转换为明确的 false。 */
export function requestFileBrowserConfirmation(title: string, text: string): Promise<boolean> {
    return new Promise(resolve => {
        let settled = false;
        const settle = (value: boolean) => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };
        confirmDialog(title, text, () => settle(true), () => settle(false), true);
    });
}

function resolveDialogInput(dialog: Dialog, selector: string) {
    return dialog.element.querySelector<HTMLInputElement>(selector);
}

/** 打开一个可取消的文本输入框；关闭按钮、Escape 和取消按钮都返回 undefined。 */
export function requestFileBrowserText(options: TextDialogOptions): Promise<string | undefined> {
    return new Promise(resolve => {
        let settled = false;
        let dialog: Dialog;
        const settle = (value: string | undefined) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(value);
        };
        dialog = new Dialog({
            title: options.title,
            width: "520px",
            content: `<div class="b3-dialog__content">
    <label class="b3-label">
        <div class="b3-label__text">${escapeHtml(options.label)}</div>
        <input class="b3-text-field fn__block" data-sforge-operation-input="text"
            value="${escapeAttr(options.value ?? "")}" placeholder="${escapeAttr(options.placeholder ?? "")}" />
    </label>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" data-sforge-operation-action="cancel">取消</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" data-sforge-operation-action="confirm">确定</button>
</div>`,
            destroyCallback: () => settle(undefined),
        });
        const input = resolveDialogInput(dialog, "[data-sforge-operation-input='text']");
        const cancel = dialog.element.querySelector<HTMLButtonElement>("[data-sforge-operation-action='cancel']");
        const confirm = dialog.element.querySelector<HTMLButtonElement>("[data-sforge-operation-action='confirm']");
        if (!input || !cancel || !confirm) {
            dialog.destroy();
            return;
        }
        const finish = () => {
            const value = input.value.trim();
            dialog.destroy();
            settle(value || undefined);
        };
        dialog.bindInput(input, finish);
        input.value = options.value ?? "";
        input.placeholder = options.placeholder ?? "";
        input.select();
        cancel.addEventListener("click", () => {
            dialog.destroy();
            settle(undefined);
        });
        confirm.addEventListener("click", finish);
    });
}

/** 选择目标授权根和完整根内目标路径，保留跨根复制的明确边界。 */
export function requestFileBrowserCopyDestination(
    roots: readonly FileBrowserRoot[],
    defaultRootID: string,
    defaultPath: string,
): Promise<FileBrowserCopyDestination | undefined> {
    const writableRoots = roots.filter(root => root.exists && root.capabilities.browse && root.capabilities.write);
    if (writableRoots.length === 0) {
        return Promise.resolve(undefined);
    }
    const initialRootID = writableRoots.some(root => root.id === defaultRootID) ? defaultRootID : writableRoots[0]!.id;
    return new Promise(resolve => {
        let settled = false;
        let dialog: Dialog;
        const settle = (value: FileBrowserCopyDestination | undefined) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(value);
        };
        const rootOptions = writableRoots.map(root =>
            `<option value="${escapeAttr(root.id)}"${root.id === initialRootID ? " selected" : ""}>` +
            `${escapeHtml(root.label)} · ${escapeHtml(root.path)}</option>`,
        ).join("");
        dialog = new Dialog({
            title: "复制到",
            width: "620px",
            content: `<div class="b3-dialog__content">
    <label class="b3-label">
        <div class="b3-label__text">目标文件根</div>
        <select class="b3-select fn__block" data-sforge-operation-input="root">${rootOptions}</select>
    </label>
    <label class="b3-label">
        <div class="b3-label__text">目标根内路径（包含文件名）</div>
        <input class="b3-text-field fn__block" data-sforge-operation-input="path"
            value="${escapeAttr(defaultPath)}" placeholder="例如：assets/copy.png" />
    </label>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" data-sforge-operation-action="cancel">取消</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" data-sforge-operation-action="confirm">确定</button>
</div>`,
            destroyCallback: () => settle(undefined),
        });
        const rootInput = dialog.element.querySelector<HTMLSelectElement>("[data-sforge-operation-input='root']");
        const pathInput = resolveDialogInput(dialog, "[data-sforge-operation-input='path']");
        const cancel = dialog.element.querySelector<HTMLButtonElement>("[data-sforge-operation-action='cancel']");
        const confirm = dialog.element.querySelector<HTMLButtonElement>("[data-sforge-operation-action='confirm']");
        if (!rootInput || !pathInput || !cancel || !confirm) {
            dialog.destroy();
            return;
        }
        const finish = () => {
            const rootID = rootInput.value.trim();
            const path = pathInput.value.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
            dialog.destroy();
            settle(rootID && path ? {rootID, path} : undefined);
        };
        dialog.bindInput(pathInput, finish);
        pathInput.select();
        cancel.addEventListener("click", () => {
            dialog.destroy();
            settle(undefined);
        });
        confirm.addEventListener("click", finish);
    });
}
