/** 用途：表格框选包含查询；使用范围：唯一几何判定；解耦评估：同域纯类型直达声明。 */
import type {TableSelectionContainmentQuery} from "./geometry.types";

/**
 * 判断物理单元格是否完全位于表格框选矩形内，并保留既有 6px 边缘容差。
 * @同步豁免: 需要绝对同步的DOM访问 - 鼠标、复制、剪切和粘贴处理必须基于当前帧的 offset/client 几何立即判定。
 */
export const isIncludeCell = (query: TableSelectionContainmentQuery) => {
    const selectionLeft = query.tableSelectElement.offsetLeft + query.scrollLeft;
    const selectionTop = query.tableSelectElement.offsetTop + query.scrollTop;
    return query.item.offsetLeft + 6 > selectionLeft &&
        query.item.offsetLeft + query.item.clientWidth - 6 < selectionLeft + query.tableSelectElement.clientWidth &&
        query.item.offsetTop + 6 > selectionTop &&
        query.item.offsetTop + query.item.clientHeight - 6 < selectionTop + query.tableSelectElement.clientHeight;
};
