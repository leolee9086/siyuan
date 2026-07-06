/**
 * 拆分后的架构约束规则插件
 *
 * 将原先通过 no-restricted-syntax 和 no-restricted-globals 配置的选择器
 * 拆解为独立的 ESLint 规则，每个规则拥有独立的 ruleId，
 * 从而可在优先级系统中分别赋予不同的优先级。
 *
 * 拆解原则：
 * - 每个独立的架构约束成为一条规则（拥有唯一的 ruleId）
 * - 选择器和错误消息与原配置完全一致，不做任何省略或改动
 * - 按逻辑类别分组：if控制流、流程控制、类设计、this约束、
 *   导入边界、类型定义边界、类型安全、上下文切换、全局对象、imports.ts网关
 *
 * 实现方式：
 * - createRestrictionRule(selector, message)：工厂函数，返回标准 ESLint 规则
 *   使用 AST 选择器作为 create 返回的键（与 no-restricted-syntax 内部机制一致）
 * - createRestrictedGlobalRule(globalName, message)：工厂函数，返回检查全局变量引用的规则
 *   使用 scope.through 检测对全局名称的引用（与 no-restricted-globals 内部机制一致）
 */

import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

// ─── 工厂函数 ───

/**
 * 根据单个 AST 选择器和消息创建标准 ESLint 规则。
 *
 * ESLint 的 create() 返回对象支持将 ESQuery 选择器作为键，
 * 这与 no-restricted-syntax 内部使用的机制完全一致。
 * 选择器可以是复合选择器（含逗号），esquery 会解析为"匹配任一侧"。
 *
 * @param {string} selector - ESQuery AST 选择器
 * @param {string} message - 报错消息
 * @param {string} description - 规则描述（用于 docs）
 * @returns {Object} 标准 ESLint 规则定义
 */
function createRestrictionRule(selector, message, description) {
    return {
        meta: {
            type: "problem",
            docs: {
                description: description || `架构约束：${selector}`,
                category: "Best Practices",
                recommended: true,
            },
            schema: [],
        },
        create(context) {
            return {
                [selector]: function (node) {
                    context.report({ node, message });
                },
            };
        },
    };
}

/**
 * 创建检查全局变量引用的规则。
 *
 * 使用 scope.through 检测无法解析为局部变量的引用（即全局引用），
 * 与 ESLint 内置的 no-restricted-globals 规则机制一致。
 *
 * @param {string} globalName - 被限制的全局变量名
 * @param {string} message - 报错消息
 * @returns {Object} 标准 ESLint 规则定义
 */
function createRestrictedGlobalRule(globalName, message) {
    return {
        meta: {
            type: "problem",
            docs: {
                description: `禁止直接访问 ${globalName}`,
                category: "Best Practices",
                recommended: true,
            },
            schema: [],
        },
        create(context) {
            return {
                "Program:exit"() {
                    // ESLint 9.x 中 context.getScope() 已移除，需通过 sourceCode 获取
                    const sourceCode = context.sourceCode || context.getSourceCode();
                    const scope = sourceCode.getScope ? sourceCode.getScope(sourceCode.ast) : context.getScope();
                    // scope.through 包含无法解析为局部变量的引用，即对全局变量的引用
                    for (const ref of scope.through) {
                        if (ref.identifier.name === globalName) {
                            context.report({
                                node: ref.identifier,
                                message,
                            });
                        }
                    }
                },
            };
        },
    };
}

// ─── if 控制流（优先级 1，用户指定次高） ───

const noElseRule = createRestrictionRule(
    "IfStatement[alternate]",
    "❌ 禁止使用 else。请使用 \"卫语句 (Guard Clauses)\" 或者其它策略扁平化逻辑。" + 全量修复提示,
    "禁止使用 else 语句",
);

const noNestedIfBlockRule = createRestrictionRule(
    "IfStatement > BlockStatement > IfStatement",
    "❌ 禁止嵌套 If。请合并判断条件 (&&) 或提取函数。" + 全量修复提示,
    "禁止在块语句中嵌套 If",
);

