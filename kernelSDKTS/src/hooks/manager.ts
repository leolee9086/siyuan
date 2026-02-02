/**
 * SDK 钩子管理器
 *
 * 提供钩子的注册、执行和清理功能。
 * 支持多个同类型钩子按注册顺序依次执行。
 *
 * @module hooks/manager
 */

import type {
    ISDKHooks,
    IHookContextMap,
    IHookResultMap,
    BeforeRequestHook,
    AfterResponseHook,
    RaceConditionCheckHook,
    NetworkErrorHook,
    HttpErrorHook,
    MessageHook,
    ShowMessageHook,
    KernelErrorHook,
    AuthExpiredHook,
} from './types';

// ============================================================================
// 钩子管理器接口
// ============================================================================

/**
 * 钩子函数类型映射
 * 用于类型安全地获取各钩子的函数类型
 */
type HookFunctionMap = {
    beforeRequest: BeforeRequestHook;
    afterResponse: AfterResponseHook;
    onRaceConditionCheck: RaceConditionCheckHook;
    onNetworkError: NetworkErrorHook;
    onHttpError: HttpErrorHook;
    onMessage: MessageHook;
    onShowMessage: ShowMessageHook;
    onKernelError: KernelErrorHook;
    onAuthExpired: AuthExpiredHook;
};

/**
 * 钩子管理器接口
 *
 * 提供钩子的完整生命周期管理功能。
 *
 * @example
 * ```typescript
 * const manager = createHookManager();
 *
 * // 注册钩子
 * const unregister = manager.register('beforeRequest', (ctx) => {
 *     console.log('请求:', ctx.url);
 * });
 *
 * // 执行钩子
 * const result = await manager.execute('beforeRequest', { url, data, headers });
 *
 * // 取消注册
 * unregister();
 * ```
 */
export interface IHookManager {
    /**
     * 注册钩子函数
     *
     * @typeParam K - 钩子名称类型
     * @param name - 钩子名称
     * @param hook - 钩子函数
     * @returns 取消注册函数，调用后移除该钩子
     *
     * @example
     * ```typescript
     * const unregister = manager.register('beforeRequest', (ctx) => {
     *     return { ...ctx, headers: { ...ctx.headers, 'X-Custom': 'value' } };
     * });
     *
     * // 稍后取消注册
     * unregister();
     * ```
     */
    register<K extends keyof ISDKHooks>(
        name: K,
        hook: HookFunctionMap[K]
    ): () => void;

    /**
     * 执行指定类型的所有钩子
     *
     * 钩子按注册顺序依次执行。对于可修改上下文的钩子（如 beforeRequest），
     * 前一个钩子的返回值会作为下一个钩子的输入。
     *
     * @typeParam K - 钩子名称类型
     * @param name - 钩子名称
     * @param context - 钩子上下文
     * @returns 最终的钩子执行结果
     *
     * @example
     * ```typescript
     * // 执行 beforeRequest 钩子链
     * const result = await manager.execute('beforeRequest', {
     *     url: '/api/block/getBlockInfo',
     *     data: { id: 'block-id' },
     *     headers: { 'Content-Type': 'application/json' },
     * });
     *
     * if (result === false) {
     *     // 请求被取消
     * } else if (result) {
     *     // 使用修改后的配置
     * }
     * ```
     */
    execute<K extends keyof ISDKHooks>(
        name: K,
        context: IHookContextMap[K]
    ): Promise<IHookResultMap[K]>;

    /**
     * 清除指定类型的所有钩子
     *
     * @param name - 钩子名称
     *
     * @example
     * ```typescript
     * // 清除所有 beforeRequest 钩子
     * manager.clear('beforeRequest');
     * ```
     */
    clear(name: keyof ISDKHooks): void;

    /**
     * 清除所有类型的所有钩子
     *
     * @example
     * ```typescript
     * // 重置钩子管理器
     * manager.clearAll();
     * ```
     */
    clearAll(): void;

    /**
     * 获取指定类型的钩子数量
     *
     * @param name - 钩子名称
     * @returns 已注册的钩子数量
     */
    count(name: keyof ISDKHooks): number;

    /**
     * 检查是否有指定类型的钩子
     *
     * @param name - 钩子名称
     * @returns 是否存在该类型的钩子
     */
    has(name: keyof ISDKHooks): boolean;
}

/** IHookManager 的中文别名 */
export type 钩子管理器 = IHookManager;

// ============================================================================
// 钩子管理器实现
// ============================================================================

/**
 * 创建钩子管理器实例
 *
 * @param initialHooks - 可选的初始钩子配置
 * @returns 钩子管理器实例
 *
 * @example
 * ```typescript
 * // 创建空的钩子管理器
 * const manager = createHookManager();
 *
 * // 创建带初始钩子的管理器
 * const managerWithHooks = createHookManager({
 *     beforeRequest: [logRequest],
 *     onNetworkError: [reportError],
 * });
 * ```
 */
