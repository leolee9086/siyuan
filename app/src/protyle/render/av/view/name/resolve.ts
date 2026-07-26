/** 用途：读取内置视图名称文案；使用范围：配置面板和关系视图搜索结果；解耦评估：名称映射属于视图元数据，经本子域网关依赖 i18n，不应参数化为调用点映射。 */
import {siyuanI18n} from "./imports";

/** 返回视图类型对应的内置名称。 */
/** @同步豁免: UI构建 - 菜单 HTML 拼接期间必须立即取得本地化视图名称。 */
export const getViewName = (type: string) => {
    const viewNames: Record<string, string> = {
        table: siyuanI18n.table,
        gallery: siyuanI18n.gallery,
        kanban: siyuanI18n.kanban,
    };
    return viewNames[type];
};
