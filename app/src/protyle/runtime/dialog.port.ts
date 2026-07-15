import {getSForgeState, setSForgeState} from "../../config/sforge.global";
import {SForgeSymbols} from "../../config/sforge.symbols";
import type {IProtyleDialog, IProtyleDialogOptions, IProtyleDialogPort, TProtyleMessageId} from "./dialog.types";

/** 导出 Dialog Port 的公共类型，供独立入口和完整 App 适配器共享。 */
export type {IProtyleDialog, IProtyleDialogOptions, IProtyleDialogPort, TProtyleMessageId};

/** 为独立回退弹窗和消息生成页面内唯一标识。 */
const createId = () => `protyle-dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** 将事件目标限制为 HTMLElement，避免 Port 假设宿主事件目标结构。 */
const getHTMLElementTarget = (target: EventTarget | null) => target instanceof HTMLElement ? target : null;

/** 移除回退弹窗并保存宿主传入的销毁数据。 */
const removeDialog = (dialog: IProtyleDialog, options?: IObject) => {
    dialog.element.remove();
    dialog.data = options || dialog.data;
};

/** 独立回退 Dialog 的最小 DOM 壳，供生命周期方法共享。 */
interface IFallbackDialogShell {
    element: HTMLElement;
    container: HTMLElement;
    content: HTMLElement;
    close: HTMLButtonElement;
}

/** 创建不依赖思源全局容器的 Dialog DOM 壳。 */
const createFallbackDialogShell = (options: IProtyleDialogOptions, id: string) => {
    const element = document.createElement("div");
    const container = document.createElement("div");
    const content = document.createElement("div");
    const close = document.createElement("button");

    element.className = "b3-dialog b3-dialog--open";
    element.setAttribute("data-id", id);
    if (options.containerClassName) {
        element.classList.add(options.containerClassName);
    }
    container.className = "b3-dialog__container";
    if (options.width) {
        container.style.width = options.width;
    }
    if (options.height) {
        container.style.height = options.height;
    }
    const header = options.title ? `<div class="b3-dialog__header"><div class="b3-dialog__title">${options.title}</div></div>` : "";
    content.className = "b3-dialog__content";
    content.innerHTML = options.content;
    close.className = "b3-dialog__close fn__none";
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    container.innerHTML = header;
    container.appendChild(content);
    container.appendChild(close);
    element.appendChild(container);
    return {element, container, content, close};
};

/** 组装回退 Dialog 的生命周期 API，使调用方可继续使用原版结构。 */
/** @显式返回类型原因: 生命周期对象需要固定为 IProtyleDialog，供递归销毁回调引用。 */
const createFallbackDialogApi = (
    options: IProtyleDialogOptions,
    shell: IFallbackDialogShell,
    abortController: AbortController,
): IProtyleDialog => {
    let dialog: IProtyleDialog;
    dialog = {
        element: shell.element,
        id: shell.element.dataset.id || createId(),
        editors: {},
        data: options.data || {},
        /** 销毁回退 DOM 和关联事件。 */
        destroy(destroyOptions?: IObject) {
            abortController.abort();
            removeDialog(dialog, destroyOptions);
            options.destroyCallback?.(destroyOptions);
        },
        /** 切换回退弹窗的全屏样式标志。 */
        fullscreen() {
            shell.element.classList.toggle("b3-dialog--full-screen");
        },
        /** 转发宿主尺寸变化通知。 */
        resize() {
            options.resizeCallback?.("l");
        },
        /** 为输入控件提供回车和 Escape 的基础行为。 */
        bindInput(inputElement, enterEvent, bindEnter = true) {
            inputElement.focus();
            if (!bindEnter) {
                return;
            }
            inputElement.addEventListener("keydown", (event) => {
                // 回车确认仅在非 Shift 输入时触发，避免破坏多行文本输入。
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    enterEvent?.();
                }
                // Escape 只在宿主未禁用时关闭当前回退弹窗。
                if (event.key === "Escape" && !options.disableEscapeClose) {
                    dialog.destroy();
                }
            }, {signal: abortController.signal});
        },
        /** 使用 AbortSignal 管理弹窗内事件生命周期。 */
        /** @参数豁免: 生命周期 */
        listen(target, type, listener, listenerOptions) {
            const optionsWithSignal = typeof listenerOptions === "boolean"
                ? {capture: listenerOptions, signal: abortController.signal}
                : {...listenerOptions, signal: abortController.signal};
            target.addEventListener(type, listener, optionsWithSignal);
        },
    };
    return dialog;
};

/** 绑定遮罩和关闭按钮事件，保持回退 Dialog 的可关闭行为。 */
/** @参数豁免: 生命周期 */
const bindFallbackDialogEvents = (
    dialog: IProtyleDialog,
    options: IProtyleDialogOptions,
    shell: IFallbackDialogShell,
    abortController: AbortController,
) => {
    shell.close.addEventListener("click", () => dialog.destroy(), {signal: abortController.signal});

    if (!options.disableScrimClose) {
        shell.element.addEventListener("click", (event) => {
            // 只有点击遮罩本身且未禁用关闭时才销毁弹窗。
            if (event.target === shell.element && !options.disableClose) {
                dialog.destroy();
            }
        }, {signal: abortController.signal});
    }
};

/** 创建并挂载独立入口使用的回退 Dialog。 */
const createFallbackDialog = (options: IProtyleDialogOptions) => {
    const id = createId();
    const shell = createFallbackDialogShell(options, id);
    const abortController = new AbortController();
    const dialog = createFallbackDialogApi(options, shell, abortController);
    bindFallbackDialogEvents(dialog, options, shell, abortController);
    (document.body || document.documentElement).appendChild(shell.element);
    return dialog;
};

const fallbackMessages = new Map<string, HTMLElement>();
const fallbackPort: IProtyleDialogPort = {
    create: createFallbackDialog,
    /** 在独立 DOM 中呈现确认框，并统一处理确认/取消回调。 */
    /** @参数豁免: 生命周期 */
    confirm(title, text, confirm, cancel, isDelete = false) {
        // 空确认请求沿用原版行为，直接执行确认回调而不创建空白弹窗。
        if (!title && !text && confirm) {
            confirm();
            return;
        }
        const dialog = createFallbackDialog({
            title,
            content: `<div class="b3-dialog__content"><div class="ft__breakword">${text}</div></div>
                <div class="b3-dialog__action"><button class="b3-button b3-button--cancel" data-protyle-dialog-cancel>Cancel</button>
                <button class="b3-button ${isDelete ? "b3-button--remove" : "b3-button--text"}" data-protyle-dialog-confirm>Confirm</button></div>`,
        });
        dialog.element.addEventListener("click", (event) => {
            const target = getHTMLElementTarget(event.target);
            if (!target) {
                return;
            }
            // 命中确认按钮时先执行业务回调，再销毁弹窗实例。
            if (target.closest("[data-protyle-dialog-confirm]")) {
                confirm?.(dialog);
                dialog.destroy();
                return;
            }
            if (!target.closest("[data-protyle-dialog-cancel]")) {
                return;
            }
            cancel?.(dialog);
            dialog.destroy();
        });
    },
    /** 在独立 DOM 中呈现消息并返回可用于关闭的标识。 */
    /** @参数豁免: 第三方接口适配 */
    showMessage(message, timeout = 6000, type = "info", messageId) {
        if (!message) {
            return;
        }
        const id = messageId || createId();
        let element = fallbackMessages.get(id);
        if (!element) {
            element = document.createElement("div");
            element.className = `b3-snackbar b3-snackbar--${type}`;
            element.dataset.id = id;
            (document.body || document.documentElement).appendChild(element);
            fallbackMessages.set(id, element);
        }
        element.innerHTML = message;
        // 非负超时表示用户可见提示，负数用于上传/导出等持续任务。
        if (timeout >= 0) {
            // 此处需要真实用户感知延迟，使用调用方传入的消息超时值。
            window.setTimeout(() => fallbackPort.hideMessage(id), timeout);
        }
        return id;
    },
    /** 移除一个消息或清空独立回退消息容器。 */
    hideMessage(id) {
        if (!id) {
            for (const element of fallbackMessages.values()) {
                element.remove();
            }
            fallbackMessages.clear();
            return;
        }
        Promise.resolve(id).then(resolvedId => {
            if (resolvedId) {
                fallbackMessages.get(resolvedId)?.remove();
                fallbackMessages.delete(resolvedId);
            }
        });
    },
    /** 在目标元素下方显示独立 Tooltip。 */
    showTooltip(message, target) {
        if (!message || !target) {
            return;
        }
        const tooltip = document.getElementById("tooltip") || document.createElement("div");
        tooltip.id = "tooltip";
        tooltip.className = "tooltip";
        tooltip.innerHTML = message;
        const rect = target.getBoundingClientRect();
        tooltip.style.position = "fixed";
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 4}px`;
        (document.body || document.documentElement).appendChild(tooltip);
    },
    /** 隐藏独立 Tooltip。 */
    hideTooltip() {
        document.getElementById("tooltip")?.classList.add("fn__none");
    },
    /** 使用浏览器文件选择器提供独立资源选择回退。 */
    openAssetDialog(callback) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.addEventListener("change", () => {
            const file = input.files?.[0];
            if (file) {
                callback(URL.createObjectURL(file), file.name);
            }
        }, {once: true});
        input.click();
    },
};

