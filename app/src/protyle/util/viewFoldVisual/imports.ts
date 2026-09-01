/** 用途：处理标题子块插入后的代码渲染。使用范围：视图折叠视觉组合。解耦评估：高层渲染依赖只留在效果组合层。 */
import {processRender} from "../processCode";
/** 导出标题子块代码渲染函数。 */
export {processRender};

/** 用途：处理标题子块插入后的文本高亮。使用范围：视图折叠视觉组合。解耦评估：高层渲染依赖只留在效果组合层。 */
import {highlightRender} from "../../render/highlightRender";
/** 导出标题子块高亮渲染函数。 */
export {highlightRender};

/** 用途：处理标题子块插入后的属性视图渲染。使用范围：视图折叠视觉组合。解耦评估：AV 依赖不进入折叠状态模块。 */
import {avRender} from "../../render/av/render";
/** 导出标题子块 AV 渲染函数。 */
export {avRender};

/** 用途：处理标题子块插入后的块级渲染。使用范围：视图折叠视觉组合。解耦评估：块渲染依赖不进入折叠状态模块。 */
import {blockRender} from "../../render/blockRender";
/** 导出标题子块块级渲染函数。 */
export {blockRender};

/** 用途：恢复禁用编辑器状态。使用范围：异步标题子块渲染完成后。解耦评估：onGet 依赖不进入折叠状态模块。 */
import {disabledProtyle} from "../onGet";
/** 导出编辑器禁用态应用函数。 */
export {disabledProtyle};
