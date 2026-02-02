/**
 * 错误处理器单元测试
 *
 * 测试各种处理器的核心功能：
 * - TransactionHandler: 事务错误处理
 * - MessageHandler: 消息处理逻辑
 * - ResponseValidator: 响应验证和类型守卫
 *
 * @module __tests__/handlers.test
 */

import { describe, expect } from './testUtils';
import {
    TransactionHandler,
    transactionHandler,
    TRANSACTION_API_PATH,
    KERNEL_ERROR_MESSAGES,
} from '../handlers/transactionHandler';
import {
    MessageHandler,
    messageHandler,
    ERROR_CODE,
    INFO_CODE,
    IApiResponse,
    IMessageConfig,
} from '../handlers/messageHandler';
import {
    ResponseValidator,
    responseValidator,
    VALIDATION_ERROR_MESSAGES,
    createForbiddenResponse,
    createNotFoundResponse,
    createNetworkErrorResponse,
    createHttpErrorResponse,
    ERROR_CODE_FORBIDDEN,
    ERROR_CODE_NOT_FOUND,
    ERROR_CODE_NETWORK,
} from '../handlers/responseValidator';

// ============================================================================
// 测试套件：TransactionHandler
// ============================================================================

/**
 * TransactionHandler.isTransactionApi 测试套件
 */
export const isTransactionApiSuite = describe(
    'TransactionHandler.isTransactionApi',
    ({ test, beforeEach }) => {
        let handler: TransactionHandler;

        beforeEach(() => {
            handler = new TransactionHandler();
        });

        test('应该正确识别事务API路径', () => {
            expect(handler.isTransactionApi(TRANSACTION_API_PATH)).toBe(true);
            expect(handler.isTransactionApi('/api/transactions')).toBe(true);
        });

        test('应该拒绝非事务API路径', () => {
            expect(handler.isTransactionApi('/api/block/getBlockInfo')).toBe(false);
            expect(handler.isTransactionApi('/api/system/version')).toBe(false);
            expect(handler.isTransactionApi('/api/transactions/other')).toBe(false);
        });

        test('应该区分大小写', () => {
            expect(handler.isTransactionApi('/API/TRANSACTIONS')).toBe(false);
            expect(handler.isTransactionApi('/Api/Transactions')).toBe(false);
        });
    }
);

/**
 * TransactionHandler.shouldTriggerKernelError 测试套件
 */
export const shouldTriggerKernelErrorSuite = describe(
    'TransactionHandler.shouldTriggerKernelError',
    ({ test, beforeEach }) => {
        let handler: TransactionHandler;

        beforeEach(() => {
            handler = new TransactionHandler();
        });

        test('应该识别 "Failed to fetch" 错误', () => {
            const error = new Error('Failed to fetch');
            expect(handler.shouldTriggerKernelError(error)).toBe(true);
        });

        test('应该识别 "Unexpected end of JSON input" 错误', () => {
            const error = new Error('Unexpected end of JSON input');
            expect(handler.shouldTriggerKernelError(error)).toBe(true);
        });

        test('应该拒绝其他错误消息', () => {
            expect(handler.shouldTriggerKernelError(new Error('Network error'))).toBe(false);
            expect(handler.shouldTriggerKernelError(new Error('Timeout'))).toBe(false);
            expect(handler.shouldTriggerKernelError(new Error('Unknown error'))).toBe(false);
        });

        test('KERNEL_ERROR_MESSAGES 应该包含预期的错误消息', () => {
            expect(KERNEL_ERROR_MESSAGES).toContain('Failed to fetch');
            expect(KERNEL_ERROR_MESSAGES).toContain('Unexpected end of JSON input');
        });
    }
);

/**
 * TransactionHandler.handleTransactionError 测试套件
 */
