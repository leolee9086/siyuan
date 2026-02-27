import { FULL_FIX_REMINDER, 单文件检查提示 } from "./shared-constants.mjs";

const VALID_EXEMPTION_REASONS = [
    "Error 异常定义 (Error)",
    "平台原生类 (NativeClass)",
    "第三方库基类 (ThirdPartyBase)",
    "框架要求 (FrameworkRequired)"
];

const VALID_REASONS_STR = VALID_EXEMPTION_REASONS.join(" | ");

export const noExtendsPlugin = {
    rules: {
        "no-extends": {
            meta: {
                type: "problem",
                docs: {
                    description: "禁止业务类之间的继承，强制要求写明合法的豁免理由",
                    recommended: "error",
                },
                messages: {
                    forbiddenExtends: "❌ [架构约束] 禁止使用继承 (extends)。组合优于继承。\n如果确需继承，必须在上一行使用确切原因进行豁免，格式为: // @允许继承: <原因>\n可选的原因有: " + VALID_REASONS_STR + "\n" + FULL_FIX_REMINDER + 单文件检查提示,
                    invalidReason: "❌ 无效的继承豁免原因。\n格式必须为: // @允许继承: <原因>\n可选的原因有: " + VALID_REASONS_STR + "\n" + FULL_FIX_REMINDER + 单文件检查提示,
                    invalidIgnore: "❌ 这里使用了 // @允许继承，但是紧邻的下一行并没有发现类的继承行为，请移除无用的豁免注释。" + FULL_FIX_REMINDER + 单文件检查提示,
                },
                schema: [],
            },
            create(context) {
                const sourceCode = context.getSourceCode();
                const EXEMPTION_PREFIX = "@允许继承:";

                // Track all exemption comments
                const exemptionComments = [];
                for (const comment of sourceCode.getAllComments()) {
                    if (comment.type === "Line" && comment.value.trim().startsWith("@允许继承")) {
                        exemptionComments.push(comment);
                    }
                }

                // Track which comments were actually used
                const usedComments = new Set();

                return {
                    "ClassDeclaration, ClassExpression"(node) {
                        if (node.superClass) {
                            // Find comment on the immediately preceding line
                            const commentsBefore = sourceCode.getCommentsBefore(node);
                            const exemptionComment = commentsBefore.find(
                                c => c.type === "Line" && c.value.trim().startsWith("@允许继承")
                            );

                            if (exemptionComment) {
                                usedComments.add(exemptionComment);

                                const val = exemptionComment.value.trim();
                                if (!val.startsWith(EXEMPTION_PREFIX)) {
                                    context.report({
                                        loc: exemptionComment.loc,
                                        messageId: "invalidReason",
                                    });
                                    return;
                                }

                                const providedReason = val.substring(EXEMPTION_PREFIX.length).trim();
                                if (!VALID_EXEMPTION_REASONS.includes(providedReason)) {
                                    context.report({
                                        loc: exemptionComment.loc,
                                        messageId: "invalidReason",
                                    });
                                }
                            } else {
                                // No exemption found, report error
                                context.report({
                                    node: node.superClass,
                                    messageId: "forbiddenExtends",
                                });
                            }
                        }
                    },
                    "Program:exit"() {
                        // Check for unused exemption comments
                        for (const comment of exemptionComments) {
                            if (!usedComments.has(comment)) {
                                context.report({
                                    loc: comment.loc,
                                    messageId: "invalidIgnore",
                                });
                            }
                        }
                    }
                };
            }
        }
    }
};
