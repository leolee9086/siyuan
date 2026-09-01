/** 用途：定义转换命令请求的回放与渲染能力。使用场景：命令层通过稳定端口调用视觉实现。关联类型：由 effects 注册真实函数。 */
export type TTransactionTransformVisualEffects = {
    applyOperations: (protyle: IProtyle, operations: IOperation[], isUndo: boolean) => void,
    rerender: (protyle: IProtyle) => void,
    renderBlock: (protyle: IProtyle, element: Element) => void,
    renderConvertedBlocks: (protyle: IProtyle) => void,
};
