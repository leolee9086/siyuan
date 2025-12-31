import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import pluginVue from "eslint-plugin-vue";
import { 禁止内联回调插件 } from "./0_lints/no-inline-callback.mjs";
import { aiWorkerPlugin } from "./0_lints/ai-worker-rules.mjs";
import { 代码量限制插件 } from "./0_lints/code-size-limits.mjs";
import { 全量修复提示 } from "./0_lints/shared-constants.mjs";

// 重新导出全量修复提示供外部使用 (保持向后兼容性)
export { 全量修复提示 };


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

const COMMON_RESTRICTED_SYNTAX = [
    {
        selector: "IfStatement[alternate]",
        message: "❌ 禁止使用 else。请使用 \"卫语句 (Guard Clauses)\" 或者其它策略扁平化逻辑。" + 全量修复提示,
    },
    {
        selector: "IfStatement > BlockStatement > IfStatement",
        message: "❌ 禁止嵌套 If。请合并判断条件 (&&) 或提取函数。" + 全量修复提示,
    },
    {
        selector: "IfStatement > IfStatement",
        message: "❌ 禁止嵌套 If。请合并逻辑。" + 全量修复提示,
    },
    // 禁止在函数内部定义命名函数（闭包）
    {
        selector: ":function BlockStatement > FunctionDeclaration",
        message: "❌ 禁止在函数内部定义命名函数。请将函数提取到模块顶层，或使用匿名箭头函数。" + 全量修复提示,
    },
    {
        selector: ":function BlockStatement VariableDeclarator > FunctionExpression",
        message: "❌ 禁止在函数内部定义命名函数。请将函数提取到模块顶层，或使用匿名箭头函数。" + 全量修复提示,
    },
    {
        selector: ":function BlockStatement VariableDeclarator > ArrowFunctionExpression",
        message: "❌ 禁止在函数内部定义命名函数。请将函数提取到模块顶层，或使用匿名箭头函数。" + 全量修复提示,
    },
    {
        selector: "MemberExpression[object.type='CallExpression'][object.callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]",
        message: "❌ 禁止隐式上下文切换：在 DOM 获取接口 (querySelector, getElementById 等) 返回的对象上直接链式调用。请务必先声明变量再使用。" + 全量修复提示,
    },
    {
        selector: "MemberExpression[object.type='MemberExpression'][object.computed=true]",
        message: "❌ 禁止隐式上下文切换：禁止在使用列表下标取值操作 ([]) 之后直接访问属性。请务必先声明变量再使用。" + 全量修复提示,
    },
    {
        selector: "CallExpression[callee.property.name='forEach']",
        message: [
            "❌ 禁止使用 .forEach()。",
            "原因 1: forEach 无法等待异步操作。",
            "原因 2: forEach 无法提前中断。",
            "替代方案: for...of / .map() / .filter()"
        ].join("\n") + 全量修复提示,
    },
    {
        selector: "SwitchStatement",
        message: [
            "❌ 禁止使用 switch 语句。",
            "替代方案: Object Literal / Map / Strategy Pattern / Polymorphism"
        ].join("\n") + 全量修复提示,
    },
    // 禁止类的私有方法 (TypeScript private 修饰符)
    {
        selector: "MethodDefinition[accessibility='private']",
        message: [
            "❌ 禁止类的私有方法。",
            "原因: 类应该只作为状态和公开方法的容器,私有方法没有可测试切面。",
            "替代方案: 将私有逻辑提取为模块级辅助函数。"
        ].join("\n") + 全量修复提示,
    },
    // 禁止类的私有方法 (ES2022 # 前缀)
    {
        selector: "MethodDefinition[key.type='PrivateIdentifier']",
        message: [
            "❌ 禁止类的私有方法 (# 前缀)。",
            "原因: 类应该只作为状态和公开方法的容器,私有方法没有可测试切面。",
            "替代方案: 将私有逻辑提取为模块级辅助函数。"
        ].join("\n") + 全量修复提示,
    },
    // 禁止类的静态方法
    {
        selector: "MethodDefinition[static=true]",
        message: [
            "❌ 禁止类的静态方法。",
            "原因: 静态方法不依赖实例状态，应该作为独立的模块级函数存在。",
            "替代方案: 将静态方法提取为模块级函数并导出。"
        ].join("\n") + 全量修复提示,
    },
];

// 类型断言限制 (仅在非 .guard.ts 文件中生效)
const TYPE_ASSERTION_RESTRICTIONS = [
    {
        selector: "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const']), TSTypeAssertion",
        message: "❌ 禁止使用 'as' 断言。请在 .guard.ts 中使用类型守卫，或依赖自动推断。" + 全量修复提示,
    },
    {
        selector: "TSTypePredicate",
        message: "❌ 架构约束：禁止在常规文件使用 'is' 关键字。类型守卫逻辑必须移至 *.guard.ts 文件中。" + 全量修复提示,
    },
];

