import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import { SHARED_PLUGINS_WITH_PRIORITY as SHARED_PLUGINS, PRIORITY_PROCESSOR } from "./0_lints/priority-config.mjs";
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

// ─────────────────────────────────────────────────────────────────────────
// 架构约束规则配置
//
// 原 no-restricted-syntax 和 no-restricted-globals 已拆解为 restrictions
// 插件中的独立规则（0_lints/restrictions.mjs），每条规则拥有独立 ruleId，
// 可在优先级系统中分别赋予不同优先级。
//
// 以下将各条独立规则按 config block 分组启用/禁用，行为与原配置完全等价。
// ─────────────────────────────────────────────────────────────────────────

/**
 * COMMON 约束：所有文件（含 guard 文件）始终生效的架构约束。
 * 对应原 COMMON_RESTRICTED_SYNTAX 中的选择器。
 */
const COMMON_RESTRICTION_RULES = {
    // if 控制流
    "restrictions/no-else": "error",
    "restrictions/no-nested-if-block": "error",
    "restrictions/no-nested-if-direct": "error",
    // 上下文切换
    "restrictions/no-implicit-dom-chain": "error",
    "restrictions/no-implicit-computed-chain": "error",
    // 流程控制
    "restrictions/no-for-each": "error",
    "restrictions/no-switch": "error",
    // 类设计
    "restrictions/no-private-method": "error",
    "restrictions/no-hash-private-method": "error",
    "restrictions/no-static-method": "error",
    // this 约束
    "restrictions/no-this-in-function": "error",
    "restrictions/no-this-in-non-class": "error",
    // 导入边界
    "restrictions/no-parent-import": "error",
    "restrictions/no-parent-reexport": "error",
    "restrictions/no-parent-reexport-all": "error",
    "restrictions/no-direct-import": "error",
    "restrictions/no-direct-reexport": "error",
    "restrictions/no-direct-reexport-all": "error",
    "restrictions/no-multi-import": "error",
};

/**
 * 类型定义边界 + 类型断言约束。
 * 仅在非 *.types.ts / *.schema.ts / *.guard.ts / *.guards.ts 文件中生效。
 * 对应原 TYPE_DEFINITION_RESTRICTIONS + TYPE_ASSERTION_RESTRICTIONS。
 */
const TYPE_BOUNDARY_RULES = {
    // 类型定义边界
    "restrictions/no-type-alias": "error",
    "restrictions/no-interface": "error",
    "restrictions/no-enum": "error",
    // 类型安全
    "restrictions/no-as-assertion": "error",
    "restrictions/no-is-keyword": "error",
};

/**
 * 全局对象访问约束。
 * 仅在非 *.environment.ts / *.global.ts 文件中生效。
 * 对应原 no-restricted-globals 配置。
 */
const GLOBAL_ACCESS_RULES = {
    "restrictions/no-window": "error",
    "restrictions/no-global": "error",
    "restrictions/no-globalthis": "error",
};

/**
 * imports.ts 网关层需要关闭的导入边界规则（imports.ts 本身就是网关）。
 * 对应原 STRICT_IMPORT_SELECTORS 的排除逻辑。
 */
const IMPORTS_GATEWAY_DISABLE_RULES = {
    "restrictions/no-parent-import": "off",
    "restrictions/no-parent-reexport": "off",
    "restrictions/no-parent-reexport-all": "off",
    "restrictions/no-direct-import": "off",
    "restrictions/no-direct-reexport": "off",
    "restrictions/no-direct-reexport-all": "off",
    "restrictions/no-multi-import": "off",
};

/**
 * imports.ts 网关层专属约束。
 * 对应原 IMPORTS_GATEWAY_RESTRICTIONS + multi-export 规则。
 */
const IMPORTS_GATEWAY_ENABLE_RULES = {
    "restrictions/imports-no-relative-import": "error",
    "restrictions/imports-no-relative-export": "error",
    "restrictions/imports-no-reexport-all-internal": "error",
    "restrictions/imports-no-multi-export": "error",
};

