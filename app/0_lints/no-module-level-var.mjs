/**
 * 禁止模块级别变量声明
 *
 * 模块级 var/let/const 声明会导致：
 * 1. 导入即初始化 —— 即使从未使用也产生内存开销
 * 2. 隐式全局单例 —— 状态跨调用持久化（不可测试、HMR 异常）
 * 3. DOM 引用无法自动回收 —— 异常路径下内存泄漏
 *
 * 豁免：
 * - 纯函数定义：const fn = () => {} / const fn = function() {}
 * - 纯字面量常量：const URL = "..."，const MAX = 100
 * - 正则表达式：const RE = /pattern/
 * - 业务文件顶层的兼容性常量：const isBrowser = typeof window !== "undefined"
 *
 * 自定义豁免注释格式：
 *   // @允许模块级变量: <解释说明，不少于 200 字符>
 *   const xxx = { ... };
 *
 * 或者使用标准 eslint-disable-next-line 逐行豁免。
 */

import { FULL_FIX_REMINDER, 单文件检查提示 } from "./shared-constants.mjs";

/** 豁免注释的最小字符数（不含前缀） */
const MIN_EXEMPTION_LENGTH = 200;

/** 豁免注释前缀 */
const EXEMPTION_PREFIX = "@允许模块级变量:";

/**
 * 初始化值类型豁免集合。
 * 以下类型的 AST 节点被视为"安全的纯量"，不会产生可变状态。
 */
const INIT_TYPE_EXEMPTIONS = new Set([
    "ArrowFunctionExpression", // const fn = () => {}
    "FunctionExpression",      // const fn = function() {}
    "Literal",                 // const x = "string" / 1 / true / null / bigint
    "TemplateLiteral",         // const x = `template`
    "RegExpLiteral",           // const RE = /pattern/
]);

/**
 * 判断 VariableDeclarator 的 init 是否属于豁免类型。
 * @param {object|null|undefined} init - AST 节点（VariableDeclarator.init）
 * @returns {boolean}
 */
function isInitExempt(init) {
    if (!init) {
        // 理论上有 const x; 无效语法，但 guard 一下
        return true;
    }
    if (INIT_TYPE_EXEMPTIONS.has(init.type)) {
        return true;
    }
    // 负值字面量：const NEG = -1
    if (init.type === "UnaryExpression" && init.argument.type === "Literal") {
        return true;
    }
    return false;
}

/**
 * 创建 @允许模块级变量: 的豁免规则插件
 */
