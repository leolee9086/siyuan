/**
 * 将单元格选择项合并进列配置，并构造与内核协议一致的 do/undo 操作。
 * 该函数按既有语义原地更新传入 column 与 cellValue，以确保调用方后续单元格渲染看到相同颜色。
 * @同步豁免: 生命周期 - 颜色回填、列配置变更和可逆操作必须在调用方生成 updateAttrViewCell 之前原子完成；异步化会改变操作载荷顺序。
 */
export const mergeAddOption = (column: IAVColumn, cellValue: IAVCellValue, avID: string) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    for (const item of cellValue.mSelect) {
        if (!column.options) {
            column.options = [];
        }
        const needAdd = column.options.find((option: {name: string, color: string}) => {
            // 同名列配置是颜色的唯一事实源，单元格必须回填其已配置颜色。
            if (option.name === item.content) {
                item.color = option.color;
                return true;
            }
        });
        if (!needAdd) {
            const newColor = ((column.options?.length || 0) % 14 + 1).toString();
            column.options.push({name: item.content, color: newColor});
            item.color = newColor;
            doOperations.push({
                action: "updateAttrViewColOptions",
                id: column.id,
                avID,
                data: column.options,
            });
            undoOperations.push({
                action: "removeAttrViewColOption",
                id: column.id,
                avID,
                data: item.content,
            });
        }
    }
    return {doOperations, undoOperations};
};
