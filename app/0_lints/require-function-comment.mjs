/**
 * 函数和类型定义注释要求规则
 * 
 * 该规则检查函数定义和类型定义是否有注释，如果没有则报错。
 * 
 * 函数注释应该说明：
 * - 函数作用（做什么）
 * - 意图（为什么这样做）
 * - 调用时机（什么时候调用）
 * - 存在的问题或改进空间（如果有的话）
 * 
 * 类型定义注释应该说明：
 * - 类型的用途和含义
 * - 在哪些场景下使用
 * - 与其他类型的关系（如果有的话）
 * - 存在的问题或改进空间（如果有的话）
 */

import { 全量修复提示 } from "./shared-constants.mjs";

/**
 * 检查节点前面是否有注释
 * 会检查 JSDoc 风格注释 (/**) 和普通多行注释 (/*)
 */
function 获取前置注释(sourceCode, node) {
    const comments = sourceCode.getCommentsBefore(node);
    // 找到最近的块级注释（JSDoc 或普通多行注释）
    for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];
        if (comment.type === "Block") {
            return comment;
        }
    }
    return null;
}

/**
 * 检查注释内容是否有基本内容
 * 
 * 作为原则性规则，只要注释不是完全空的就视为有效。
 * 提示信息已经说明了注释应该包含什么内容，具体质量由编写者把关。
 */
function 检查注释质量(commentText) {
    // 只要注释不是完全空的就视为有效
    const 去除星号 = commentText
        .replace(/^\s*\*+\s*/gm, "") // 移除行首的 * 和空格
        .replace(/^\/\*+\s*/, "")    // 移除开头的 /*
        .replace(/\s*\*+\/$/, "")    // 移除结尾的 */
        .trim();

    // 只要有任何内容就算有效
    return 去除星号.length > 0;
}

/**
 * 获取函数名称
 */
function 获取函数名(node) {
    // 函数声明
    if (node.id && node.id.name) {
        return node.id.name;
    }

    // 变量声明中的函数表达式或箭头函数
    if (node.parent) {
        if (node.parent.type === "VariableDeclarator" && node.parent.id && node.parent.id.name) {
            return node.parent.id.name;
        }
        // 类方法
        if (node.parent.type === "MethodDefinition" && node.parent.key) {
            if (node.parent.key.name) {
                return node.parent.key.name;
            }
            if (node.parent.key.type === "PrivateIdentifier") {
                return `#${node.parent.key.name}`;
            }
        }
        // 对象属性方法
        if (node.parent.type === "Property" && node.parent.key) {
            if (node.parent.key.name) {
                return node.parent.key.name;
            }
            if (node.parent.key.value) {
                return String(node.parent.key.value);
            }
        }
        // 导出的函数声明
        if (node.parent.type === "ExportNamedDeclaration" || node.parent.type === "ExportDefaultDeclaration") {
            if (node.id && node.id.name) {
                return node.id.name;
            }
        }
    }

    return null;
}

/**
 * 判断是否是需要检查的函数节点
 * 排除：匿名回调、IIFE、getter/setter 等
 */
function 需要检查注释(node) {
    const 函数名 = 获取函数名(node);

    // 匿名函数不需要检查（通常是回调）
    if (!函数名) {
        return false;
    }

    // 类的 constructor 不需要检查（通常很明显）
    if (函数名 === "constructor") {
        return false;
    }

    // getter/setter 不需要单独检查
    if (node.parent && node.parent.type === "MethodDefinition") {
        if (node.parent.kind === "get" || node.parent.kind === "set") {
            return false;
        }
    }

    return true;
}

/**
 * 获取需要检查注释的节点
 * 对于变量声明，应该检查变量声明语句而非函数本身
 * 对于导出的变量声明，需要继续向上找到导出声明
 */
function 获取注释目标节点(node) {
    if (node.parent) {
        // 类方法：注释应该在 MethodDefinition 上
        if (node.parent.type === "MethodDefinition") {
            return node.parent;
        }
        // 变量声明中的函数
        if (node.parent.type === "VariableDeclarator") {
            // 返回整个变量声明语句
            if (node.parent.parent && node.parent.parent.type === "VariableDeclaration") {
                const 变量声明 = node.parent.parent;
                // 如果变量声明本身被导出，需要继续向上找到导出声明
                if (变量声明.parent && (变量声明.parent.type === "ExportNamedDeclaration" || 变量声明.parent.type === "ExportDefaultDeclaration")) {
                    return 变量声明.parent;
                }
                return 变量声明;
            }
        }
        // 直接导出的函数声明
        if (node.parent.type === "ExportNamedDeclaration" || node.parent.type === "ExportDefaultDeclaration") {
            return node.parent;
        }
    }
    return node;
}

