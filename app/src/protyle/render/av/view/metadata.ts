/** 用途：按协议结构区分 Table 与卡片视图；使用范围：字段集合查询；解耦评估：守卫属于同一元数据领域，直接导入不加载菜单实现。 */
import {isAVTableView} from "./metadata.guards";

/** 返回视图类型对应的内置图标。 */
/** @同步豁免: UI构建 — 必须立即返回 SVG sprite 标识，异步化会改变现有 HTML 拼接契约。 */
export const getViewIcon = (type: TAVView) => {
    const iconMap = {
        table: "iconTable",
        gallery: "iconGallery",
        kanban: "iconBoard",
    } satisfies Record<TAVView, string>;
    return iconMap[type];
};

/** 返回当前视图实际拥有的字段集合。 */
/** @同步豁免: UI构建 — 菜单和渲染流程需要读取当前数据对象中的原数组身份，异步化会改变调用顺序。 */
export const getFieldsByData = (data: IAV) => {
    return isAVTableView(data.view) ? data.view.columns : data.view.fields;
};
