/**
 * 类定义约束
 * 
 * 禁止在非 .class.ts 文件中定义类
 */
export const STRICT_CLASS_RESTRICTIONS = [
    {
        selector: ':matches(ClassDeclaration, ClassExpression)',
        message: '架构严令：禁止在此文件中定义类 (Class)。类定义必须位于以 .class.ts 结尾的文件中。'
    }
];