export function createHookManager(initialHooks?: Partial<ISDKHooks>): IHookManager {
    // 内部钩子存储
    const hooks: ISDKHooks = {
        beforeRequest: initialHooks?.beforeRequest ? [...initialHooks.beforeRequest] : [],
        afterResponse: initialHooks?.afterResponse ? [...initialHooks.afterResponse] : [],
        onRaceConditionCheck: initialHooks?.onRaceConditionCheck ? [...initialHooks.onRaceConditionCheck] : [],
        onNetworkError: initialHooks?.onNetworkError ? [...initialHooks.onNetworkError] : [],
        onHttpError: initialHooks?.onHttpError ? [...initialHooks.onHttpError] : [],
        onMessage: initialHooks?.onMessage ? [...initialHooks.onMessage] : [],
        onShowMessage: initialHooks?.onShowMessage ? [...initialHooks.onShowMessage] : [],
        onKernelError: initialHooks?.onKernelError ? [...initialHooks.onKernelError] : [],
        onAuthExpired: initialHooks?.onAuthExpired ? [...initialHooks.onAuthExpired] : [],
    };

    /**
     * 注册钩子
     */
    function register<K extends keyof ISDKHooks>(
        name: K,
        hook: HookFunctionMap[K]
    ): () => void {
        const hookList = hooks[name] as HookFunctionMap[K][];
        hookList.push(hook);

        // 返回取消注册函数
        return () => {
            const index = hookList.indexOf(hook);
            if (index !== -1) {
                hookList.splice(index, 1);
            }
        };
    }

    /**
     * 执行钩子链
     * 根据钩子类型采用不同的执行策略
     */
    async function execute<K extends keyof ISDKHooks>(
        name: K,
        context: IHookContextMap[K]
    ): Promise<IHookResultMap[K]> {
        const hookList = hooks[name];
        if (!hookList || hookList.length === 0) {
            return undefined as IHookResultMap[K];
        }

        // 根据钩子类型选择执行策略
        switch (name) {
            case 'beforeRequest':
                return executeBeforeRequestHooks(
                    hookList as BeforeRequestHook[],
                    context as IHookContextMap['beforeRequest']
                ) as Promise<IHookResultMap[K]>;

            case 'afterResponse':
                return executeAfterResponseHooks(
                    hookList as AfterResponseHook[],
                    context as IHookContextMap['afterResponse']
                ) as Promise<IHookResultMap[K]>;

            case 'onRaceConditionCheck':
                return executeRaceConditionCheckHooks(
                    hookList as RaceConditionCheckHook[],
                    context as IHookContextMap['onRaceConditionCheck']
                ) as Promise<IHookResultMap[K]>;

            case 'onHttpError':
                return executeHttpErrorHooks(
                    hookList as HttpErrorHook[],
                    context as IHookContextMap['onHttpError']
                ) as Promise<IHookResultMap[K]>;

            case 'onMessage':
                return executeMessageHooks(
                    hookList as MessageHook[],
                    context as IHookContextMap['onMessage']
                ) as Promise<IHookResultMap[K]>;

            case 'onShowMessage':
                return executeShowMessageHooks(
                    hookList as ShowMessageHook[],
                    context as IHookContextMap['onShowMessage']
                ) as Promise<IHookResultMap[K]>;

            case 'onAuthExpired':
                return executeAuthExpiredHooks(
                    hookList as AuthExpiredHook[],
                    context as IHookContextMap['onAuthExpired']
                ) as Promise<IHookResultMap[K]>;

            case 'onNetworkError':
                // 网络错误钩子只是通知，不返回值
                await executeNetworkErrorHooks(
                    hookList as NetworkErrorHook[],
                    context as IHookContextMap['onNetworkError']
                );
                return undefined as IHookResultMap[K];

            case 'onKernelError':
                // 内核错误钩子只是通知，不返回值
                await executeKernelErrorHooks(
                    hookList as KernelErrorHook[],
                    context as IHookContextMap['onKernelError']
                );
                return undefined as IHookResultMap[K];

            default:
                return undefined as IHookResultMap[K];
        }
    }

    /**
     * 清除指定类型的钩子
     */
    function clear(name: keyof ISDKHooks): void {
        const hookList = hooks[name];
        if (hookList) {
            hookList.length = 0;
        }
    }

    /**
     * 清除所有钩子
     */
    function clearAll(): void {
        for (const key of Object.keys(hooks) as (keyof ISDKHooks)[]) {
            clear(key);
        }
    }

    /**
     * 获取钩子数量
     */
    function count(name: keyof ISDKHooks): number {
        return hooks[name]?.length ?? 0;
    }

    /**
     * 检查是否有钩子
     */
    function has(name: keyof ISDKHooks): boolean {
        return count(name) > 0;
    }

    return {
        register,
        execute,
        clear,
        clearAll,
        count,
        has,
    };
}

