/**
 * @file 错误占位组件
 * @description 当 dock 或 tab 加载失败时显示错误信息
 * 
 * 该组件会被保存到布局配置中，刷新后仍保持错误状态。
 * 用户可以通过关闭 tab 或删除 dock 项来手动清理。
 */

/** 用途：约束错误占位模型的宿主应用参数；使用范围：仅构造参数类型；解耦评估：已使用纯类型导入，不产生运行时耦合或聚合入口循环。 */
import type { App } from "../../index";
// eslint-disable-next-line restrictions/no-parent-import -- 用途：继承布局模型生命周期；使用范围：错误占位模型运行时基类；解耦评估：框架要求继承 Model，且 dock/imports.ts 会经 Wnd 和布局工具回到 dock.factory，必须直接导入以切断已复现的初始化循环。
import { Model } from "../Model";
/** 用途：约束占位模型对应的页签；使用范围：仅构造参数类型；解耦评估：已使用纯类型导入，不加载 Tab 运行时模块。 */
import type { Tab } from "../Tab";

/** 错误占位符类型标识 */
export const ERROR_PLACEHOLDER_TYPE = "error_placeholder";

/**
 * 错误占位组件
 *
 * 作用：当 dock 或 tab 加载失败时显示错误信息，而不是触发布局重置。
 * 意图：提供优雅降级，让用户能够看到具体错误信息并保持布局完整。
 * 调用时机：在 safeCreateModel 捕获到异常时创建。
 * @允许继承: 框架要求 (FrameworkRequired)
 * @允许类: ErrorPlaceholder 是 SiYuan 布局系统的错误占位面板类型，必须继承 Model 基类才能被布局引擎识别和序列化。具体业务场景：当 dock 或 tab 加载失败时，ErrorPlaceholder 作为降级组件替代原始面板，必须与普通 model 遵循相同的创建/销毁/序列化生命周期，否则布局系统会在保存/恢复时崩溃或丢失错误状态。替代方案评估：(1) 纯函数工厂可创建实例但无法被 dock.registry 的 instanceof 守卫识别，这会绕过类型安全检查导致运行时错误；(2) 对象组合模式无法注入布局生命周期，且无法通过布局序列化/反序列化流程恢复；(3) 接口模拟 class 行为需要额外适配器来匹配布局框架契约，复杂度反而更高且与框架基类的交互路径更长。class 方案的优势：与所有其他 Model 子类格式一致，布局框架的序列化/反序列化流程无需特殊分支即可处理 ErrorPlaceholder；构造函数签名与 dock.registry 工厂签名完全兼容；toJSON 方法精确控制序列化行为；instanceof 检查确保类型安全。未来重构方向：如果布局框架改为函数式组件注册，ErrorPlaceholder 可直接转为纯函数。
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
        });

        this.element = options.tab.panelElement;
        this.原始类型 = options.原始类型;
        this.错误信息 = options.错误信息;
        // 仅在工厂捕获到可用堆栈时持久化详情，避免把缺失值写入布局配置。
        if (options.错误堆栈 !== undefined) {
            this.错误堆栈 = options.错误堆栈;
        }

        渲染错误占位符(this.element, this);
    }

    /**
     * 用于布局保存时生成配置
     * 保存原始类型信息，以便识别这是一个错误占位符
     */
    public toJSON() {
        return {
            原始类型: this.原始类型,
            错误信息: this.错误信息,
            ...(this.错误堆栈 !== undefined ? { 错误堆栈: this.错误堆栈 } : {}),
        };
    }
}

/**
 * HTML 转义，防止 XSS
 */
function 转义HTML(text: string) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 渲染错误占位符界面
 * @param element 目标 DOM 元素
 * @param data 错误数据
 */
function 渲染错误占位符(
    element: HTMLElement,
    data: Pick<ErrorPlaceholder, "原始类型" | "错误信息" | "错误堆栈">,
) {
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

