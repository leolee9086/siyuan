/**
 * 导出函数异步要求规则
 * 
 * 任何导出的函数必须是异步函数 (async)，否则需要豁免注释。
 * 豁免注释格式: @同步豁免: 原因
 */

import { 全量修复提示 } from "./shared-constants.mjs";


const ALLOWED_REASONS = [
    "性能考虑",
    "生命周期",
    "遗留代码",
    "UI构建",
    "DOM访问"
];

/**
 * 获取豁免信息
 * @returns {{hasTag: boolean, reason: string | null}}
 */
function 获取豁免信息(node, sourceCode) {
    const comments = getAllCommentsBefore(node, sourceCode);
    for (const comment of comments) {
        const match = comment.value.match(/@同步豁免:\s*(\S+)/);
        if (match) {
            return { hasTag: true, reason: match[1].trim() };
        }
    }
    return { hasTag: false, reason: null };
}

function getAllCommentsBefore(node, sourceCode) {
    let comments = [];
    let current = node;

    // Check current node and parents up to ExportDeclaration
    while (current) {
        const nodeComments = sourceCode.getCommentsBefore(current);
        comments = comments.concat(nodeComments);

        if (current.parent) {
            if (current.parent.type === 'ExportNamedDeclaration' ||
                current.parent.type === 'ExportDefaultDeclaration' ||
                current.parent.type === 'VariableDeclarator' ||
                current.parent.type === 'VariableDeclaration') {
                current = current.parent;
                continue;
            }
        }
        break;
    }
    return comments;
}

export const requireAsyncExportPlugin = {
    rules: {
        "require-async-export": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "要求导出函数必须是异步的",
                    category: "Best Practices",
                    recommended: true
                },
                messages: {
                    missingAsync: "❌ 导出函数必须是异步函数 (async)。\n当且仅当有绝对充足而且无法避免的原因时才能够使用同步函数，此时必须添加详尽的豁免注释,说明为何此处必须使用同步逻辑: '/** @同步豁免: 原因 */'。\n" +
                        "允许的原因: " + ALLOWED_REASONS.join(", ") + "。" + 全量修复提示,
                    invalidReason: "❌ 无效的同步豁免原因: '{{reason}}'。\n" +
                        "允许的原因: " + ALLOWED_REASONS.join(", ") + "。" + 全量修复提示
                }
            },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();

                function checkFunction(node) {
                    // Check if it's exported
                    let isExported = false;
                    let parent = node.parent;

                    // Case 1: export function foo() {}
                    // Case 2: export default function() {}
                    if (parent && (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration')) {
                        isExported = true;
                    }

                    // Case 3: export const foo = () => {}
                    if (parent && parent.type === 'VariableDeclarator') {
                        if (parent.parent && parent.parent.type === 'VariableDeclaration') {
                            if (parent.parent.parent && parent.parent.parent.type === 'ExportNamedDeclaration') {
                                isExported = true;
                            }
                        }
                    }

                    if (!isExported) {
                        return;
                    }

                    if (node.async) {
                        return;
                    }

                    const exemption = 获取豁免信息(node, sourceCode);
                    if (exemption.hasTag) {
                        if (!ALLOWED_REASONS.includes(exemption.reason)) {
                            context.report({
                                node,
                                messageId: "invalidReason",
                                data: {
                                    reason: exemption.reason
                                }
                            });
                        }
                        return;
                    }

                    context.report({
                        node,
                        messageId: "missingAsync"
                    });
                }

                return {
                    FunctionDeclaration: checkFunction,
                    FunctionExpression: checkFunction,
                    ArrowFunctionExpression: checkFunction
                };
            }
        }
    }
};
