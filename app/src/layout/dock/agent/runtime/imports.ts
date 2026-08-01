/** 用途：约束宿主可创建的 Dialog 实例；使用范围：Agent 面板完整能力聚合；解耦评估：只依赖公共类型契约。 */
import type {IDialog} from "../../../../dialog/dialog.types";
/** 用途：约束宿主 Dialog 创建参数；使用范围：Agent 面板完整能力聚合；解耦评估：只依赖公共类型契约。 */
import type {IDialogOptions} from "../../../../dialog/dialog.types";
/** 用途：约束控制器管理的布局页签；使用范围：独立面板 DOM 生命周期；解耦评估：完整布局抽象替代对 Tab 具体类的依赖。 */
import type {LayoutTab} from "../../../layout.types";
/** 用途：约束宿主应用能力；使用范围：面板组合工厂参数；解耦评估：AppFacade 替代具体 App class。 */
import type {AppFacade} from "../../../../app/AppFacade.types";
/** 用途：创建独立面板页签；使用范围：面板组合工厂；解耦评估：具体构造器只停留在宿主工厂。 */
import {Tab} from "../../../Tab";
/** 用途：创建唯一 AgentChat 实现；使用范围：面板组合工厂；解耦评估：具体类只停留在宿主工厂，控制器和调用方依赖公共领域。 */
import {AgentChat} from "../AgentChat";

/** 导出宿主 Dialog 实例契约。 */
export type {IDialog};
/** 导出宿主 Dialog 创建参数契约。 */
export type {IDialogOptions};
/** 导出布局页签公共领域。 */
export type {LayoutTab};
/** 导出应用能力抽象。 */
export type {AppFacade};
/** 导出布局页签构造器供组合工厂使用。 */
export {Tab};
/** 导出 AgentChat 构造器供组合工厂使用。 */
export {AgentChat};
