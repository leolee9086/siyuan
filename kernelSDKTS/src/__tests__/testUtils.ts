/**
 * 简单测试工具模块
 *
 * 提供轻量级的测试框架，不依赖外部测试库（如 Jest）。
 * 用于 SDK 单元测试。
 *
 * @module __tests__/testUtils
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 测试用例函数类型
 */
export type TestFn = () => void | Promise<void>;

/**
 * 测试结果接口
 */
export interface ITestResult {
    /** 测试名称 */
    name: string;
    /** 是否通过 */
    passed: boolean;
    /** 错误信息（如果失败） */
    error?: string;
    /** 执行时间（毫秒） */
    duration: number;
}

/**
 * 测试套件结果接口
 */
export interface ISuiteResult {
    /** 套件名称 */
    name: string;
    /** 测试结果列表 */
    tests: ITestResult[];
    /** 通过的测试数量 */
    passed: number;
    /** 失败的测试数量 */
    failed: number;
    /** 总执行时间（毫秒） */
    duration: number;
}

/**
 * 断言匹配器接口
 */
export interface IExpectMatchers<T> {
    /** 严格相等比较 */
    toBe(expected: T): void;
    /** 深度相等比较 */
    toEqual(expected: T): void;
    /** 真值检查 */
    toBeTruthy(): void;
    /** 假值检查 */
    toBeFalsy(): void;
    /** 类型检查 */
    toBeInstanceOf(constructor: Function): void;
    /** 包含检查（字符串或数组） */
    toContain(item: unknown): void;
    /** 抛出异常检查 */
    toThrow(message?: string | RegExp): void;
    /** 未定义检查 */
    toBeUndefined(): void;
    /** 已定义检查 */
    toBeDefined(): void;
    /** null 检查 */
    toBeNull(): void;
    /** 大于检查 */
    toBeGreaterThan(expected: number): void;
    /** 小于检查 */
    toBeLessThan(expected: number): void;
}

// ============================================================================
// 断言错误类
// ============================================================================

/**
 * 断言失败错误
 */
export class AssertionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AssertionError';
    }
}

// ============================================================================
// 断言实现
// ============================================================================

/**
 * 创建断言匹配器
 *
 * @param actual - 实际值
 * @returns 断言匹配器对象
 *
 * @example
 * ```typescript
 * expect(1 + 1).toBe(2);
 * expect({ a: 1 }).toEqual({ a: 1 });
 * expect(true).toBeTruthy();
 * ```
 */
