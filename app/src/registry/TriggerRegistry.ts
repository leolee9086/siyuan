/**
 * TriggerRegistry.ts - 触发器注册表
 * 
 * 智能工具箱的核心管理类，负责：
 * 1. 注册和管理所有工具触发器
 * 2. 管理刷子模式的生命周期
 * 3. 提供上下文匹配能力
 * 
 * 设计理念：
 * - 仿照 TabRegistry 的注册模式
 * - 支持三种触发模式：immediate/brush/toggle
 * - 为未来的 UI 渲染层预留接口
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
import { isTriggerRegistryMap, isBrushSession, isValidTriggerRegistration, isValidParams } from "./TriggerRegistry.guard";

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
    return 获取注册表Map().delete(type);
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
 */
export function 刷子是否激活(): boolean {
    const session = 获取刷子会话();
    return session !== null && session.状态 !== "idle";
}

/**
 * 获取当前激活的刷子类型
 */
export function 获取激活刷子类型(): string | null {
    const session = 获取刷子会话();
    return session?.triggerType ?? null;
}

/**
 * 激活刷子模式
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

    // 调用 onEnter
    registration.onEnter?.(params);

    console.log(`[TriggerRegistry] 刷子已激活: ${type}`);
    return true;
}

/**
 * 退出刷子模式
 */
export function 退出刷子(): void {
    const session = 获取刷子会话();
    if (!session) {
        return;
    }

    const registration = 获取触发器(session.triggerType);

    // 执行清理函数
    for (const fn of session.cleanupFns) {
        try {
            fn();
        } catch (e) {
            console.error("[TriggerRegistry] 清理函数执行失败:", e);
        }
    }

    // 移除光标元素
    session.cursorElement?.remove();

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
 * 设置刷子光标元素
 */
export function 设置刷子光标(element: HTMLElement): void {
    const session = 获取刷子会话();
    if (session) {
        // 移除旧的光标
        session.cursorElement?.remove();
        session.cursorElement = element;
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
async function 尝试匹配触发器(
    registration: ITriggerRegistration,
    context: IGlobalContext,
    timeout: number
): Promise<ITriggerRegistration | null> {
    if (!registration.match) {
        // 无 match 函数，默认匹配
        return registration;
    }

    try {
        // 带超时的匹配
        const result = await Promise.race([
            Promise.resolve(registration.match(context)),
            new Promise<false>((_, reject) =>
                setTimeout(() => reject(new Error("match timeout")), timeout)
            )
        ]);

        if (result) {
            return registration;
        }
    } catch {
        // 超时或匹配失败，跳过
        console.debug(`[TriggerRegistry] 触发器 ${registration.type} 匹配超时或失败`);
    }
    return null;
}

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
    const timeout = options?.timeout ?? 100;

    // @内联回调
    const matchPromises = Array.from(注册表.values()).map(
        (reg) => 尝试匹配触发器(reg, context, timeout)
    );

    const results = await Promise.all(matchPromises);
    return results.filter(isValidTriggerRegistration);
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

// ============ 英文别名导出 ============

export const registerTrigger = 注册触发器;
export const getTrigger = 获取触发器;
export const hasTrigger = 触发器已注册;
export const unregisterTrigger = 注销触发器;
export const getAllTriggerTypes = 获取所有触发器类型;

export const isBrushActive = 刷子是否激活;
export const getActiveBrushType = 获取激活刷子类型;
export const activateBrush = 激活刷子;
export const deactivateBrush = 退出刷子;
export const registerBrushCleanup = 注册刷子清理函数;
export const setBrushCursor = 设置刷子光标;
export const updateBrushState = 更新刷子状态;
export const getBrushParams = 获取刷子参数;

export const matchTriggers = 匹配触发器;
