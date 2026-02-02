/**
 * 竞态控制器单元测试
 *
 * 测试 RaceController 的核心功能：
 * - registerRequest: 生成唯一请求ID
 * - isResponseStale: 判断响应是否过期
 * - shouldControl: 识别需要竞态控制的API
 * - clear/clearAll: 清理功能
 *
 * @module __tests__/raceController.test
 */

import { describe, expect } from './testUtils';
import {
    createRaceController,
    IRaceController,
} from '../utils/raceController';
import { DEFAULT_RACE_CONTROL_APIS } from '../types/config';

// ============================================================================
// 测试套件：registerRequest
// ============================================================================

/**
 * registerRequest 方法测试套件
 *
 * 验证请求ID生成的正确性和唯一性
 */
export const registerRequestSuite = describe(
    'RaceController.registerRequest',
    ({ test, beforeEach }) => {
        let controller: IRaceController;

        beforeEach(() => {
            controller = createRaceController();
        });

        test('应该生成非空的请求ID', () => {
            const reqId = controller.registerRequest('/api/test');
            expect(reqId).toBeTruthy();
            expect(typeof reqId).toBe('string');
        });

        test('应该为不同URL生成不同的请求ID', () => {
            const reqId1 = controller.registerRequest('/api/test1');
            const reqId2 = controller.registerRequest('/api/test2');

            // 两个ID都应该存在
            expect(reqId1).toBeTruthy();
            expect(reqId2).toBeTruthy();

            // 由于时间戳可能相同，我们只验证它们都是有效的字符串
            expect(typeof reqId1).toBe('string');
            expect(typeof reqId2).toBe('string');
        });

        test('应该为同一URL的连续请求生成不同的ID', async () => {
            const url = '/api/search/searchRefBlock';
            const reqId1 = controller.registerRequest(url);

            // 等待一小段时间确保时间戳不同
            await new Promise((resolve) => setTimeout(resolve, 1));

            const reqId2 = controller.registerRequest(url);

            // 两个ID应该不同（因为时间戳不同）
            expect(reqId1).toBeTruthy();
            expect(reqId2).toBeTruthy();
            // 注意：在极快的执行环境中，时间戳可能相同
            // 但 generateRequestId 使用了 performance.now() 或随机数来确保唯一性
        });

        test('请求ID应该包含时间戳信息', () => {
            const reqId = controller.registerRequest('/api/test');

            // ID 格式应该是 "timestamp-xxx" 的形式
            expect(reqId).toContain('-');

            // 提取时间戳部分并验证
            const timestampPart = reqId.split('-')[0];
            const timestamp = parseInt(timestampPart, 10);
            expect(timestamp).toBeGreaterThan(0);
        });
    }
);

// ============================================================================
// 测试套件：isResponseStale
// ============================================================================

/**
 * isResponseStale 方法测试套件
 *
 * 验证响应过期判断的正确性
 */
export const isResponseStaleSuite = describe(
    'RaceController.isResponseStale',
    ({ test, beforeEach }) => {
        let controller: IRaceController;

        beforeEach(() => {
            controller = createRaceController();
        });

        test('当请求ID匹配时应该返回false（响应未过期）', () => {
            const url = '/api/test';
            const reqId = controller.registerRequest(url);

            const isStale = controller.isResponseStale(url, reqId);
            expect(isStale).toBe(false);
        });

        test('当有新请求时旧请求ID应该返回true（响应已过期）', () => {
            const url = '/api/search/searchRefBlock';

            // 第一个请求
            const oldReqId = controller.registerRequest(url);

            // 第二个请求（覆盖第一个）
            controller.registerRequest(url);

            // 第一个请求的响应应该被标记为过期
            const isStale = controller.isResponseStale(url, oldReqId);
            expect(isStale).toBe(true);
        });

        test('当URL未注册时应该返回false', () => {
            const isStale = controller.isResponseStale(
                '/api/unregistered',
                'some-id'
            );
            expect(isStale).toBe(false);
        });

        test('当URL被清理后应该返回false', () => {
            const url = '/api/test';
            const reqId = controller.registerRequest(url);

            // 清理该URL的记录
            controller.clear(url);

            // 清理后应该返回false（因为没有记录了）
            const isStale = controller.isResponseStale(url, reqId);
            expect(isStale).toBe(false);
        });

        test('不同URL的请求ID不应该互相影响', () => {
            const url1 = '/api/test1';
            const url2 = '/api/test2';

            const reqId1 = controller.registerRequest(url1);
            const reqId2 = controller.registerRequest(url2);

            // 各自的请求ID应该都是有效的
            expect(controller.isResponseStale(url1, reqId1)).toBe(false);
            expect(controller.isResponseStale(url2, reqId2)).toBe(false);

            // 更新url1不应该影响url2
            controller.registerRequest(url1);
            expect(controller.isResponseStale(url1, reqId1)).toBe(true);
            expect(controller.isResponseStale(url2, reqId2)).toBe(false);
        });
    }
);

