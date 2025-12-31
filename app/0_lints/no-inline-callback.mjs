/**
 * 禁止内联回调 ESLint 规则
 * 
 * 检测在函数调用参数位置定义的回调函数，如果超过指定行数则报错
 * 这有助于提高代码可读性，避免深层嵌套的回调地狱
 */

import { 全量修复提示 } from "./shared-constants.mjs";

/**
 * 豁免注释标记
 * 使用 @内联回调 注释可以豁免此检查
 */
const EXEMPT_COMMENT = "@内联回调";

/**
 * 最大允许的内联回调行数
 */
const MAX_INLINE_CALLBACK_LINES = 5;

/**
 * 计算函数的实际行数（排除空行和注释）
 */
function 计算实际行数(node, sourceCode) {
    if (!node.loc) return 0;

    const lines = sourceCode.getLines();
    const startLine = node.loc.start.line - 1; // 转换为0基索引
    const endLine = node.loc.end.line - 1;

    let actualLines = 0;

    for (let i = startLine; i <= endLine; i++) {
        const line = lines[i];

        // 跳过空行
        if (line.trim() === "") continue;

        // 跳过只包含注释的行
        if (line.trim().startsWith("//") || line.trim().startsWith("/*") || line.trim().startsWith("*")) continue;

        // 跳过只有大括号的行
        if (line.trim() === "{" || line.trim() === "}" || line.trim() === "};") continue;

        actualLines++;
    }

    return actualLines;
}

/**
 * 检查节点前面的注释是否包含豁免标记
 */
function 检查豁免注释(node, sourceCode) {
    // 检查函数本身前的注释
    const comments = sourceCode.getCommentsBefore(node);
    if (comments.some((comment) => comment.value.includes(EXEMPT_COMMENT))) return true;

    // 检查 CallExpression 父节点的注释
    if (node.parent && node.parent.type === "CallExpression") {
        const parentComments = sourceCode.getCommentsBefore(node.parent);
        if (parentComments.some((comment) => comment.value.includes(EXEMPT_COMMENT))) return true;

        // 检查 ExpressionStatement 的注释
        if (node.parent.parent && node.parent.parent.type === "ExpressionStatement") {
            const grandParentComments = sourceCode.getCommentsBefore(node.parent.parent);
            if (grandParentComments.some((comment) => comment.value.includes(EXEMPT_COMMENT))) return true;
        }
    }

    return false;
}

/**
 * 检查节点是否是函数调用的参数
 */
function 是函数调用参数(node) {
    if (!node.parent) return false;

    // 直接作为 CallExpression 的参数
    if (node.parent.type === "CallExpression" && node.parent.arguments.includes(node)) {
        return true;
    }

    return false;
}

/**
 * 生成错误信息
 */
function 生成错误信息(actualLines, functionName) {
    const callerInfo = functionName ? ` (调用: ${functionName})` : "";
    return `❌ 禁止超过 ${MAX_INLINE_CALLBACK_LINES} 行的内联回调函数${callerInfo}。当前 ${actualLines} 行。请提取为命名函数以提高可读性。\n💡 豁免方式: 在调用语句前添加 // ${EXEMPT_COMMENT} 注释${全量修复提示}`;
}

/**
 * 获取调用函数的名称（用于更好的错误提示）
 */
function 获取调用函数名(node) {
    if (!node.parent || node.parent.type !== "CallExpression") return null;

    const callee = node.parent.callee;

    // element.addEventListener
    if (callee.type === "MemberExpression" && callee.property) {
        return callee.property.name || callee.property.value;
    }

    // someFunction()
    if (callee.type === "Identifier") {
        return callee.name;
    }

    return null;
}

/**
 * 禁止内联回调插件
 */
export const 禁止内联回调插件 = {
    rules: {
        "no-inline-callback": {
            meta: {
                type: "problem",
                docs: {
                    description: "禁止在函数参数中使用超过指定行数的内联回调",
                    category: "Best Practices",
                    recommended: true
                }
            },
            create(context) {
                const sourceCode = context.getSourceCode();

                /**
                 * 检查函数节点
                 */
                function 检查函数节点(node) {
                    // 只检查作为函数调用参数的回调
                    if (!是函数调用参数(node)) return;

                    // 检查豁免注释
                    if (检查豁免注释(node, sourceCode)) return;

                    // 计算实际行数
                    const actualLines = 计算实际行数(node, sourceCode);

                    // 超过限制则报错
                    if (actualLines > MAX_INLINE_CALLBACK_LINES) {
                        const functionName = 获取调用函数名(node);
                        context.report({
                            node,
                            message: 生成错误信息(actualLines, functionName)
                        });
                    }
                }

                return {
                    // 检查箭头函数
                    ArrowFunctionExpression: 检查函数节点,
                    // 检查函数表达式
                    FunctionExpression: 检查函数节点
                };
            }
        }
    }
};

// 英文别名导出
export const noInlineCallbackPlugin = 禁止内联回调插件;
