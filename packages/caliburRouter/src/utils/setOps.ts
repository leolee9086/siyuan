/**
 * 集合运算工具函数
 * 
 * 基于arktype的类型能力实现集合论运算
 */

import type { Type } from "arktype";
import type { 状态空间模式 } from "../core/types.js";

const 最大覆盖证明节点数 = 16_384;

/** ArkType 后端边界：核心模式只暴露公共能力，集合运算在此恢复具体后端类型。 */
function asArkType(模式: 状态空间模式): Type<unknown> {
    return 模式 as Type<unknown>;
}

/**
 * 判断输入是否匹配给定模式
 * 
 * @param 模式 - arktype模式定义
 * @param 输入 - 待匹配的值
 * @returns 匹配成功返回验证后的值，失败返回null
 * 
 * @example
 * ```ts
 * const 结果 = 匹配(type({ 名称: "string" }), { 名称: "测试" });
 * if (结果) {
 *   console.log(结果.名称); // 类型安全
 * }
 * ```
 */
export function 匹配<T>(模式: 状态空间模式<T>, 输入: unknown): T | null {
    const 验证结果 = asArkType(模式)(输入);
    // ArkType 2.x 错误检测：检查 ' arkKind' 属性
    // 验证失败时返回 ArkErrors 对象，它是一个数组且有 ' arkKind': 'errors' 属性
    if (typeof 验证结果 === "object" && 验证结果 !== null && " arkKind" in 验证结果) {
        return null;
    }
    // arktype验证成功后返回的是validated value，需要断言类型
    return 验证结果 as T;
}

/**
 * 判断模式A是否是模式B的子集
 * 即：A的所有可能值都是B的可能值
 * 
 * @param a - 模式A
 * @param b - 模式B
 * @returns A ⊆ B 返回true
 * 
 * @example
 * ```ts
 * 是子集(type("'a'"), type("'a' | 'b'")); // true
 * 是子集(type("string"), type("'a'")); // false
 * ```
 */
export function 是子集(a: 状态空间模式, b: 状态空间模式): boolean {
    return asArkType(a).extends(asArkType(b)) === true;
}

type 属性路径 = readonly string[];
type ArkTypeObjectDefinition = {
    readonly [key: string]: object | ArkTypeObjectDefinition;
};

