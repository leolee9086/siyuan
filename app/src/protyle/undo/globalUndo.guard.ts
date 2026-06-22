/**
 * 用途：判断模型对象是否包含 editor.protyle 属性。
 * 
 * 使用场景：getActiveProtyle 中遍历模型时，区分不同 Tab 类型的模型结构。
 * 关联类型：IProtyle 编辑器实例。
 * 
 * @显式返回类型原因 类型守卫必须标注 is 返回类型以启用 TypeScript 类型收窄。
 */
export const hasEditorProtyle = (obj: unknown): obj is { editor: { protyle: IProtyle } } => {
    return typeof obj === "object" && obj !== null && "editor" in obj;
};
