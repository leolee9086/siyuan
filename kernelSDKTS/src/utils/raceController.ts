/**
 * 竞态控制器模块
 *
 * 用于处理 API 请求的竞态条件，防止旧请求的响应覆盖新请求的响应。
 * 典型场景：用户快速输入搜索关键词时，确保只显示最新搜索结果。
 *
 * 实现原理：
 * 1. 请求时注入时间戳作为 reqId
 * 2. 以 URL 为 key 存储最新 reqId
 * 3. 响应时比较 reqId，丢弃过期响应
 *
 * @module utils/raceController
 */

import { DEFAULT_RACE_CONTROL_APIS } from '../types/config';

// ============================================================================
// 接口定义
// ============================================================================

/**
 * 竞态控制器接口
 *
 * 提供请求注册、响应验证、记录清理等功能。
 *
 * @example
 * ```typescript
 * const controller = createRaceController();
 *
 * // 发起请求前注册
 * const reqId = controller.registerRequest('/api/search/searchRefBlock');
 *
 * // 请求完成后检查是否过期
 * if (controller.isResponseStale('/api/search/searchRefBlock', reqId)) {
 *     console.log('响应已过期，丢弃');
 *     return;
 * }
 *
 * // 处理响应...
 * ```
 */
export interface IRaceController {
    /**
     * 生成请求 ID 并注册
     *
     * 为指定 URL 生成唯一的请求 ID（基于时间戳），并将其注册为该 URL 的最新请求。
     * 后续同一 URL 的请求会覆盖之前的注册。
     *
     * @param url - API 请求的 URL 路径（如 '/api/search/searchRefBlock'）
     * @returns 生成的请求 ID，格式为时间戳字符串
     *
     * @example
     * ```typescript
     * const reqId = controller.registerRequest('/api/search/searchRefBlock');
     * // reqId: "1706789012345"
     * ```
     */
    registerRequest(url: string): string;

    /**
     * 检查响应是否过期
     *
     * 比较给定的请求 ID 与当前注册的最新请求 ID。
     * 如果不匹配，说明有更新的请求已发出，当前响应应被丢弃。
     *
     * @param url - API 请求的 URL 路径
     * @param reqId - 请求时获得的请求 ID
     * @returns 如果响应已过期返回 true，否则返回 false
     *
     * @example
     * ```typescript
     * const reqId = controller.registerRequest('/api/search/searchRefBlock');
     * // ... 发起请求 ...
     *
     * // 在请求返回前，用户又发起了新请求
     * controller.registerRequest('/api/search/searchRefBlock');
     *
     * // 第一个请求返回时检查
     * if (controller.isResponseStale('/api/search/searchRefBlock', reqId)) {
     *     // 返回 true，响应已过期
     * }
     * ```
     */
    isResponseStale(url: string, reqId: string): boolean;

    /**
     * 清理指定 URL 的记录
     *
     * 移除指定 URL 的请求 ID 记录。
     * 适用于需要重置某个 API 竞态状态的场景。
     *
     * @param url - 要清理的 API URL 路径
     *
     * @example
     * ```typescript
     * controller.clear('/api/search/searchRefBlock');
     * ```
     */
    clear(url: string): void;

    /**
     * 清理所有记录
     *
     * 移除所有 URL 的请求 ID 记录。
     * 适用于重置整个竞态控制器状态的场景。
     *
     * @example
     * ```typescript
     * controller.clearAll();
     * ```
     */
    clearAll(): void;

    /**
     * 检查 URL 是否需要竞态控制
     *
     * 根据默认列表和自定义列表判断指定 URL 是否需要进行竞态控制。
     *
     * @param url - 要检查的 API URL 路径
     * @param enabledApis - 可选的自定义需要竞态控制的 API 列表，会与默认列表合并
     * @returns 如果需要竞态控制返回 true，否则返回 false
     *
     * @example
     * ```typescript
     * // 使用默认列表检查
     * controller.shouldControl('/api/search/searchRefBlock'); // true
     * controller.shouldControl('/api/block/getBlockInfo'); // false
     *
     * // 使用自定义列表检查
     * controller.shouldControl('/api/custom/api', ['/api/custom/api']); // true
     * ```
     */
    shouldControl(url: string, enabledApis?: string[]): boolean;
}

/** IRaceController 的中文别名 */
export type 竞态控制器 = IRaceController;

