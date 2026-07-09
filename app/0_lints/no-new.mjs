/**
 * 禁止 new 关键字规则
 *
 * 除 *.factory.ts 文件外，所有文件禁止使用 new 关键字实例化对象。
 * 工厂模式应集中在 .factory.ts 文件中，其他文件通过工厂函数获取实例。
 *
 * 豁免：文件名以 .factory.ts 结尾的文件不受此限制。
 */

import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

/**
 * 判断当前文件是否为工厂文件（以 .factory.ts 结尾）
 */
function isFactoryFile(filename) {
    return filename.endsWith(".factory.ts");
}

/**
 * 内置 JS 构造器白名单
 * 这些是语言/平台标准对象，不属于业务领域对象，无需经工厂模式创建
 */
const BUILTIN_CONSTRUCTORS = new Set([
    "Array", "Object", "Function", "Boolean", "Number", "String", "Symbol", "BigInt",
    "Date", "RegExp", "Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError",
    "EvalError", "URIError", "AggregateError",
    "Set", "Map", "WeakSet", "WeakMap", "WeakRef", "Iterator", "Generator",
    "Promise", "ArrayBuffer", "SharedArrayBuffer", "DataView",
    "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
    "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array",
    "URL", "URLSearchParams", "TextEncoder", "TextDecoder",
    "Headers", "Request", "Response", "FormData", "Blob", "File", "FileReader",
    "AbortController", "AbortSignal", "Event", "CustomEvent", "MessageChannel", "MessagePort",
    "Proxy", "FinalizationRegistry",
]);

/**
 * 判断 NewExpression 的构造器是否为内置 JS 对象
 */
function isBuiltinConstructor(node) {
    return node.callee.type === "Identifier" && BUILTIN_CONSTRUCTORS.has(node.callee.name);
}

export const noNewPlugin = {
    rules: {
        "no-new": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "禁止在非 .factory.ts 文件中使用 new 关键字",
                    category: "Best Practices",
                    recommended: true,
                },
                messages: {
                    noNew: "❌ 禁止在非 .factory.ts 文件中使用 new 关键字实例化对象。\n" +
                        "工厂模式应集中在 .factory.ts 文件中，其他文件应通过工厂函数获取实例。\n" +
                        "如果当前文件确实需要直接实例化，请将其重命名为 *.factory.ts，或调用对应的工厂函数。" +
                        全量修复提示 + 单文件检查提示,
                },
            },
            create(context) {
                const filename = context.getFilename();

                // 工厂文件豁免
                if (isFactoryFile(filename)) {
                    return {};
                }

                return {
                    NewExpression(node) {
                        // 内置 JS 构造器（如 Set/Map/Date 等）不视为业务对象工厂，豁免
                        if (isBuiltinConstructor(node)) {
                            return;
                        }
                        context.report({
                            node,
                            messageId: "noNew",
                        });
                    },
                };
            },
        },
    },
};
