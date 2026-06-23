import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import { noInlineCallbackPlugin } from "./0_lints/no-inline-callback.mjs";
import { aiWorkerPlugin } from "./0_lints/ai-worker-rules.mjs";
import { codeSizeLimitsPlugin } from "./0_lints/code-size-limits.mjs";
import { requireFunctionCommentPlugin } from "./0_lints/require-function-comment.mjs";
import { vueCustomRulesPlugin } from "./0_lints/vue-custom-rules.mjs";
import { noAliasUsagePlugin } from "./0_lints/no-alias-usage.mjs";
import { noLargeInlineArrayPlugin } from "./0_lints/no-large-inline-array.mjs";
import { requireIfCommentPlugin } from "./0_lints/require-if-comment.mjs";
import { requireTimeoutCommentPlugin } from "./0_lints/require-timeout-comment.mjs";
import { requireAsyncExportPlugin } from "./0_lints/require-async-export.mjs";
import { requireImportCommentPlugin } from "./0_lints/require-import-comment.mjs";
import { requireExportCommentPlugin } from "./0_lints/require-export-comment.mjs";
import { noTrivialWrapperPlugin } from "./0_lints/no-trivial-wrapper.mjs";
import { noExtendsPlugin } from "./0_lints/no-extends.mjs";
import { noExportForwardingPlugin } from "./0_lints/no-export-forwarding.mjs";
import { taskCheckerPlugin } from "./0_lints/task-checker.mjs";
import { folderItemLimitPlugin } from "./0_lints/folder-item-limit.mjs";
import { noLongSingleLineCommentPlugin } from "./0_lints/no-long-single-line-comment.mjs";
import { noNestedFunctionPlugin } from "./0_lints/no-nested-function.mjs";
import { explicitReturnTypeReasonPlugin } from "./0_lints/explicit-return-type-reason.mjs";
import { FULL_FIX_REMINDER, 单文件检查提示 } from "./0_lints/shared-constants.mjs";

// Defining local constant for backward compatibility and internal usage
const 全量修复提示 = FULL_FIX_REMINDER;

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
    // 禁止在函数内部定义命名函数的规则已移至自定义规则 no-nested-function（支持柯里化豁免）
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
        ].join("\n") + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "SwitchStatement",
        message: [
            "❌ 禁止使用 switch 语句。",
            "替代方案: Object Literal / Map / Strategy Pattern / Polymorphism"
        ].join("\n") + 全量修复提示 + 单文件检查提示,
    },
    // 禁止类的私有方法 (TypeScript private 修饰符)
    {
        selector: "MethodDefinition[accessibility='private']",
        message: [
            "❌ 禁止类的私有方法。",
            "原因: 类应该只作为状态和公开方法的容器,私有方法没有可测试切面。",
            "替代方案: 将私有逻辑提取为模块级辅助函数。"
        ].join("\n") + 全量修复提示 + 单文件检查提示,
    },
    // 禁止类的私有方法 (ES2022 # 前缀)
    {
        selector: "MethodDefinition[key.type='PrivateIdentifier']",
        message: [
            "❌ 禁止类的私有方法 (# 前缀)。",
            "原因: 类应该只作为状态和公开方法的容器,私有方法没有可测试切面。",
            "替代方案: 将私有逻辑提取为模块级辅助函数。"
        ].join("\n") + 全量修复提示 + 单文件检查提示,
    },
    // 禁止类的静态方法
    {
        selector: "MethodDefinition[static=true]",
        message: [
            "❌ 禁止类的静态方法。",
            "原因: 静态方法不依赖实例状态，应该作为独立的模块级函数存在。",
            "替代方案: 将静态方法提取为模块级函数并导出。"
        ].join("\n") + 全量修复提示 + 单文件检查提示,
    },
    // 禁止单纯的别名定义 (const A = B) logic moved to no-alias-usage plugin
    {
        selector: "FunctionDeclaration ThisExpression",
        message: "❌ 禁止在独立函数中使用 this。请使用类方法或将 context 作为参数传递。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "FunctionExpression:not(MethodDefinition > FunctionExpression) ThisExpression",
        message: "❌ 禁止在非类方法(如: 对象字面量方法/独立函数表达式)中使用 this。请使用类方法或将 context 作为参数传递。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ImportDeclaration[source.value=/^\\u002E\\u002E\\u002F/][importKind!='type']",
        message: "禁止从父级目录导入 (../)。必须通过本目录同层级的 ./imports.ts 转发。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ExportNamedDeclaration[source.value=/^\\u002E\\u002E\\u002F/]",
        message: "禁止从父级目录重导出 (../)。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ExportAllDeclaration[source.value=/^\\u002E\\u002E\\u002F/]",
        message: "禁止从父级目录全量重导出 (../)。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ImportDeclaration[source.value=/^[^.]/][importKind!='type']",
        message: "禁止直接导入第三方包或别名。必须通过本目录同层级 ./imports.ts 转发。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ExportNamedDeclaration[source.value=/^[^.]/]",
        message: "禁止直接重导出第三方包或别名。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ExportAllDeclaration[source.value=/^[^.]/]",
        message: "禁止直接全量重导出第三方包或别名。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ImportDeclaration[specifiers.length>1]",
        message: "架构约束：非 imports.ts 文件中每条 import 语句只允许一个导入项目。请拆分为多条 import，避免集中导入掩盖依赖边界。" + 全量修复提示 + 单文件检查提示,
    },
];

