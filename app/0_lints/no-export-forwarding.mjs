import { FULL_FIX_REMINDER, 单文件检查提示 } from "./shared-constants.mjs";

export const noExportForwardingPlugin = {
    rules: {
        "no-export-forwarding": {
            meta: {
                type: "problem",
                docs: {
                    description: "禁止导出转发 (Export Forwarding) 以保持清晰的模块依赖图。",
                    recommended: "error",
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            message: {
                                type: "string"
                            }
                        },
                        additionalProperties: false
                    }
                ],
                messages: {
                    defaultMessage: "❌ [架构约束] 禁止导出转发 (Export Forwarding / Re-exporting)。\n原因：导出转发会将多个模块打包成一个“桶 (Barrel)”进行导出，这会导致隐式依赖、增加打包体积风险、扰乱代码补全和跳转，并破坏基于文件的树形结构。\n解决：请直接从声明该变量、函数或类的原始文件中 import (例如 `import { foo } from './original.ts'`)，不要通过中间文件进行转发。\n" + FULL_FIX_REMINDER + 单文件检查提示
                }
            },
            create(context) {
                const options = context.options[0] || {};
                const customMessage = options.message;

                const reportError = (node) => {
                    if (customMessage) {
                        context.report({
                            node,
                            message: customMessage
                        });
                    } else {
                        context.report({
                            node,
                            messageId: "defaultMessage"
                        });
                    }
                };

                return {
                    "ExportNamedDeclaration"(node) {
                        // 如果有 source，并且不是类型导出的转发
                        if (node.source != null) {
                            if (node.exportKind === 'type') {
                                return; // 类型转发暂不拦截
                            }
                            reportError(node);
                        }
                    },
                    "ExportAllDeclaration"(node) {
                        if (node.exportKind === 'type') {
                            return; // 类型转发暂不拦截
                        }
                        reportError(node);
                    }
                };
            }
        }
    }
};
