/** 用途：完整应用外观；使用范围：Custom 模型宿主；解耦评估：直达稳定类型声明。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：完整布局页签；使用范围：Custom 父级与 DOM 宿主；解耦评估：直达布局领域声明。 */
import type {LayoutTab} from "../../layout.types";
/** 用途：布局模型基类；使用范围：唯一 Custom class 继承；解耦评估：具体基类仅在模型实现边界加载。 */
import {Model} from "../../Model";
/** 用途：完整 Protyle 领域表面；使用范围：Custom 内嵌编辑器集合；解耦评估：类型不加载具体实现。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";

/** 导出 Custom 领域唯一需要的运行时基类。 */
export {Model};
/** 导出 Custom 领域完整应用宿主类型。 */
export type {AppFacade};
/** 导出 Custom 领域完整页签宿主类型。 */
export type {LayoutTab};
/** 导出 Custom 领域完整编辑器类型。 */
export type {ProtyleDomain};
