/** 通过协议专属的 columns 字段区分表格视图。 */
export const isAVTableView = (view: IAV["view"]): view is IAVTable => "columns" in view;