const 注释要求提示 = [
    "❌ 函数定义必须编写注释。",
    "注释除了基本的输入输出等之外应该说明：",
    "  - 作用：这个函数做什么",
    "  - 意图：为什么需要这个函数",
    "  - 调用时机：什么时候/在哪里调用",
    "  - 问题/改进：如果有已知问题或改进空间也应指出",
    "注释应该仔细阅读的函数的使用情况之后编写,保证任何新加入的项目参与者能够迅速理解 "
].join("\n");

const 类型注释要求提示 = [
    "❌ 类型定义必须编写注释。",
    "注释应该说明：",
    "  - 用途：这个类型表示什么",
    "  - 使用场景：在哪些场景下使用",
    "  - 关联类型：与其他类型的关系（如果有的话）",
    "  - 问题/改进：如果有已知问题或改进空间也应指出",
    "注释应该仔细阅读类型的使用情况之后编写,保证任何新加入的项目参与者能够迅速理解 "
].join("\n");

/**
 * 获取类型定义的注释目标节点
 * 对于导出声明，应该检查导出声明本身
 */
function 获取类型注释目标节点(node) {
    if (node.parent && (node.parent.type === "ExportNamedDeclaration" || node.parent.type === "ExportDefaultDeclaration")) {
        return node.parent;
    }
    return node;
}

/**
 * 函数和类型注释要求插件
 */
export const 函数注释要求插件 = {
    rules: {
        /**
         * 要求函数必须有注释
         */
        "require-function-comment": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "要求函数定义必须编写注释",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            minCommentLength: { type: "integer", default: 10 }
                        }
                    }
                ]
            },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();

                /**
                 * 检查函数节点
                 */
                function 检查函数(node) {
                    if (!需要检查注释(node)) {
                        return;
                    }

                    const 函数名 = 获取函数名(node);
                    const 注释目标 = 获取注释目标节点(node);
                    const 前置注释 = 获取前置注释(sourceCode, 注释目标);

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
                    if (node.parent && node.parent.type === "MethodDefinition") {
                        函数类型 = node.parent.static ? "静态方法" : "方法";
                    }

                    if (!前置注释) {
                        context.report({
                            node,
                            message: `${注释要求提示}\n${函数类型} "${函数名}" 缺少注释。${全量修复提示}`
                        });
                        return;
                    }

                    if (!检查注释质量(前置注释.value)) {
                        context.report({
                            node,
                            message: `${注释要求提示}\n${函数类型} "${函数名}" 的注释过于简短或为空。${全量修复提示}`
                        });
                    }
                }

                return {
                    FunctionDeclaration: 检查函数,
                    FunctionExpression: 检查函数,
                    ArrowFunctionExpression: 检查函数
                };
            }
        },

        /**
         * 要求类型定义必须有注释
         * 检查 TypeScript 的 type alias、interface 和 enum
         */
        "require-type-comment": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "要求类型定义必须编写注释",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            minCommentLength: { type: "integer", default: 10 }
                        }
                    }
                ]
            },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();

                /**
                 * 检查类型定义节点
                 */
                function 检查类型定义(node, 类型种类) {
                    const 类型名 = node.id && node.id.name;
                    if (!类型名) {
                        return;
                    }

                    const 注释目标 = 获取类型注释目标节点(node);
                    const 前置注释 = 获取前置注释(sourceCode, 注释目标);

                    if (!前置注释) {
                        context.report({
                            node,
                            message: `${类型注释要求提示}\n${类型种类} "${类型名}" 缺少注释。${全量修复提示}`
                        });
                        return;
                    }

                    if (!检查注释质量(前置注释.value)) {
                        context.report({
                            node,
                            message: `${类型注释要求提示}\n${类型种类} "${类型名}" 的注释过于简短或为空。${全量修复提示}`
                        });
                    }
                }

                return {
                    TSTypeAliasDeclaration(node) {
                        检查类型定义(node, "类型别名 (type)");
                    },
                    TSInterfaceDeclaration(node) {
                        检查类型定义(node, "接口 (interface)");
                    },
                    TSEnumDeclaration(node) {
                        检查类型定义(node, "枚举 (enum)");
                    }
                };
            }
        }
    }
};

// 英文别名导出
export const requireFunctionCommentPlugin = 函数注释要求插件;

