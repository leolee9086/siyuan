/**
 * 优先级配置中心
 *
 * 在此文件中：
 * 1. 导入所有自定义插件和第三方插件
 * 2. 用 createPriorityPlugin 包装并注册优先级（副作用：写入 registry）
 * 3. 手动注册原生/第三方规则和拆分后的 restrictions 规则的优先级
 * 4. 导出包装后的插件集合 + 处理器插件 + 处理器引用字符串
 *
 * 优先级使用任意数值，没有硬编码级别限制。
 * 约定：0 = 最高优先级，数值越大优先级越低。
 * 高优先级 error 清零后，低优先级 error 自动浮现。
 *
 * ─── 优先级分配 ───
 *
 *   0  代码行数/函数行数
 *   1  if 嵌套控制流 + 执行器层无控制流约束
 *   2  流程控制（forEach、switch）
 *   3  类型安全（as 断言、is 关键字）+ 基础格式 + vue
 *   4  代码质量（注释要求、返回类型理由、Vue 文件约束、长单行注释）
 *   5  架构强约束-单文件（继承禁令、嵌套函数定义、内联回调、大型内联数组、无意义包装、禁止 new）
 *   6  类型定义边界（业务文件中定义 type/interface/enum）
 *   7  类设计（私有方法、静态方法）
 *   8  this 约束
 *   9  上下文切换（DOM 链式调用、下标取值链式调用）
 *  10  全局对象访问（window、global、globalThis）
 *  11  AI 任务标记
 *  11  require-async-export / require-import-comment（单独下调）+ AI 任务标记
 *  12  no-class（单独下调，禁止所有 class 声明）
 *  13  导入边界（父级导入、直接导入第三方、批量导入）——跨文件
 *  14  imports.ts 网关特殊约束——跨文件
 *  15  跨文件架构约束（导出转发、别名禁令、文件夹条目）——跨文件
 *  16  未注册规则的默认优先级（DEFAULT_PRIORITY in priority-lint.mjs）
 *
 * eslint.config.mjs 只需从此文件导入 SHARED_PLUGINS_WITH_PRIORITY 和
 * PRIORITY_PROCESSOR，替换原先的 SHARED_PLUGINS。
 */

import { createPriorityPlugin, registerPriorities, priorityLintPlugin } from "./priority-lint.mjs";

// ─── 导入所有自定义插件 ───
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import pluginVue from "eslint-plugin-vue";
import { restrictionsPlugin } from "./restrictions.mjs";
import { noInlineCallbackPlugin } from "./no-inline-callback.mjs";
import { aiWorkerPlugin } from "./ai-worker-rules.mjs";
import { codeSizeLimitsPlugin } from "./code-size-limits.mjs";
import { requireFunctionCommentPlugin } from "./require-function-comment.mjs";
import { vueCustomRulesPlugin } from "./vue-custom-rules.mjs";
import { noAliasUsagePlugin } from "./no-alias-usage.mjs";
import { noLargeInlineArrayPlugin } from "./no-large-inline-array.mjs";
import { requireIfCommentPlugin } from "./require-if-comment.mjs";
import { requireTimeoutCommentPlugin } from "./require-timeout-comment.mjs";
import { requireAsyncExportPlugin } from "./require-async-export.mjs";
import { requireImportCommentPlugin } from "./require-import-comment.mjs";
import { requireExportCommentPlugin } from "./require-export-comment.mjs";
import { noTrivialWrapperPlugin } from "./no-trivial-wrapper.mjs";
import { noExtendsPlugin } from "./no-extends.mjs";
import { noExportForwardingPlugin } from "./no-export-forwarding.mjs";
import { folderItemLimitPlugin } from "./folder-item-limit.mjs";
import { noLongSingleLineCommentPlugin } from "./no-long-single-line-comment.mjs";
import { noNestedFunctionPlugin } from "./no-nested-function.mjs";
import { explicitReturnTypeReasonPlugin } from "./explicit-return-type-reason.mjs";
import { noControlFlowInExecutorPlugin } from "./no-control-flow-in-executor.mjs";
import { noClassPlugin } from "./no-class.mjs";
import { maxParamsPlugin } from "./max-params.mjs";
import { noNewPlugin } from "./no-new.mjs";

// ─── 包装自定义插件并注册优先级 ───
// createPriorityPlugin 不修改插件行为，仅将规则优先级写入 registry

