export const requireRange = (protyle: IProtyle) => {
    if (!protyle.toolbar) {
        throw new Error('protyle 上没有工具栏')
    }
    return protyle.toolbar.range
} 