export const noModuleLevelVarPlugin = {
    rules: {
        "no-module-level-var": {
            meta: {
                type: "problem",
                docs: {
                    description: "禁止模块级别变量声明（允许纯函数定义和纯字面量常量）",
                    recommended: "error",
                },
                messages: {
                    forbiddenLetOrVar: [
                        "❌ [架构约束] 禁止模块级别使用 let 或 var。",
                        "",
                        "原因：let/var 声明的变量可被重新赋值，产生不可控的可变状态。",
                        "替代方案：将可变逻辑封装为 factory 函数，返回独立实例。",
                        "",
                        "如果确实需要模块级 let/var，请使用 eslint-disable-next-line 豁免。",
                    ].join("\n") + FULL_FIX_REMINDER + 单文件检查提示,

                    forbiddenConst: [
                        "❌ [架构约束] 禁止模块级别 const 声明可变状态。",
                        "",
                        "原因：const 声明的对象/数组/类实例等是可变状态容器，会导致：",
                        "  1. 测试无法隔离 —— 状态跨用例残留",
                        "  2. HMR 热重载异常 —— 新旧模块状态分裂",
                        "  3. DOM 引用无法自动回收 —— 异常路径下内存泄漏",
                        "",
                        "仅允许以下 const 声明：",
                        "  - 函数定义：const fn = () => {}",
                        "  - 原始值常量：const URL = '...' / const MAX = 100",
                        "  - 正则表达式：const RE = /pattern/",
                        "",
                        "替代方案：将可变状态封装为 factory 函数，在首次使用时惰性初始化。",
                        "",
                        `如需豁免，在上一行添加至少 ${MIN_EXEMPTION_LENGTH} 字符的注释：`,
                        `  // ${EXEMPTION_PREFIX} <详细解释>`,
                    ].join("\n") + FULL_FIX_REMINDER + 单文件检查提示,

                    commentTooShort: [
                        `❌ 豁免注释长度不足。`,
                        `// ${EXEMPTION_PREFIX} 注释必须包含至少 ${MIN_EXEMPTION_LENGTH} 字符的详细解释。`,
                        "当前仅 {{actual}} 字符。",
                        "",
                        "请补充充分的技术理由，包括但不限于：",
                        "  1. 具体业务场景",
                        "  2. 无法使用 factory 替代方案的根本原因",
                        "  3. 已评估的替代方案及其逐个排除的理由",
                        "  4. 如果将来条件变化，可能的重构方向",
                    ].join("\n") + FULL_FIX_REMINDER + 单文件检查提示,

                    invalidIgnore: [
                        `❌ 这里使用了 // ${EXEMPTION_PREFIX}，但紧邻的下一行并不是需要豁免的 const 声明。`,
                        "如果不再需要豁免，请移除这行注释以避免混淆。",
                    ].join("\n") + FULL_FIX_REMINDER + 单文件检查提示,
                },
                schema: [],
            },

            create(context) {
                const sourceCode = context.getSourceCode();

                // ── 收集 @允许模块级变量: 注释 ──
                const exemptionComments = [];
                for (const comment of sourceCode.getAllComments()) {
                    if ((comment.type === "Line" || comment.type === "Block") &&
                        comment.value.includes(EXEMPTION_PREFIX)) {
                        exemptionComments.push(comment);
                    }
                }

                // 记录已匹配到声明的豁免注释
                const usedComments = new Set();

                /**
                 * 查找 VariableDeclaration 前的豁免注释。
                 * 取声明节点上一行（可跨 export 声明）。
                 *
                 * 注意：不能依赖 sourceCode.getCommentsBefore，
                 * 因为 ExportNamedDeclaration 包裹时注释附着在外层。
                 */
                function findExemptionComment(varDeclNode) {
                    const declLine = varDeclNode.loc.start.line;
                    for (const comment of exemptionComments) {
                        if (comment.loc.end.line === declLine - 1) {
                            return comment;
                        }
                    }
                    return null;
                }

                return {
                    /**
                     * 匹配模块顶层 VariableDeclaration。
                     * 复合选择器覆盖两种 AST 形态：
                     *   - const x = ...              → Program > VariableDeclaration
                     *   - export const x = ...        → Program > ExportNamedDeclaration > VariableDeclaration
                     *
                     * 注意：FunctionDeclaration 和 export function/export default 不会被匹配。
                     */
                    "Program > VariableDeclaration, Program > ExportNamedDeclaration > VariableDeclaration"(node) {
                        // ── let / var：无条件禁止 ──
                        if (node.kind === "let" || node.kind === "var") {
                            context.report({
                                node,
                                messageId: "forbiddenLetOrVar",
                            });
                            return;
                        }

                        // ── const：按 declarator 粒度检查 ──
                        const exemptionComment = findExemptionComment(node);

                        for (const declarator of node.declarations) {
                            const init = declarator.init;

                            // 初始化值类型豁免（函数定义/字面量/正则/负值）
                            if (isInitExempt(init)) {
                                continue;
                            }

                            // 检查自定义豁免注释
                            if (exemptionComment) {
                                usedComments.add(exemptionComment);

                                const commentText = exemptionComment.value.trim();

                                // 检查前缀
                                if (!commentText.includes(EXEMPTION_PREFIX)) {
                                    context.report({
                                        loc: exemptionComment.loc,
                                        messageId: "forbiddenConst",
                                    });
                                    continue;
                                }

                                // 检查长度
                                if (commentText.length < MIN_EXEMPTION_LENGTH) {
                                    context.report({
                                        loc: exemptionComment.loc,
                                        messageId: "commentTooShort",
                                        data: { actual: commentText.length },
                                    });
                                    continue;
                                }

                                // 豁免通过：注释存在、格式正确、长度达标
                                continue;
                            }

                            // 无豁免 → 报错
                            context.report({
                                node: declarator,
                                messageId: "forbiddenConst",
                            });
                        }
                    },

                    /**
                     * 文件检查结束后，检测是否有未使用的豁免注释。
                     * 避免开发者重构移除变量声明后遗留无用的豁免注释。
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
