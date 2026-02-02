/**
 * 工具模块
 *
 * 统一导出所有工具函数和类
 *
 * @module utils
 */

// 竞态控制器
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
} from './raceController';

// 同步请求
export {
    // 类型
    type SyncFetchOptions,
    type 同步请求配置选项,

    // 错误类
    SyncFetchError,
    同步请求错误,

    // 核心函数
    syncFetch,
    同步请求,
} from './syncFetch';