export function expect<T>(actual: T): IExpectMatchers<T> {
    return {
        toBe(expected: T): void {
            if (actual !== expected) {
                throw new AssertionError(
                    `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
                );
            }
        },

        toEqual(expected: T): void {
            const actualStr = JSON.stringify(actual);
            const expectedStr = JSON.stringify(expected);
            if (actualStr !== expectedStr) {
                throw new AssertionError(
                    `Expected ${expectedStr}, but got ${actualStr}`
                );
            }
        },

        toBeTruthy(): void {
            if (!actual) {
                throw new AssertionError(
                    `Expected truthy value, but got ${JSON.stringify(actual)}`
                );
            }
        },

        toBeFalsy(): void {
            if (actual) {
                throw new AssertionError(
                    `Expected falsy value, but got ${JSON.stringify(actual)}`
                );
            }
        },

        toBeInstanceOf(constructor: Function): void {
            if (!(actual instanceof (constructor as new (...args: unknown[]) => unknown))) {
                throw new AssertionError(
                    `Expected instance of ${constructor.name}, but got ${typeof actual}`
                );
            }
        },

        toContain(item: unknown): void {
            if (typeof actual === 'string') {
                if (!actual.includes(item as string)) {
                    throw new AssertionError(
                        `Expected "${actual}" to contain "${item}"`
                    );
                }
            } else if (Array.isArray(actual)) {
                if (!actual.includes(item)) {
                    throw new AssertionError(
                        `Expected array to contain ${JSON.stringify(item)}`
                    );
                }
            } else {
                throw new AssertionError(
                    `toContain can only be used with strings or arrays`
                );
            }
        },

        toThrow(message?: string | RegExp): void {
            if (typeof actual !== 'function') {
                throw new AssertionError(
                    `toThrow can only be used with functions`
                );
            }
            let threw = false;
            let thrownError: Error | undefined;
            try {
                (actual as () => void)();
            } catch (e) {
                threw = true;
                thrownError = e as Error;
            }
            if (!threw) {
                throw new AssertionError(`Expected function to throw`);
            }
            if (message !== undefined && thrownError) {
                if (typeof message === 'string') {
                    if (!thrownError.message.includes(message)) {
                        throw new AssertionError(
                            `Expected error message to contain "${message}", but got "${thrownError.message}"`
                        );
                    }
                } else if (message instanceof RegExp) {
                    if (!message.test(thrownError.message)) {
                        throw new AssertionError(
                            `Expected error message to match ${message}, but got "${thrownError.message}"`
                        );
                    }
                }
            }
        },

        toBeUndefined(): void {
            if (actual !== undefined) {
                throw new AssertionError(
                    `Expected undefined, but got ${JSON.stringify(actual)}`
                );
            }
        },

        toBeDefined(): void {
            if (actual === undefined) {
                throw new AssertionError(`Expected value to be defined`);
            }
        },

        toBeNull(): void {
            if (actual !== null) {
                throw new AssertionError(
                    `Expected null, but got ${JSON.stringify(actual)}`
                );
            }
        },

        toBeGreaterThan(expected: number): void {
            if (typeof actual !== 'number' || actual <= expected) {
                throw new AssertionError(
                    `Expected ${actual} to be greater than ${expected}`
                );
            }
        },

        toBeLessThan(expected: number): void {
            if (typeof actual !== 'number' || actual >= expected) {
                throw new AssertionError(
                    `Expected ${actual} to be less than ${expected}`
                );
            }
        },
    };
}

// ============================================================================
// 测试运行器
// ============================================================================

/**
 * 测试套件类
 *
 * 用于组织和运行一组相关的测试用例。
 *
 * @example
 * ```typescript
 * const suite = new TestSuite('RaceController');
 *
 * suite.test('should generate unique ID', () => {
 *     const id = controller.registerRequest('/api/test');
 *     expect(id).toBeTruthy();
 * });
 *
 * const results = await suite.run();
 * ```
 */
export class TestSuite {
    /** 套件名称 */
    private readonly name: string;

    /** 测试用例列表 */
    private readonly tests: Array<{ name: string; fn: TestFn }> = [];

    /** 每个测试前执行的钩子 */
    private beforeEachFn?: TestFn;

    /** 每个测试后执行的钩子 */
    private afterEachFn?: TestFn;

    /**
     * 创建测试套件
     *
     * @param name - 套件名称
     */
    constructor(name: string) {
        this.name = name;
    }

    /**
     * 添加测试用例
     *
     * @param name - 测试名称
     * @param fn - 测试函数
     */
    test(name: string, fn: TestFn): void {
        this.tests.push({ name, fn });
    }

    /**
     * 设置每个测试前执行的钩子
     *
     * @param fn - 钩子函数
     */
    beforeEach(fn: TestFn): void {
        this.beforeEachFn = fn;
    }

    /**
     * 设置每个测试后执行的钩子
     *
     * @param fn - 钩子函数
     */
    afterEach(fn: TestFn): void {
        this.afterEachFn = fn;
    }

    /**
     * 运行所有测试
     *
     * @returns 测试套件结果
     */
    async run(): Promise<ISuiteResult> {
        const results: ITestResult[] = [];
        const suiteStart = Date.now();

        for (const { name, fn } of this.tests) {
            const testStart = Date.now();
            let passed = true;
            let error: string | undefined;

            try {
                // 执行 beforeEach 钩子
                if (this.beforeEachFn) {
                    await this.beforeEachFn();
                }

                // 执行测试
                await fn();

                // 执行 afterEach 钩子
                if (this.afterEachFn) {
                    await this.afterEachFn();
                }
            } catch (e) {
                passed = false;
                error = e instanceof Error ? e.message : String(e);
            }

            results.push({
                name,
                passed,
                error,
                duration: Date.now() - testStart,
            });
        }

        const passed = results.filter((r) => r.passed).length;
        const failed = results.filter((r) => !r.passed).length;

        return {
            name: this.name,
            tests: results,
            passed,
            failed,
            duration: Date.now() - suiteStart,
        };
    }
}

// ============================================================================
// 测试运行器
// ============================================================================

/**
 * 测试运行器类
 *
 * 用于运行多个测试套件并汇总结果。
 *
 * @example
 * ```typescript
 * const runner = new TestRunner();
 * runner.addSuite(raceControllerSuite);
 * runner.addSuite(handlersSuite);
 *
 * const results = await runner.runAll();
 * runner.printResults(results);
 * ```
 */
export class TestRunner {
    /** 测试套件列表 */
    private readonly suites: TestSuite[] = [];

    /**
     * 添加测试套件
     *
     * @param suite - 测试套件
     */
    addSuite(suite: TestSuite): void {
        this.suites.push(suite);
    }

    /**
     * 运行所有测试套件
     *
     * @returns 所有套件的结果
     */
    async runAll(): Promise<ISuiteResult[]> {
        const results: ISuiteResult[] = [];

        for (const suite of this.suites) {
            const result = await suite.run();
            results.push(result);
        }

        return results;
    }

    /**
     * 打印测试结果
     *
     * @param results - 测试结果列表
     */
    printResults(results: ISuiteResult[]): void {
        let totalPassed = 0;
        let totalFailed = 0;

        console.log('\n========================================');
        console.log('           TEST RESULTS');
        console.log('========================================\n');

        for (const suite of results) {
            console.log(`📦 ${suite.name}`);
            console.log(`   Duration: ${suite.duration}ms`);
            console.log('');

            for (const test of suite.tests) {
                const status = test.passed ? '✅' : '❌';
                console.log(`   ${status} ${test.name} (${test.duration}ms)`);
                if (test.error) {
                    console.log(`      Error: ${test.error}`);
                }
            }

            console.log('');
            totalPassed += suite.passed;
            totalFailed += suite.failed;
        }

        console.log('========================================');
        console.log(`Total: ${totalPassed + totalFailed} tests`);
        console.log(`✅ Passed: ${totalPassed}`);
        console.log(`❌ Failed: ${totalFailed}`);
        console.log('========================================\n');
    }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建测试套件的便捷函数
 *
 * @param name - 套件名称
 * @param setupFn - 设置函数，接收 test 和 beforeEach 函数
 * @returns 测试套件
 *
 * @example
 * ```typescript
 * const suite = describe('RaceController', ({ test, beforeEach }) => {
 *     let controller: IRaceController;
 *
 *     beforeEach(() => {
 *         controller = createRaceController();
 *     });
 *
 *     test('should generate unique ID', () => {
 *         const id = controller.registerRequest('/api/test');
 *         expect(id).toBeTruthy();
 *     });
 * });
 * ```
 */
export function describe(
    name: string,
    setupFn: (helpers: {
        test: (name: string, fn: TestFn) => void;
        beforeEach: (fn: TestFn) => void;
        afterEach: (fn: TestFn) => void;
    }) => void
): TestSuite {
    const suite = new TestSuite(name);

    setupFn({
        test: (testName, fn) => suite.test(testName, fn),
        beforeEach: (fn) => suite.beforeEach(fn),
        afterEach: (fn) => suite.afterEach(fn),
    });

    return suite;
}

/** describe 的别名 */
export const 描述 = describe;

/** expect 的中文别名 */
export const 期望 = expect;
