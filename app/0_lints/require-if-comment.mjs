/**
 * 要求 if 语句必须有注释说明 ESLint 规则
 * 
 * 检测 if 语句前是否有注释说明其判断逻辑
 * 这有助于提高代码可读性，让其他开发者理解条件判断的意图
 */

import { FULL_FIX_REMINDER } from "./shared-constants.mjs";



/**
 * 明显不需要注释的简单条件模式
 * 这些条件足够简单，不需要额外的注释说明
 */
const 简单条件模式 = [
    // 简单的空值检查: if (!x), if (x), if (x == null), if (x != null)
    /^!?\w+$/,
    /^\w+\s*[!=]==?\s*null$/,
    /^\w+\s*[!=]==?\s*undefined$/,
    // 简单的布尔属性检查: if (obj.prop)
    /^!?\w+\.\w+$/,
    // 简单的类型检查: if (typeof x === 'string')
    /^typeof\s+\w+\s*===?\s*['"][^'"]+['"]$/,
];

/**
 * 检查条件是否足够简单，不需要注释
 */
function 是简单条件(conditionText) {
    const trimmed = conditionText.trim();
    return 简单条件模式.some(pattern => pattern.test(trimmed));
}

/**
 * 检查节点前面是否有注释
 */
function 检查前置注释(node, sourceCode) {
    const comments = sourceCode.getCommentsBefore(node);

    // 如果有任何注释，则认为已经有说明
    if (comments.length > 0) {
        // 检查注释是否在同一行或紧邻的上一行
        const lastComment = comments[comments.length - 1];
        const commentEndLine = lastComment.loc.end.line;
        const nodeStartLine = node.loc.start.line;

        // 注释必须紧邻 if 语句（在同一行或上一行）
        if (nodeStartLine - commentEndLine <= 1) {
            return true;
        }
    }

    return false;
}



/**
 * 检查 if 语句是否是卫语句（guard clause）
 * 卫语句通常用于提前返回，条件意图明确
 */
function 是卫语句(node) {
    // 检查 if 语句体是否只包含 return/throw/continue/break
    const consequent = node.consequent;

    if (consequent.type === "BlockStatement") {
        // 检查是否只有一条语句
        if (consequent.body.length !== 1) {
            return false;
        }
        const stmt = consequent.body[0];
        return ["ReturnStatement", "ThrowStatement", "ContinueStatement", "BreakStatement"].includes(stmt.type);
    }

    // 没有大括号的情况
    return ["ReturnStatement", "ThrowStatement", "ContinueStatement", "BreakStatement"].includes(consequent.type);
}

/**
 * 获取条件的源代码文本
 */
function 获取条件文本(node, sourceCode) {
    return sourceCode.getText(node.test);
}

/**
 * 生成错误信息
 */
function 生成错误信息(conditionText) {
    const shortCondition = conditionText.length > 30
        ? conditionText.substring(0, 30) + "..."
        : conditionText;
    return [
        `❌ if 语句 (${shortCondition}) 缺少注释说明。`,
        `📖 请先阅读上下文代码，完全理解这个判断在什么情况下会生效、为什么需要这个判断。`,
        `✏️ 然后在 if 语句前添加注释，解释判断的意图和生效场景。`,
        FULL_FIX_REMINDER
    ].join("\n");
}

/**
 * 要求 if 注释插件
 */
export const 要求if注释插件 = {
    rules: {
        "require-if-comment": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "要求 if 语句前必须有注释说明判断意图",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            exemptGuardClauses: {
                                type: "boolean",
                                default: true
                            },
                            exemptSimpleConditions: {
                                type: "boolean",
                                default: true
                            }
                        },
                        additionalProperties: false
                    }
                ]
            },
            create(context) {
                const sourceCode = context.getSourceCode();
                const options = context.options[0] || {};
                const exemptGuardClauses = options.exemptGuardClauses !== false;
                const exemptSimpleConditions = options.exemptSimpleConditions !== false;

                return {
                    IfStatement(node) {
                        // 跳过 else if 分支（它们是嵌套的 IfStatement）
                        if (node.parent && node.parent.type === "IfStatement" && node.parent.alternate === node) {
                            return;
                        }



                        // 获取条件文本
                        const conditionText = 获取条件文本(node, sourceCode);

                        // 豁免卫语句
                        if (exemptGuardClauses && 是卫语句(node)) {
                            return;
                        }

                        // 豁免简单条件
                        if (exemptSimpleConditions && 是简单条件(conditionText)) {
                            return;
                        }

                        // 检查是否有前置注释
                        if (检查前置注释(node, sourceCode)) {
                            return;
                        }

                        // 报告错误
                        context.report({
                            node,
                            message: 生成错误信息(conditionText)
                        });
                    }
                };
            }
        }
    }
};

// 英文别名导出
export const requireIfCommentPlugin = 要求if注释插件;