const STRICT_IMPORT_SELECTORS = new Set([
    "ImportDeclaration[source.value=/^\\u002E\\u002E\\u002F/][importKind!='type']",
    "ExportNamedDeclaration[source.value=/^\\u002E\\u002E\\u002F/]",
    "ExportAllDeclaration[source.value=/^\\u002E\\u002E\\u002F/]",
    "ImportDeclaration[source.value=/^[^.]/][importKind!='type']",
    "ExportNamedDeclaration[source.value=/^[^.]/]",
    "ExportAllDeclaration[source.value=/^[^.]/]",
    "ImportDeclaration[specifiers.length>1]",
]);

const IMPORTS_COMMON_RESTRICTED_SYNTAX = COMMON_RESTRICTED_SYNTAX.filter(
    (rule) => !STRICT_IMPORT_SELECTORS.has(rule.selector)
);

const IMPORTS_GATEWAY_RESTRICTIONS = [
    {
        selector: "ImportDeclaration[source.value=/^\\.\\u002F/]",
        message: "架构约束：imports.ts 仅用于引入外部依赖。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ExportNamedDeclaration[source.value=/^\\.\\u002F/]",
        message: "架构约束：imports.ts 仅用于引入外部依赖。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "ExportAllDeclaration[source.value=/^\\.\\u002F/]",
        message: "架构约束：imports.ts 禁止全量重导出内部文件。" + 全量修复提示 + 单文件检查提示,
    },
];

// 类型断言限制 (仅在非 *.guard.ts / *.guards.ts 文件中生效)
const TYPE_ASSERTION_RESTRICTIONS = [
    {
        selector: "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const']), TSTypeAssertion",
        message: "❌ 禁止使用 'as' 断言。请在 *.guard.ts 或 *.guards.ts 中使用类型守卫，或依赖自动推断。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "TSTypePredicate",
        message: "❌ 架构约束：禁止在常规文件使用 'is' 关键字。类型守卫逻辑必须移至 *.guard.ts 或 *.guards.ts 文件中。" + 全量修复提示 + 单文件检查提示,
    },
];

const TYPE_DEFINITION_RESTRICTIONS = [
    {
        selector: "TSTypeAliasDeclaration",
        message: "架构约束：禁止在业务/UI文件定义 Type。请移至 *.types.ts。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "TSInterfaceDeclaration",
        message: "架构约束：禁止在业务/UI文件定义 Interface。请移至 *.types.ts。" + 全量修复提示 + 单文件检查提示,
    },
    {
        selector: "TSEnumDeclaration",
        message: "架构约束：禁止在业务/UI文件定义 Enum。请移至 *.types.ts。" + 全量修复提示 + 单文件检查提示,
    },
];

const SHARED_PLUGINS = {
    "@typescript-eslint": typescriptEslint,
    "vue": pluginVue,
    "no-inline-callback": noInlineCallbackPlugin,
    "ai-worker": aiWorkerPlugin,
    "code-size": codeSizeLimitsPlugin,
    "function-comment": requireFunctionCommentPlugin,
    "vue-custom": vueCustomRulesPlugin,
    "no-alias-usage": noAliasUsagePlugin,
    "no-large-inline-array": noLargeInlineArrayPlugin,
    "require-if-comment": requireIfCommentPlugin,
    "require-timeout-comment": requireTimeoutCommentPlugin,
    "require-async-export": requireAsyncExportPlugin,
    "require-import-comment": requireImportCommentPlugin,
    "require-export-comment": requireExportCommentPlugin,
    "no-trivial-wrapper": noTrivialWrapperPlugin,
    "no-extends": noExtendsPlugin,
    "no-export-forwarding": noExportForwardingPlugin,
    "task-checker": taskCheckerPlugin,
    "folder-item-limit": folderItemLimitPlugin,
    "comment-style": noLongSingleLineCommentPlugin,
    "no-nested-function": noNestedFunctionPlugin,
    "explicit-return-type-reason": explicitReturnTypeReasonPlugin,
};

