/**
 * 硬编码值约束
 * 
 * 禁止在逻辑中硬编码字符串，要求提取到专用文件
 */
export const NO_MAGIC_STRINGS = [
    {
        selector: [
            ':matches(Literal[raw=/^["\']/], TemplateLiteral)',
            ':not(ImportDeclaration Literal)',
            ':not(ExportNamedDeclaration Literal)',
            ':not(ExportAllDeclaration Literal)',
            ':not(TSLiteralType Literal)',
            ':not(Property > Literal.key)',
            ':not(JSXAttribute Literal)',
            ':not(TSEnumMember Literal)',
            ':not(TSPropertySignature Literal)',
            ':not(TSAsExpression Literal)',
        ].join(''),
        message: `
架构严令：
禁止在逻辑中硬编码字符串 (Magic String)。
请根据语义将字符串提取到专用文件：
1. *.constants.ts : 纯粹的常量值、配置项
2. *.code.ts      : 非JS代码片段 (如 WGSL, SQL, GLSL)
3. *.templates.ts : 文本模板、HTML片段
4. *.prompts.ts   : AI 提示词
    `
    }
];