function 是记录(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function 收集必需叶路径(schema: unknown, prefix: 属性路径, result: Map<string, 属性路径>): void {
    if (Array.isArray(schema)) {
        for (const branch of schema) {
            收集必需叶路径(branch, prefix, result);
        }
        return;
    }
    if (!是记录(schema) || !Array.isArray(schema.required)) {
        return;
    }

    for (const property of schema.required) {
        if (!是记录(property) || typeof property.key !== "string" || !("value" in property)) {
            continue;
        }
        const path = [...prefix, property.key];
        const value = property.value;
        if (是记录(value) && Array.isArray(value.required)) {
            收集必需叶路径(value, path, result);
        } else {
            result.set(JSON.stringify(path), path);
        }
    }
}

function 每个分支都要求路径(schema: unknown, path: 属性路径, depth = 0): boolean {
    if (Array.isArray(schema)) {
        return schema.length > 0 && schema.every((branch) => 每个分支都要求路径(branch, path, depth));
    }
    if (!是记录(schema) || !Array.isArray(schema.required)) {
        return false;
    }

    const property = schema.required.find((candidate) =>
        是记录(candidate) && candidate.key === path[depth] && "value" in candidate
    );
    if (!是记录(property) || !("value" in property)) {
        return false;
    }
    return depth === path.length - 1
        ? true
        : 每个分支都要求路径(property.value, path, depth + 1);
}

function 读取属性模式(schema: Type<unknown>, path: 属性路径): Type<unknown> {
    let current = schema;
    for (const key of path) {
        current = (current as Type<Record<string, unknown>>).get(key);
    }
    return current;
}

function 是Unit模式(schema: Type<unknown>): boolean {
    return 是记录(schema.json) && Object.hasOwn(schema.json, "unit");
}

function 创建路径约束(base: Type<unknown>, path: 属性路径, value: Type<unknown>): Type<unknown> {
    if (path.length === 0) {
        throw new Error("calibur-router: 有限路径分区不能使用空属性路径。");
    }
    let definition: object | ArkTypeObjectDefinition = value;
    for (let index = path.length - 1; index >= 0; index--) {
        definition = { [path[index]]: definition };
    }
    // 通过全集模式自身的 parser 构造约束，保证外部 ArkType 实例不会与
    // CaliburRouter 内部依赖的 ArkType 实例混用。
    if (typeof definition !== "object" || definition === null || Array.isArray(definition)) {
        throw new Error("calibur-router: 路径约束必须生成 JSON 对象模式。");
    }
    return base.and(definition);
}

function 创建有限路径分区(
    universe: Type<unknown>,
    patterns: readonly Type<unknown>[],
): Type<unknown>[][] {
    const constrainedPaths = new Map<string, 属性路径>();
    for (const pattern of patterns) {
        收集必需叶路径(pattern.json, [], constrainedPaths);
    }

    const partitions: Type<unknown>[][] = [];
    for (const path of constrainedPaths.values()) {
        if (!每个分支都要求路径(universe.json, path)) {
            continue;
        }
        const values = 读取属性模式(universe, path).distribute((branch) => branch);
        if (values.length < 2 || !values.every(是Unit模式)) {
            continue;
        }
        partitions.push(values.map((value) => 创建路径约束(universe, path, value)));
    }
    return partitions;
}

/**
 * 证明全集是否被多个模式共同覆盖。
 *
 * ArkType 对对象属性联合与部分对象模式联合的子集判断不会自动做笛卡尔分发。
 * 在原生证明未通过时，这里只对模式实际约束的有限 unit 字段分区，并逐区继续证明。
 */
export function 全集被模式集合覆盖(
    universePattern: 状态空间模式,
    patterns: readonly 状态空间模式[],
): boolean {
    if (patterns.length === 0) {
        return false;
    }

    const universe = asArkType(universePattern);
    const arkPatterns = patterns.map(asArkType);
    const covered = arkPatterns.slice(1).reduce(
        (union, pattern) => union.or(pattern),
        arkPatterns[0],
    );
    if (universe.extends(covered)) {
        return true;
    }

    const partitions = 创建有限路径分区(universe, arkPatterns);
    let visitedNodes = 0;

    const prove = (region: Type<unknown>, partitionIndex: number): boolean => {
        visitedNodes++;
        if (visitedNodes > 最大覆盖证明节点数) {
            throw new Error(
                `calibur-router: 运行时覆盖证明超过 ${最大覆盖证明节点数} 个状态分区。` +
                "\n  请使用分层分发器缩小单个路由的有限状态空间。"
            );
        }
        if (region.extends(covered)) {
            return true;
        }
        if (partitionIndex >= partitions.length) {
            return false;
        }

        for (const constraint of partitions[partitionIndex]) {
            if (!有交集(region, constraint)) {
                continue;
            }
            if (!prove(region.and(constraint), partitionIndex + 1)) {
                return false;
            }
        }
        return true;
    };

    return prove(universe, 0);
}

/**
 * 判断两个模式是否有交集
 * 即：存在某个值同时满足两个模式
 * 
 * @param a - 模式A
 * @param b - 模式B
 * @returns A ∩ B ≠ ∅ 返回true
 * 
 * @example
 * ```ts
 * 有交集(type("'a' | 'b'"), type("'b' | 'c'")); // true (交集为'b')
 * 有交集(type("'a'"), type("'b'")); // false
 * ```
 */
export function 有交集(a: 状态空间模式, b: 状态空间模式): boolean {
    try {
        // 计算交集类型
        const 交集 = asArkType(a).and(asArkType(b));
        // 直接检查交集自身的 ArkType 表示，避免拿另一份 ArkType 实例的
        // `type("never")` 与调用方创建的模式做跨实例 extends。
        return !是Never模式(交集);
    } catch (error) {
        // 仅捕获预期的 ArkType "unsatisfiable" 错误
        if (error instanceof Error &&
            error.message.includes('unsatisfiable')) {
            // arktype对某些类型组合会抛出"unsatisfiable type"错误
            // 这通常意味着两个类型没有交集
            return false;
        }
        // 未知错误必须抛出，附带完整上下文信息
        const 错误消息 = `有交集() 遇到未预期的错误: ${error}\n` +
            `类型A: ${asArkType(a).description}\n` +
            `类型B: ${asArkType(b).description}`;
        const 新错误 = new Error(错误消息);
        // 保留原始错误作为 cause（如果运行时支持）
        if ('cause' in 新错误) {
            (新错误 as any).cause = error;
        }
        throw 新错误;
    }
}

/**
 * 检查模式是否为空集（never）
 * 
 * @param 模式 - 待检查的模式
 * @returns 是空集返回true
 */
export function 是空集(模式: 状态空间模式): boolean {
    return 是Never模式(asArkType(模式));
}

function 是Never模式(schema: Type<unknown>): boolean {
    return schema.description === "never" || (Array.isArray(schema.json) && schema.json.length === 0);
}
