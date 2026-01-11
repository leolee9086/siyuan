/**
 * @file 错误占位组件
 * @description 当 dock 或 tab 加载失败时显示错误信息
 * 
 * 该组件会被保存到布局配置中，刷新后仍保持错误状态。
 * 用户可以通过关闭 tab 或删除 dock 项来手动清理。
 */

import { Model } from "../Model";
import { Tab } from "../Tab";
import { App } from "../../index";

/** 错误占位符类型标识 */
export const ERROR_PLACEHOLDER_TYPE = "error_placeholder";

/** 错误占位符配置接口 */
export interface IErrorPlaceholderData {
    /** 原本应加载的类型 */
    原始类型: string;
    /** 错误信息 */
    错误信息: string;
    /** 错误堆栈（可选，用于调试） */
    错误堆栈?: string;
}

/**
 * 错误占位组件
 * 
 * 作用：当 dock 或 tab 加载失败时显示错误信息，而不是触发布局重置
 * 意图：提供优雅降级，让用户能够看到具体错误信息并保持布局完整
 * 调用时机：在 safeCreateModel 捕获到异常时创建
 */
export class ErrorPlaceholder extends Model {
    public element: HTMLElement;
    public 原始类型: string;
    public 错误信息: string;
    public 错误堆栈?: string;

    constructor(options: {
        app: App;
        tab: Tab;
        原始类型: string;
        错误信息: string;
        错误堆栈?: string;
    }) {
        super({
            app: options.app,
            id: options.tab.id,
        });

        this.element = options.tab.panelElement;
        this.原始类型 = options.原始类型;
        this.错误信息 = options.错误信息;
        this.错误堆栈 = options.错误堆栈;

        this.渲染界面();
    }

    /**
     * 渲染错误占位符界面
     */
    private 渲染界面() {
        this.element.classList.add("fn__flex-column", "error-placeholder");

        const 堆栈显示 = this.错误堆栈
            ? `<details class="error-placeholder__details">
                <summary>查看详情</summary>
                <pre class="error-placeholder__stack">${this.转义HTML(this.错误堆栈)}</pre>
               </details>`
            : "";

        this.element.innerHTML = `
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
                        <strong>组件类型:</strong> ${this.转义HTML(this.原始类型)}
                    </div>
                    <div class="error-placeholder__message">
                        <strong>错误信息:</strong> ${this.转义HTML(this.错误信息)}
                    </div>
                </div>
                ${堆栈显示}
            </div>
        `;
    }

    /**
     * HTML 转义，防止 XSS
     */
    private 转义HTML(text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 用于布局保存时生成配置
     * 保存原始类型信息，以便识别这是一个错误占位符
     */
    public toJSON(): IErrorPlaceholderData {
        return {
            原始类型: this.原始类型,
            错误信息: this.错误信息,
            错误堆栈: this.错误堆栈,
        };
    }
}

/**
 * 判断是否为错误占位符类型
 */
export function isErrorPlaceholderType(type: string): boolean {
    return type === ERROR_PLACEHOLDER_TYPE;
}

/**
 * 从已保存的配置创建错误占位符
 */
export function createErrorPlaceholderFromData(
    app: App,
    tab: Tab,
    data: IErrorPlaceholderData
): ErrorPlaceholder {
    return new ErrorPlaceholder({
        app,
        tab,
        原始类型: data.原始类型,
        错误信息: data.错误信息,
        错误堆栈: data.错误堆栈,
    });
}