const SHARED_RULES = {
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
    // 禁止超过 100 字符的单行注释，超长时必须改用多行注释
    "comment-style/no-long-single-line-comment": ["error", { "max": 100 }],
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
    "explicit-return-type-reason/require-return-type-reason": ["error", {
        tag: "@显式返回类型原因",
        minReasonLength: 12,
    }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-require-imports": "off",
    "vue/multi-word-component-names": "off",
    "vue/no-unused-components": "warn",
    "vue/no-unused-vars": "warn",
    "vue/require-default-prop": "off",
    "vue/require-explicit-emits": "off",
    "ai-worker/detect-ai-todo": "error",
    "function-comment/require-function-comment": "error",
    "function-comment/require-type-comment": "error",
    "vue-custom/vue-script-max-lines": "error",
    "vue-custom/vue-template-max-lines": "error",
    "vue-custom/no-vue-style-block": "error",
    "no-alias-usage/no-alias-usage": "error",
    "no-large-inline-array/no-large-inline-array": ["error", { "max": 3 }],
    "require-if-comment/require-if-comment": ["error", { "exemptGuardClauses": true, "exemptSimpleConditions": true }],
    "require-timeout-comment/require-timeout-comment": "error",
    "require-async-export/require-async-export": "error",
    "require-import-comment/require-import-comment": "error",
    "require-export-comment/require-export-comment": "error",
    "no-trivial-wrapper/no-trivial-wrapper": "error",
    "no-extends/no-extends": "error",
    "no-export-forwarding/no-export-forwarding": ["error", {
        "message": "❌ [架构约束] 禁止使用导出转发 (Export Forwarding)。\n直接在声明的原始文件中导入需要的标识符，而不是通过中间文件 (Barrel) 进行聚合。\n原因：多层导出转出会导致意外的依赖循环产生、并影响编辑器基于文件的语义与依赖查找链。" + FULL_FIX_REMINDER + 单文件检查提示
    }],
    "task-checker/require-task": "off",
    "folder-item-limit/folder-item-limit": "error",
    "no-nested-function/no-nested-function": "error",
};

export default [{
    ignores: [
        "build",
        "node_modules",
        "src/asset/pdf",
        "src/types/dist",
        "stage",
        "appearance",
        "test",
        "scripts",
        "**/*.d.ts",
        "webpack*.js",
        "**/*.backup.ts",
        "**/*.old.ts",
    ],
}, ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended"), ...pluginVue.configs["flat/essential"],
{
    // TypeScript & JavaScript Files
    files: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.mjs"],

    plugins: SHARED_PLUGINS,
    // processor: "task-checker/task-processor",  // 已禁用

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

    rules: SHARED_RULES,
},
{
    // Vue Files
    files: ["src/**/*.vue"],

    plugins: SHARED_PLUGINS,

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.browser,
        },

        parser: vueParser,
        parserOptions: {
            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "module",
            ecmaFeatures: {
                jsx: true,
            },
            extraFileExtensions: ['.vue'],
        },
    },

    rules: SHARED_RULES,
},
{
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
    ignores: ["**/*.types.ts", "**/types.ts", "**/*.schema.ts", "**/*.guard.ts", "**/*.guards.ts"]
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
                message: "❌ 禁止直接访问 window。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示 + 单文件检查提示,
            },
            {
                name: "global",
                message: "❌ 禁止直接访问 global。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示 + 单文件检查提示,
            },
            {
                name: "globalThis",
                message: "❌ 禁止直接访问 globalThis。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示 + 单文件检查提示,
            },
        ],
    },
}, {
    // imports.ts 网关层：覆盖 strict-import，仅允许外部依赖入口
    files: ["src/**/imports.ts"],
    rules: {
        "no-restricted-syntax": [
            "error",
            ...IMPORTS_COMMON_RESTRICTED_SYNTAX,
            ...TYPE_DEFINITION_RESTRICTIONS.map(r => ({
                ...r,
            })),
            ...TYPE_ASSERTION_RESTRICTIONS.map(r => ({
                ...r,
            })),
            ...IMPORTS_GATEWAY_RESTRICTIONS,
            {
                selector: "ExportNamedDeclaration[specifiers.length>1]",
                message: "架构约束：imports.ts 禁止在单条 export 语句中批量导出多个项目。请拆分为每条 export 仅导出一个项目，并分别添加注释说明。" + 全量修复提示 + 单文件检查提示
            }
        ],
        "no-export-forwarding/no-export-forwarding": ["error", {
            "message": "❌ [imports.ts 约束] 禁止在 imports.ts 中使用 export ... from / export * from 转发。\n目的：鼓励你在 imports.ts 中按业务领域重新组织依赖，而不是做机械转发。\n要求：先 import，再基于领域语义分组后 export。\n示例：\n  // ❌ 错误\n  export { foo } from \"some-lib\"\n  // ✅ 正确\n  import { foo } from \"some-lib\"\n  export { foo }\n说明：这样可以在 imports.ts 内显式表达依赖边界与领域归属，降低后续重构成本。" + FULL_FIX_REMINDER + 单文件检查提示
        }]
    }
}, {
    // 只有 *.guard.ts / *.guards.ts 允许 is，但依然受 COMMON 限制
    files: ["**/*.guard.ts", "**/*.guards.ts"],
    rules: {
        "no-restricted-syntax": ["error", ...COMMON_RESTRICTED_SYNTAX],
        "explicit-return-type-reason/require-return-type-reason": "off",
        "require-async-export/require-async-export": "off"
    }
}];
