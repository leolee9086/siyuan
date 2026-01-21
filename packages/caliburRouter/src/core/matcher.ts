/**
 * CalibURRouter 核心实现
 * 
 * 基于集合论的类型安全模式匹配引擎
 */

import { Type } from "arktype";
import { 匹配 } from "../utils/setOps.js";
import type {
    匹配器构建器,
    可构建匹配器,
    已注册模式,
    分发器,
    处理器
} from "./types.js";

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
     */
    split<模式定义, 新结果>(
        模式: Type<模式定义>,
        处理器: 处理器<模式定义, 新结果>
    ): 匹配器构建器<全集, Exclude<剩余集, 模式定义>, 结果联合 | 新结果> {
        // 创建新的已注册列表（不可变）
        const 新列表: 已注册模式[] = [
            ...this.已注册列表,
            { 模式: 模式 as Type<unknown>, 处理器: 处理器 as 处理器<unknown, unknown> }
        ];

        // 返回新的构建器实例
        return new 匹配器构建器实现(this.全集模式, 新列表) as unknown as
            匹配器构建器<全集, Exclude<剩余集, 模式定义>, 结果联合 | 新结果>;
    }

    /**
     * 处理剩余模式
     */
    remain<新结果>(
        处理器: 处理器<剩余集, 新结果>
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

        return ((输入: 全集) => {
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
