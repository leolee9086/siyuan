/**
 * 禁止使用 class 关键字
 *
 * class 只在经由充分论证并附有详细说明后才允许豁免，
 * 豁免注释必须不少于 500 字符。
 *
 * 豁免格式：
 *   // @允许类: <详细的解释说明，不少于 500 字符>
 *   class Foo { ... }
 *
 * 未使用的豁免注释也会被报错，避免残留不一致。
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
                        description: "禁止使用 class 关键字",
                        recommended: "error",
                    },
                messages: {
                    forbiddenClass: [
                        "❌ [架构约束] 禁止使用 class 关键字。",
                        "",
                        `如果确需使用 class，必须在上一行使用至少 ${MIN_EXEMPTION_LENGTH} 字符的注释进行豁免。`,
                        `格式: // ${EXEMPTION_PREFIX} <详细解释>`,
                    ].join("\n") + FULL_FIX_REMINDER + 单文件检查提示,

                    commentTooShort: [
                        `❌ 豁免注释长度不足。`,
                        `// ${EXEMPTION_PREFIX} 注释必须包含至少 ${MIN_EXEMPTION_LENGTH} 字符的详细解释。`,
                        "当前仅 {{actual}} 字符。",
                        "",
                        "请补充充分的技术理由，包括但不限于：",
                        "  1. 具体业务场景和上下文",
                        "  2. 无法使用 class 替代方案的根本原因",
                        "  3. 已评估的替代方案及其逐个排除的理由",
                        "  4. class 方案在本场景中带来的具体可维护性优势",
                        "  5. 如果将来条件变化，可能的重构方向",
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

                // 收集包含 @允许类: 的注释（允许与其他豁免标记合并在同一行）
                const exemptionComments = [];
                for (const comment of sourceCode.getAllComments()) {
                    if ((comment.type === "Line" || comment.type === "Block") && comment.value.includes("@允许类:")) {
                        exemptionComments.push(comment);
                    }
                }

                // 记录已匹配到 class 的豁免注释
                const usedComments = new Set();

                /**
                 * 查找 class 前的豁免注释。
                 *
                 * 不能依赖 sourceCode.getCommentsBefore(node)，
                 * 因为 export class 场景下 AST 结构为
                 * ExportNamedDeclaration 包裹 ClassDeclaration，
                 * 注释附着在外层 ExportNamedDeclaration 上，
                 * getCommentsBefore(ClassDeclaration) 找不到它。
                 *
                 * 改用基于源码行的位置查找：取 class 上一行的 @允许类 注释。
                 */
                function findExemptionComment(classNode) {
                    const classLine = classNode.loc.start.line;
                    for (const comment of exemptionComments) {
                        if (comment.loc.end.line === classLine - 1) {
                            return comment;
                        }
                    }
                    return null;
                }

                return {
                    /**
                     * 匹配所有 class 定义（包括声明和表达式）。
                     * 在 class 前寻找豁免注释，如果没有或长度不足则报错。
                     */
                    "ClassDeclaration, ClassExpression"(node) {
                        // abstract class 默认豁免
                        if (node.abstract === true) {
                            return;
                        }

                        const exemptionComment = findExemptionComment(node);

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
                            if (!commentText.includes(EXEMPTION_PREFIX)) {
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
