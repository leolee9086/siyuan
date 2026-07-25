/**
 * CalibURRouter 核心实现
 * 
 * 基于集合论的类型安全模式匹配引擎
 */

import { type } from "arktype";
import { 匹配, 是子集, 有交集, 全集被模式集合覆盖 } from "../utils/setOps.js";
import type {
    匹配器构建器,
    可构建匹配器,
    已注册模式,
    分发器,
    处理器,
    合并类型,
    耗尽的匹配器构建器,
    状态空间模式,
} from "./types.js";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 安全地序列化对象，处理循环引用等边界情况
 */
function safeStringify(obj: unknown): string {
    try {
        return JSON.stringify(obj);
    } catch {
        // 降级策略：提供类型信息
        const type = Object.prototype.toString.call(obj);
        return `[${type}] (无法序列化)`;
    }
}

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
class 匹配器构建器实现<全集, 剩余集, 结果联合> {
    /** 全集模式（用于运行时验证） */
    private readonly 全集模式: 状态空间模式<全集>;
    /** 已注册的模式-处理器对列表 */
    private readonly 已注册列表: 已注册模式[];
    /** 剩余处理器（可选） */
    private 剩余处理器: 处理器<unknown, unknown> | null = null;
    /** 是否已耗尽（运行时标志） */
    private readonly 已耗尽: boolean;

    constructor(
        全集模式: 状态空间模式<全集>,
        已注册列表: 已注册模式[] = [],
        已耗尽: boolean = false
    ) {
        this.全集模式 = 全集模式;
        this.已注册列表 = 已注册列表;
        this.已耗尽 = 已耗尽;
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
        模式: 状态空间模式<模式定义>,
        处理器或分发器: any,
        fallback处理器?: 处理器<合并类型<全集, 模式定义>, unknown>
    ): any {
        // 1. 运行时耗尽检查
        if (this.已耗尽) {
            throw new Error(
                "calibur-router: 当前匹配器已耗尽（所有可能状态已被覆盖），不允许继续调用 split 或 remain。" +
                "\n  只有 build() 方法是允许的。"
            );
        }

        let 实际处理器: 处理器<unknown, unknown>;

        // 检查是否是分发器
        if (处理器是分发器(处理器或分发器)) {
            const 子分发器 = 处理器或分发器;
            const 子全集模式 = 子分发器.__全集模式__;

            // 分发器必须提供 fallback
            if (!fallback处理器) {
                throw new Error(
                    `calibur-router: 使用分发器作为处理器时，必须提供第三参数 fallback 处理器。` +
                    `\n  当前模式: ${模式.description}` +
                    `\n  子分发器全集: ${子全集模式.description}`
                );
            }

            // 验证子分发器的全集是否为当前模式的子集
            if (!是子集(子全集模式, 模式)) {
                throw new Error(
                    `calibur-router: 嵌套分发器的全集不是当前模式的子集。` +
                    `\n  当前模式: ${模式.description}` +
                    `\n  子分发器全集: ${子全集模式.description}`
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

        // 检查新模式是否与已注册的模式有交集
        for (const 已注册 of this.已注册列表) {
            if (有交集(模式, 已注册.模式)) {
                throw new Error(
                    `calibur-router: 模式重叠检测失败。新模式与已注册模式有交集，这会导致新模式永远无法被匹配。` +
                    `\n  已注册模式: ${已注册.模式.description}` +
                    `\n  新模式: ${模式.description}` +
                    `\n  提示: 请确保 split 的模式互不重叠，或者使用嵌套分发器来处理子集关系。`
                );
            }
        }

        // 创建新的已注册列表（不可变）
        const 新列表: 已注册模式[] = [
            ...this.已注册列表,
            { 模式, 处理器: 实际处理器 }
        ];

        // 2. 计算新的耗尽状态。ArkType 后端负责证明部分对象模式的联合覆盖。
        const 新是否已耗尽 = 全集被模式集合覆盖(
            this.全集模式,
            新列表.map(({ 模式 }) => 模式),
        );

        // 返回新的构建器实例
        return new 匹配器构建器实现(this.全集模式, 新列表, 新是否已耗尽) as unknown as
            匹配器构建器<全集, 结果联合 | 新结果>;
    }

    /**
     * 处理剩余模式
     */
    remain<新结果>(
        // 处理器接收剩余类型
        处理器: 处理器<剩余集, 新结果>
    ): 可构建匹配器<全集, 结果联合 | 新结果> {
        // 1. 运行时耗尽检查
        if (this.已耗尽) {
            throw new Error(
                "calibur-router: 剩余集为空（全集已被之前的模式完全覆盖），不允许调用 remain。" +
                "\n  所有情况都已处理，请直接调用 build()。"
            );
        }

        // 创建一个新实例并设置剩余处理器
        const 结果 = new 匹配器构建器实现<全集, never, 结果联合 | 新结果>(
            this.全集模式,
            this.已注册列表,
            true // remain 理论上消耗所有剩余，所以标记为耗尽（虽然 remain 返回的可构建匹配器不再有 split 方法）
        );
        结果.剩余处理器 = 处理器 as 处理器<unknown, unknown>;
        return 结果 as unknown as 可构建匹配器<全集, 结果联合 | 新结果>;
    }

    /** 注册不读取剩余状态的兜底处理器。 */
    otherwise<新结果>(处理器: () => 新结果): 可构建匹配器<全集, 结果联合 | 新结果> {
        return this.remain(处理器);
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

            // 如果所有模式都没匹配，且没有剩余处理器
            // 但如果在编译期保证了全覆盖（Exhausted -> split returned ExhaustedMatcherBuilder -> only build），
            // 理论上应该匹配上了。
            // 除非：运行时输入不在全集范围内（ArkType校验可能在边界处），或者逻辑漏洞。
            // 不过对于 ExhaustedMatcherBuilder，我们没有强制要求必须有 remain。
            // 如果 build() 被调用且没有 remain，这意味着全集应该被 patterns 覆盖。
            // 我们可以在这里抛出更有意义的错误。

            throw new Error(
                "calibur-router: 分发失败。输入未匹配任何模式，且未定义 remain 处理器。" +
                "\n  输入: " + safeStringify(输入) +
                "\n  请检查是否遗漏了某些情况，或考虑通过 .remain() 提供默认处理。"
            );
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
     */
    universe<全集>(全集模式: 状态空间模式<全集>): 匹配器构建器<全集, never> {
        return new 匹配器构建器实现(全集模式) as unknown as 匹配器构建器<全集, never>;
    }
};

// 类型导出
export type {
    匹配器构建器,
    可构建匹配器,
    分发器,
    处理器,
    已注册模式,
    耗尽的匹配器构建器
} from "./types.js";