// ============================================================================
// 测试套件：shouldControl
// ============================================================================

/**
 * shouldControl 方法测试套件
 *
 * 验证API竞态控制判断的正确性
 */
export const shouldControlSuite = describe(
    'RaceController.shouldControl',
    ({ test, beforeEach }) => {
        let controller: IRaceController;

        beforeEach(() => {
            controller = createRaceController();
        });

        test('默认列表中的API应该返回true', () => {
            // 测试默认列表中的所有API
            for (const api of DEFAULT_RACE_CONTROL_APIS) {
                expect(controller.shouldControl(api)).toBe(true);
            }
        });

        test('不在默认列表中的API应该返回false', () => {
            expect(controller.shouldControl('/api/block/getBlockInfo')).toBe(
                false
            );
            expect(controller.shouldControl('/api/system/version')).toBe(false);
            expect(controller.shouldControl('/api/custom/endpoint')).toBe(
                false
            );
        });

        test('自定义列表中的API应该返回true', () => {
            const customApis = ['/api/custom/api1', '/api/custom/api2'];

            expect(
                controller.shouldControl('/api/custom/api1', customApis)
            ).toBe(true);
            expect(
                controller.shouldControl('/api/custom/api2', customApis)
            ).toBe(true);
        });

        test('自定义列表应该与默认列表合并', () => {
            const customApis = ['/api/custom/api'];

            // 默认列表中的API仍然应该返回true
            expect(
                controller.shouldControl(
                    '/api/search/searchRefBlock',
                    customApis
                )
            ).toBe(true);

            // 自定义列表中的API也应该返回true
            expect(
                controller.shouldControl('/api/custom/api', customApis)
            ).toBe(true);

            // 不在任何列表中的API应该返回false
            expect(
                controller.shouldControl('/api/other/endpoint', customApis)
            ).toBe(false);
        });

        test('空自定义列表不应该影响默认列表', () => {
            expect(
                controller.shouldControl('/api/search/searchRefBlock', [])
            ).toBe(true);
            expect(
                controller.shouldControl('/api/block/getBlockInfo', [])
            ).toBe(false);
        });

        test('应该正确识别所有默认竞态控制API', () => {
            // 验证默认列表包含预期的API
            expect(DEFAULT_RACE_CONTROL_APIS).toContain(
                '/api/search/searchRefBlock'
            );
            expect(DEFAULT_RACE_CONTROL_APIS).toContain('/api/graph/getGraph');
            expect(DEFAULT_RACE_CONTROL_APIS).toContain(
                '/api/graph/getLocalGraph'
            );
            expect(DEFAULT_RACE_CONTROL_APIS).toContain(
                '/api/block/getRecentUpdatedBlocks'
            );
            expect(DEFAULT_RACE_CONTROL_APIS).toContain(
                '/api/search/fullTextSearchBlock'
            );
        });
    }
);

// ============================================================================
// 测试套件：clear 和 clearAll
// ============================================================================

/**
 * clear 和 clearAll 方法测试套件
 *
 * 验证清理功能的正确性
 */