export const handleTransactionErrorSuite = describe(
    'TransactionHandler.handleTransactionError',
    ({ test, beforeEach }) => {
        let handler: TransactionHandler;
        let kernelErrorCalled: boolean;
        let kernelErrorMessage: string | undefined;

        beforeEach(() => {
            handler = new TransactionHandler();
            kernelErrorCalled = false;
            kernelErrorMessage = undefined;
        });

        test('应该为事务API的网络错误调用kernelErrorFn', () => {
            const mockKernelError = (msg?: string) => {
                kernelErrorCalled = true;
                kernelErrorMessage = msg;
            };

            handler.handleTransactionError(
                TRANSACTION_API_PATH,
                new Error('Failed to fetch'),
                mockKernelError
            );

            expect(kernelErrorCalled).toBe(true);
            expect(kernelErrorMessage).toBe('Failed to fetch');
        });

        test('应该为事务API的JSON解析错误调用kernelErrorFn', () => {
            const mockKernelError = (msg?: string) => {
                kernelErrorCalled = true;
                kernelErrorMessage = msg;
            };

            handler.handleTransactionError(
                TRANSACTION_API_PATH,
                new Error('Unexpected end of JSON input'),
                mockKernelError
            );

            expect(kernelErrorCalled).toBe(true);
        });

        test('不应该为非事务API调用kernelErrorFn', () => {
            const mockKernelError = () => {
                kernelErrorCalled = true;
            };

            handler.handleTransactionError(
                '/api/block/getBlockInfo',
                new Error('Failed to fetch'),
                mockKernelError
            );

            expect(kernelErrorCalled).toBe(false);
        });

        test('不应该为非内核错误调用kernelErrorFn', () => {
            const mockKernelError = () => {
                kernelErrorCalled = true;
            };

            handler.handleTransactionError(
                TRANSACTION_API_PATH,
                new Error('Some other error'),
                mockKernelError
            );

            expect(kernelErrorCalled).toBe(false);
        });

        test('当kernelErrorFn未提供时应该安全执行', () => {
            // 不应该抛出异常
            handler.handleTransactionError(
                TRANSACTION_API_PATH,
                new Error('Failed to fetch')
            );
        });
    }
);

/**
 * transactionHandler 单例测试套件
 */
export const transactionHandlerSingletonSuite = describe(
    'transactionHandler singleton',
    ({ test }) => {
        test('应该是 TransactionHandler 的实例', () => {
            expect(transactionHandler).toBeInstanceOf(TransactionHandler);
        });

        test('应该具有所有必需的方法', () => {
            expect(typeof transactionHandler.isTransactionApi).toBe('function');
            expect(typeof transactionHandler.shouldTriggerKernelError).toBe('function');
            expect(typeof transactionHandler.handleTransactionError).toBe('function');
        });
    }
);

// ============================================================================
// 测试套件：MessageHandler
// ============================================================================

/**
 * MessageHandler.processMessage 测试套件
 */
export const processMessageSuite = describe(
    'MessageHandler.processMessage',
    ({ test, beforeEach }) => {
        let handler: MessageHandler;
        let shownMessages: Array<{ msg: string; timeout?: number; type?: string }>;

        beforeEach(() => {
            shownMessages = [];
            handler = new MessageHandler({
                showMessageFn: (msg, timeout, type) => {
                    shownMessages.push({ msg, timeout, type });
                    return `msg-${Date.now()}`;
                },
            });
        });

        test('code >= 0 时应该返回 true 且不显示消息', () => {
            const response: IApiResponse = { code: 0, msg: '成功' };
            const result = handler.processMessage(response);

            expect(result).toBe(true);
            expect(shownMessages.length).toBe(0);
        });

        test('code === -1 时应该显示错误消息并返回 false', () => {
            const response: IApiResponse = { code: ERROR_CODE, msg: '操作失败' };
            const result = handler.processMessage(response);

            expect(result).toBe(false);
            expect(shownMessages.length).toBe(1);
            expect(shownMessages[0].msg).toBe('操作失败');
            expect(shownMessages[0].type).toBe('error');
        });

        test('code === -2 时应该显示提示消息并返回 false', () => {
            const response: IApiResponse = { code: INFO_CODE, msg: '提示信息' };
            const result = handler.processMessage(response);

            expect(result).toBe(false);
            expect(shownMessages.length).toBe(1);
            expect(shownMessages[0].msg).toBe('提示信息');
            expect(shownMessages[0].type).toBe('info');
        });

        test('其他负数 code 应该显示提示消息', () => {
            const response: IApiResponse = { code: -3, msg: '其他提示' };
            const result = handler.processMessage(response);

            expect(result).toBe(false);
            expect(shownMessages[0].type).toBe('info');
        });

        test('应该使用 data.closeTimeout 作为超时时间', () => {
            const response: IApiResponse = {
                code: ERROR_CODE,
                msg: '错误',
                data: { closeTimeout: 3000 },
            };
            handler.processMessage(response);

            expect(shownMessages[0].timeout).toBe(3000);
        });

        test('processMessage: false 配置应该跳过消息处理', () => {
            const response: IApiResponse = { code: ERROR_CODE, msg: '错误' };
            const config: IMessageConfig = { processMessage: false };
            const result = handler.processMessage(response, config);

            expect(result).toBe(true);
            expect(shownMessages.length).toBe(0);
        });

        test('showErrorMessage: false 配置应该跳过错误消息', () => {
            const response: IApiResponse = { code: ERROR_CODE, msg: '错误' };
            const config: IMessageConfig = { showErrorMessage: false };
            const result = handler.processMessage(response, config);

            expect(result).toBe(false);
            expect(shownMessages.length).toBe(0);
        });

        test('showInfoMessage: false 配置应该跳过提示消息', () => {
            const response: IApiResponse = { code: INFO_CODE, msg: '提示' };
            const config: IMessageConfig = { showInfoMessage: false };
            const result = handler.processMessage(response, config);

            expect(result).toBe(false);
            expect(shownMessages.length).toBe(0);
        });
    }
);

