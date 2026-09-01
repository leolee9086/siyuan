/**
 * 用途：定义属性视图单元格文本测量端口。
 * 使用场景：关联视图计算列宽时读取完整 cell 渲染文本。
 * 关联类型：IAVCellValue、IAVColumn。
 * 问题/改进：调用方只依赖测量协议，不加载 cell 组合渲染实现。
 */
export type TAttrViewCellValueText = (
    value: IAVCellValue,
    column?: IAVColumn,
    rowIndex?: number,
) => string;
