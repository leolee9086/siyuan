/**
 * 显式返回类型理由规则
 *
 * 默认禁止函数实现上显式标注返回值类型。
 * 只有在前置块注释中说明“为什么不能依赖类型推导”时才允许保留该语法。
 */

import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

const 默认理由标签 = "@显式返回类型原因";
const 默认最短理由长度 = 12;

/**
 * 转义正则中的特殊字符。
 */
function 转义正则字符(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 获取需要承载理由注释的目标节点。
 *
 * 规则：
 * - export function：注释挂在 export 声明上
 * - const foo = () => {}：注释挂在变量声明上
 * - class Foo { bar(): T {} }：注释挂在 MethodDefinition 上
 * - const obj = { bar(): T {} }：注释挂在 Property 上
 */
function 获取注释目标节点(node) {
    const parent = node.parent;
    if (!parent) {
        return node;
    }

    if (parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration") {
        return parent;
    }

    if (parent.type === "MethodDefinition" || parent.type === "Property") {
        return parent;
    }

    if (parent.type === "VariableDeclarator") {
        const declaration = parent.parent?.type === "VariableDeclaration"
            ? parent.parent
            : parent;

        if (
            declaration.parent
            && (declaration.parent.type === "ExportNamedDeclaration"
                || declaration.parent.type === "ExportDefaultDeclaration")
        ) {
            return declaration.parent;
        }

        return declaration;
    }

    return node;
}

/**
 * 获取最近的前置块注释。
 */
function 获取前置块注释(sourceCode, node) {
    const comments = sourceCode.getCommentsBefore(node);

    for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];
        if (comment.type === "Block") {
            return comment;
        }
    }

    return null;
}

/**
 * 提取注释中的显式返回类型理由。
 */
function 提取显式返回类型理由(commentValue, tag) {
    const normalized = commentValue
        .split("\n")
        .map((line) => line.replace(/^\s*\*?\s?/, ""))
        .join("\n");

    const reasonPattern = new RegExp(`${转义正则字符(tag)}\\s*[:：]?\\s*(.+)`);
    const match = normalized.match(reasonPattern);
    return match?.[1]?.trim() ?? "";
}

/**
 * 获取函数名，便于生成错误信息。
 */
function 获取函数名(node) {
    if (node.id?.type === "Identifier") {
        return node.id.name;
    }

    const parent = node.parent;
    if (!parent) {
        return "匿名函数";
    }

    if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
        return parent.id.name;
    }

    if (parent.type === "MethodDefinition" || parent.type === "Property") {
        if (parent.key.type === "Identifier") {
            return parent.key.name;
        }

        if (parent.key.type === "Literal") {
            return String(parent.key.value);
        }

        if (parent.key.type === "PrivateIdentifier") {
            return `#${parent.key.name}`;
        }
    }

    return "匿名函数";
}

/**
 * 检查节点是否为真正的函数实现。
 *
 * 例如：TSDeclareFunction 没有函数体，无法依赖实现推导，不应由本规则处理。
 */
function 是可检查的函数实现(node) {
    return !!node.body;
}

/**
 * 显式返回类型理由插件
 */
export const 显式返回类型理由插件 = {
    rules: {
        "require-return-type-reason": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "禁止函数显式返回值注解，除非前置注释说明为什么必须固定返回类型",
                    recommended: true,
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            tag: { type: "string" },
                            minReasonLength: {
                                type: "integer",
                                minimum: 1,
                            },
                        },
                        additionalProperties: false,
                    },
                ],
                messages: {
                    missingReason: [
                        "❌ 禁止显式返回值注解。",
                        "函数 \"{{name}}\" 使用了返回值类型标注，但没有说明为什么不能依赖类型推导。",
                        "请删除该返回值注解，或在前置块注释中添加 {{tag}} 并解释必须固定返回类型的原因。",
                        "{{extra}}",
                    ].join("\n"),
                    shortReason: [
                        "❌ 显式返回值注解理由过短。",
                        "函数 \"{{name}}\" 提供了 {{tag}}，但内容不足以说明为什么不能依赖类型推导。",
                        "请补充清楚：为什么这里必须显式规定返回类型，而不是让 TypeScript 自动推导。",
                        "{{extra}}",
                    ].join("\n"),
                },
            },

            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();
                const options = context.options[0] ?? {};
                const tag = options.tag ?? 默认理由标签;
                const minReasonLength = options.minReasonLength ?? 默认最短理由长度;

                function 检查函数(node) {
                    if (!是可检查的函数实现(node)) {
                        return;
                    }

                    if (!node.returnType) {
                        return;
                    }

                    const targetNode = 获取注释目标节点(node);
                    const comment = 获取前置块注释(sourceCode, targetNode);
                    const reason = comment ? 提取显式返回类型理由(comment.value, tag) : "";

                    if (!comment || !reason) {
                        context.report({
                            node: node.returnType,
                            messageId: "missingReason",
                            data: {
                                name: 获取函数名(node),
                                tag,
                                extra: `${全量修复提示}${单文件检查提示}`,
                            },
                        });
                        return;
                    }

                    if (reason.length < minReasonLength) {
                        context.report({
                            node: node.returnType,
                            messageId: "shortReason",
                            data: {
                                name: 获取函数名(node),
                                tag,
                                extra: `${全量修复提示}${单文件检查提示}`,
                            },
                        });
                    }
                }

                return {
                    FunctionDeclaration: 检查函数,
                    FunctionExpression: 检查函数,
                    ArrowFunctionExpression: 检查函数,
                };
            },
        },
    },
};

// 英文别名导出
export const explicitReturnTypeReasonPlugin = 显式返回类型理由插件;