const TYPE_DEFINITION_RESTRICTIONS = [
    {
        selector: "TSTypeAliasDeclaration",
        message: "架构约束：禁止在业务/UI文件定义 Type。请移至 *.types.ts。" + 全量修复提示,
    },
    {
        selector: "TSInterfaceDeclaration",
        message: "架构约束：禁止在业务/UI文件定义 Interface。请移至 *.types.ts。" + 全量修复提示,
    },
    {
        selector: "TSEnumDeclaration",
        message: "架构约束：禁止在业务/UI文件定义 Enum。请移至 *.types.ts。" + 全量修复提示,
    },
];

export default [{
    ignores: [
        "build",
        "node_modules",
        "src/asset/pdf",
        "src/types/dist",
        "stage",
        "appearance",
        "test",
        "**/*.d.ts",
        "webpack*.js",
    ],
}, ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"), ...pluginVue.configs["flat/essential"], {
    files: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "src/**/*.mjs"],

    plugins: {
        "@typescript-eslint": typescriptEslint,
        "vue": pluginVue,
        "no-inline-callback": 禁止内联回调插件,
        "ai-worker": aiWorkerPlugin,
        "code-size": 代码量限制插件,
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
            ...COMMON_RESTRICTED_SYNTAX,
            // 只有在非 .types.ts / .schema.ts 中才拦截类型定义
            // 注意：ESLint 选择器本身不支持判断当前文件名，
            // 所以我们需要通过分块并给不同文件应用不同规则，
            // 但关键是不要让它们“覆盖”掉基础的 COMMON 规则。
        ],
        "max-lines": "off",  // 使用自定义规则 code-size/max-lines 代替
        "max-lines-per-function": "off",  // 使用自定义规则 code-size/max-lines-per-function 代替
        "code-size/max-lines": ["error", { "max": 300, "skipBlankLines": true, "skipComments": true }],
        "code-size/max-lines-per-function": ["error", { "max": 50, "skipBlankLines": true, "skipComments": true, "IIFEs": true }],
        "no-inline-callback/no-inline-callback": "error",
        "class-methods-use-this": "off",  // 静态方法已被 no-restricted-syntax 禁止，此规则不再需要
        semi: [2, "always"],
        quotes: [2, "double", {
            avoidEscape: true,
        }],
        // 禁止 if/else/for/while 等不使用大括号
        "curly": ["error", "all"],
        // 强制大括号换行风格 (1tbs = one true brace style，但要求换行)
        "brace-style": ["error", "1tbs", { "allowSingleLine": false }],
        // 禁止一行内写多条语句 (用分号分隔)
        "max-statements-per-line": ["error", { "max": 1 }],
        "@typescript-eslint/no-unused-vars": ["warn", { caughtErrors: "none" }],
        "no-async-promise-executor": "off",
        "no-prototype-builtins": "off",
        "no-useless-escape": "off",
        "no-irregular-whitespace": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-non-null-assertion": "error",
        "@typescript-eslint/no-require-imports": "off",
        "vue/multi-word-component-names": "off",
        "vue/no-unused-components": "warn",
        "vue/no-unused-vars": "warn",
        "vue/require-default-prop": "off",
        "vue/require-explicit-emits": "off",
        "ai-worker/detect-ai-todo": "error",
    },
}, {
    // 架构约束：组合所有探测逻辑
    files: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
    rules: {
        "no-restricted-syntax": [
            "error",
            ...COMMON_RESTRICTED_SYNTAX,
            // 为不同文件后缀应用特定规则（这里采用多重判定或简单合并）
            // 实际上，如果我们要针对不同文件应用不同规则且不覆盖，
            // 每个 block 的 files/ignores 必须严格互斥，或者在同一个 block 里搞定。
            ...TYPE_DEFINITION_RESTRICTIONS.map(r => ({
                ...r,
            })),
            ...TYPE_ASSERTION_RESTRICTIONS.map(r => ({
                ...r,
            }))
        ]
    },
    ignores: ["**/*.types.ts", "**/types.ts", "**/*.schema.ts", "**/*.guard.ts"]
}, {
    // 禁止在非环境/全局文件中访问全局对象 (独立规则不冲突)
    files: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
    ignores: [
        "**/*.environment.ts",
        "**/*.global.ts",
    ],
    rules: {
        "no-restricted-globals": [
            "error",
            {
                name: "window",
                message: "❌ 禁止直接访问 window。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示,
            },
            {
                name: "global",
                message: "❌ 禁止直接访问 global。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示,
            },
            {
                name: "globalThis",
                message: "❌ 禁止直接访问 globalThis。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示,
            },
        ],
    },
}, {
    // 只有 .guard.ts 允许 is，但依然受 COMMON 限制
    files: ["**/*.guard.ts"],
    rules: {
        "no-restricted-syntax": ["error", ...COMMON_RESTRICTED_SYNTAX]
    }
}];
