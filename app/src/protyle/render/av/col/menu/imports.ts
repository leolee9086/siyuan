/** 用途：创建列头菜单；使用范围：菜单工厂；解耦评估：直达 Menu class 创建边界。 */
import {Menu} from "../../../../../plugin/Menu";
/** 导出 Menu 创建边界。 */
export {Menu};
/** 用途：读取 AV 菜单常量；使用范围：菜单工厂；解耦评估：直达常量所有者。 */
import {Constants} from "../../../../../constants";
/** 导出 AV 菜单常量。 */
export {Constants};
/** 用途：读取菜单文案；使用范围：菜单工厂；解耦评估：直达 i18n 环境。 */
import {siyuanI18n} from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出菜单文案。 */
export {siyuanI18n};
/** 用途：打开列编辑 Panel；使用范围：编辑导航；解耦评估：直达 Panel 唯一实现。 */
import {openMenuPanel} from "../../openMenuPanel";
/** 导出 Panel 入口。 */
export {openMenuPanel};
/** 用途：复用列头行为；使用范围：菜单工厂；解耦评估：直达列头行为唯一实现。 */
import {bindColHeaderEvents, buildColHeaderLabel, handleFilterClick, handleSortClick} from "../col.showColMenu";
/** 导出列头事件绑定。 */
export {bindColHeaderEvents};
/** 导出列头标签构建。 */
export {buildColHeaderLabel};
/** 导出筛选行为。 */
export {handleFilterClick};
/** 导出排序行为。 */
export {handleSortClick};
/** 用途：约束列菜单完整上下文；使用范围：菜单工厂；解耦评估：纯类型直达领域声明。 */
import type {IShowColMenuContext} from "../col.showColMenu.types";
/** 导出列菜单上下文。 */
export type {IShowColMenuContext};
/** 用途：复用列菜单操作项；使用范围：菜单工厂；解耦评估：直达操作项唯一实现。 */
import {addDuplicateDeleteItems, addInsertColumnItems, addPinAndHideItems, addSyncAndWrapItems, buildMenuCloseCallback} from "../col.showColMenu.items";
/** 导出复制删除项。 */
export {addDuplicateDeleteItems};
/** 导出插入项。 */
export {addInsertColumnItems};
/** 导出固定隐藏项。 */
export {addPinAndHideItems};
/** 导出同步换行项。 */
export {addSyncAndWrapItems};
/** 导出菜单关闭保存行为。 */
export {buildMenuCloseCallback};
/** 用途：收窄列类型；使用范围：上下文构造；解耦评估：直达列类型守卫。 */
import {toTAVCol} from "../col.typeUtils";
/** 导出列类型守卫。 */
export {toTAVCol};
