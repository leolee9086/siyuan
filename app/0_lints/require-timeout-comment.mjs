/**
 * 避免使用 setTimeout/setInterval 的 ESLint 规则
 * 
 * 定时器操作引入不确定的延迟，应优先使用确定性替代方案：
 * - Signal/响应式状态、MutationObserver、事件回调等
 * 
 * 只有在无法使用确定性方案时才应使用定时器，且必须添加注释说明原因
 */

import { FULL_FIX_REMINDER } from "./shared-constants.mjs";

/**
 * 检查节点前面是否有注释
 */
function 检查前置注释(node, sourceCode) {
    const comments = sourceCode.getCommentsBefore(node);

    if (comments.length > 0) {
        // 检查注释是否在同一行或紧邻的上一行
        const lastComment = comments[comments.length - 1];
        const commentEndLine = lastComment.loc.end.line;
        const nodeStartLine = node.loc.start.line;

        // 注释必须紧邻调用语句（在同一行或上一行）
        if (nodeStartLine - commentEndLine <= 1) {
            return true;
        }
    }

    return false;
}

/**
 * 检查行尾是否有注释
 */
function 检查行尾注释(node, sourceCode) {
    const comments = sourceCode.getCommentsAfter(node);

    if (comments.length > 0) {
        const firstComment = comments[0];
        // 注释必须在同一行
        if (firstComment.loc.start.line === node.loc.end.line) {
            return true;
        }
    }

    return false;
}

/**
 * 获取调用表达式的目标函数名
 */
function 获取调用函数名(node) {
    if (node.callee.type === "Identifier") {
        return node.callee.name;
    }
    if (node.callee.type === "MemberExpression" && node.callee.property.type === "Identifier") {
        return node.callee.property.name;
    }
    return null;
}

/**
 * 获取包含语句节点（用于检测注释位置）
 * 因为 setTimeout(...) 可能嵌套在表达式语句、变量声明等中
 */
function 获取语句节点(node) {
    let current = node;
    while (current.parent) {
        // 如果父节点是语句类型，返回父节点
        if (current.parent.type.endsWith("Statement") || current.parent.type.endsWith("Declaration")) {
            return current.parent;
        }
        // 如果父节点是导出声明，继续向上
        if (current.parent.type === "ExportNamedDeclaration" || current.parent.type === "ExportDefaultDeclaration") {
            return current.parent;
        }
        current = current.parent;
    }
    return node;
}

/**
 * 生成错误信息
 */
function 生成错误信息(functionName) {
    return [
        `❌ ${functionName} 引入了不确定的延迟，应尽量避免使用。`,
        ``,
        `🚫 问题: 定时器依赖"猜测"的时间，无法保证操作在正确时机执行。`,
        ``,
        `✅ 确定性替代方案（按优先级）:`,
        `   1. Signal/响应式状态 - 状态变化时自动触发`,
        `   2. MutationObserver - 监听 DOM 变化`,
        `   3. ResizeObserver - 监听尺寸变化`,
        `   4. IntersectionObserver - 监听元素可见性`,
        `   5. 事件回调 - transitionend, animationend, load 等`,
        `   6. requestAnimationFrame - 下一帧渲染前执行`,
        `   7. queueMicrotask - 微任务队列（同步代码后立即执行）`,
        `   8. Promise.then - 异步流程控制`,
        ``,
        `⚠️ 只有在以下情况才应使用 ${functionName}:`,
        `   - 需要真正的"用户感知延迟"（如防抖、节流、延迟提示）`,
        `   - 外部 API 明确要求等待固定时间`,
        `   - 已确认无法使用上述确定性方案`,
        ``,
        `✏️ 如果确实需要使用，请在调用前添加注释说明:`,
        `   - 为什么无法使用确定性方案`,
        `   - 这个延迟时间是如何确定的`,
        FULL_FIX_REMINDER
    ].join("\n");
}

/**
 * 需要检查的定时器函数名
 */
const 定时器函数名列表 = ["setTimeout", "setInterval"];

/**
 * 避免定时器插件
 */
export const 避免定时器插件 = {
    rules: {
        "require-timeout-comment": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "避免使用 setTimeout/setInterval，优先使用确定性替代方案；如必须使用则需注释说明原因",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            functions: {
                                type: "array",
                                items: { type: "string" },
                                default: ["setTimeout", "setInterval"]
                            }
                        },
                        additionalProperties: false
                    }
                ]
            },
            create(context) {
                const sourceCode = context.getSourceCode();
                const options = context.options[0] || {};
                const targetFunctions = options.functions || 定时器函数名列表;

                return {
                    CallExpression(node) {
                        const functionName = 获取调用函数名(node);

                        // 只检查目标函数
                        if (!targetFunctions.includes(functionName)) {
                            return;
                        }

                        // 获取包含此调用的语句节点
                        const statementNode = 获取语句节点(node);

                        // 检查是否有前置注释
                        if (检查前置注释(statementNode, sourceCode)) {
                            return;
                        }

                        // 也检查行尾注释
                        if (检查行尾注释(node, sourceCode)) {
                            return;
                        }

                        // 报告错误
                        context.report({
                            node,
                            message: 生成错误信息(functionName)
                        });
                    }
                };
            }
        }
    }
};

// 英文别名导出
export const requireTimeoutCommentPlugin = 避免定时器插件;
