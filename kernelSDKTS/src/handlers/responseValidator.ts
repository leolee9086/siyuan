/**
 * 响应验证器模块
 *
 * 本模块提供 API 响应格式验证和类型守卫功能，
 * 用于确保响应数据符合 IWebSocketData 标准格式。
 *
 * @module handlers/responseValidator
 *
 * @example
 * ```typescript
 * import { responseValidator, ResponseValidator } from './responseValidator';
 *
 * // 使用单例实例
 * const result = responseValidator.validate(data);
 * if (result.valid) {
 *     console.log('响应有效:', result.data);
 * }
 *
 * // 使用类型守卫
 * if (responseValidator.isValidResponse(data)) {
 *     console.log('响应码:', data.code);
 * }
 *
 * // 创建错误响应
 * const errorResponse = responseValidator.createErrorResponse(-403, 'Forbidden');
 * ```
 */

import { IWebSocketData, isWebSocketData } from '../types/config';

// ============================================================================
// 验证结果接口
// ============================================================================

/**
 * 响应验证结果接口
 *
 * 包含验证是否通过、错误信息和验证后的数据
 */
export interface IValidationResult {
    /** 验证是否通过 */
    valid: boolean;
    /** 验证失败时的错误信息 */
    error?: string;
    /** 验证通过时的响应数据 */
    data?: IWebSocketData<unknown>;
}

/** IValidationResult 的中文别名 */
export type 验证结果 = IValidationResult;

// ============================================================================
// 响应验证器接口
// ============================================================================

/**
 * 响应验证器接口
 *
 * 定义响应验证器的标准方法，用于验证 API 响应格式是否符合预期。
 * 提供类型守卫、详细验证和错误响应创建功能。
 *
 * @example
 * ```typescript
 * const validator: IResponseValidatorService = {
 *     isValidResponse: (data) => isWebSocketData(data),
 *     validate: (data) => ({ valid: true, data }),
 *     createErrorResponse: (code, msg) => ({ code, msg, data: null }),
 * };
 * ```
 */
export interface IResponseValidatorService {
    /**
     * 验证响应是否为标准 WebSocket 数据格式
     *
     * 使用类型守卫检查数据是否符合 IWebSocketData 接口：
     * - code 字段存在且为数字
     * - msg 字段存在且为字符串
     * - data 字段存在
     *
     * @param data - 待验证的数据
     * @returns 类型守卫结果，true 表示数据符合 IWebSocketData 格式
     *
     * @example
     * ```typescript
     * const response = await fetch('/api/block/getBlockInfo');
     * const data = await response.json();
     *
     * if (validator.isValidResponse(data)) {
     *     // TypeScript 现在知道 data 是 IWebSocketData<unknown> 类型
     *     console.log('响应码:', data.code);
     *     console.log('消息:', data.msg);
     * }
     * ```
     */
    isValidResponse(data: unknown): data is IWebSocketData<unknown>;

    /**
     * 验证响应并返回类型安全的结果
     *
     * 执行详细的响应格式验证，返回包含验证状态、错误信息和数据的结果对象。
     * 相比 isValidResponse，此方法提供更详细的错误信息。
     *
     * @param data - 待验证的数据
     * @returns 验证结果对象，包含 valid、error 和 data 字段
     *
     * @example
     * ```typescript
     * const result = validator.validate(responseData);
     *
     * if (result.valid) {
     *     processResponse(result.data!);
     * } else {
     *     console.error('验证失败:', result.error);
     * }
     * ```
     */
    validate(data: unknown): IValidationResult;

    /**
     * 创建标准错误响应
     *
     * 根据错误码和消息创建符合 IWebSocketData 格式的错误响应对象。
     * 用于在 HTTP 错误或网络错误时生成统一的错误响应。
     *
     * @param code - 错误码（通常为负数，如 -403、-404、-1）
     * @param msg - 错误消息
     * @returns 标准错误响应对象，data 字段为 null
     *
     * @example
     * ```typescript
     * // HTTP 403 错误
     * const forbidden = validator.createErrorResponse(-403, 'Forbidden');
     * // 结果: { code: -403, msg: 'Forbidden', data: null }
     *
     * // HTTP 404 错误
     * const notFound = validator.createErrorResponse(-404, 'Not Found');
     * // 结果: { code: -404, msg: 'Not Found', data: null }
     *
     * // 网络错误
     * const networkError = validator.createErrorResponse(-1, 'Network Error');
     * // 结果: { code: -1, msg: 'Network Error', data: null }
     * ```
     */
    createErrorResponse(code: number, msg: string): IWebSocketData<null>;
}

