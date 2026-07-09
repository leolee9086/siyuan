/**
 * 函数参数数量限制规则
 *
 * 任何函数的参数数量不得超过 3 个，否则需要豁免注释。
 * 豁免注释格式: @参数豁免: 原因
 *
 * 参数过多通常意味着函数职责不单一，应考虑：
 * 1. 将部分参数合并为参数对象
 * 2. 拆分函数使其职责更单一
 * 3. 使用柯里化或部分应用减少单次调用参数
 */

import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

const MAX_PARAMS = 3;

const ALLOWED_REASONS = [
    "第三方接口适配",
    "生命周期",
    "遗留代码",
    "测试辅助",
];

/**
 * 获取豁免信息
 * @returns {{hasTag: boolean, reason: string | null}}
 */
function 获取豁免信息(node, sourceCode) {
    const comments = sourceCode.getCommentsBefore(node);
    for (const comment of comments) {
        const match = comment.value.match(/@参数豁免:\s*(\S+)/);
        if (match) {
            return { hasTag: true, reason: match[1].trim() };
        }
    }
    // 对于变量声明中的函数，检查 VariableDeclaration 前的注释
    if (node.parent && node.parent.type === "VariableDeclarator") {
        const declarator = node.parent;
        if (declarator.parent && declarator.parent.type === "VariableDeclaration") {
            const declaration = declarator.parent;
            const declComments = sourceCode.getCommentsBefore(declaration);
            for (const comment of declComments) {
                const match = comment.value.match(/@参数豁免:\s*(\S+)/);
                if (match) {
                    return { hasTag: true, reason: match[1].trim() };
                }
            }
        }
    }
    // 对于导出的函数声明，JSDoc 挂在 ExportNamedDeclaration/ExportDefaultDeclaration 之前
    if (node.parent && (node.parent.type === "ExportNamedDeclaration" || node.parent.type === "ExportDefaultDeclaration")) {
        const exportComments = sourceCode.getCommentsBefore(node.parent);
        for (const comment of exportComments) {
            const match = comment.value.match(/@参数豁免:\s*(\S+)/);
            if (match) {
                return { hasTag: true, reason: match[1].trim() };
            }
        }
    }
    return { hasTag: false, reason: null };
}

/**
 * 计算参数数量，RestElement 计为 1 个
 */
function countParams(params) {
    return params.length;
}

export const maxParamsPlugin = {
    rules: {
        "max-params": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "函数参数数量不得超过 " + MAX_PARAMS + " 个",
                    category: "Best Practices",
                    recommended: true,
                },
                messages: {
                    tooManyParams: "❌ 函数 \"{{name}}\" 参数过多：当前 {{count}} 个，最多允许 " + MAX_PARAMS + " 个。\n" +
                        "参数过多通常意味着函数职责不单一，应考虑：\n" +
                        "1. 将部分参数合并为参数对象\n" +
                        "2. 拆分函数使其职责更单一\n" +
                        "3. 使用柯里化或部分应用减少单次调用参数\n" +
                        "如有充分理由，可添加豁免注释: '/** @参数豁免: 原因 */'。\n" +
                        "允许的原因: " + ALLOWED_REASONS.join(", ") + "。" + 全量修复提示 + 单文件检查提示,
                    invalidReason: "❌ 无效的参数豁免原因: '{{reason}}'。\n" +
                        "允许的原因: " + ALLOWED_REASONS.join(", ") + "。" + 全量修复提示 + 单文件检查提示,
                },
            },
            create(context) {
                const sourceCode = context.sourceCode || context.getSourceCode();

                function checkFunction(node) {
                    const params = node.params;
                    const count = countParams(params);

                    if (count <= MAX_PARAMS) {
                        return;
                    }

                    // 获取函数名
                    let name = "匿名函数";
                    if (node.id && node.id.name) {
                        name = node.id.name;
                    } else if (node.parent && node.parent.type === "VariableDeclarator" && node.parent.id) {
                        name = node.parent.id.name;
                    } else if (node.parent && node.parent.type === "MethodDefinition" && node.parent.key) {
                        name = node.parent.key.name || name;
                    } else if (node.parent && node.parent.type === "Property" && node.parent.key) {
                        name = node.parent.key.name || name;
                    }

                    // 检查豁免
                    const { hasTag, reason } = 获取豁免信息(node, sourceCode);
                    if (hasTag) {
                        if (!ALLOWED_REASONS.includes(reason)) {
                            context.report({
                                node,
                                messageId: "invalidReason",
                                data: { reason },
                            });
                        }
                        return;
                    }

                    context.report({
                        node,
                        messageId: "tooManyParams",
                        data: { name, count },
                    });
                }

                return {
                    FunctionDeclaration: checkFunction,
                    FunctionExpression: checkFunction,
                    ArrowFunctionExpression: checkFunction,
                };
            },
        },
    },
};