/**
 * MessageHandler.showMessage/hideMessage 测试套件
 */
export const showHideMessageSuite = describe(
    'MessageHandler.showMessage/hideMessage',
    ({ test, beforeEach }) => {
        let handler: MessageHandler;
        let shownMessages: Array<{ msg: string; timeout?: number; type?: string }>;
        let hiddenIds: string[];

        beforeEach(() => {
            shownMessages = [];
            hiddenIds = [];
            handler = new MessageHandler({
                showMessageFn: (msg, timeout, type) => {
                    const id = `msg-${shownMessages.length}`;
                    shownMessages.push({ msg, timeout, type });
                    return id;
                },
                hideMessageFn: (id) => {
                    hiddenIds.push(id);
                },
            });
        });

        test('showMessage 应该调用 showMessageFn 并返回 ID', () => {
            const id = handler.showMessage('测试消息', 1000, 'info');

            expect(id).toBeTruthy();
            expect(shownMessages.length).toBe(1);
            expect(shownMessages[0].msg).toBe('测试消息');
            expect(shownMessages[0].timeout).toBe(1000);
            expect(shownMessages[0].type).toBe('info');
        });

        test('showMessage 应该使用默认参数', () => {
            handler.showMessage('消息');

            expect(shownMessages[0].timeout).toBe(0);
            expect(shownMessages[0].type).toBe('info');
        });

        test('hideMessage 应该调用 hideMessageFn', () => {
            const id = handler.showMessage('消息');
            handler.hideMessage(id);

            expect(hiddenIds.length).toBe(1);
            expect(hiddenIds[0]).toBe(id);
        });
    }
);

/**
 * messageHandler 单例测试套件
 */
export const messageHandlerSingletonSuite = describe(
    'messageHandler singleton',
    ({ test }) => {
        test('应该是 MessageHandler 的实例', () => {
            expect(messageHandler).toBeInstanceOf(MessageHandler);
        });

        test('应该具有所有必需的方法', () => {
            expect(typeof messageHandler.processMessage).toBe('function');
            expect(typeof messageHandler.showMessage).toBe('function');
            expect(typeof messageHandler.hideMessage).toBe('function');
        });
    }
);

// ============================================================================
// 测试套件：ResponseValidator
// ============================================================================

/**
 * ResponseValidator.isValidResponse 测试套件
 */
