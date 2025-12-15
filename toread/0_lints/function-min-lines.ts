/**
 * 函数最小行数检查规则
 * 
 * 检查函数实际行数是否少于3行
 * 这有助于识别过于简单的函数，可能需要合并或重构
 */

/**
 * 提示词字典
 */
export const PROMPTS = {
    FUNCTION_TOO_SHORT: {
        id: 'FUNC-001: Too Short Function',
        mode: 'CODE_REFACTORING_SPECIALIST',
        reason: "检测到函数实际行数少于3行。",
        action: "请考虑将此函数合并到调用处或增加功能，避免过度拆分。",
        exemption: "如果函数确实需要保持简洁（如谓词函数、getter/工具函数），可在函数前的 JSDoc 注释中添加 @简洁函数 标记并说明原因。例如：/** @简洁函数 这是一个谓词工具函数 */"
    }
};

/**
 * 生成 Agent 指令信息
 */
export function generateAgentInstruction(prompt: any): string {
    let message = `🤖 Agent指令: ${prompt.id} | ${prompt.mode}\n${prompt.reason}\n${prompt.action}`;
    if (prompt.exemption) {
        message += `\n💡 豁免方式: ${prompt.exemption}`;
    }
    return message;
}

/**
 * 计算函数的实际行数（排除空行和注释）
 */
function calculateActualFunctionLines(node: any, sourceCode: any): number {
    if (!node.loc) return 0;

    const lines = sourceCode.getLines();
    const startLine = node.loc.start.line - 1; // 转换为0基索引
    const endLine = node.loc.end.line - 1;

    let actualLines = 0;

    for (let i = startLine; i <= endLine; i++) {
        const line = lines[i];

        // 跳过空行
        if (line.trim() === '') continue;

        // 跳过只包含注释的行
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) continue;

        // 跳过函数声明行和函数体的大括号行
        if (i === startLine || line.trim() === '{' || line.trim() === '}') continue;

        actualLines++;
    }

    return actualLines;
}

/**
 * 豁免注释标记
 * 使用 @简洁函数 注释可以豁免函数最小行数检查
 * 适用场景：工具函数、谓词函数、简单的 getter/setter 等
 */
const EXEMPT_COMMENT = '@简洁函数';

/**
 * 检查函数前面的注释是否包含豁免标记
 * 同时检查函数本身和其父节点（如 export 声明）的注释
 */
function hasExemptComment(node: any, sourceCode: any): boolean {
    // 检查函数本身前的注释
    const comments = sourceCode.getCommentsBefore(node);
    if (comments.some((comment: any) => comment.value.includes(EXEMPT_COMMENT))) return true;

    // 检查父节点
    if (node.parent) {
        // 对于 export function，注释可能在 ExportNamedDeclaration 上
        if (node.parent.type === 'ExportNamedDeclaration') {
            const parentComments = sourceCode.getCommentsBefore(node.parent);
            if (parentComments.some((comment: any) => comment.value.includes(EXEMPT_COMMENT))) return true;
        }

        // 检查 AssignmentExpression (例如: tx.oncomplete = () => {})
        // 结构通常是: ExpressionStatement -> AssignmentExpression -> ArrowFunctionExpression
        if (node.parent.type === 'AssignmentExpression') {
            const parentComments = sourceCode.getCommentsBefore(node.parent);
            if (parentComments.some((comment: any) => comment.value.includes(EXEMPT_COMMENT))) return true;

            // 如果是 ExpressionStatement 的一部分
            if (node.parent.parent && node.parent.parent.type === 'ExpressionStatement') {
                const grandParentComments = sourceCode.getCommentsBefore(node.parent.parent);
                if (grandParentComments.some((comment: any) => comment.value.includes(EXEMPT_COMMENT))) return true;
            }
        }

        // 检查 VariableDeclarator (例如: const foo = () => {})
        // 结构通常是: VariableDeclaration -> VariableDeclarator -> ArrowFunctionExpression
        if (node.parent.type === 'VariableDeclarator') {
            if (node.parent.parent && node.parent.parent.type === 'VariableDeclaration') {
                const grandParentComments = sourceCode.getCommentsBefore(node.parent.parent);
                if (grandParentComments.some((comment: any) => comment.value.includes(EXEMPT_COMMENT))) return true;
            }
        }

        // 检查 Property (例如在对象字面量中: { foo: () => {} })
        if (node.parent.type === 'Property') {
            const parentComments = sourceCode.getCommentsBefore(node.parent);
            if (parentComments.some((comment: any) => comment.value.includes(EXEMPT_COMMENT))) return true;
        }
    }

    return false;
}

/**
 * 函数最小行数检查插件
 */
export const functionMinLinesPlugin = {
    rules: {
        'function-min-lines': {
            meta: {
                type: 'problem',
                docs: {
                    description: '检查函数实际行数是否少于3行',
                    category: 'Best Practices',
                    recommended: true
                }
            },
            create(context: any) {
                const MIN_LINES = 3;
                const sourceCode = context.getSourceCode();

                return {
                    // 检查函数声明
                    FunctionDeclaration(node: any) {
                        if (hasExemptComment(node, sourceCode)) return;
                        const actualLines = calculateActualFunctionLines(node, sourceCode);
                        if (actualLines < MIN_LINES && actualLines > 0) {
                            context.report({
                                node,
                                message: generateAgentInstruction(PROMPTS.FUNCTION_TOO_SHORT)
                            });
                        }
                    },
                    // 检查箭头函数
                    ArrowFunctionExpression(node: any) {
                        if (hasExemptComment(node, sourceCode)) return;
                        const actualLines = calculateActualFunctionLines(node, sourceCode);
                        if (actualLines < MIN_LINES && actualLines > 0) {
                            context.report({
                                node,
                                message: generateAgentInstruction(PROMPTS.FUNCTION_TOO_SHORT)
                            });
                        }
                    },
                    // 检查函数表达式
                    FunctionExpression(node: any) {
                        if (hasExemptComment(node, sourceCode)) return;
                        const actualLines = calculateActualFunctionLines(node, sourceCode);
                        if (actualLines < MIN_LINES && actualLines > 0) {
                            context.report({
                                node,
                                message: generateAgentInstruction(PROMPTS.FUNCTION_TOO_SHORT)
                            });
                        }
                    },
                    // 检查类方法
                    MethodDefinition(node: any) {
                        if (hasExemptComment(node, sourceCode)) return;
                        if (node.value && (node.value.type === 'FunctionExpression' || node.value.type === 'ArrowFunctionExpression')) {
                            const actualLines = calculateActualFunctionLines(node.value, sourceCode);
                            if (actualLines < MIN_LINES && actualLines > 0) {
                                context.report({
                                    node,
                                    message: generateAgentInstruction(PROMPTS.FUNCTION_TOO_SHORT)
                                });
                            }
                        }
                    }
                };
            }
        }
    }
};