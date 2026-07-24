/** 用途：编辑器具体实现；使用范围：同目录创建工厂；解耦评估：具体 class 仅在装配边界实例化。 */
import {Editor} from "../model/Editor";
/** 用途：编辑器构造选项契约；使用范围：同目录创建工厂参数；解耦评估：泛型契约保留宿主身份。 */
import type {IEditorOptions} from "../types";
/** 用途：应用实现身份；使用范围：工厂边界绑定编辑器选项；解耦评估：仅装配边界依赖具体宿主。 */
import type {App} from "../../index";
/** 用途：页签实现身份；使用范围：工厂边界绑定编辑器选项；解耦评估：仅装配边界依赖具体宿主。 */
import type {Tab} from "../../layout/Tab";
/** 用途：Protyle 实现身份；使用范围：工厂返回编辑器初始化回调类型；解耦评估：仅装配边界依赖具体编辑器。 */
import {Protyle} from "../../protyle";
/** 用途：同步独立窗口模型 hash；使用范围：编辑器初始化完成回调；解耦评估：在工厂装配宿主能力，Editor 不再导入窗口实现。 */
import {setModelsHash} from "../../window/setHeader";
/** 用途：编辑器全屏 UI 同步；使用范围：Editor 模型宿主能力注入；解耦评估：具体行为在工厂边界绑定。 */
import {fullscreen} from "../../protyle/breadcrumb/action";
/** 用途：参数化引擎创建选项；使用范围：Protyle 工厂参数；解耦评估：完整配置映射保持静态类型。 */
import type {EditorEngineOptions} from "../types";

/** 同目录工厂使用的编辑器具体实现。 */
export {Editor};
/** 同目录工厂使用的编辑器构造契约。 */
export type {IEditorOptions};
/** 同目录工厂绑定的应用身份。 */
export type {App};
/** 同目录工厂绑定的页签身份。 */
export type {Tab};
/** 同目录工厂绑定的 Protyle 身份。 */
export {Protyle};
/** 同目录工厂注入的窗口 hash 同步实现。 */
export {setModelsHash};
/** 同目录工厂注入的编辑器全屏实现。 */
export {fullscreen};
/** 同目录工厂使用的参数化引擎创建选项。 */
export type {EditorEngineOptions};
