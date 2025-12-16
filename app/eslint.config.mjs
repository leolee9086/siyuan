import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import pluginVue from "eslint-plugin-vue";
import { 禁止内联回调插件 } from "./0_lints/no-inline-callback.mjs";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        "build",
        "node_modules",
        "src/asset/pdf",
        "src/types/dist",
        "stage",
        "appearance",
    ],
}, ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"), ...pluginVue.configs["flat/essential"], {
    plugins: {
        "@typescript-eslint": typescriptEslint,
        "vue": pluginVue,
        "no-inline-callback": 禁止内联回调插件,
    },

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.browser,
        },

        parser: tsParser,
        parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: {
                jsx: true,
            },
        },
    },

    rules: {
        // 禁止 else 和嵌套 if 的规则
        "no-restricted-syntax": [
            "error",
            {
                selector: "IfStatement[alternate]",
                message: "❌ 禁止使用 else。请使用 \"卫语句 (Guard Clauses)\" 扁平化逻辑。",
            },
            {
                selector: "IfStatement > BlockStatement > IfStatement",
                message: "❌ 禁止嵌套 If。请合并判断条件 (&&) 或提取函数。",
            },
            {
                selector: "IfStatement > IfStatement",
                message: "❌ 禁止嵌套 If。请合并逻辑。",
            },
            // 禁止在函数内部定义命名函数（闭包）
            {
                selector: ":function BlockStatement > FunctionDeclaration",
                message: "❌ 禁止在函数内部定义命名函数。请将函数提取到模块顶层，或使用匿名箭头函数。",
            },
            {
                selector: ":function BlockStatement VariableDeclarator > FunctionExpression",
                message: "❌ 禁止在函数内部定义命名函数。请将函数提取到模块顶层，或使用匿名箭头函数。",
            },
            {
                selector: ":function BlockStatement VariableDeclarator > ArrowFunctionExpression",
                message: "❌ 禁止在函数内部定义命名函数。请将函数提取到模块顶层，或使用匿名箭头函数。",
            },
            {
                selector: "MemberExpression[object.type='CallExpression'][object.callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]",
                message: "❌ 禁止隐式上下文切换：在 DOM 获取接口 (querySelector, getElementById 等) 返回的对象上直接链式调用。请务必先声明变量再使用。",
            },
            {
                selector: "MemberExpression[object.type='MemberExpression'][object.computed=true]",
                message: "❌ 禁止隐式上下文切换：禁止在使用列表下标取值操作 ([]) 之后直接访问属性。请务必先声明变量再使用。",
            },
        ],
        "max-lines": ["error", { "max": 300, "skipBlankLines": true, "skipComments": true }],
        "max-lines-per-function": ["error", { "max": 50, "skipBlankLines": true, "skipComments": true, "IIFEs": true }],
        "no-inline-callback/no-inline-callback": "error",
        semi: [2, "always"],
        quotes: [2, "double", {
            avoidEscape: true,
        }],
        "@typescript-eslint/no-unused-vars": ["warn", { caughtErrors: "none" }],
        "no-async-promise-executor": "off",
        "no-prototype-builtins": "off",
        "no-useless-escape": "off",
        "no-irregular-whitespace": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-require-imports": "off",
        "vue/multi-word-component-names": "off",
        "vue/no-unused-components": "warn",
        "vue/no-unused-vars": "warn",
        "vue/require-default-prop": "off",
        "vue/require-explicit-emits": "off",
    },
}, {
    // 禁止在非环境文件中访问全局对象
    files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
    ignores: [
        "**/*.environment.ts",
        "**/*.global.ts",
    ],
    rules: {
        "no-restricted-globals": [
            "error",
            {
                name: "window",
                message: "❌ 禁止直接访问 window。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。",
            },
            {
                name: "global",
                message: "❌ 禁止直接访问 global。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。",
            },
            {
                name: "globalThis",
                message: "❌ 禁止直接访问 globalThis。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。",
            },
        ],
    },
}];
