export const 禁止静态方法规则 ={
    selector: 'MethodDefinition[static=true]',
    message: `
架构严令：
类禁止定义静态方法。
类仅用于封装实例状态，无状态逻辑请提取为 export function。
请切换到Code模式进行修复。
`
}
