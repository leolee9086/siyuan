/** 用途：声明式 provider 连接对话框；使用范围：文件树 provider 根。 */
import {Dialog} from "../../dialog";
import {escapeAttr, escapeHtml} from "../../util/DOM/escape";
import {
    buildFileBrowserProviderSessionRequest,
    createFileBrowserProviderSessionFormValues,
    fileBrowserProviderFieldIdentity,
} from "./FileBrowser.provider.config";
import type {
    FileBrowserProviderDescriptor,
    FileBrowserProviderSessionField,
    FileBrowserProviderSessionOpenRequest,
} from "./FileBrowser.types";

export interface FileBrowserProviderConnectionRequest {
    request: FileBrowserProviderSessionOpenRequest;
    label: string;
}

function fieldInput(field: FileBrowserProviderSessionField, value: string | boolean) {
    const identity = fileBrowserProviderFieldIdentity(field);
    if (field.input === "checkbox") {
        return `<label class="b3-label fn__flex">
    <input type="checkbox" class="b3-switch fn__flex-center" data-provider-field="${escapeAttr(identity)}"${value ? " checked" : ""} />
    <span class="fn__space"></span><span class="b3-label__text">${escapeHtml(field.label)}</span>
</label>`;
    }
    const required = field.required ? " *" : "";
    return `<label class="b3-label">
    <div class="b3-label__text">${escapeHtml(field.label + required)}</div>
    <input class="b3-text-field fn__block" type="${escapeAttr(field.input)}"
        data-provider-field="${escapeAttr(identity)}" value="${escapeAttr(String(value))}"
        placeholder="${escapeAttr(field.placeholder ?? "")}" autocomplete="${escapeAttr(field.autocomplete ?? "off")}" />
</label>`;
}

function readFieldValue(dialog: Dialog, field: FileBrowserProviderSessionField) {
    const selector = `[data-provider-field="${CSS.escape(fileBrowserProviderFieldIdentity(field))}"]`;
    const input = dialog.element.querySelector<HTMLInputElement>(selector);
    if (!input) {
        throw new Error(`连接表单缺少字段：${field.label}`);
    }
    return field.input === "checkbox" ? input.checked : input.value;
}

/** 连接失败时保留表单和凭据输入，成功建立 session 后才销毁对话框。 */
export function requestFileBrowserProviderConnection(
    descriptor: FileBrowserProviderDescriptor,
    connect: (value: FileBrowserProviderConnectionRequest) => Promise<void>,
): Promise<boolean> {
    return new Promise(resolve => {
        const config = descriptor.sessionConfig;
        if (descriptor.sessionMode !== "configured" || !config) {
            resolve(false);
            return;
        }
        const initial = createFileBrowserProviderSessionFormValues(descriptor);
        let settled = false;
        let connecting = false;
        const settle = (value: boolean) => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };
        const fields = config.fields.map(field =>
            fieldInput(field, initial[fileBrowserProviderFieldIdentity(field)] ?? "")).join("");
        const dialog = new Dialog({
            title: `连接 ${descriptor.displayName}`,
            width: "580px",
            content: `<div class="b3-dialog__content">${fields}
    <label class="b3-label fn__none" data-provider-http-warning>
        <div class="b3-label__text ft__error">未加密 HTTP 会暴露本次连接的密码、密钥和传输内容，仅允许明确确认的私网地址。</div>
        <label class="fn__flex">
            <input type="checkbox" class="b3-switch fn__flex-center" data-provider-insecure-confirm />
            <span class="fn__space"></span><span>我确认仅在当前 session 使用该私网 HTTP 端点</span>
        </label>
    </label>
    ${config.readOnly ? `<label class="b3-label fn__flex">
        <input type="checkbox" class="b3-switch fn__flex-center" data-provider-read-only />
        <span class="fn__space"></span><span class="b3-label__text">以只读模式连接</span>
    </label>` : ""}
    <div class="ft__error fn__none" data-provider-connect-error role="alert"></div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" data-provider-action="cancel">取消</button>
    <div class="fn__space"></div>
    <button class="b3-button b3-button--text" data-provider-action="connect">连接</button>
</div>`,
            destroyCallback: () => settle(false),
        });
        const cancel = dialog.element.querySelector<HTMLButtonElement>("[data-provider-action='cancel']");
        const submit = dialog.element.querySelector<HTMLButtonElement>("[data-provider-action='connect']");
        const warning = dialog.element.querySelector<HTMLElement>("[data-provider-http-warning]");
        const insecure = dialog.element.querySelector<HTMLInputElement>("[data-provider-insecure-confirm]");
        const readOnly = dialog.element.querySelector<HTMLInputElement>("[data-provider-read-only]");
        const errorElement = dialog.element.querySelector<HTMLElement>("[data-provider-connect-error]");
        const endpointField = config.fields.find(field => field.target === "endpoint");
        const endpointInput = endpointField ? dialog.element.querySelector<HTMLInputElement>(
            `[data-provider-field="${CSS.escape(fileBrowserProviderFieldIdentity(endpointField))}"]`,
        ) : null;
        if (!cancel || !submit || !warning || !insecure || !errorElement || !endpointInput) {
            dialog.destroy();
            return;
        }
        const updateTransportWarning = () => {
            let visible = false;
            try {
                visible = new URL(endpointInput.value.trim()).protocol === "http:";
            } catch {
                visible = false;
            }
            warning.classList.toggle("fn__none", !visible);
            if (!visible) {
                insecure.checked = false;
            }
        };
        const setBusy = (busy: boolean) => {
            connecting = busy;
            submit.disabled = busy;
            cancel.disabled = busy;
            for (const input of dialog.element.querySelectorAll<HTMLInputElement>("input")) {
                input.disabled = busy;
            }
            submit.textContent = busy ? "正在连接" : "连接";
        };
        const showError = (error: unknown) => {
            errorElement.textContent = error instanceof Error ? error.message : String(error);
            errorElement.classList.remove("fn__none");
        };
        const finish = async () => {
            if (connecting) {
                return;
            }
            errorElement.classList.add("fn__none");
            try {
                const values = createFileBrowserProviderSessionFormValues(descriptor);
                for (const field of config.fields) {
                    values[fileBrowserProviderFieldIdentity(field)] = readFieldValue(dialog, field);
                }
                const value = buildFileBrowserProviderSessionRequest(
                    descriptor, values, readOnly?.checked === true, insecure.checked,
                );
                setBusy(true);
                await connect(value);
                dialog.destroy();
                settle(true);
            } catch (error) {
                setBusy(false);
                showError(error);
            }
        };
        endpointInput.addEventListener("input", updateTransportWarning);
        cancel.addEventListener("click", () => {
            if (!connecting) {
                dialog.destroy();
                settle(false);
            }
        });
        submit.addEventListener("click", () => void finish());
        dialog.bindInput(endpointInput, () => void finish());
        updateTransportWarning();
        endpointInput.focus();
    });
}