/** IResponseValidatorService 的中文别名 */
export type 响应验证器服务接口 = IResponseValidatorService;

// ============================================================================
// 错误码常量
// ============================================================================

/**
 * HTTP 403 禁止访问错误码
 * 用于创建权限不足的错误响应
 */
export const ERROR_CODE_FORBIDDEN = -403;

/**
 * HTTP 404 资源不存在错误码
 * 用于创建资源未找到的错误响应
 */
export const ERROR_CODE_NOT_FOUND = -404;

/**
 * 网络错误码
 * 用于创建网络请求失败的错误响应
 */
export const ERROR_CODE_NETWORK = -1;

/**
 * 验证错误码
 * 用于创建响应格式验证失败的错误响应
 */
export const ERROR_CODE_VALIDATION = -2;

/** 错误码常量的中文别名 */
export const 禁止访问错误码 = ERROR_CODE_FORBIDDEN;
export const 资源不存在错误码 = ERROR_CODE_NOT_FOUND;
export const 网络错误码 = ERROR_CODE_NETWORK;
export const 验证错误码 = ERROR_CODE_VALIDATION;

// ============================================================================
// 验证错误消息常量
// ============================================================================

/**
 * 验证错误消息常量
 * 用于提供一致的错误消息
 */
export const VALIDATION_ERROR_MESSAGES = {
    /** 数据为 null 或 undefined */
    NULL_DATA: 'Response data is null or undefined',
    /** 数据不是对象类型 */
    NOT_OBJECT: 'Response data is not an object',
    /** code 字段缺失或类型错误 */
    INVALID_CODE: 'Response code is missing or not a number',
    /** msg 字段缺失或类型错误 */
    INVALID_MSG: 'Response msg is missing or not a string',
    /** data 字段缺失 */
    MISSING_DATA: 'Response data field is missing',
} as const;

/** VALIDATION_ERROR_MESSAGES 的中文别名 */
export const 验证错误消息 = VALIDATION_ERROR_MESSAGES;

// ============================================================================
// 响应验证器实现
// ============================================================================

/**
 * 响应验证器类
 *
 * 实现 IResponseValidatorService 接口，提供完整的响应验证功能。
 * 支持类型守卫、详细验证和错误响应创建。
 *
 * @implements {IResponseValidatorService}
 *
 * @example
 * ```typescript
 * // 创建自定义实例
 * const validator = new ResponseValidator();
 *
 * // 验证响应
 * const result = validator.validate(data);
 *
 * // 使用类型守卫
 * if (validator.isValidResponse(data)) {
 *     console.log(data.code);
 * }
 * ```
 */
export class ResponseValidator implements IResponseValidatorService {
    /**
     * 验证响应是否为标准 WebSocket 数据格式
     *
     * 委托给 types/config.ts 中的 isWebSocketData 函数实现，
     * 确保验证逻辑的一致性。
     *
     * @param data - 待验证的数据
     * @returns 类型守卫结果
     */
    isValidResponse(data: unknown): data is IWebSocketData<unknown> {
        return isWebSocketData(data);
    }

    /**
     * 验证响应并返回详细的验证结果
     *
     * 执行分步验证，提供具体的错误信息：
     * 1. 检查数据是否为 null/undefined
     * 2. 检查数据是否为对象类型
     * 3. 检查 code 字段是否存在且为数字
     * 4. 检查 msg 字段是否存在且为字符串
     * 5. 检查 data 字段是否存在
     *
     * @param data - 待验证的数据
     * @returns 验证结果对象
     */
    validate(data: unknown): IValidationResult {
        // 检查 null/undefined
        if (data === null || data === undefined) {
            return {
                valid: false,
                error: VALIDATION_ERROR_MESSAGES.NULL_DATA,
            };
        }

        // 检查是否为对象
        if (typeof data !== 'object') {
            return {
                valid: false,
                error: VALIDATION_ERROR_MESSAGES.NOT_OBJECT,
            };
        }

        const obj = data as Record<string, unknown>;

        // 检查 code 字段
        if (typeof obj.code !== 'number') {
            return {
                valid: false,
                error: VALIDATION_ERROR_MESSAGES.INVALID_CODE,
            };
        }

        // 检查 msg 字段
        if (typeof obj.msg !== 'string') {
            return {
                valid: false,
                error: VALIDATION_ERROR_MESSAGES.INVALID_MSG,
            };
        }

        // 检查 data 字段存在性
        if (!('data' in obj)) {
            return {
                valid: false,
                error: VALIDATION_ERROR_MESSAGES.MISSING_DATA,
            };
        }

        // 验证通过
        return {
            valid: true,
            data: obj as unknown as IWebSocketData<unknown>,
        };
    }

