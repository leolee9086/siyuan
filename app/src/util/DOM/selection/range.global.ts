/**
 * 读取当前窗口的 Selection，并在浏览器未返回有效对象时明确抛错，避免调用方继续在空选区上运行。
 * 调用时机：需要直接访问原生 Selection API 的 DOM/Range 工具会同步调用。
 * 问题/改进：当前依赖全局 `window`，但文件已通过 `.global.ts` 表达该边界，符合现有约定。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getSelection = () => {
    const selection = window.getSelection();
    const hasSelection = !!selection;
    if (hasSelection) {
        return selection;
    }
    throw new Error("getSelection 方法未返回有效值");
};

/**
 * 获取当前第一个选区范围，供只关心单个 Range 的调用方减少样板判断。
 * 调用时机：最近文档、内容菜单等仅需要当前首个选区时调用。
 * 问题/改进：若未来要支持多选区浏览器差异，这里可以统一扩展兼容逻辑。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getFirstSelectedRange = () => {
    const selection = getSelection();
    const hasRange = selection.rangeCount > 0;
    if (!hasRange) {
        return undefined;
    }
    return selection.getRangeAt(0);
};