const noNestedIfDirectRule = createRestrictionRule(
    "IfStatement > IfStatement",
    "❌ 禁止嵌套 If。请合并逻辑。" + 全量修复提示,
    "禁止直接嵌套 If（else if 链除外）",
);

// ─── 上下文切换（优先级 8） ───

const noImplicitDomChainRule = createRestrictionRule(
    "MemberExpression[object.type='CallExpression'][object.callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]",
    "❌ 禁止隐式上下文切换：在 DOM 获取接口 (querySelector, getElementById 等) 返回的对象上直接链式调用。请务必先声明变量再使用。" + 全量修复提示,
    "禁止 DOM 查询接口返回值上直接链式调用",
);

const noImplicitComputedChainRule = createRestrictionRule(
    "MemberExpression[object.type='MemberExpression'][object.computed=true]",
    "❌ 禁止隐式上下文切换：禁止在使用列表下标取值操作 ([]) 之后直接访问属性。请务必先声明变量再使用。" + 全量修复提示,
    "禁止下标取值后直接访问属性",
);

// ─── 流程控制（优先级 3） ───

const noForEachRule = createRestrictionRule(
    "CallExpression[callee.property.name='forEach']",
    [
        "❌ 禁止使用 .forEach()。",
        "原因 1: forEach 无法等待异步操作。",
        "原因 2: forEach 无法提前中断。",
        "替代方案: for...of / .map() / .filter()",
    ].join("\n") + 全量修复提示 + 单文件检查提示,
    "禁止使用 forEach",
);

const noSwitchRule = createRestrictionRule(
    "SwitchStatement",
    [
        "❌ 禁止使用 switch 语句。",
        "替代方案: Object Literal / Map / Strategy Pattern / Polymorphism",
    ].join("\n") + 全量修复提示 + 单文件检查提示,
    "禁止使用 switch 语句",
);

// ─── 类设计（优先级 6） ───

const noPrivateMethodRule = createRestrictionRule(
    "MethodDefinition[accessibility='private']",
    [
        "❌ 禁止类的私有方法。",
        "原因: 类应该只作为状态和公开方法的容器,私有方法没有可测试切面。",
        "替代方案: 将私有逻辑提取为模块级辅助函数。",
    ].join("\n") + 全量修复提示 + 单文件检查提示,
    "禁止类的私有方法 (TypeScript private 修饰符)",
);

const noHashPrivateMethodRule = createRestrictionRule(
    "MethodDefinition[key.type='PrivateIdentifier']",
    [
        "❌ 禁止类的私有方法 (# 前缀)。",
        "原因: 类应该只作为状态和公开方法的容器,私有方法没有可测试切面。",
        "替代方案: 将私有逻辑提取为模块级辅助函数。",
    ].join("\n") + 全量修复提示 + 单文件检查提示,
    "禁止类的私有方法 (ES2022 # 前缀)",
);

const noStaticMethodRule = createRestrictionRule(
    "MethodDefinition[static=true]",
    [
        "❌ 禁止类的静态方法。",
        "原因: 静态方法不依赖实例状态，应该作为独立的模块级函数存在。",
        "替代方案: 将静态方法提取为模块级函数并导出。",
    ].join("\n") + 全量修复提示 + 单文件检查提示,
    "禁止类的静态方法",
);

// ─── this 约束（优先级 7） ───

const noThisInFunctionRule = createRestrictionRule(
    "FunctionDeclaration ThisExpression",
    "❌ 禁止在独立函数中使用 this。请使用类方法或将 context 作为参数传递。" + 全量修复提示 + 单文件检查提示,
    "禁止在独立函数声明中使用 this",
);

const noThisInNonClassRule = createRestrictionRule(
    "FunctionExpression:not(MethodDefinition > FunctionExpression) ThisExpression",
    "❌ 禁止在非类方法(如: 对象字面量方法/独立函数表达式)中使用 this。请使用类方法或将 context 作为参数传递。" + 全量修复提示 + 单文件检查提示,
    "禁止在非类方法中使用 this",
);

