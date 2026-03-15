import { FULL_FIX_REMINDER, 单文件检查提示, 检查柯里化豁免 } from "./shared-constants.mjs";

/**
 * ESLint 规则: 禁止在函数内部定义命名函数
 * 
 * 目的: 防止在函数内部定义命名函数，这会降低可测试性和复用性
 * 
 * 豁免: 如果是合理的柯里化场景（需要闭包捕获上下文），可以在前面添加 // @柯里化 注释
 */

export const noNestedFunctionPlugin = {
    rules: {
        "no-nested-function": {
            meta: {
                type: "problem",
                docs: {
                    description: "禁止在函数内部定义命名函数",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [],
            },
            create(context) {
                const sourceCode = context.getSourceCode();

                function checkNestedFunction(node) {
                    // 检查是否在函数内部
                    let parent = node.parent;
                    let inFunction = false;

                    while (parent) {
                        if (
                            parent.type === "FunctionDeclaration" ||
                            parent.type === "FunctionExpression" ||
                            parent.type === "ArrowFunctionExpression"
                        ) {
                            inFunction = true;
                            break;
                        }
                        parent = parent.parent;
                    }

                    if (!inFunction) {
                        return;
                    }

                    // 检查柯里化豁免注释
                    if (检查柯里化豁免(node, sourceCode)) {
                        return;
                    }

                    context.report({
                        node,
                        message: "❌ 禁止在函数内部定义命名函数。请将函数提取到模块顶层，或使用匿名箭头函数。" + 
                                 FULL_FIX_REMINDER + 单文件检查提示
                    });
                }

                return {
                    // 检查函数声明
                    "FunctionDeclaration": checkNestedFunction,
                    // 检查变量声明中的函数表达式和箭头函数
                    "VariableDeclarator > FunctionExpression": checkNestedFunction,
                    "VariableDeclarator > ArrowFunctionExpression": checkNestedFunction,
                };
            },
        },
    },
};
