/**
 * StatusBarRegistry.ts - 状态栏按钮注册表
 * 
 * 统一管理状态栏按钮的注册、渲染和事件处理。
 * 
 * @module registry/StatusBarRegistry
 */

// ============ 类型定义 ============

/** 状态栏按钮位置 */
export type 状态栏按钮位置 = "left" | "right";

/** 状态栏按钮注册信息 */
export interface IStatusBarButtonRegistration {
    /** 按钮唯一标识符 */
    id: string;
    /** 图标（SVG id 或完整 SVG 标签） */
    icon: string;
    /** 提示文本 */
    tooltip: string;
    /** 点击回调 */
    onClick: () => void;
    /** 位置：left 在左侧，right 在帮助按钮前 */
    position?: 状态栏按钮位置;
    /** 排序权重（越小越靠前） */
    order?: number;
}

// ============ 内部状态 ============

/** 已注册的状态栏按钮 */
const 注册表 = new Map<string, IStatusBarButtonRegistration>();

/** 已渲染的按钮元素 */
const 已渲染按钮 = new Map<string, HTMLElement>();

// ============ 公开 API ============

/**
 * @function 注册状态栏按钮
 * @zh-CN
 * @作用: 注册一个状态栏按钮
 * @意图: 提供统一的状态栏按钮管理
 * @调用时机: 模块初始化时
 * @已知问题: 无
 * @改进方向: 支持按钮状态（激活/禁用）
 */
export function 注册状态栏按钮(registration: IStatusBarButtonRegistration): void {
    if (注册表.has(registration.id)) {
        console.warn(`[StatusBarRegistry] 按钮 ${registration.id} 已存在，将被覆盖`);
    }
    注册表.set(registration.id, {
        ...registration,
        position: registration.position || "right",
        order: registration.order ?? 100
    });
}

/**
 * @function 注销状态栏按钮
 * @zh-CN
 * @作用: 移除已注册的状态栏按钮
 * @意图: 支持动态卸载按钮
 * @调用时机: 模块卸载时
 * @已知问题: 无
 * @改进方向: 无
 */
export function 注销状态栏按钮(id: string): void {
    注册表.delete(id);
    const element = 已渲染按钮.get(id);
    if (element) {
        element.remove();
        已渲染按钮.delete(id);
    }
}

/**
 * @function 渲染所有状态栏按钮
 * @zh-CN
 * @作用: 将所有已注册的按钮渲染到状态栏
 * @意图: 在状态栏初始化后统一渲染
 * @调用时机: status.ts 的 initStatus 之后
 * @已知问题: 无
 * @改进方向: 支持按钮的增量更新
 */
export function 渲染所有状态栏按钮(): void {
    const statusElement = document.getElementById("status");
    if (!statusElement) {
        console.warn("[StatusBarRegistry] 状态栏元素未找到");
        return;
    }

    const helpButton = document.getElementById("statusHelp");

    // 按 order 排序
    const sortedRegistrations = [...注册表.values()].sort(
        (a, b) => (a.order ?? 100) - (b.order ?? 100)
    );

    for (const reg of sortedRegistrations) {
        // 跳过已渲染的
        if (已渲染按钮.has(reg.id)) {
            continue;
        }

        const button = 创建按钮元素(reg);

        if (reg.position === "left") {
            // 插入到状态栏开头
            statusElement.insertBefore(button, statusElement.firstChild);
        } else if (helpButton) {
            // 插入到帮助按钮前
            statusElement.insertBefore(button, helpButton);
        } else {
            // 追加到末尾
            statusElement.appendChild(button);
        }

        已渲染按钮.set(reg.id, button);
    }
}

/**
 * @function 获取所有注册
 * @zh-CN
 * @作用: 获取所有已注册的状态栏按钮
 * @意图: 用于调试和查询
 * @调用时机: 需要查询时
 * @已知问题: 无
 * @改进方向: 无
 */
export function 获取所有注册(): IStatusBarButtonRegistration[] {
    return [...注册表.values()];
}

// ============ 内部函数 ============

/** @简洁函数 创建按钮 DOM 元素 */
function 创建按钮元素(reg: IStatusBarButtonRegistration): HTMLElement {
    const button = document.createElement("div");
    button.id = `status${reg.id}`;
    button.className = "toolbar__item ariaLabel";
    button.setAttribute("aria-label", reg.tooltip);

    // 支持 SVG id 或完整 SVG
    if (reg.icon.startsWith("<svg")) {
        button.innerHTML = reg.icon;
    } else {
        button.innerHTML = `<svg><use xlink:href="#${reg.icon}"></use></svg>`;
    }

    button.addEventListener("click", reg.onClick);

    return button;
}

// ============ 单例导出 ============

export const statusBarRegistry = {
    register: 注册状态栏按钮,
    unregister: 注销状态栏按钮,
    renderAll: 渲染所有状态栏按钮,
    getAll: 获取所有注册
};