// ─── 导入边界（优先级 4） ───

const noParentImportRule = createRestrictionRule(
    "ImportDeclaration[source.value=/^\\u002E\\u002E\\u002F/][importKind!='type']",
    "禁止从父级目录导入 (../)。必须通过本目录同层级的 ./imports.ts 转发。" + 全量修复提示 + 单文件检查提示,
    "禁止从父级目录导入",
);

const noParentReexportRule = createRestrictionRule(
    "ExportNamedDeclaration[source.value=/^\\u002E\\u002E\\u002F/]",
    "禁止从父级目录重导出 (../)。" + 全量修复提示 + 单文件检查提示,
    "禁止从父级目录重导出",
);

const noParentReexportAllRule = createRestrictionRule(
    "ExportAllDeclaration[source.value=/^\\u002E\\u002E\\u002F/]",
    "禁止从父级目录全量重导出 (../)。" + 全量修复提示 + 单文件检查提示,
    "禁止从父级目录全量重导出",
);

const noDirectImportRule = createRestrictionRule(
    "ImportDeclaration[source.value=/^[^.]/][importKind!='type']",
    "禁止直接导入第三方包或别名。必须通过本目录同层级 ./imports.ts 转发。" + 全量修复提示 + 单文件检查提示,
    "禁止直接导入第三方包或别名",
);

const noDirectReexportRule = createRestrictionRule(
    "ExportNamedDeclaration[source.value=/^[^.]/]",
    "禁止直接重导出第三方包或别名。" + 全量修复提示 + 单文件检查提示,
    "禁止直接重导出第三方包或别名",
);

const noDirectReexportAllRule = createRestrictionRule(
    "ExportAllDeclaration[source.value=/^[^.]/]",
    "禁止直接全量重导出第三方包或别名。" + 全量修复提示 + 单文件检查提示,
    "禁止直接全量重导出第三方包或别名",
);

const noMultiImportRule = createRestrictionRule(
    "ImportDeclaration[specifiers.length>1]",
    "架构约束：非 imports.ts 文件中每条 import 语句只允许一个导入项目。请拆分为多条 import，避免集中导入掩盖依赖边界。" + 全量修复提示 + 单文件检查提示,
    "每条 import 语句只允许一个导入项",
);

// ─── 类型定义边界（优先级 5） ───

const noTypeAliasRule = createRestrictionRule(
    "TSTypeAliasDeclaration",
    "架构约束：禁止在业务/UI文件定义 Type。请移至 *.types.ts。" + 全量修复提示 + 单文件检查提示,
    "禁止在业务/UI文件定义 Type",
);

const noInterfaceRule = createRestrictionRule(
    "TSInterfaceDeclaration",
    "架构约束：禁止在业务/UI文件定义 Interface。请移至 *.types.ts。" + 全量修复提示 + 单文件检查提示,
    "禁止在业务/UI文件定义 Interface",
);

const noEnumRule = createRestrictionRule(
    "TSEnumDeclaration",
    "架构约束：禁止在业务/UI文件定义 Enum。请移至 *.types.ts。" + 全量修复提示 + 单文件检查提示,
    "禁止在业务/UI文件定义 Enum",
);

// ─── 类型安全（优先级 2） ───

const noAsAssertionRule = createRestrictionRule(
    "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const']), TSTypeAssertion",
    "❌ 禁止使用 'as' 断言。请在 *.guard.ts 或 *.guards.ts 中使用类型守卫，或依赖自动推断。" + 全量修复提示 + 单文件检查提示,
    "禁止使用 as 类型断言（const 断言除外）",
);

const noIsKeywordRule = createRestrictionRule(
    "TSTypePredicate",
    "❌ 架构约束：禁止在常规文件使用 'is' 关键字。类型守卫逻辑必须移至 *.guard.ts 或 *.guards.ts 文件中。" + 全量修复提示 + 单文件检查提示,
    "禁止在常规文件使用 is 关键字（类型守卫须移至 guard 文件）",
);

// ─── 全局对象访问（优先级 9） ───

