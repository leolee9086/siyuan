/**
 * @file 错误占位组件
 * @description 当 dock 或 tab 加载失败时显示错误信息并提供布局序列化数据
 */

/** 用途：错误占位数据契约；使用范围：工厂输入和渲染；解耦评估：同目录纯类型依赖。 */
import type {IErrorPlaceholderData} from "./ErrorPlaceholder.types";
/** 用途：错误占位模型契约；使用范围：工厂公开返回值；解耦评估：同目录接口只包含挂载和序列化能力。 */
import type {IErrorPlaceholderModel} from "./ErrorPlaceholder.types";

/** 错误占位符类型标识 */
export const ERROR_PLACEHOLDER_TYPE = "error_placeholder";

/**
 * 创建并渲染错误占位模型。
 * @同步豁免: UI构建 - 布局恢复和 Dock 创建必须同步得到可挂载模型并完成 DOM 渲染。
 * @显式返回类型原因: 工厂边界必须固定为最小错误占位接口，避免对象字面量的实现细节泄漏给布局调用方。
 */
export function createErrorPlaceholder(options: {
    element: HTMLElement;
    data: IErrorPlaceholderData;
}): IErrorPlaceholderModel {
    渲染错误占位符(options.element, options.data);
    return {
        layoutModel: true,
        element: options.element,
        errorPlaceholderData: options.data,
        layoutSerialization: {
            instance: "ErrorPlaceholder",
            errorPlaceholderType: ERROR_PLACEHOLDER_TYPE,
            errorPlaceholderData: options.data,
        },
    };
}

/** HTML 转义，防止错误文本进入标记结构。 */
function 转义HTML(text: string) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/** 渲染错误占位符界面。 */
function 渲染错误占位符(element: HTMLElement, data: IErrorPlaceholderData) {
    element.classList.add("fn__flex-column", "error-placeholder");

    const 堆栈显示 = data.错误堆栈
        ? `<details class="error-placeholder__details">
            <summary>查看详情</summary>
            <pre class="error-placeholder__stack">${转义HTML(data.错误堆栈)}</pre>
           </details>`
        : "";

    element.innerHTML = `
        <div class="error-placeholder__header block__icons">
            <span class="block__logo">
                <svg class="block__logoicon"><use xlink:href="#iconClose"></use></svg>
                加载失败
            </span>
        </div>
        <div class="error-placeholder__content fn__flex-1">
            <div class="error-placeholder__icon">
                <svg style="width: 48px; height: 48px; color: var(--b3-theme-error);">
                    <use xlink:href="#iconClose"></use>
                </svg>
            </div>
            <div class="error-placeholder__info">
                <div class="error-placeholder__type">
                    <strong>组件类型:</strong> ${转义HTML(data.原始类型)}
                </div>
                <div class="error-placeholder__message">
                    <strong>错误信息:</strong> ${转义HTML(data.错误信息)}
                </div>
            </div>
            ${堆栈显示}
        </div>
    `;
}
