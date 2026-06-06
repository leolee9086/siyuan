/**
 * 代码量限制规则
 * 
 * 用自定义规则替代 max-lines、max-lines-per-function 等内置规则，
 * 以便添加自定义的错误信息
 */

import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

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
                    Program() {
                        const sourceCode = context.sourceCode || context.getSourceCode();

                        // 创建带有行号的lines数组（参考ESLint实现）
                        let lines = sourceCode.getLines().map((text, i) => ({
                            lineNumber: i + 1,
                            text,
                        }));

                        // 如果文件以换行符结尾，会有一个额外的空行，需要移除
                        if (lines.length > 1 && lines[lines.length - 1].text === "") {
                            lines.pop();
                        }

                        // 过滤空行
                        if (skipBlankLines) {
                            lines = lines.filter(l => l.text.trim() !== "");
                        }

                        // 过滤注释行（简化版本，因为我们已经有 计算实际行数 函数）
                        if (skipComments) {
                            // 简化实现：过滤单行/多行注释（含 JSDoc 中间行）
                            lines = lines.filter(l => {
                                const trimmed = l.text.trim();
                                return !trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*");
                            });
                        }

                        if (lines.length > max) {
                            // 使用范围报告：从第301行实际代码的物理行号到文件末尾
                            // 参考 ESLint 自带的 max-lines 规则实现
                            const 物理总行数 = sourceCode.getLines().length;
                            const loc = {
                                start: {
                                    line: lines[max].lineNumber,  // 第301行实际代码对应的物理行号
                                    column: 0
                                },
                                end: {
                                    line: 物理总行数,
                                    column: sourceCode.getLines()[物理总行数 - 1].length
                                }
                            };

                            context.report({
                                loc,
                                message: `❌ 文件超过最大行数限制。当前 ${lines.length} 行，最大允许 ${max} 行。请通过拆分模块、拆分函数、减少重复模式化代码的方式减少代码行数，绝不能试图通过破坏代码可读性的删除注释等方式强行敷衍任务！${全量修复提示 + 单文件检查提示}`
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
                    } else if (!skipBlankLines && !skipComments) {
                        行数 = endLine - startLine + 1;
                    } else if (skipBlankLines && !skipComments) {
                        行数 = lines.slice(startLine, endLine + 1).filter(line => line.trim() !== "").length;
                    } else if (!skipBlankLines && skipComments) {
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
                            message: `❌ ${函数类型} "${函数名}" 超过最大实际行数限制。当前实际代码 ${行数} 行，最大允许实际代码 ${max} 行。请通过拆分模块、拆分函数、减少重复模式化代码的方式减少代码行数，绝不能试图通过破坏代码可读性的删除注释等方式强行敷衍任务！注意此处的代码行数不包含注释和空行因此你不能依赖代码物理行数判断,应该以lint结果为准.${全量修复提示}`
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