/** 获取当前宿主注册的 Dialog Port；未注册时返回独立回退实现。 */
export const getProtyleDialogPort = () => getSForgeState(SForgeSymbols.DIALOG_PORT) || fallbackPort;

/** 注册宿主提供的 Dialog Port，供 Protyle 后续所有弹窗触发使用。 */
export const setProtyleDialogPort = (port: IProtyleDialogPort) => {
    setSForgeState(SForgeSymbols.DIALOG_PORT, port);
};

/** 测试或宿主销毁时清除注册，使下一次调用回退到独立实现。 */
export const resetProtyleDialogPort = () => {
    setSForgeState(SForgeSymbols.DIALOG_PORT, undefined);
};

/** 保持既有 `new Dialog(...)` 调用点的结构兼容，同时把实例创建委托给宿主。 */
export class Dialog implements IProtyleDialog {
    public element!: HTMLElement;
    public id!: string;
    public editors!: Record<string, IProtyle>;
    public data!: IObject;

    constructor(options: IProtyleDialogOptions) {
        return getProtyleDialogPort().create(options);
    }

    /** 宿主实例会覆盖该占位方法；保留空实现维持结构类型兼容。 */
    public destroy(options?: IObject) {
        void options;
    }
    /** 宿主实例会覆盖该占位方法；保留结构类型兼容。 */
    public fullscreen() {
        return;
    }
    /** 宿主实例会覆盖该占位方法；保留结构类型兼容。 */
    public resize() {
        return;
    }
    /** 宿主实例会覆盖该占位方法；保留结构类型兼容。 */
    public bindInput(inputElement: HTMLInputElement | HTMLTextAreaElement, enterEvent?: () => void, bindEnter?: boolean) {
        void inputElement;
        void enterEvent;
        void bindEnter;
    }
    /** 宿主实例会覆盖该占位方法；保留结构类型兼容。 */
    /** @参数豁免: 生命周期 */
    public listen(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) {
        void target;
        void type;
        void listener;
        void options;
    }
}

