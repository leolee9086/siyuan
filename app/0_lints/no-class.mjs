/**
 * 禁止使用 class 关键字
 *
 * 架构决策：坚持使用函数式编程模式（工厂函数、闭包、模块级函数等）
 * 替代面向对象编程。class 关键字仅在经由充分论证并附有详细说明后
 * 才允许豁免，豁免注释必须不少于 500 字符。
 *
 * 豁免格式：
 *   // @允许类: <详细的解释说明，不少于 500 字符>
 *   class Foo { ... }
 *
 * 未使用的豁免注释也会被报错，避免残留不一致。
 *
 * 常见函数式替代方案：
 * - 状态容器 → 闭包 + 模块级变量
 * - 方法调用 → 模块级函数，状态作为参数传入
 * - 构造逻辑 → 工厂函数
 * - 多态分发 → 策略模式对象映射
 * - 命名空间 → 模块作用域
 * - 生命周期管理 → 组合函数
 */

import { FULL_FIX_REMINDER, 单文件检查提示 } from "./shared-constants.mjs";

/** 豁免注释的最小字符数 */
const MIN_EXEMPTION_LENGTH = 500;
/** 豁免注释前缀 */
const EXEMPTION_PREFIX = "@允许类:";

export const noClassPlugin = {
    rules: {
        "no-class": {
            meta: {
                type: "problem",
                docs: {
                    description: "禁止使用 class 关键字，要求使用函数式编程模式替代",
                    recommended: "error",
                },
                messages: {
                    forbiddenClass: [
                        "❌ [架构约束] 禁止使用 class 关键字。",
                        "",
                        "请使用函数式编程模式（工厂函数、闭包、模块级函数等）替代面向对象编程。",
                        "class 增加了隐式状态管理和继承复杂度，而函数式模式更易于测试、组合和推理。",
                        "",
                        "常见替代方案：",
                        "  - 状态容器 → 闭包 + 模块级变量",
                        "  - 方法调用 → 模块级函数，状态作为参数传入",
                        "  - 构造逻辑 → 工厂函数",
                        "  - 多态分发 → 策略模式对象映射",
                        "  - 命名空间 → 模块作用域",
                        "  - 生命周期管理 → 组合函数",
                        "",
                        `如果确需使用 class，必须在上一行使用至少 ${MIN_EXEMPTION_LENGTH} 字符的注释进行豁免。`,
                        `格式: // ${EXEMPTION_PREFIX} <详细解释>`,
                        "",
                        "豁免注释必须阐明以下问题：",
                        "  1. 为什么无法使用函数式替代方案？",
                        "  2. 已经评估了哪些替代方案以及它们为何不可行？",
                        "  3. class 方案在可维护性上的具体优势是什么？",
                    ].join("\n") + FULL_FIX_REMINDER + 单文件检查提示,

                    commentTooShort: [
                        `❌ 豁免注释长度不足。`,
                        `// ${EXEMPTION_PREFIX} 注释必须包含至少 ${MIN_EXEMPTION_LENGTH} 字符的详细解释。`,
                        "当前仅 {{actual}} 字符。",
                        "",
                        "请补充充分的技术理由，包括但不限于：",
                        "  1. 具体业务场景和上下文",
                        "  2. 无法使用函数式替代方案的根本原因",
                        "  3. 已评估的替代方案及其逐个排除的理由",
                        "  4. class 方案在本场景中带来的具体可维护性优势",
                        "  5. 如果将来条件变化，如何迁移到函数式模式",
                    ].join("\n") + FULL_FIX_REMINDER + 单文件检查提示,

                    invalidIgnore: [
                        `❌ 这里使用了 // ${EXEMPTION_PREFIX}，但是紧邻的下一行并没有发现 class 定义。`,
                        "如果不再需要豁免，请移除这行注释以避免混淆。",
                        "如果初衷确实是豁免 class，请确保豁免注释紧邻在 class 定义之前。",
                    ].join("\n") + FULL_FIX_REMINDER + 单文件检查提示,
                },
                schema: [],
            },
            create(context) {
                const sourceCode = context.getSourceCode();

                // 收集文件中所有 @允许类 注释，用于在 Program:exit 中检测未使用豁免
                const exemptionComments = [];
                for (const comment of sourceCode.getAllComments()) {
                    if (comment.type === "Line" && comment.value.trim().startsWith("@允许类")) {
                        exemptionComments.push(comment);
                    }
                }

                // 记录已匹配到 class 的豁免注释
                const usedComments = new Set();

                return {
                    /**
                     * 匹配所有 class 定义（包括声明和表达式）。
                     * 在 class 前寻找豁免注释，如果没有或长度不足则报错。
                     */
                    "ClassDeclaration, ClassExpression"(node) {
                        // 查找紧邻在 class 前的豁免注释
                        const commentsBefore = sourceCode.getCommentsBefore(node);
                        const exemptionComment = commentsBefore.find(
                            c => c.type === "Line" && c.value.trim().startsWith("@允许类"),
                        );

                        if (exemptionComment) {
                            usedComments.add(exemptionComment);

                            // 检查注释长度是否满足最低要求
                            const commentText = exemptionComment.value.trim();
                            if (commentText.length < MIN_EXEMPTION_LENGTH) {
                                context.report({
                                    loc: exemptionComment.loc,
                                    messageId: "commentTooShort",
                                    data: { actual: commentText.length },
                                });
                                return;
                            }

                            // 检查前缀格式正确
                            if (!commentText.startsWith(EXEMPTION_PREFIX)) {
                                context.report({
                                    loc: exemptionComment.loc,
                                    messageId: "forbiddenClass",
                                });
                                return;
                            }

                            // 豁免通过：注释存在、格式正确、长度达标
                            // 不报错，允许使用 class
                        } else {
                            // 没有找到豁免注释
                            context.report({
                                node,
                                messageId: "forbiddenClass",
                            });
                        }
                    },

                    /**
                     * 文件检查结束后，检测是否有未使用的豁免注释。
                     * 避免开发者在重构移除 class 后遗留无用的豁免注释。
                     */
                    "Program:exit"() {
                        for (const comment of exemptionComments) {
                            if (!usedComments.has(comment)) {
                                context.report({
                                    loc: comment.loc,
                                    messageId: "invalidIgnore",
                                });
                            }
                        }
                    },
                };
            },
        },
    },
};
