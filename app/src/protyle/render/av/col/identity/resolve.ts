/** 用途：判断自定义属性列；使用范围：跨视图列 ID 解析；解耦评估：直达 DOM 查询唯一实现，不加载列编辑或菜单。 */
import {hasClosestByClassName} from "./imports";

/** 返回目标元素在当前视图协议中的列 ID。 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const getColId = (element: Element, viewType: TAVView) => {
    if (viewType === "table" || hasClosestByClassName(element, "custom-attr")) {
        return element.getAttribute("data-col-id");
    }
    if (["gallery", "kanban"].includes(viewType)) {
        return element.getAttribute("data-field-id");
    }
};
