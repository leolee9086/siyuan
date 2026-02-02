/**
 * SDK 类型定义模块
 *
 * 统一导出所有 SDK 相关的类型定义
 *
 * @module types
 */

// 配置相关类型
export {
    // 基础响应类型
    type IWebSocketData,
    type 标准响应数据,
    type ISDKResponse,
    type SDK响应,

    // 请求上下文
    type IRequestContext,
    type 请求上下文,

    // 处理器类型
    type IUnauthorizedHandler,
    type 未授权处理器,
    type IForbiddenHandler,
    type 禁止访问处理器,
    type INotFoundHandler,
    type 资源不存在处理器,
    type I202ResponseHandler,
    type 响应202处理器,
    type ITransactionErrorHandler,
    type 事务错误处理器,
    type IExitApiErrorHandler,
    type 退出API错误处理器,
    type INetworkErrorHandler,
    type 网络错误处理器,
    type IShowMessageFn,
    type 显示消息函数,
    type IHideMessageFn,
    type 隐藏消息函数,
    type IResponseValidator,
    type 响应验证器,

    // SDK 配置接口
    type ISDKConfig,
    type SDK配置,

    // 请求配置接口
    type IRequestConfig,
    type 请求配置,

    // API 方法类型
    type ApiMethodWithConfig,
    type 带配置的API方法,

    // 运行时环境类型
    type RuntimeEnvironment,
    type 运行时环境,

    // 常量
    DEFAULT_RACE_CONTROL_APIS,
    默认竞态控制API列表,

    // 类型守卫函数
    isWebSocketData,
    是标准响应数据,
    detectEnvironment,
    检测运行时环境,
} from './config';

// 竞态控制器类型
export {
    // 接口类型
    type IRaceController,
    type 竞态控制器,

    // 工厂函数
    createRaceController,
    创建竞态控制器,

    // 默认实例
    defaultRaceController,
    默认竞态控制器,
} from '../utils/raceController';
