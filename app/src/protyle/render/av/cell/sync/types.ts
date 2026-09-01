/**
 * 用途：定义属性视图单元格跨实例同步能力。
 * 使用场景：资产、选择器等低层编辑流程需要更新同一行列的其它可见副本。
 * 关联类型：IProtyle、IAVCellValue。
 * 问题/改进：该能力由 cell 组合层注册，调用方不得假定具体渲染实现。
 */
export type TAttrViewCellOtherElementsSync = (
    protyle: IProtyle,
    avID: string,
    rowID: string,
    colID: string,
    value: IAVCellValue,
    sourceElement?: HTMLElement,
) => void;
