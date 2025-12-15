import { 禁止静态方法规则 } from './messages.ts'

/**
 * 基础架构约束 (所有 TS 文件通用)
 * 
 * 包括:
 * - 禁止静态方法和静态属性
 * - 函数参数数量限制
 * - 禁止 forEach
 * - 禁止 else 和嵌套 if
 * - 禁止 switch
 * - 禁止 export ... from 语法
 */
export const BASE_ARCHITECTURE_RESTRICTIONS = [
    禁止静态方法规则,
    {
        selector: 'PropertyDefinition[static=true]',
        message: '架构严令：禁止定义静态属性。常量请定义为模块级的 const。'
    },
    {
        selector: "FunctionDeclaration[params.length>3], ArrowFunctionExpression[params.length>3], FunctionExpression[params.length>3]",
        message: `
        函数参数不能超过3个。请使用对象参数模式 (Object Pattern)。
        或者使用合适的ctx类型。
        请注意ctx类型应该是一个业务领域的抽象。
        仔细设计它而不是简单地为每一个函数调用创建一个新的参数集。
        正面例：
        function drawRectangle(ctx: DrawContext) {
            // 使用 ctx.width, ctx.height, ctx.color 等等
        }
        反面例：
        function drawRectangle(width: number, height: number, color: string, borderWidth: number) {
            // 过多的参数使得函数调用复杂且难以维护
        }
        创建参数集类型的负面例，多个同一领域上下文的函数没有共享参数类型而是各自定义：
        interface DrawRectangleParams {
            width: number;
            height: number;
        }
        interface DrawCircleParams {
            radius: number;
        }
        function drawRectangle(params: DrawRectangleParams) { ... }
        function drawCircle(params: DrawCircleParams) { ... }
        这种方式会导致代码重复且难以维护。
        正确的方式是创建一个共享的上下文类型：
        interface DrawContext {
            width?: number;
            height?: number;
            radius?: number;
            color?: string;
            borderWidth?: number;
        }
        function drawRectangle(ctx: DrawContext) { ... }
        function drawCircle(ctx: DrawContext) { ... }
        这样可以确保所有绘图函数都使用相同的上下文类型，减少重复代码并提高可维护性。
        即使需要对领域中可选参数进行区分，也应通过文档和命名约定来明确，而不是创建多个类似的参数类型。
        这种情况下，一定的性能开销是可以接受的。
        可以通过统一的上下文类型和管线式调度来中和这种开销。
        允许创建的具体参数集类型应该是根据领域上下文收窄而不是扩展。
        `
    },
    {
        selector: 'CallExpression[callee.property.name="forEach"]',
        message: [
            '❌ 禁止使用 .forEach()。',
            '原因 1: forEach 无法等待异步操作。',
            '原因 2: forEach 无法提前中断。',
            '替代方案: for...of / .map() / .filter()'
        ].join('\n'),
    },
    {
        selector: 'IfStatement[alternate]',
        message: '❌ 禁止使用 else。请使用 "卫语句 (Guard Clauses)" 扁平化逻辑。',
    },
    {
        selector: 'IfStatement > BlockStatement > IfStatement',
        message: '❌ 禁止嵌套 If。请合并判断条件 (&&) 或提取函数。',
    },
    {
        selector: 'IfStatement > IfStatement',
        message: '❌ 禁止嵌套 If。请合并逻辑。',
    },
    {
        selector: 'SwitchStatement',
        message: [
            '❌ 禁止使用 switch 语句。',
            '替代方案: Object Literal / Map / Strategy Pattern / Polymorphism'
        ].join('\n'),
    },
    {
        selector: 'ExportNamedDeclaration[source]',
        message: [
            '❌ 禁止直接使用 export { ... } from "..." 语法。',
            '原因: 导出转发会降低代码可追溯性。',
            '要求: 必须先 import，然后再 export。',
            '示例:',
            '  // ❌ 错误',
            '  export { foo } from "./bar"',
            '  // ✅ 正确',
            '  import { foo } from "./bar"',
            '  export { foo }'
        ].join('\n'),
    },
    {
        selector: 'ExportAllDeclaration',
        message: [
            '❌ 禁止直接使用 export * from "..." 语法。',
            '原因: 全量导出转发会严重降低代码可追溯性和可维护性。',
            '要求: 必须先 import，然后再 export。',
            '示例:',
            '  // ❌ 错误',
            '  export * from "./utils"',
            '  // ✅ 正确',
            '  import * as utils from "./utils"',
            '  export { utils }'
        ].join('\n'),
    },
];
