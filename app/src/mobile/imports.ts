/** 用途：数据库行导航数据契约。使用范围：移动数据库行工厂；解耦评估：直达完整 AppFacade 声明。 */
import type {AppDatabaseRowNavigation} from "../app/AppFacade.types";
/** 导出数据库行导航数据契约。 */
export type {AppDatabaseRowNavigation};
/** 用途：完整应用领域根。使用范围：移动数据库行工厂；解耦评估：直达抽象声明，不加载具体 App。 */
import type {AppFacade} from "../app/AppFacade.types";
/** 导出完整应用领域根。 */
export type {AppFacade};
/** 用途：块打开动作协议。使用范围：绑定数据库行；解耦评估：直达无状态协议常量。 */
import {Constants} from "../constants";
/** 导出块打开动作协议。 */
export {Constants};
/** 用途：移动全屏详情容器。使用范围：分离数据库行；解耦评估：Dialog 是既有移动 UI 基础设施，实例化集中在工厂。 */
import {Dialog} from "../dialog";
/** 导出 Dialog 构造器。 */
export {Dialog};
/** 用途：数据库属性表唯一渲染实现。使用范围：移动分离条目；解耦评估：直达真实实现，避免复制属性渲染。 */
import {renderAVAttribute} from "../protyle/render/av/blockAttr";
/** 导出数据库属性渲染。 */
export {renderAVAttribute};
