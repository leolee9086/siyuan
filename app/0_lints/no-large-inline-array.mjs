/**
 * 禁止大型内联数组 ESLint 规则
 * 
 * 检测在函数/方法内部定义的超过指定元素数量的数组字面量，
 * 这类数组应该提取到模块顶层作为常量定义。
 */

import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

/**
 * 豁免注释标记
 * 使用 @内联数组 注释可以豁免此检查
 */
const 豁免标记 = "@内联数组";

/**
 * 最大允许的内联数组元素数量（默认3个）
 */
const 默认最大元素数 = 3;

/**
 * 检查节点是否在模块顶层
 * 
 * - 作用：判断节点是否直接位于 Program 节点下的变量声明中
 * - 意图：模块顶层的数组定义是允许的，只有函数内部的内联数组需要禁止
 */
function 是模块顶层(node) {
    let current = node.parent;

    while (current) {
        // 如果遇到函数、方法、类方法体，说明不在顶层
        if (
            current.type === "FunctionDeclaration" ||
            current.type === "FunctionExpression" ||
            current.type === "ArrowFunctionExpression" ||
            current.type === "MethodDefinition"
        ) {
            return false;
        }

        // 如果直接到达 Program 且经过了 VariableDeclaration，说明在顶层
        if (current.type === "Program") {
            return true;
        }

        current = current.parent;
    }

    return false;
}

/**
 * 检查节点前面的注释是否包含豁免标记
 */
function 检查豁免注释(node, sourceCode) {
    // 检查数组本身前的注释
    const comments = sourceCode.getCommentsBefore(node);
    if (comments.some((comment) => comment.value.includes(豁免标记))) {
        return true;
    }

    // 向上查找父节点的注释
    let current = node.parent;
    while (current && current.type !== "Program") {
        const parentComments = sourceCode.getCommentsBefore(current);
        if (parentComments.some((comment) => comment.value.includes(豁免标记))) {
            return true;
        }

        // 只向上查找两层
        if (current.parent && current.parent.type !== "Program") {
            current = current.parent;
        } else {
            break;
        }
    }

    return false;
}

/**
 * 生成错误信息
 */
function 生成错误信息(elementCount, maxElements) {
    return [
        `❌ 禁止大型内联数组定义。`,
        `当前 ${elementCount} 个元素，最大允许 ${maxElements} 个。`,
        `请将数组提取到模块顶层作为常量定义。`,
        `💡 豁免方式: 在语句前添加 // ${豁免标记} 注释`
    ].join("\n") + 全量修复提示+ 单文件检查提示;
}

/**
 * 禁止大型内联数组插件
 */
export const 禁止大型内联数组插件 = {
    rules: {
        "no-large-inline-array": {
            meta: {
                type: "problem",
                docs: {
                    description: "禁止在函数内部定义超过指定元素数量的数组",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            max: {
                                type: "integer",
                                minimum: 1,
                                default: 默认最大元素数
                            }
                        },
                        additionalProperties: false
                    }
                ]
            },
            create(context) {
                const sourceCode = context.getSourceCode();
                const options = context.options[0] || {};
                const maxElements = options.max || 默认最大元素数;

                return {
                    ArrayExpression(node) {
                        // 跳过空数组或元素数量在限制内的数组
                        if (node.elements.length <= maxElements) {
                            return;
                        }

                        // 跳过模块顶层定义的数组
                        if (是模块顶层(node)) {
                            return;
                        }

                        // 检查豁免注释
                        if (检查豁免注释(node, sourceCode)) {
                            return;
                        }

                        // 报告错误
                        context.report({
                            node,
                            message: 生成错误信息(node.elements.length, maxElements)
                        });
                    }
                };
            }
        }
    }
};

// 英文别名导出
export const noLargeInlineArrayPlugin = 禁止大型内联数组插件;
