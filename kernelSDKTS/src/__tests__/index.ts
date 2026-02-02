/**
 * 测试入口文件
 *
 * 汇总所有测试套件并提供统一的测试运行入口。
 *
 * @module __tests__/index
 *
 * @example
 * ```typescript
 * // 运行所有测试
 * import { runAllTests } from './__tests__';
 * runAllTests();
 *
 * // 或者只运行特定模块的测试
 * import { runRaceControllerTests, runHandlersTests } from './__tests__';
 * runRaceControllerTests();
 * ```
 */

import { TestRunner, ISuiteResult } from './testUtils';
import { raceControllerSuites } from './raceController.test';
import {
    handlersSuites,
    transactionHandlerSuites,
    messageHandlerSuites,
    responseValidatorSuites,
} from './handlers.test';

// ============================================================================
// 测试运行函数
// ============================================================================

/**
 * 运行竞态控制器测试
 *
 * @returns 测试结果
 */
export async function runRaceControllerTests(): Promise<ISuiteResult[]> {
    const runner = new TestRunner();

    for (const suite of raceControllerSuites) {
        runner.addSuite(suite);
    }

    const results = await runner.runAll();
    runner.printResults(results);

    return results;
}

/**
 * 运行事务处理器测试
 *
 * @returns 测试结果
 */
export async function runTransactionHandlerTests(): Promise<ISuiteResult[]> {
    const runner = new TestRunner();

    for (const suite of transactionHandlerSuites) {
        runner.addSuite(suite);
    }

    const results = await runner.runAll();
    runner.printResults(results);

    return results;
}

/**
 * 运行消息处理器测试
 *
 * @returns 测试结果
 */
export async function runMessageHandlerTests(): Promise<ISuiteResult[]> {
    const runner = new TestRunner();

    for (const suite of messageHandlerSuites) {
        runner.addSuite(suite);
    }

    const results = await runner.runAll();
    runner.printResults(results);

    return results;
}

/**
 * 运行响应验证器测试
 *
 * @returns 测试结果
 */
export async function runResponseValidatorTests(): Promise<ISuiteResult[]> {
    const runner = new TestRunner();

    for (const suite of responseValidatorSuites) {
        runner.addSuite(suite);
    }

    const results = await runner.runAll();
    runner.printResults(results);

    return results;
}

/**
 * 运行所有处理器测试
 *
 * @returns 测试结果
 */
export async function runHandlersTests(): Promise<ISuiteResult[]> {
    const runner = new TestRunner();

    for (const suite of handlersSuites) {
        runner.addSuite(suite);
    }

    const results = await runner.runAll();
    runner.printResults(results);

    return results;
}

/**
 * 运行所有测试
 *
 * @returns 测试结果
 */
export async function runAllTests(): Promise<ISuiteResult[]> {
    const runner = new TestRunner();

    // 添加所有测试套件
    for (const suite of raceControllerSuites) {
        runner.addSuite(suite);
    }

    for (const suite of handlersSuites) {
        runner.addSuite(suite);
    }

    const results = await runner.runAll();
    runner.printResults(results);

    return results;
}

// ============================================================================
// 导出测试工具
// ============================================================================

export {
    TestRunner,
    TestSuite,
    expect,
    describe,
    AssertionError,
    描述,
    期望,
} from './testUtils';

export type {
    TestFn,
    ITestResult,
    ISuiteResult,
    IExpectMatchers,
} from './testUtils';

// ============================================================================
// 导出测试套件
// ============================================================================

export { raceControllerSuites } from './raceController.test';
export {
    handlersSuites,
    transactionHandlerSuites,
    messageHandlerSuites,
    responseValidatorSuites,
} from './handlers.test';
