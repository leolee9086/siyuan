/**
 * 作用：确保 protyle 实例上存在工具栏并返回其选区范围。
 * 意图：在需要操作编辑器选区前调用，避免在 toolbar 未初始化时访问 range 导致运行时错误。
 * 调用时机：需要在编辑器选区上执行操作之前（如获取选区文本、展开菜单等）。
 * @同步豁免: 类型守卫 - 纯同步的运行时断言，异步化会改变异常抛出语义。
 */
/** 导出 requireRange 供编辑器选区操作前校验使用 */
export const requireRange = (protyle: IProtyle) => {
    if (!protyle.toolbar) {
        throw new Error("protyle 上没有工具栏");
    }
    return protyle.toolbar.range;
}; 