export const isValidResponseSuite = describe(
    'ResponseValidator.isValidResponse',
    ({ test, beforeEach }) => {
        let validator: ResponseValidator;

        beforeEach(() => {
            validator = new ResponseValidator();
        });

        test('应该接受有效的 WebSocket 数据格式', () => {
            const validData = { code: 0, msg: '成功', data: { id: '123' } };
            expect(validator.isValidResponse(validData)).toBe(true);
        });

        test('应该接受 data 为 null 的响应', () => {
            const validData = { code: 0, msg: '成功', data: null };
            expect(validator.isValidResponse(validData)).toBe(true);
        });

        test('应该接受负数 code 的响应', () => {
            const validData = { code: -1, msg: '错误', data: null };
            expect(validator.isValidResponse(validData)).toBe(true);
        });

        test('应该拒绝 null', () => {
            expect(validator.isValidResponse(null)).toBe(false);
        });

        test('应该拒绝 undefined', () => {
            expect(validator.isValidResponse(undefined)).toBe(false);
        });

        test('应该拒绝非对象类型', () => {
            expect(validator.isValidResponse('string')).toBe(false);
            expect(validator.isValidResponse(123)).toBe(false);
            expect(validator.isValidResponse(true)).toBe(false);
        });

        test('应该拒绝缺少 code 字段的对象', () => {
            expect(validator.isValidResponse({ msg: '消息', data: null })).toBe(false);
        });

        test('应该拒绝缺少 msg 字段的对象', () => {
            expect(validator.isValidResponse({ code: 0, data: null })).toBe(false);
        });

        test('应该拒绝缺少 data 字段的对象', () => {
            expect(validator.isValidResponse({ code: 0, msg: '消息' })).toBe(false);
        });

        test('应该拒绝 code 不是数字的对象', () => {
            expect(validator.isValidResponse({ code: '0', msg: '消息', data: null })).toBe(false);
        });

        test('应该拒绝 msg 不是字符串的对象', () => {
            expect(validator.isValidResponse({ code: 0, msg: 123, data: null })).toBe(false);
        });
    }
);

/**
 * ResponseValidator.validate 测试套件
 */
export const validateSuite = describe(
    'ResponseValidator.validate',
    ({ test, beforeEach }) => {
        let validator: ResponseValidator;

        beforeEach(() => {
            validator = new ResponseValidator();
        });

        test('有效数据应该返回 valid: true', () => {
            const result = validator.validate({ code: 0, msg: '成功', data: {} });
            expect(result.valid).toBe(true);
            expect(result.data).toBeDefined();
        });

        test('null 数据应该返回正确的错误消息', () => {
            const result = validator.validate(null);
            expect(result.valid).toBe(false);
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGES.NULL_DATA);
        });

        test('undefined 数据应该返回正确的错误消息', () => {
            const result = validator.validate(undefined);
            expect(result.valid).toBe(false);
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGES.NULL_DATA);
        });

        test('非对象数据应该返回正确的错误消息', () => {
            const result = validator.validate('string');
            expect(result.valid).toBe(false);
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGES.NOT_OBJECT);
        });

        test('缺少 code 字段应该返回正确的错误消息', () => {
            const result = validator.validate({ msg: '消息', data: null });
            expect(result.valid).toBe(false);
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGES.INVALID_CODE);
        });

        test('code 类型错误应该返回正确的错误消息', () => {
            const result = validator.validate({ code: '0', msg: '消息', data: null });
            expect(result.valid).toBe(false);
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGES.INVALID_CODE);
        });

        test('缺少 msg 字段应该返回正确的错误消息', () => {
            const result = validator.validate({ code: 0, data: null });
            expect(result.valid).toBe(false);
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGES.INVALID_MSG);
        });

        test('msg 类型错误应该返回正确的错误消息', () => {
            const result = validator.validate({ code: 0, msg: 123, data: null });
            expect(result.valid).toBe(false);
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGES.INVALID_MSG);
        });

        test('缺少 data 字段应该返回正确的错误消息', () => {
            const result = validator.validate({ code: 0, msg: '消息' });
            expect(result.valid).toBe(false);
            expect(result.error).toBe(VALIDATION_ERROR_MESSAGES.MISSING_DATA);
        });
    }
);

/**
 * ResponseValidator.createErrorResponse 测试套件
 */
export const createErrorResponseSuite = describe(
    'ResponseValidator.createErrorResponse',
    ({ test, beforeEach }) => {
        let validator: ResponseValidator;

        beforeEach(() => {
            validator = new ResponseValidator();
        });

        test('应该创建正确格式的错误响应', () => {
            const response = validator.createErrorResponse(-1, '错误消息');

            expect(response.code).toBe(-1);
            expect(response.msg).toBe('错误消息');
            expect(response.data).toBeNull();
        });

        test('应该支持任意错误码', () => {
            const response = validator.createErrorResponse(-500, '服务器错误');
            expect(response.code).toBe(-500);
        });
    }
);

