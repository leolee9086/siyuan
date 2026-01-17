import { FULL_FIX_REMINDER } from "./shared-constants.mjs";

export const noAliasUsagePlugin = {
    rules: {
        "no-alias-usage": {
            meta: {
                type: "problem",
                docs: {
                    description: "Disallow alias usage in imports, exports, and variable definitions",
                },
                messages: {
                    noImportAlias: "❌ 禁止导入别名 (import { {{imported}} as {{local}} })。请直接使用原始名称，或在源头修改导出名。" + FULL_FIX_REMINDER,
                    noExportAlias: "❌ 禁止导出别名 (export { {{local}} as {{exported}} })。请直接使用原始名称。" + FULL_FIX_REMINDER,
                    noVariableAlias: "❌ 禁止单纯别名定义 (const {{id}} = {{init}})。请直接使用原始定义。" + FULL_FIX_REMINDER,
                },
                schema: [],
            },
            create(context) {
                return {
                    ImportSpecifier(node) {
                        const importedName = node.imported.name || node.imported.value;
                        const localName = node.local.name;

                        if (importedName !== localName) {
                            context.report({
                                node,
                                messageId: "noImportAlias",
                                data: {
                                    imported: importedName,
                                    local: localName,
                                },
                            });
                        }
                    },
                    ExportSpecifier(node) {
                        const localName = node.local.name;
                        // exported can be Identifier or Literal
                        const exportedName = node.exported.name || node.exported.value;

                        // If it's `export { A as B }` where A != B
                        if (localName !== exportedName) {
                            context.report({
                                node,
                                messageId: "noExportAlias",
                                data: {
                                    local: localName,
                                    exported: exportedName,
                                },
                            });
                        }
                    },
                    VariableDeclarator(node) {
                        // Check for: const A = B;
                        // We strictly want:
                        // 1. Parent is 'const' (or optionally let/var if desired, but request said const A = B usually)
                        // 2. id is Identifier
                        // 3. init is Identifier

                        if (
                            node.id.type === "Identifier" &&
                            node.init &&
                            node.init.type === "Identifier"
                        ) {
                            // Check parent kind
                            // node.parent is not always available depending on parser options, 
                            // but standard eslint parser usually provides it if configured?
                            // Actually context.sourceCode.getAncestors(node) or standard traversal.
                            // However, in standard ESTree, Declarator is child of Declaration.
                            // We can use the ancestor check or just accept all kinds if acceptable.
                            // But usually 'const' is the target.
                            if (node.parent.kind === 'const') {
                                context.report({
                                    node,
                                    messageId: "noVariableAlias",
                                    data: {
                                        id: node.id.name,
                                        init: node.init.name,
                                    }
                                });
                            }
                        }
                    }
                };
            },
        },
    },
};
