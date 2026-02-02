/**
 * SDK 钩子系统模块
 *
 * 统一导出钩子系统的所有类型定义和管理器功能。
 *
 * @module hooks
 */

// ============================================================================
// 钩子上下文类型
// ============================================================================

export type {
    // 请求生命周期上下文
    IBeforeRequestContext,
    请求前上下文,
    IAfterResponseContext,
    响应后上下文,

    // 竞态控制上下文
    IRaceConditionCheckContext,
    竞态检查上下文,

    // 错误处理上下文
    INetworkErrorContext,
    网络错误上下文,
    IHttpErrorContext,
    HTTP错误上下文,

    // 消息处理上下文
    IMessageContext,
    消息上下文,
    IShowMessageContext,
    显示消息上下文,

    // 特殊事件上下文
    IKernelErrorContext,
    内核错误上下文,
    IAuthExpiredContext,
    认证过期上下文,
} from './types';

// ============================================================================
// 钩子函数类型
// ============================================================================

export type {
    // 请求生命周期钩子
    BeforeRequestHook,
    请求前钩子,
    AfterResponseHook,
    响应后钩子,

    // 竞态控制钩子
    RaceConditionCheckHook,
    竞态检查钩子,

    // 错误处理钩子
    NetworkErrorHook,
    网络错误钩子,
    HttpErrorHook,
    HTTP错误钩子,

    // 消息处理钩子
    MessageHook,
    消息钩子,
    ShowMessageHook,
    显示消息钩子,

    // 特殊事件钩子
    KernelErrorHook,
    内核错误钩子,
    AuthExpiredHook,
    认证过期钩子,
} from './types';

// ============================================================================
// 钩子集合与映射类型
// ============================================================================

export type {
    // 钩子集合
    ISDKHooks,
    SDK钩子集合,

    // 类型映射
    IHookResultMap,
    钩子结果映射,
    IHookContextMap,
    钩子上下文映射,
} from './types';

// ============================================================================
// 钩子管理器
// ============================================================================

export {
    // 管理器接口
    type IHookManager,
    type 钩子管理器,

    // 工厂函数
    createHookManager,
    创建钩子管理器,

    // 默认实例
    defaultHookManager,
    默认钩子管理器,
} from './manager';