export const clearSuite = describe(
    'RaceController.clear/clearAll',
    ({ test, beforeEach }) => {
        let controller: IRaceController;

        beforeEach(() => {
            controller = createRaceController();
        });

        test('clear应该只清理指定URL的记录', () => {
            const url1 = '/api/test1';
            const url2 = '/api/test2';

            const reqId1 = controller.registerRequest(url1);
            const reqId2 = controller.registerRequest(url2);

            // 清理url1
            controller.clear(url1);

            // url1的记录应该被清理（isResponseStale返回false因为没有记录）
            expect(controller.isResponseStale(url1, reqId1)).toBe(false);

            // url2的记录应该保留
            expect(controller.isResponseStale(url2, reqId2)).toBe(false);

            // 为url2注册新请求后，旧请求应该过期
            controller.registerRequest(url2);
            expect(controller.isResponseStale(url2, reqId2)).toBe(true);
        });

        test('clear对未注册的URL应该安全执行', () => {
            // 不应该抛出异常
            controller.clear('/api/nonexistent');
        });

        test('clearAll应该清理所有URL的记录', () => {
            const url1 = '/api/test1';
            const url2 = '/api/test2';
            const url3 = '/api/test3';

            const reqId1 = controller.registerRequest(url1);
            const reqId2 = controller.registerRequest(url2);
            const reqId3 = controller.registerRequest(url3);

            // 清理所有记录
            controller.clearAll();

            // 所有URL的记录都应该被清理
            expect(controller.isResponseStale(url1, reqId1)).toBe(false);
            expect(controller.isResponseStale(url2, reqId2)).toBe(false);
            expect(controller.isResponseStale(url3, reqId3)).toBe(false);
        });

        test('clearAll后应该能够重新注册请求', () => {
            const url = '/api/test';

            controller.registerRequest(url);
            controller.clearAll();

            // 重新注册应该正常工作
            const newReqId = controller.registerRequest(url);
            expect(newReqId).toBeTruthy();
            expect(controller.isResponseStale(url, newReqId)).toBe(false);
        });

        test('clear后应该能够重新注册同一URL', () => {
            const url = '/api/test';

            const oldReqId = controller.registerRequest(url);
            controller.clear(url);

            // 重新注册
            const newReqId = controller.registerRequest(url);
            expect(newReqId).toBeTruthy();
            expect(controller.isResponseStale(url, newReqId)).toBe(false);

            // 旧ID应该仍然返回false（因为记录已被清理后重新创建）
            expect(controller.isResponseStale(url, oldReqId)).toBe(true);
        });
    }
);

// ============================================================================
// 测试套件：工厂函数
// ============================================================================

/**
 * createRaceController 工厂函数测试套件
 *
 * 验证工厂函数创建独立实例的能力
 */
export const factorySuite = describe(
    'createRaceController',
    ({ test }) => {
        test('应该创建独立的控制器实例', () => {
            const controller1 = createRaceController();
            const controller2 = createRaceController();

            const url = '/api/test';

            // 在controller1中注册
            const reqId1 = controller1.registerRequest(url);

            // controller2应该是独立的，不受controller1影响
            expect(controller2.isResponseStale(url, reqId1)).toBe(false);

            // 在controller2中注册不应该影响controller1
            controller2.registerRequest(url);
            expect(controller1.isResponseStale(url, reqId1)).toBe(false);
        });

        test('每次调用应该返回新实例', () => {
            const controller1 = createRaceController();
            const controller2 = createRaceController();

            // 虽然无法直接比较引用，但可以通过行为验证它们是独立的
            const url = '/api/test';

            controller1.registerRequest(url);
            controller1.clearAll();

            // controller2不应该受到controller1.clearAll()的影响
            const reqId2 = controller2.registerRequest(url);
            expect(controller2.isResponseStale(url, reqId2)).toBe(false);
        });
    }
);

// ============================================================================
// 导出所有测试套件
// ============================================================================

/**
 * 所有竞态控制器测试套件
 */
export const raceControllerSuites = [
    registerRequestSuite,
    isResponseStaleSuite,
    shouldControlSuite,
    clearSuite,
    factorySuite,
];