/** createHookManager 的中文别名 */
export const 创建钩子管理器 = createHookManager;

// ============================================================================
// 钩子执行策略实现
// ============================================================================

/**
 * 执行 beforeRequest 钩子链
 * 支持链式修改上下文，任一钩子返回 false 则取消请求
 */
async function executeBeforeRequestHooks(
    hookList: BeforeRequestHook[],
    context: IHookContextMap['beforeRequest']
): Promise<IHookResultMap['beforeRequest']> {
    let currentContext = context;

    for (const hook of hookList) {
        const result = await hook(currentContext);

        if (result === false) {
            // 请求被取消
            return false;
        }

        if (result && typeof result === 'object') {
            // 更新上下文
            currentContext = result;
        }
    }

    // 返回最终的上下文（如果有修改）
    return currentContext !== context ? currentContext : undefined;
}

/**
 * 执行 afterResponse 钩子链
 * 支持链式修改响应
 */
async function executeAfterResponseHooks(
    hookList: AfterResponseHook[],
    context: IHookContextMap['afterResponse']
): Promise<IHookResultMap['afterResponse']> {
    let currentResponse = context.response;

    for (const hook of hookList) {
        const result = await hook({
            ...context,
            response: currentResponse,
        });

        if (result && typeof result === 'object') {
            currentResponse = result;
        }
    }

    // 返回最终的响应（如果有修改）
    return currentResponse !== context.response ? currentResponse : undefined;
}

/**
 * 执行竞态检查钩子链
 * 任一钩子返回明确的 boolean 值则使用该结果
 */
async function executeRaceConditionCheckHooks(
    hookList: RaceConditionCheckHook[],
    context: IHookContextMap['onRaceConditionCheck']
): Promise<IHookResultMap['onRaceConditionCheck']> {
    for (const hook of hookList) {
        const result = await hook(context);

        if (typeof result === 'boolean') {
            return result;
        }
    }

    return undefined;
}

/**
 * 执行 HTTP 错误钩子链
 * 第一个返回响应的钩子结果将被使用
 */
async function executeHttpErrorHooks(
    hookList: HttpErrorHook[],
    context: IHookContextMap['onHttpError']
): Promise<IHookResultMap['onHttpError']> {
    for (const hook of hookList) {
        const result = await hook(context);

        if (result && typeof result === 'object') {
            return result;
        }
    }

    return undefined;
}

/**
 * 执行消息处理钩子链
 * 任一钩子返回 false 则跳过消息处理
 */
async function executeMessageHooks(
    hookList: MessageHook[],
    context: IHookContextMap['onMessage']
): Promise<IHookResultMap['onMessage']> {
    for (const hook of hookList) {
        const result = await hook(context);

        if (result === false) {
            return false;
        }
    }

    return undefined;
}

/**
 * 执行显示消息钩子链
 * 支持链式修改消息配置，任一钩子返回 false 则阻止显示
 */
async function executeShowMessageHooks(
    hookList: ShowMessageHook[],
    context: IHookContextMap['onShowMessage']
): Promise<IHookResultMap['onShowMessage']> {
    let currentContext = context;

    for (const hook of hookList) {
        const result = await hook(currentContext);

        if (result === false) {
            return false;
        }

        if (result && typeof result === 'object') {
            currentContext = result;
        }
    }

    return currentContext !== context ? currentContext : undefined;
}

/**
 * 执行认证过期钩子链
 * 任一钩子返回 false 则阻止自动刷新
 */
async function executeAuthExpiredHooks(
    hookList: AuthExpiredHook[],
    context: IHookContextMap['onAuthExpired']
): Promise<IHookResultMap['onAuthExpired']> {
    for (const hook of hookList) {
        const result = await hook(context);

        if (result === false) {
            return false;
        }
    }

    return undefined;
}

/**
 * 执行网络错误钩子（无返回值）
 * 所有钩子都会被执行
 */
async function executeNetworkErrorHooks(
    hookList: NetworkErrorHook[],
    context: IHookContextMap['onNetworkError']
): Promise<void> {
    for (const hook of hookList) {
        await hook(context);
    }
}

/**
 * 执行内核错误钩子（无返回值）
 * 所有钩子都会被执行
 */
async function executeKernelErrorHooks(
    hookList: KernelErrorHook[],
    context: IHookContextMap['onKernelError']
): Promise<void> {
    for (const hook of hookList) {
        await hook(context);
    }
}

// ============================================================================
// 默认实例
// ============================================================================

/**
 * 默认钩子管理器实例
 * 用于全局钩子注册
 */
export const defaultHookManager: IHookManager = createHookManager();

/** defaultHookManager 的中文别名 */
export const 默认钩子管理器 = defaultHookManager;