const wrappedPlugins = {
    // 第三方插件——基础安全规则（优先级 3，与类型安全同级）
    "@typescript-eslint": createPriorityPlugin(typescriptEslint, "@typescript-eslint", 3),
    "vue": createPriorityPlugin(pluginVue, "vue", 3),

    // 拆分后的架构约束插件——每条规则单独注册优先级
    "restrictions": createPriorityPlugin(restrictionsPlugin, "restrictions", {
        // if 控制流（优先级 1）
        "no-else": 1,
        "no-nested-if-block": 1,
        "no-nested-if-direct": 1,

        // 流程控制（优先级 2）
        "no-for-each": 2,
        "no-switch": 2,

        // 类型安全（优先级 3）
        "no-as-assertion": 3,
        "no-is-keyword": 3,

        // 类型定义边界（优先级 6）
        "no-type-alias": 6,
        "no-interface": 6,
        "no-enum": 6,

        // 类设计（优先级 7）
        "no-private-method": 7,
        "no-hash-private-method": 7,
        "no-static-method": 7,

        // this 约束（优先级 8）
        "no-this-in-function": 8,
        "no-this-in-non-class": 8,

        // 上下文切换（优先级 9）
        "no-implicit-dom-chain": 9,
        "no-implicit-computed-chain": 9,

        // 全局对象访问（优先级 10）
        "no-window": 10,
        "no-global": 10,
        "no-globalthis": 10,

        // 导入边界——跨文件（优先级 13）
        "no-parent-import": 13,
        "no-parent-reexport": 13,
        "no-parent-reexport-all": 13,
        "no-direct-import": 13,
        "no-direct-reexport": 13,
        "no-direct-reexport-all": 13,
        "no-multi-import": 13,

        // imports.ts 网关特殊约束——跨文件（优先级 14）
        "imports-no-relative-import": 14,
        "imports-no-relative-export": 14,
        "imports-no-reexport-all-internal": 14,
        "imports-no-multi-export": 14,
    }),

    // 代码行数/函数行数（优先级 0）
    "code-size": createPriorityPlugin(codeSizeLimitsPlugin, "code-size", {
        "max-lines": 0,
        "max-lines-per-function": 0,
    }),

    // 执行器层无控制流约束（架构边界，优先级 1，与 if 控制流同级）
    "no-control-flow-in-executor": createPriorityPlugin(noControlFlowInExecutorPlugin, "no-control-flow-in-executor", 1),

    // 代码质量（优先级 4）
    "function-comment": createPriorityPlugin(requireFunctionCommentPlugin, "function-comment", 4),
    "max-params": createPriorityPlugin(maxParamsPlugin, "max-params", 4),
    "require-export-comment": createPriorityPlugin(requireExportCommentPlugin, "require-export-comment", 4),
    "require-if-comment": createPriorityPlugin(requireIfCommentPlugin, "require-if-comment", 4),
    "require-timeout-comment": createPriorityPlugin(requireTimeoutCommentPlugin, "require-timeout-comment", 4),
    "explicit-return-type-reason": createPriorityPlugin(explicitReturnTypeReasonPlugin, "explicit-return-type-reason", 4),
    "comment-style": createPriorityPlugin(noLongSingleLineCommentPlugin, "comment-style", 4),
    "vue-custom": createPriorityPlugin(vueCustomRulesPlugin, "vue-custom", 4),

    // 架构强约束-单文件（优先级 5）
    "no-extends": createPriorityPlugin(noExtendsPlugin, "no-extends", 5),
    "no-nested-function": createPriorityPlugin(noNestedFunctionPlugin, "no-nested-function", 5),
    "no-inline-callback": createPriorityPlugin(noInlineCallbackPlugin, "no-inline-callback", 5),
    "no-large-inline-array": createPriorityPlugin(noLargeInlineArrayPlugin, "no-large-inline-array", 5),
    "no-trivial-wrapper": createPriorityPlugin(noTrivialWrapperPlugin, "no-trivial-wrapper", 5),
    "no-new": createPriorityPlugin(noNewPlugin, "no-new", 5),

    // require-async-export / require-import-comment 单独下调（优先级 11）
    "require-async-export": createPriorityPlugin(requireAsyncExportPlugin, "require-async-export", 11),
    "require-import-comment": createPriorityPlugin(requireImportCommentPlugin, "require-import-comment", 11),

    // AI 任务标记（优先级 11）
    "ai-worker": createPriorityPlugin(aiWorkerPlugin, "ai-worker", 11),

    // no-class 单独下调（优先级 12，禁止所有 class 声明，改造影响面大）
    "no-class": createPriorityPlugin(noClassPlugin, "no-class", 12),

    // 跨文件架构约束（优先级 15）
    "no-export-forwarding": createPriorityPlugin(noExportForwardingPlugin, "no-export-forwarding", 15),
    "no-alias-usage": createPriorityPlugin(noAliasUsagePlugin, "no-alias-usage", 15),
    "folder-item-limit": createPriorityPlugin(folderItemLimitPlugin, "folder-item-limit", 15),
};

// ─── 手动注册原生/第三方规则优先级 ───
// 这些规则不在我们的自定义插件中，无法通过 createPriorityPlugin 注册
registerPriorities({
    // 基础格式（优先级 3，与类型安全同级）
    "semi": 3,
    "quotes": 3,
    "curly": 3,
    "brace-style": 3,
    "max-statements-per-line": 3,
});

// ─── 处理器插件 ───
const processorPlugin = {
    "priority-lint": priorityLintPlugin,
};

// ─── 导出 ───

/**
 * 合并所有插件（自定义插件 + 处理器插件）
 * 在 eslint.config.mjs 中替换原先的 SHARED_PLUGINS
 */
export const SHARED_PLUGINS_WITH_PRIORITY = {
    ...wrappedPlugins,
    ...processorPlugin,
};

/**
 * 处理器引用字符串
 * 在 eslint.config.mjs 的 config block 中声明：processor: PRIORITY_PROCESSOR
 */
export const PRIORITY_PROCESSOR = "priority-lint/processor";

// 导出优先级辅助函数（供 check-file-lint.js 等脚本使用）
export { getPriority, getRegistrySnapshot } from "./priority-lint.mjs";