const noWindowRule = createRestrictedGlobalRule(
    "window",
    "❌ 禁止直接访问 window。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示 + 单文件检查提示,
);

const noGlobalRule = createRestrictedGlobalRule(
    "global",
    "❌ 禁止直接访问 global。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示 + 单文件检查提示,
);

const noGlobalThisRule = createRestrictedGlobalRule(
    "globalThis",
    "❌ 禁止直接访问 globalThis。请在 *.environment.ts 或 *.global.ts 文件中封装后使用。" + 全量修复提示 + 单文件检查提示,
);

// ─── imports.ts 网关特殊约束（优先级 10） ───

const importsNoRelativeImportRule = createRestrictionRule(
    "ImportDeclaration[source.value=/^\\.\\u002F/]",
    "架构约束：imports.ts 仅用于引入外部依赖。" + 全量修复提示 + 单文件检查提示,
    "imports.ts 中禁止相对路径导入（仅允许外部依赖）",
);

const importsNoRelativeExportRule = createRestrictionRule(
    "ExportNamedDeclaration[source.value=/^\\.\\u002F/]",
    "架构约束：imports.ts 仅用于引入外部依赖。" + 全量修复提示 + 单文件检查提示,
    "imports.ts 中禁止相对路径重导出",
);

const importsNoReexportAllInternalRule = createRestrictionRule(
    "ExportAllDeclaration[source.value=/^\\.\\u002F/]",
    "架构约束：imports.ts 禁止全量重导出内部文件。" + 全量修复提示 + 单文件检查提示,
    "imports.ts 中禁止全量重导出内部文件",
);

const importsNoMultiExportRule = createRestrictionRule(
    "ExportNamedDeclaration[specifiers.length>1]",
    "架构约束：imports.ts 禁止在单条 export 语句中批量导出多个项目。请拆分为每条 export 仅导出一个项目，并分别添加注释说明。" + 全量修复提示 + 单文件检查提示,
    "imports.ts 中禁止单条 export 批量导出多个项目",
);

// ─── 插件导出 ───

export const restrictionsPlugin = {
    rules: {
        // if 控制流
        "no-else": noElseRule,
        "no-nested-if-block": noNestedIfBlockRule,
        "no-nested-if-direct": noNestedIfDirectRule,

        // 上下文切换
        "no-implicit-dom-chain": noImplicitDomChainRule,
        "no-implicit-computed-chain": noImplicitComputedChainRule,

        // 流程控制
        "no-for-each": noForEachRule,
        "no-switch": noSwitchRule,

        // 类设计
        "no-private-method": noPrivateMethodRule,
        "no-hash-private-method": noHashPrivateMethodRule,
        "no-static-method": noStaticMethodRule,

        // this 约束
        "no-this-in-function": noThisInFunctionRule,
        "no-this-in-non-class": noThisInNonClassRule,

        // 导入边界
        "no-parent-import": noParentImportRule,
        "no-parent-reexport": noParentReexportRule,
        "no-parent-reexport-all": noParentReexportAllRule,
        "no-direct-import": noDirectImportRule,
        "no-direct-reexport": noDirectReexportRule,
        "no-direct-reexport-all": noDirectReexportAllRule,
        "no-multi-import": noMultiImportRule,

        // 类型定义边界
        "no-type-alias": noTypeAliasRule,
        "no-interface": noInterfaceRule,
        "no-enum": noEnumRule,

        // 类型安全
        "no-as-assertion": noAsAssertionRule,
        "no-is-keyword": noIsKeywordRule,

        // 全局对象访问
        "no-window": noWindowRule,
        "no-global": noGlobalRule,
        "no-globalthis": noGlobalThisRule,

        // imports.ts 网关特殊约束（默认 off，仅在 imports.ts 的 config block 中启用）
        "imports-no-relative-import": importsNoRelativeImportRule,
        "imports-no-relative-export": importsNoRelativeExportRule,
        "imports-no-reexport-all-internal": importsNoReexportAllInternalRule,
        "imports-no-multi-export": importsNoMultiExportRule,
    },
};