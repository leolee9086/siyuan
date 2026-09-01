/** 用途：刷新转换后插入的内容渲染器。使用范围：仅事务转换视觉效果。解耦评估：命令层经端口调用，本文件保留组合依赖。 */
import {contentRendererRegistry} from "../../../../registry/contentRenderer/ContentRendererRegistry";
/** 导出转换后的内容渲染器。 */
export {contentRendererRegistry};

/** 用途：刷新转换后的属性视图。使用范围：仅完整编辑器视觉刷新。解耦评估：AV 依赖不进入转换命令层。 */
import {avRender} from "../../../render/av/render";
/** 导出属性视图渲染函数。 */
export {avRender};

/** 用途：刷新嵌入与块级内容。使用范围：转换提交后的视觉阶段。解耦评估：集中在效果组合层。 */
import {blockRender} from "../../../render/blockRender";
/** 导出块级渲染函数。 */
export {blockRender};

/** 用途：刷新代码和文本高亮。使用范围：转换提交后的视觉阶段。解耦评估：集中在效果组合层。 */
import {highlightRender} from "../../../render/highlightRender";
/** 导出高亮渲染函数。 */
export {highlightRender};

/** 用途：回放转换产生的折叠操作。使用范围：非视图折叠列表转换。解耦评估：绑定在启动组合层，不反向暴露给命令层。 */
import {onTransaction} from "../../transaction.onTransaction";
/** 导出事务回放函数。 */
export {onTransaction};