    /**
     * 创建标准错误响应
     *
     * @param code - 错误码
     * @param msg - 错误消息
     * @returns 标准错误响应对象
     */
    createErrorResponse(code: number, msg: string): IWebSocketData<null> {
        return {
            code,
            msg,
            data: null,
        };
    }
}

/** ResponseValidator 的中文别名 */
export const 响应验证器 = ResponseValidator;

// ============================================================================
// 错误响应工厂函数
// ============================================================================

/**
 * 创建 HTTP 403 禁止访问错误响应
 *
 * @param statusText - HTTP 状态文本，默认为 'Forbidden'
 * @returns 标准错误响应对象，code 为 -403
 *
 * @example
 * ```typescript
 * const response = createForbiddenResponse('Access Denied');
 * // 结果: { code: -403, msg: 'Access Denied', data: null }
 * ```
 */
export function createForbiddenResponse(
    statusText: string = 'Forbidden'
): IWebSocketData<null> {
    return {
        code: ERROR_CODE_FORBIDDEN,
        msg: statusText,
        data: null,
    };
}

/** createForbiddenResponse 的中文别名 */
export const 创建禁止访问响应 = createForbiddenResponse;

/**
 * 创建 HTTP 404 资源不存在错误响应
 *
 * @param statusText - HTTP 状态文本，默认为 'Not Found'
 * @returns 标准错误响应对象，code 为 -404
 *
 * @example
 * ```typescript
 * const response = createNotFoundResponse('Resource Not Found');
 * // 结果: { code: -404, msg: 'Resource Not Found', data: null }
 * ```
 */
export function createNotFoundResponse(
    statusText: string = 'Not Found'
): IWebSocketData<null> {
    return {
        code: ERROR_CODE_NOT_FOUND,
        msg: statusText,
        data: null,
    };
}

/** createNotFoundResponse 的中文别名 */
export const 创建资源不存在响应 = createNotFoundResponse;

/**
 * 创建网络错误响应
 *
 * @param errorMessage - 错误消息，默认为 'Network Error'
 * @returns 标准错误响应对象，code 为 -1
 *
 * @example
 * ```typescript
 * try {
 *     await fetch('/api/endpoint');
 * } catch (error) {
 *     const response = createNetworkErrorResponse(error.message);
 *     // 结果: { code: -1, msg: 'Failed to fetch', data: null }
 * }
 * ```
 */
export function createNetworkErrorResponse(
    errorMessage: string = 'Network Error'
): IWebSocketData<null> {
    return {
        code: ERROR_CODE_NETWORK,
        msg: errorMessage,
        data: null,
    };
}

/** createNetworkErrorResponse 的中文别名 */
export const 创建网络错误响应 = createNetworkErrorResponse;

/**
 * 根据 HTTP 状态码创建对应的错误响应
 *
 * 支持的状态码：
 * - 403: 禁止访问
 * - 404: 资源不存在
 * - 其他: 通用 HTTP 错误
 *
 * @param status - HTTP 状态码
 * @param statusText - HTTP 状态文本
 * @returns 标准错误响应对象
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/endpoint');
 * if (!response.ok) {
 *     const errorResponse = createHttpErrorResponse(
 *         response.status,
 *         response.statusText
 *     );
 * }
 * ```
 */
export function createHttpErrorResponse(
    status: number,
    statusText: string
): IWebSocketData<null> {
    switch (status) {
        case 403:
            return createForbiddenResponse(statusText);
        case 404:
            return createNotFoundResponse(statusText);
        default:
            return {
                code: -status,
                msg: statusText || `HTTP Error ${status}`,
                data: null,
            };
    }
}

/** createHttpErrorResponse 的中文别名 */
export const 创建HTTP错误响应 = createHttpErrorResponse;

// ============================================================================
// 单例实例导出
// ============================================================================

/**
 * 响应验证器单例实例
 *
 * 提供全局可用的响应验证器实例，适用于大多数场景。
 *
 * @example
 * ```typescript
 * import { responseValidator } from './responseValidator';
 *
 * // 使用类型守卫
 * if (responseValidator.isValidResponse(data)) {
 *     console.log(data.code);
 * }
 *
 * // 验证响应
 * const result = responseValidator.validate(data);
 * ```
 */
export const responseValidator = new ResponseValidator();

/** responseValidator 的中文别名 */
export const 响应验证器实例 = responseValidator;
