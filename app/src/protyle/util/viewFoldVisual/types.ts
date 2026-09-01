/** 用途：定义视图折叠完成异步标题加载后的视觉能力。使用场景：低层折叠状态通过稳定端口请求高层渲染。关联类型：由 effects 注册实际函数。 */
export type TViewFoldVisualEffects = {
    renderHeadingChildren: (protyle: IProtyle, children: Element[]) => void,
    applyDisabledState: (protyle: IProtyle) => void,
};
