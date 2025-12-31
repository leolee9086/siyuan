/**
 * 代码量限制规则
 * 
 * 用自定义规则替代 max-lines、max-lines-per-function 等内置规则，
 * 以便添加自定义的错误信息
 */

import { 全量修复提示 } from "./shared-constants.mjs";

/**
 * 计算实际代码行数（排除空行和注释）
 */
function 计算实际行数(lines, startLine, endLine) {
    let 实际行数 = 0;
    let 在多行注释中 = false;

    for (let i = startLine; i <= endLine; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 跳过空行
        if (trimmed === "") {
            continue;
        }

        // 处理多行注释
        if (在多行注释中) {
            if (trimmed.includes("*/")) {
                在多行注释中 = false;
            }
            continue;
        }

        // 多行注释开始
        if (trimmed.startsWith("/*")) {
            if (!trimmed.includes("*/")) {
                在多行注释中 = true;
            }
            continue;
        }

        // 单行注释
        if (trimmed.startsWith("//")) {
            continue;
        }

        实际行数++;
    }

    return 实际行数;
}

/**
 * 代码量限制插件
 */
export const 代码量限制插件 = {
    rules: {
        /**
         * 文件最大行数规则 (替代 max-lines)
         */
        "max-lines": {
            meta: {
                type: "problem",
                docs: {
                    description: "限制文件的最大代码行数",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            max: { type: "integer", default: 300 },
                            skipBlankLines: { type: "boolean", default: true },
                            skipComments: { type: "boolean", default: true }
                        }
                    }
                ]
            },
            create(context) {
                const options = context.options[0] || {};
                const max = options.max || 300;
                const skipBlankLines = options.skipBlankLines !== false;
                const skipComments = options.skipComments !== false;

                return {
                    Program(node) {
                        const sourceCode = context.sourceCode || context.getSourceCode();
                        const lines = sourceCode.getLines();

                        let 行数;
                        if (skipBlankLines && skipComments) {
                            行数 = 计算实际行数(lines, 0, lines.length - 1);
                        }
                        if (!skipBlankLines && !skipComments) {
                            行数 = lines.length;
                        }
                        if (skipBlankLines && !skipComments) {
                            行数 = lines.filter(line => line.trim() !== "").length;
                        }
                        if (!skipBlankLines && skipComments) {
                            行数 = 计算实际行数(lines, 0, lines.length - 1);
                        }

                        if (行数 > max) {
                            context.report({
                                loc: { line: max + 1, column: 0 },
                                message: `❌ 文件超过最大行数限制。当前 ${行数} 行，最大允许 ${max} 行。请拆分为更小的模块。${全量修复提示}`
                            });
                        }
                    }
                };
            }
        },

        /**
         * 函数最大行数规则 (替代 max-lines-per-function)
         */
        "max-lines-per-function": {
            meta: {
                type: "problem",
                docs: {
                    description: "限制函数的最大代码行数",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            max: { type: "integer", default: 50 },
                            skipBlankLines: { type: "boolean", default: true },
                            skipComments: { type: "boolean", default: true },
                            IIFEs: { type: "boolean", default: true }
                        }
                    }
                ]
            },
            create(context) {
                const options = context.options[0] || {};
                const max = options.max || 50;
                const skipBlankLines = options.skipBlankLines !== false;
                const skipComments = options.skipComments !== false;

                /**
                 * 检查函数节点
                 */
                function 检查函数(node) {
                    if (!node.loc) {
                        return;
                    }

                    const sourceCode = context.sourceCode || context.getSourceCode();
                    const lines = sourceCode.getLines();
                    const startLine = node.loc.start.line - 1; // 转换为0基索引
                    const endLine = node.loc.end.line - 1;

                    let 行数;
                    if (skipBlankLines && skipComments) {
                        行数 = 计算实际行数(lines, startLine, endLine);
                    }
                    if (!skipBlankLines && !skipComments) {
                        行数 = endLine - startLine + 1;
                    }
                    if (skipBlankLines && !skipComments) {
                        行数 = lines.slice(startLine, endLine + 1).filter(line => line.trim() !== "").length;
                    }
                    if (!skipBlankLines && skipComments) {
                        行数 = 计算实际行数(lines, startLine, endLine);
                    }

                    // 获取函数名称
                    let 函数名 = "匿名函数";
                    if (node.id && node.id.name) {
                        函数名 = node.id.name;
                    }
                    if (node.parent) {
                        if (node.parent.type === "VariableDeclarator" && node.parent.id && node.parent.id.name) {
                            函数名 = node.parent.id.name;
                        }
                        if (node.parent.type === "MethodDefinition" && node.parent.key && node.parent.key.name) {
                            函数名 = node.parent.key.name;
                        }
                        if (node.parent.type === "Property" && node.parent.key && node.parent.key.name) {
                            函数名 = node.parent.key.name;
                        }
                    }

                    // 判断函数类型
                    let 函数类型 = "函数";
                    if (node.type === "ArrowFunctionExpression") {
                        函数类型 = node.async ? "异步箭头函数" : "箭头函数";
                    }
                    if (node.type === "FunctionExpression") {
                        函数类型 = node.async ? "异步函数表达式" : "函数表达式";
                    }
                    if (node.type === "FunctionDeclaration") {
                        函数类型 = node.async ? "异步函数" : "函数";
                    }

                    if (行数 > max) {
                        context.report({
                            node,
                            message: `❌ ${函数类型} "${函数名}" 超过最大行数限制。当前 ${行数} 行，最大允许 ${max} 行。请拆分为更小的函数。${全量修复提示}`
                        });
                    }
                }

                return {
                    FunctionDeclaration: 检查函数,
                    FunctionExpression: 检查函数,
                    ArrowFunctionExpression: 检查函数
                };
            }
        }
    }
};

// 英文别名导出
export const codeSizeLimitsPlugin = 代码量限制插件;
