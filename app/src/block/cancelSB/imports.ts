/** 用途：解析超级块和子块关系；使用范围：cancelSB 的位置与子块收集；解耦评估：直接依赖唯一块解析实现，不复制 DOM 规则。 */
import {getContenteditableElement} from "../../protyle/wysiwyg/getBlock";
/** 用途：解析超级块嵌入父级；使用范围：cancelSB 的事务 parentID 计算；解耦评估：直接依赖唯一块解析实现。 */
import {getEmbedChildOperationParentID} from "../../protyle/wysiwyg/getBlock";
/** 用途：解析普通父块；使用范围：cancelSB 的事务 parentID 计算；解耦评估：直接依赖唯一块解析实现。 */
import {getParentBlock} from "../../protyle/wysiwyg/getBlock";
/** 用途：解析前置兄弟块；使用范围：cancelSB 的 do/undo 操作顺序；解耦评估：直接依赖唯一块解析实现。 */
import {getPreviousBlockSibling} from "../../protyle/wysiwyg/getBlock";
/** 用途：重绘嵌入块；使用范围：cancelSB 的 DOM 变更后处理；解耦评估：直接依赖唯一渲染实现，不引入块工具综合入口。 */
import {blockRender} from "../../protyle/render/blockRender";
/** 用途：重绘数学公式；使用范围：cancelSB 的超级块结构变更后处理；解耦评估：直接依赖唯一数学渲染实现。 */
import {mathRender} from "../../protyle/render/mathRender";
/** 用途：恢复编辑器光标；使用范围：cancelSB 的 wbr 回填流程；解耦评估：直接依赖唯一选区恢复实现。 */
import {focusByWbr} from "../../protyle/util/selection.range";
/** 用途：读取块位置；使用范围：cancelSB 的 showAll/反链兜底定位；解耦评估：直接依赖网络请求实现，不经过 block 综合网关。 */
import {fetchSyncPost} from "../../util/network/fetch";

/** 导出超级块取消流程所需的块节点解析能力。 */
export {getContenteditableElement};
/** 导出超级块取消流程所需的嵌入父级解析能力。 */
export {getEmbedChildOperationParentID};
/** 导出超级块取消流程所需的普通父级解析能力。 */
export {getParentBlock};
/** 导出超级块取消流程所需的前置兄弟解析能力。 */
export {getPreviousBlockSibling};
/** 导出超级块取消流程所需的嵌入块重绘能力。 */
export {blockRender};
/** 导出超级块取消流程所需的数学重绘能力。 */
export {mathRender};
/** 导出超级块取消流程所需的光标恢复能力。 */
export {focusByWbr};
/** 导出超级块取消流程所需的同步请求能力。 */
export {fetchSyncPost};
