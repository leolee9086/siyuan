/** 用途：活动页签查询的完整页签领域类型；使用范围：activeTab 查询出口；解耦评估：仅依赖布局领域类型，不加载具体 Tab class。 */
import type {LayoutTab} from "../../layout.types";
/** 导出活动页签完整领域类型。 */
export type {LayoutTab};

/** 用途：读取中心布局页签；使用范围：activeTab 查询；解耦评估：复用既有遍历实现，不复制布局树算法。 */
import {getAllTabs} from "../../getAll";
/** 导出中心页签查询实现。 */
export {getAllTabs};
