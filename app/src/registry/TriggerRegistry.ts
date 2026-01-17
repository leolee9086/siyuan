/**
 * TriggerRegistry.ts - 触发器注册表
 * 
 * 智能工具箱的核心管理类，负责：
 * 1. 注册和管理所有工具触发器
 * 2. 管理刷子模式的生命周期（光标管理委托给 TriggerRegistry.cursor）
 * 3. 提供上下文匹配能力
 * 
 * 设计理念：
 * - 仿照 TabRegistry 的注册模式
 * - 支持三种触发模式：immediate/brush/toggle
 * - 统一管理刷子光标和退出事件，具体刷子只需关注业务逻辑
 * 
 * @module layout/registry/TriggerRegistry
 */

import { SForgeSymbols, getSForgeState, setSForgeState } from "../config/sforge";
import type {
    ITriggerRegistration,
    IBrushSession,
    IGlobalContext,
    刷子状态
} from "./TriggerRegistry.types";
import { isTriggerRegistryMap, isBrushSession, isValidParams } from "./TriggerRegistry.guard";
import {
    创建刷子光标,
    更新刷子光标位置,
    设置刷子光标,
    设置光标跟随,
    设置退出事件监听,
    隐藏系统光标,
    清理光标会话,
    初始化光标会话,
    设置左键点击监听
} from "./TriggerRegistry.cursor";
import { 查找Protyle } from "./TriggerRegistry.protyle";
import { 执行匹配触发器 } from "./TriggerRegistry.match";

// 重新导出类型
export type {
    ITriggerRegistration,
    IBrushSession,
    IGlobalContext,
    触发模式,
    刷子状态
} from "./TriggerRegistry.types";

// ============ 内部存储访问器 ============

/**
 * 获取触发器注册表 Map
 */
function 获取注册表Map(): Map<string, ITriggerRegistration> {
    const existing = getSForgeState(SForgeSymbols.TRIGGER_REGISTRY);

    if (isTriggerRegistryMap(existing)) {
        return existing;
    }

    const newRegistry = new Map<string, ITriggerRegistration>();
    setSForgeState(SForgeSymbols.TRIGGER_REGISTRY, newRegistry);
    return newRegistry;
}

/**
 * 获取当前刷子会话
 */
function 获取刷子会话(): IBrushSession | null {
    const session = getSForgeState(SForgeSymbols.BRUSH_SESSION);
    if (session === undefined) {
        return null;
    }
    if (isBrushSession(session)) {
        return session;
    }
    return null;
}

/**
 * 设置刷子会话
 */
function 设置刷子会话(session: IBrushSession | null): void {
    setSForgeState(SForgeSymbols.BRUSH_SESSION, session);
}


// 监听器集合
const listeners = new Set<() => void>();

/**
 * 通知所有监听器
 */
function notifyListeners() {
    for (const listener of listeners) {
        try {
            listener();
        } catch (e) {
            console.error("[TriggerRegistry] 监听器执行失败:", e);
        }
    }
}

/**
 * 监听注册表变更
 * 
 * @param callback 变更回调函数
 * @returns 取消监听函数
 */
export function 监听注册表变更(callback: () => void): () => void {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
}

// ============ 注册 API ============

/**
 * 注册触发器
 * 
 * @param registration 触发器注册配置
 * @returns 是否注册成功
 */
export function 注册触发器(registration: ITriggerRegistration): boolean {
    const 注册表 = 获取注册表Map();

    if (注册表.has(registration.type)) {
        console.warn(`[TriggerRegistry] 触发器类型已存在: ${registration.type}`);
        return false;
    }

    注册表.set(registration.type, registration);
    console.log(`[TriggerRegistry] 已注册触发器: ${registration.type} (${registration.mode})`);

    notifyListeners();
    return true;
}

/**
 * 获取触发器注册信息
 */
export function 获取触发器(type: string): ITriggerRegistration | undefined {
    return 获取注册表Map().get(type);
}

/**
 * 检查触发器是否已注册
 */
export function 触发器已注册(type: string): boolean {
    return 获取注册表Map().has(type);
}

/**
 * 注销触发器
 */
export function 注销触发器(type: string): boolean {
    const result = 获取注册表Map().delete(type);
    if (result) {
        notifyListeners();
    }
    return result;
}

/**
 * 获取所有已注册的触发器类型
 */
export function 获取所有触发器类型(): string[] {
    return Array.from(获取注册表Map().keys());
}

// ============ 刷子模式 API ============

/**
 * 检查是否有刷子处于激活状态
 * 
 * @param type 可选，指定检查特定的刷子类型
 */
export function 刷子是否激活(type?: string): boolean {
    const session = 获取刷子会话();
    const isActive = session !== null && session.状态 !== "idle";

    if (!isActive) {
        return false;
    }

    if (type) {
        return session.triggerType === type;
    }

    return true;
}

/**
 * 获取当前激活的刷子类型
 */
export function 获取激活刷子类型(): string | null {
    const session = 获取刷子会话();
    return session?.triggerType ?? null;
}

/**
 * 创建应用处理器
 * 
 * @param registration 触发器注册对象
 * @param type 触发器类型
 * @returns 鼠标事件处理器
 * @AIDONE 应该从块元素反向查找归属的protyle,因此所有的protyle必须在初始化的时候注册自身到一个全局注册表
 */