/** 通过当前宿主 Port 显示确认框。 */
export const confirmDialog = (...args: Parameters<IProtyleDialogPort["confirm"]>) => getProtyleDialogPort().confirm(...args);
/** 通过当前宿主 Port 显示消息。 */
export const showMessage = (...args: Parameters<IProtyleDialogPort["showMessage"]>) => getProtyleDialogPort().showMessage(...args);
/** 通过当前宿主 Port 隐藏消息。 */
export const hideMessage = (id?: TProtyleMessageId) => getProtyleDialogPort().hideMessage(id);
/** 通过当前宿主 Port 显示 Tooltip。 */
export const showTooltip = (...args: Parameters<IProtyleDialogPort["showTooltip"]>) => getProtyleDialogPort().showTooltip(...args);
/** 通过当前宿主 Port 隐藏 Tooltip。 */
export const hideTooltip = () => getProtyleDialogPort().hideTooltip();
/** 通过当前宿主 Port 打开资源选择器。 */
export const openAssetDialog = (callback: (url: string, name: string) => void) => getProtyleDialogPort().openAssetDialog?.(callback);
/** 通过当前宿主 Port 关闭资源选择器。 */
export const closeAssetDialog = () => getProtyleDialogPort().closeAssetDialog?.();
/** 通过当前宿主 Port 启用可选的拖拽缩放能力。 */
export const moveResize = (element: HTMLElement, resizeCallback?: (type: string) => void) => getProtyleDialogPort().moveResize?.(element, resizeCallback);
