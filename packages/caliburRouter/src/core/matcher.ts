/**
 * CalibURRouter 核心实现
 * 
 * 基于集合论的类型安全模式匹配引擎
 */

import { Type } from "arktype";
import { 匹配, 是子集 } from "../utils/setOps.js";
import type {
    匹配器构建器,
    可构建匹配器,
    已注册模式,
    分发器,
    处理器,
    合并类型
} from "./types.js";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查一个处理器是否为分发器（运行时检测）
 * 通过检查是否存在 __全集模式__ 属性来判断
 */
function 处理器是分发器(处理器: unknown): 处理器 is 分发器<unknown, unknown> {
    return (
        typeof 处理器 === "function" &&
        "__全集模式__" in 处理器 &&
        处理器.__全集模式__ !== undefined
    );
}

// ============================================================================
// 内部实现类
// ============================================================================

/**
 * 匹配器构建器实现类
 * 
 * 维护已注册的模式列表，在build时生成分发器
 */
class 匹配器构建器实现<全集, 剩余集, 结果联合> implements 匹配器构建器<全集, 剩余集, 结果联合> {
    /** 全集模式（用于运行时验证） */
    private readonly 全集模式: Type<全集>;
    /** 已注册的模式-处理器对列表 */
    private readonly 已注册列表: 已注册模式[];
    /** 剩余处理器（可选） */
    private 剩余处理器: 处理器<unknown, unknown> | null = null;

    constructor(全集模式: Type<全集>, 已注册列表: 已注册模式[] = []) {
        this.全集模式 = 全集模式;
        this.已注册列表 = 已注册列表;
    }

    /**
     * 切割子集并注册处理器
     * 
     * 支持两种调用方式：
     * 1. split(模式, 处理器) - 普通处理器
     * 2. split(模式, 子分发器, fallback) - 嵌套分发器+fallback
     * 
     * 当使用分发器时，必须提供fallback处理器
     */
    split<模式定义, 新结果>(
        模式: Type<模式定义>,
        处理器或分发器: 处理器<合并类型<全集, 模式定义>, 新结果> | 分发器<unknown, unknown>,
        fallback处理器?: 处理器<合并类型<全集, 模式定义>, unknown>
    ): 匹配器构建器<全集, Exclude<剩余集, 模式定义>, 结果联合 | 新结果> {
        let 实际处理器: 处理器<unknown, unknown>;

        // 检查是否是分发器
        if (处理器是分发器(处理器或分发器)) {
            const 子分发器 = 处理器或分发器;
            const 子全集模式 = 子分发器.__全集模式__;

            // 分发器必须提供 fallback
            if (!fallback处理器) {
                throw new Error(
                    `calibur-router: 使用分发器作为处理器时，必须提供第三参数 fallback 处理器。` +
                    `\n  当前模式: ${JSON.stringify(模式.json)}` +
                    `\n  子分发器全集: ${JSON.stringify(子全集模式.json)}`
                );
            }

            // 验证子分发器的全集是否为当前模式的子集
            if (!是子集(子全集模式, 模式)) {
                throw new Error(
                    `calibur-router: 嵌套分发器的全集不是当前模式的子集。` +
                    `\n  当前模式: ${JSON.stringify(模式.json)}` +
                    `\n  子分发器全集: ${JSON.stringify(子全集模式.json)}`
                );
            }

            // 创建包装处理器：先尝试子分发器，失败则调用fallback
            const fallback = fallback处理器 as 处理器<unknown, unknown>;
            实际处理器 = (输入: unknown) => {
                // 检查输入是否匹配子分发器的全集
                const 子匹配结果 = 匹配(子全集模式, 输入);
                if (子匹配结果 !== null) {
                    return 子分发器(子匹配结果);
                }
                // 不匹配子分发器全集时调用fallback
                return fallback(输入);
            };
        } else {
            // 普通处理器
            实际处理器 = 处理器或分发器 as 处理器<unknown, unknown>;
        }

        // 创建新的已注册列表（不可变）
        const 新列表: 已注册模式[] = [
            ...this.已注册列表,
            { 模式: 模式 as Type<unknown>, 处理器: 实际处理器 }
        ];

        // 返回新的构建器实例
        return new 匹配器构建器实现(this.全集模式, 新列表) as unknown as
            匹配器构建器<全集, Exclude<剩余集, 模式定义>, 结果联合 | 新结果>;
    }

    /**
     * 处理剩余模式
     */
    remain<新结果>(
        // 处理器接收全集类型
        处理器: 处理器<全集, 新结果>
    ): 可构建匹配器<全集, 结果联合 | 新结果> {
        // 创建一个新实例并设置剩余处理器
        const 结果 = new 匹配器构建器实现<全集, never, 结果联合 | 新结果>(
            this.全集模式,
            this.已注册列表
        );
        结果.剩余处理器 = 处理器 as 处理器<unknown, unknown>;
        return 结果 as unknown as 可构建匹配器<全集, 结果联合 | 新结果>;
    }

    /**
     * 构建分发器
     */
    build(): 分发器<全集, 结果联合> {
        const 已注册列表 = this.已注册列表;
        const 剩余处理器 = this.剩余处理器;
        const 全集模式 = this.全集模式;

        const 分发函数 = ((输入: 全集) => {
            // 线性搜索匹配
            for (const { 模式, 处理器 } of 已注册列表) {
                const 结果 = 匹配(模式, 输入);
                if (结果 !== null) {
                    return 处理器(结果);
                }
            }

            // 执行剩余处理器
            if (剩余处理器) {
                return 剩余处理器(输入);
            }

            // 理论上不应该到达这里（如果正确使用remain）
            throw new Error("calibur-router: 未匹配任何模式且未设置剩余处理器");
        }) as 分发器<全集, 结果联合>;

        // 挂载全集模式到分发器，用于嵌套验证
        (分发函数 as 分发器<全集, 结果联合>).__全集模式__ = 全集模式;

        return 分发函数;
    }
}

// ============================================================================
// 公共API
// ============================================================================

/**
 * calibur 命名空间
 * 提供创建模式匹配器的入口API
 */
export const calibur = {
    /**
     * 定义状态空间全集，创建匹配器构建器
     * 
     * @param 全集模式 - arktype模式，定义所有可能的输入
     * @returns 匹配器构建器，可链式调用split和remain
     * 
     * @example
     * ```ts
     * const matcher = calibur.universe(type({
     *   按键: "string",
     *   修饰符: { ctrl: "boolean", shift: "boolean" }
     * }));
     * 
     * matcher
     *   .split(type({ 按键: "'Enter'" }), () => ({ 命令: "回车" }))
     *   .split(type({ 按键: "'Tab'" }), () => ({ 命令: "制表符" }))
     *   .remain(() => ({ 命令: "其他" }))
     *   .build();
     * ```
     */
    universe<全集>(全集模式: Type<全集>): 匹配器构建器<全集, 全集, never> {
        return new 匹配器构建器实现(全集模式) as unknown as 匹配器构建器<全集, 全集, never>;
    }
};

// 类型导出
export type {
    匹配器构建器,
    可构建匹配器,
    分发器,
    处理器,
    已注册模式
} from "./types.js";