const SHARED_RULES = {
    // 原 no-restricted-syntax 和 no-restricted-globals 已被拆解为独立规则，
    // 此处关闭内置规则避免重复报错
    "no-restricted-syntax": "off",
    "no-restricted-globals": "off",

    // COMMON 架构约束（所有文件生效）
    ...COMMON_RESTRICTION_RULES,

    "max-lines": "off",  // 使用自定义规则 code-size/max-lines 代替
    "max-lines-per-function": "off",  // 使用自定义规则 code-size/max-lines-per-function 代替
    "code-size/max-lines": ["error", { "max": 300, "skipBlankLines": true, "skipComments": true }],
    "code-size/max-lines-per-function": ["error", { "max": 50, "skipBlankLines": true, "skipComments": true, "IIFEs": true }],
    "no-inline-callback/no-inline-callback": "error",
    "class-methods-use-this": "off",  // 静态方法已被 restrictions/no-static-method 禁止，此规则不再需要
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
    "no-class/no-class": "error",
    "no-module-level-var/no-module-level-var": "error",
    "no-export-forwarding/no-export-forwarding": ["error", {
        "message": "❌ [架构约束] 禁止使用导出转发 (Export Forwarding)。\n直接在声明的原始文件中导入需要的标识符，而不是通过中间文件 (Barrel) 进行聚合。\n原因：多层导出转出会导致意外的依赖循环产生、并影响编辑器基于文件的语义与依赖查找链。" + FULL_FIX_REMINDER + 单文件检查提示
    }],
    "folder-item-limit/folder-item-limit": "error",
    "no-nested-function/no-nested-function": "error",
    "max-params/max-params": "error",
    "no-new/no-new": "error",
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
    processor: PRIORITY_PROCESSOR,

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
    processor: PRIORITY_PROCESSOR,

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
    // 类型定义边界 + 类型断言约束：仅在非 types/schema/guard 文件中生效
    files: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
    ignores: ["**/*.types.ts", "**/types.ts", "**/*.schema.ts", "**/*.guard.ts", "**/*.guards.ts"],
    rules: {
        ...TYPE_BOUNDARY_RULES,
    },
}, {
    // 全局对象访问约束：仅在非 environment/global 文件中生效
    files: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
    ignores: [
        "**/*.environment.ts",
        "**/*.global.ts",
    ],
    rules: {
        ...GLOBAL_ACCESS_RULES,
    },
}, {
    // imports.ts 网关层：关闭导入边界规则，启用网关专属约束
    files: ["src/**/imports.ts"],
    rules: {
        ...IMPORTS_GATEWAY_DISABLE_RULES,
        ...IMPORTS_GATEWAY_ENABLE_RULES,
        // 类型定义和断言约束在 imports.ts 中也生效
        "restrictions/no-type-alias": "error",
        "restrictions/no-interface": "error",
        "restrictions/no-enum": "error",
        "restrictions/no-as-assertion": "error",
        "restrictions/no-is-keyword": "error",
        "no-export-forwarding/no-export-forwarding": ["error", {
            "message": "❌ [imports.ts 约束] 禁止在 imports.ts 中使用 export ... from / export * from 转发。\n目的：鼓励你在 imports.ts 中按业务领域重新组织依赖，而不是做机械转发。\n要求：先 import，再基于领域语义分组后 export。\n示例：\n  // ❌ 错误\n  export { foo } from \"some-lib\"\n  // ✅ 正确\n  import { foo } from \"some-lib\"\n  export { foo }\n说明：这样可以在 imports.ts 内显式表达依赖边界与领域归属，降低后续重构成本。" + FULL_FIX_REMINDER + 单文件检查提示
        }]
    }
}, {
    // 只有 *.guard.ts / *.guards.ts 允许 is，关闭类型断言约束和相关质量规则
    files: ["**/*.guard.ts", "**/*.guards.ts"],
    rules: {
        // guard 文件中允许 is 关键字和 as 断言（不在 TYPE_BOUNDARY_RULES 的覆盖范围内，
        // 因为上面的 config block ignores 了 guard 文件）
        "explicit-return-type-reason/require-return-type-reason": "off",
        "require-async-export/require-async-export": "off"
    }
}, {
    // 执行器层 (*.executor.ts)：状态空间收集完成后禁止控制流
    // 分派必须提升到 calibur-router 的 split 模式，由类型系统保证穷尽性与互斥性
    // 极少数必须保留的判断通过 // @执行器豁免: <理由> 显式声明
    files: ["**/*.executor.ts"],
    rules: {
        "no-control-flow-in-executor/no-control-flow-in-executor": "error",
    }
}];