/**
 * 错误响应工厂函数测试套件
 */
export const errorResponseFactorySuite = describe(
    'Error Response Factory Functions',
    ({ test }) => {
        test('createForbiddenResponse 应该创建 -403 错误', () => {
            const response = createForbiddenResponse();
            expect(response.code).toBe(ERROR_CODE_FORBIDDEN);
            expect(response.msg).toBe('Forbidden');
            expect(response.data).toBeNull();
        });

        test('createForbiddenResponse 应该支持自定义消息', () => {
            const response = createForbiddenResponse('Access Denied');
            expect(response.msg).toBe('Access Denied');
        });

        test('createNotFoundResponse 应该创建 -404 错误', () => {
            const response = createNotFoundResponse();
            expect(response.code).toBe(ERROR_CODE_NOT_FOUND);
            expect(response.msg).toBe('Not Found');
            expect(response.data).toBeNull();
        });

        test('createNotFoundResponse 应该支持自定义消息', () => {
            const response = createNotFoundResponse('Resource Not Found');
            expect(response.msg).toBe('Resource Not Found');
        });

        test('createNetworkErrorResponse 应该创建 -1 错误', () => {
            const response = createNetworkErrorResponse();
            expect(response.code).toBe(ERROR_CODE_NETWORK);
            expect(response.msg).toBe('Network Error');
            expect(response.data).toBeNull();
        });

        test('createNetworkErrorResponse 应该支持自定义消息', () => {
            const response = createNetworkErrorResponse('Connection refused');
            expect(response.msg).toBe('Connection refused');
        });

        test('createHttpErrorResponse 应该处理 403 状态码', () => {
            const response = createHttpErrorResponse(403, 'Forbidden');
            expect(response.code).toBe(ERROR_CODE_FORBIDDEN);
        });

        test('createHttpErrorResponse 应该处理 404 状态码', () => {
            const response = createHttpErrorResponse(404, 'Not Found');
            expect(response.code).toBe(ERROR_CODE_NOT_FOUND);
        });

        test('createHttpErrorResponse 应该处理其他状态码', () => {
            const response = createHttpErrorResponse(500, 'Internal Server Error');
            expect(response.code).toBe(-500);
            expect(response.msg).toBe('Internal Server Error');
        });

        test('createHttpErrorResponse 应该处理空状态文本', () => {
            const response = createHttpErrorResponse(502, '');
            expect(response.msg).toBe('HTTP Error 502');
        });
    }
);

/**
 * responseValidator 单例测试套件
 */
export const responseValidatorSingletonSuite = describe(
    'responseValidator singleton',
    ({ test }) => {
        test('应该是 ResponseValidator 的实例', () => {
            expect(responseValidator).toBeInstanceOf(ResponseValidator);
        });

        test('应该具有所有必需的方法', () => {
            expect(typeof responseValidator.isValidResponse).toBe('function');
            expect(typeof responseValidator.validate).toBe('function');
            expect(typeof responseValidator.createErrorResponse).toBe('function');
        });
    }
);

// ============================================================================
// 导出所有测试套件
// ============================================================================

/**
 * 所有 TransactionHandler 测试套件
 */
export const transactionHandlerSuites = [
    isTransactionApiSuite,
    shouldTriggerKernelErrorSuite,
    handleTransactionErrorSuite,
    transactionHandlerSingletonSuite,
];

/**
 * 所有 MessageHandler 测试套件
 */
export const messageHandlerSuites = [
    processMessageSuite,
    showHideMessageSuite,
    messageHandlerSingletonSuite,
];

/**
 * 所有 ResponseValidator 测试套件
 */
export const responseValidatorSuites = [
    isValidResponseSuite,
    validateSuite,
    createErrorResponseSuite,
    errorResponseFactorySuite,
    responseValidatorSingletonSuite,
];

/**
 * 所有处理器测试套件
 */
export const handlersSuites = [
    ...transactionHandlerSuites,
    ...messageHandlerSuites,
    ...responseValidatorSuites,
];
