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
 *   0  代码行数/函数行数（用户指定最高优先级）
 *   1  if 嵌套控制流（用户指定次高优先级）
 *   2  类型安全（as 断言、is 关键字）
 *   3  流程控制（forEach、switch）
 *   4  导入边界（父级导入、直接导入第三方、批量导入）
 *   5  类型定义边界（业务文件中定义 type/interface/enum）
 *   6  类设计（私有方法、静态方法）
 *   7  this 约束
 *   8  上下文切换（DOM 链式调用、下标取值链式调用）
 *   9  全局对象访问（window、global、globalThis）
 *  10  imports.ts 网关特殊约束
 *  11  架构强约束（继承禁令、导出转发、别名禁令、嵌套函数定义、文件夹条目、内联回调、大型内联数组、无意义包装）
 *  12  AI 任务标记
 *  13  代码质量（注释要求、返回类型理由、Vue 文件约束、长单行注释）
 *  14  元任务检查（task-checker）
 *  15  未注册规则的默认优先级（DEFAULT_PRIORITY in priority-lint.mjs）
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
import { taskCheckerPlugin } from "./task-checker.mjs";
import { folderItemLimitPlugin } from "./folder-item-limit.mjs";
import { noLongSingleLineCommentPlugin } from "./no-long-single-line-comment.mjs";
import { noNestedFunctionPlugin } from "./no-nested-function.mjs";
import { explicitReturnTypeReasonPlugin } from "./explicit-return-type-reason.mjs";
import { noControlFlowInExecutorPlugin } from "./no-control-flow-in-executor.mjs";
import { noClassPlugin } from "./no-class.mjs";

// ─── 包装自定义插件并注册优先级 ───
// createPriorityPlugin 不修改插件行为，仅将规则优先级写入 registry

const wrappedPlugins = {
    // 第三方插件——基础安全规则，给较低数值确保不遗漏
    "@typescript-eslint": createPriorityPlugin(typescriptEslint, "@typescript-eslint", 2),
    "vue": createPriorityPlugin(pluginVue, "vue", 2),

    // 拆分后的架构约束插件——每条规则单独注册优先级
    "restrictions": createPriorityPlugin(restrictionsPlugin, "restrictions", {
        // if 控制流（用户指定次高优先级）
        "no-else": 1,
        "no-nested-if-block": 1,
        "no-nested-if-direct": 1,

        // 上下文切换
        "no-implicit-dom-chain": 8,
        "no-implicit-computed-chain": 8,

        // 流程控制
        "no-for-each": 3,
        "no-switch": 3,

        // 类设计
        "no-private-method": 6,
        "no-hash-private-method": 6,
        "no-static-method": 6,

        // this 约束
        "no-this-in-function": 7,
        "no-this-in-non-class": 7,

        // 导入边界
        "no-parent-import": 4,
        "no-parent-reexport": 4,
        "no-parent-reexport-all": 4,
        "no-direct-import": 4,
        "no-direct-reexport": 4,
        "no-direct-reexport-all": 4,
        "no-multi-import": 4,

        // 类型定义边界
        "no-type-alias": 5,
        "no-interface": 5,
        "no-enum": 5,

        // 类型安全
        "no-as-assertion": 2,
        "no-is-keyword": 2,

        // 全局对象访问
        "no-window": 9,
        "no-global": 9,
        "no-globalthis": 9,

        // imports.ts 网关特殊约束
        "imports-no-relative-import": 10,
        "imports-no-relative-export": 10,
        "imports-no-reexport-all-internal": 10,
        "imports-no-multi-export": 10,
    }),

    // 代码行数/函数行数（用户指定最高优先级）
    "code-size": createPriorityPlugin(codeSizeLimitsPlugin, "code-size", {
        "max-lines": 0,
        "max-lines-per-function": 0,
    }),

    // 架构强约束（优先级 11）
    "no-class": createPriorityPlugin(noClassPlugin, "no-class", 11),
    "no-extends": createPriorityPlugin(noExtendsPlugin, "no-extends", 11),
    "no-export-forwarding": createPriorityPlugin(noExportForwardingPlugin, "no-export-forwarding", 11),
    "no-alias-usage": createPriorityPlugin(noAliasUsagePlugin, "no-alias-usage", 11),
    "no-nested-function": createPriorityPlugin(noNestedFunctionPlugin, "no-nested-function", 11),
    // 执行器层无控制流约束（架构边界，优先级 1，与 if 控制流同级）
    "no-control-flow-in-executor": createPriorityPlugin(noControlFlowInExecutorPlugin, "no-control-flow-in-executor", 1),
    "folder-item-limit": createPriorityPlugin(folderItemLimitPlugin, "folder-item-limit", 11),
    "no-inline-callback": createPriorityPlugin(noInlineCallbackPlugin, "no-inline-callback", 11),
    "no-large-inline-array": createPriorityPlugin(noLargeInlineArrayPlugin, "no-large-inline-array", 11),
    "no-trivial-wrapper": createPriorityPlugin(noTrivialWrapperPlugin, "no-trivial-wrapper", 11),

    // AI 任务标记（优先级 12）
    "ai-worker": createPriorityPlugin(aiWorkerPlugin, "ai-worker", 12),

    // 代码质量（优先级 13）
    "function-comment": createPriorityPlugin(requireFunctionCommentPlugin, "function-comment", 13),
    "require-import-comment": createPriorityPlugin(requireImportCommentPlugin, "require-import-comment", 13),
    "require-export-comment": createPriorityPlugin(requireExportCommentPlugin, "require-export-comment", 13),
    "require-if-comment": createPriorityPlugin(requireIfCommentPlugin, "require-if-comment", 13),
    "require-timeout-comment": createPriorityPlugin(requireTimeoutCommentPlugin, "require-timeout-comment", 13),
    "require-async-export": createPriorityPlugin(requireAsyncExportPlugin, "require-async-export", 13),
    "explicit-return-type-reason": createPriorityPlugin(explicitReturnTypeReasonPlugin, "explicit-return-type-reason", 13),
    "comment-style": createPriorityPlugin(noLongSingleLineCommentPlugin, "comment-style", 13),
    "vue-custom": createPriorityPlugin(vueCustomRulesPlugin, "vue-custom", 13),

    // 元任务检查（优先级 14，最低）
    "task-checker": createPriorityPlugin(taskCheckerPlugin, "task-checker", 14),
};

// ─── 手动注册原生/第三方规则优先级 ───
// 这些规则不在我们的自定义插件中，无法通过 createPriorityPlugin 注册
registerPriorities({
    // 基础格式（优先级 2，与类型安全同级）
    "semi": 2,
    "quotes": 2,
    "curly": 2,
    "brace-style": 2,
    "max-statements-per-line": 2,
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