function 创建应用处理器(registration: ITriggerRegistration, type: string): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        const target = e.target;
        if (!(target instanceof Element)) {
            return;
        }

        const protyle = 查找Protyle(target);

        // 此处只做简单的转发，更复杂的 Context 构建需要由具体的 Brush 自行处理或未来统一
        // 主要是为了确保 onApply 被调度，逻辑回归统一
        const 简易Context: IGlobalContext = {
            protyle: protyle || (null as unknown as IProtyle),
            目标块: {
                id: target.getAttribute("data-node-id") || "",
                type: target.getAttribute("data-type") || "",
                element: target as HTMLElement
            },
            选区: {
                text: "",
                isCollapsed: true,
                range: null
            }
        };

        try {
            registration.onApply(target, 简易Context, false);
        } catch (err) {
            console.error(`[TriggerRegistry] 触发器 ${type} onApply 执行失败:`, err);
        }
    };
}

/**
 * 激活刷子模式
 * 
 * 作用：创建刷子会话并自动设置光标、退出事件等通用功能
 * 意图：让具体刷子实现只需关注业务逻辑，不用处理 UI 层面的光标管理
 * 调用时机：用户选择刷子工具时（如从菜单选择格式刷）
 * 
 * @param type 触发器类型
 * @param params 传入参数
 * @returns 是否激活成功
 */
export function 激活刷子(type: string, params: unknown): boolean {
    // 检查是否已有刷子激活
    if (刷子是否激活()) {
        console.warn("[TriggerRegistry] 已有刷子激活中，请先退出当前刷子");
        return false;
    }

    const registration = 获取触发器(type);
    if (!registration) {
        console.error(`[TriggerRegistry] 触发器未注册: ${type}`);
        return false;
    }

    if (registration.mode !== "brush") {
        console.error(`[TriggerRegistry] 触发器 ${type} 不是刷子模式`);
        return false;
    }

    // 创建会话
    const session: IBrushSession = {
        triggerType: type,
        状态: "active",
        params,
        cleanupFns: []
    };
    设置刷子会话(session);

    // 初始化光标管理会话
    初始化光标会话();

    // 设置光标和事件（委托给光标管理模块）
    if (registration.cursorHTML) {
        创建刷子光标(registration.cursorHTML);
        设置光标跟随();
    }

    // 设置左键点击监听，调度 onApply 事件
    // 设置左键点击监听，调度 onApply 事件
    const onApplyHandler = 创建应用处理器(registration, type);
    设置左键点击监听(onApplyHandler);

    设置退出事件监听(退出刷子);
    隐藏系统光标();

    // 调用 onEnter
    registration.onEnter?.(params);

    console.log(`[TriggerRegistry] 刷子已激活: ${type}`);
    return true;
}

/**
 * 退出刷子模式
 * 
 * 作用：清理刷子会话并恢复系统状态
 * 意图：确保刷子退出后所有资源被释放
 * 调用时机：用户按 Esc、右键或手动调用退出时
 */
export function 退出刷子(): void {
    const session = 获取刷子会话();
    if (!session) {
        return;
    }

    const registration = 获取触发器(session.triggerType);

    // 清理光标管理会话（包括事件监听和光标元素）
    清理光标会话();

    // 执行刷子会话的清理函数
    for (const fn of session.cleanupFns) {
        try {
            fn();
        } catch (e) {
            console.error("[TriggerRegistry] 清理函数执行失败:", e);
        }
    }

    // 调用 onExit
    registration?.onExit?.();

    // 清除会话
    设置刷子会话(null);

    console.log(`[TriggerRegistry] 刷子已退出: ${session.triggerType}`);
}

/**
 * 在刷子会话中注册清理函数
 */
export function 注册刷子清理函数(cleanupFn: () => void): void {
    const session = 获取刷子会话();
    if (session) {
        session.cleanupFns.push(cleanupFn);
    }
}

/**
 * 更新刷子状态
 */
export function 更新刷子状态(状态: 刷子状态): void {
    const session = 获取刷子会话();
    if (session) {
        session.状态 = 状态;
    }
}

/**
 * 更新刷子光标位置（代理到光标管理模块）
 */
export { 更新刷子光标位置 };

/**
 * 获取刷子参数
 */
export function 获取刷子参数<T = unknown>(): T | null {
    const session = 获取刷子会话();
    if (!session) {
        return null;
    }

    if (isValidParams<T>(session.params)) {
        return session.params;
    }
    return null;
}

// ============ 上下文匹配 API ============

/**
 * 尝试匹配单个触发器
 */
/**
 * 匹配当前上下文可用的触发器
 * 
 * @param context 全局上下文
 * @param options 匹配选项
 * @returns 匹配的触发器列表
 */
export async function 匹配触发器(
    context: IGlobalContext,
    options?: {
        /** 超时时间(ms)，默认 100ms */
        timeout?: number;
        /** 是否使用 AbortController */
        abortSignal?: AbortSignal;
    }
): Promise<ITriggerRegistration[]> {
    const 注册表 = 获取注册表Map();
    return 执行匹配触发器(context, 注册表, options);
}

// ============ 兼容对象形式 API ============

export const triggerRegistry = {
    register: 注册触发器,
    get: 获取触发器,
    has: 触发器已注册,
    unregister: 注销触发器,
    getAllTypes: 获取所有触发器类型,

    // 刷子模式
    isBrushActive: 刷子是否激活,
    getActiveBrushType: 获取激活刷子类型,
    activateBrush: 激活刷子,
    deactivateBrush: 退出刷子,
    registerCleanup: 注册刷子清理函数,
    setBrushCursor: 设置刷子光标,
    updateBrushState: 更新刷子状态,
    getBrushParams: 获取刷子参数,

    // 匹配
    matchTriggers: 匹配触发器,
};

// ============ 重新导出光标管理函数 ============

export { 设置刷子光标 };