// ============================================================================
// 实现
// ============================================================================

/**
 * 竞态控制器实现类
 *
 * 使用 Map 存储 URL 到最新请求 ID 的映射。
 * 请求 ID 使用高精度时间戳生成，确保唯一性。
 */
class RaceController implements IRaceController {
    /**
     * 存储 URL 到最新请求 ID 的映射
     * @internal
     */
    private readonly requestMap: Map<string, string> = new Map();

    /**
     * @inheritdoc
     */
    registerRequest(url: string): string {
        // 使用高精度时间戳作为请求 ID
        // performance.now() 提供微秒级精度，Date.now() 提供毫秒级精度
        // 组合使用确保在高频调用场景下的唯一性
        const reqId = this.generateRequestId();
        this.requestMap.set(url, reqId);
        return reqId;
    }

    /**
     * @inheritdoc
     */
    isResponseStale(url: string, reqId: string): boolean {
        const latestReqId = this.requestMap.get(url);

        // 如果没有记录，说明已被清理或从未注册，视为不过期
        if (latestReqId === undefined) {
            return false;
        }

        // 比较请求 ID，不匹配则说明有更新的请求
        return latestReqId !== reqId;
    }

    /**
     * @inheritdoc
     */
    clear(url: string): void {
        this.requestMap.delete(url);
    }

    /**
     * @inheritdoc
     */
    clearAll(): void {
        this.requestMap.clear();
    }

    /**
     * @inheritdoc
     */
    shouldControl(url: string, enabledApis?: string[]): boolean {
        // 检查是否在默认列表中
        if (DEFAULT_RACE_CONTROL_APIS.includes(url)) {
            return true;
        }

        // 检查是否在自定义列表中
        if (enabledApis && enabledApis.includes(url)) {
            return true;
        }

        return false;
    }

    /**
     * 生成唯一的请求 ID
     *
     * 使用时间戳组合策略确保唯一性：
     * - 在支持 performance.now() 的环境中，组合 Date.now() 和 performance.now()
     * - 在不支持的环境中，使用 Date.now() 加随机数
     *
     * @returns 唯一的请求 ID 字符串
     * @internal
     */
    private generateRequestId(): string {
        const timestamp = Date.now();

        // 检查 performance API 是否可用
        if (
            typeof performance !== 'undefined' &&
            typeof performance.now === 'function'
        ) {
            // 组合毫秒时间戳和高精度计时器
            // performance.now() 返回的是页面加载后的微秒级时间
            const highResTime = performance.now();
            return `${timestamp}-${highResTime.toFixed(3)}`;
        }

        // 降级方案：使用随机数补充
        const random = Math.random().toString(36).substring(2, 8);
        return `${timestamp}-${random}`;
    }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建竞态控制器实例
 *
 * 工厂函数，用于创建新的竞态控制器实例。
 * 每个实例维护独立的请求 ID 映射。
 *
 * @returns 新的竞态控制器实例
 *
 * @example
 * ```typescript
 * // 创建控制器
 * const controller = createRaceController();
 *
 * // 在请求拦截器中使用
 * async function fetchWithRaceControl(url: string, options: RequestInit) {
 *     let reqId: string | undefined;
 *
 *     if (controller.shouldControl(url)) {
 *         reqId = controller.registerRequest(url);
 *     }
 *
 *     const response = await fetch(url, options);
 *     const data = await response.json();
 *
 *     if (reqId && controller.isResponseStale(url, reqId)) {
 *         throw new Error('Response is stale');
 *     }
 *
 *     return data;
 * }
 * ```
 */
export function createRaceController(): IRaceController {
    return new RaceController();
}

/** createRaceController 的中文别名 */
export const 创建竞态控制器 = createRaceController;

// ============================================================================
// 默认实例
// ============================================================================

/**
 * 默认的全局竞态控制器实例
 *
 * 提供一个预创建的控制器实例，适用于大多数场景。
 * 如果需要隔离的竞态控制，请使用 createRaceController() 创建新实例。
 *
 * @example
 * ```typescript
 * import { defaultRaceController } from './utils/raceController';
 *
 * // 直接使用默认实例
 * const reqId = defaultRaceController.registerRequest('/api/search/searchRefBlock');
 * ```
 */
export const defaultRaceController: IRaceController = createRaceController();

/** defaultRaceController 的中文别名 */
export const 默认竞态控制器 = defaultRaceController;
