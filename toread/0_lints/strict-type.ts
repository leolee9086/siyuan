/**
 * 类型纯洁性约束
 * 
 * 包括:
 * - 禁止 as 断言
 * - 禁止在业务/UI文件定义类型、接口、枚举
 * - 禁止在常规文件使用类型守卫
 */
export const STRICT_TYPE_RESTRICTIONS = [
    {
        selector: "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='const']), TSTypeAssertion",
        message: "禁止使用 'as' 断言。请在 .guard.ts 中使用类型守卫，或依赖自动推断。"
    },
    {
        selector: 'TSTypeAliasDeclaration',
        message: '架构约束：禁止在业务/UI文件定义 Type。请移至 *.types.ts。'
    },
    {
        selector: 'TSInterfaceDeclaration',
        message: '架构约束：禁止在业务/UI文件定义 Interface。请移至 *.types.ts。'
    },
    {
        selector: 'TSEnumDeclaration',
        message: '架构约束：禁止在业务/UI文件定义 Enum。请移至 *.types.ts。'
    },
    {
        selector: 'TSTypePredicate',
        message: "架构约束：禁止在常规文件使用 'is' 关键字。类型守卫逻辑必须移至 *.guard.ts 文件中。"
    }
];
