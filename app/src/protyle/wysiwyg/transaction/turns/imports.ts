/** 用途：读取编辑器基础常量。使用范围：容器和列表 DOM 属性。解耦评估：通过同域网关集中基础协议。 */
import {Constants} from "../../../../constants";
/** 导出编辑器基础常量，供转换 owner 构造标准 DOM。 */
export {Constants};

/** 用途：请求块相关定位信息。使用范围：单块取消容器转换。解耦评估：网络边界集中在同域网关。 */
import {fetchSyncPost} from "../../../../util/network/fetch";
/** 导出同步请求函数，供单块转换补齐惰加载前置块。 */
export {fetchSyncPost};
/** 用途：请求块引用文本。使用范围：单块转换后的空引用恢复。解耦评估：网络边界集中在同域网关。 */
import {fetchPost} from "../../../../util/network/fetch";
/** 导出异步请求函数，供单块转换恢复块引用显示。 */
export {fetchPost};

/** 用途：聚焦转换后的块。使用范围：三个转换 owner 的提交完成路径。解耦评估：选择能力通过同域网关集中。 */
import {focusBlock} from "../../../util/selection";
/** 导出块焦点函数，供转换 owner 恢复编辑位置。 */
export {focusBlock};
/** 用途：通过 WBR 恢复光标。使用范围：普通和单块转换提交完成路径。解耦评估：选择能力通过同域网关集中。 */
import {focusByWbr} from "../../../util/selection";
/** 导出 WBR 焦点函数，供转换 owner 恢复编辑位置。 */
export {focusByWbr};
/** 用途：读取编辑器当前范围。使用范围：单块转换焦点恢复。解耦评估：选择能力通过同域网关集中。 */
import {getEditorRange} from "../../../util/selection";
/** 导出编辑器范围函数，供转换 owner 读取当前光标。 */
export {getEditorRange};

/** 用途：定位块内容编辑节点。使用范围：单块转换插入 WBR。解耦评估：块查询保持在同域网关。 */
import {getContenteditableElement} from "../../getBlock";
/** 导出可编辑节点查询，供单块转换保留光标。 */
export {getContenteditableElement};
/** 用途：定位嵌入块操作父级。使用范围：容器和普通块转换事务。解耦评估：块查询保持在同域网关。 */
import {getEmbedChildOperationParentID} from "../../getBlock";
/** 导出嵌入父级查询，供转换 owner 构造内核操作。 */
export {getEmbedChildOperationParentID};
/** 用途：定位下一个块。使用范围：快捷键选区连续性判断。解耦评估：块查询保持在同域网关。 */
import {getNextBlockSibling} from "../../getBlock";
/** 导出后继块查询，供普通块转换判断连续选区。 */
export {getNextBlockSibling};
/** 用途：定位父块。使用范围：容器和普通块转换事务。解耦评估：块查询保持在同域网关。 */
import {getParentBlock} from "../../getBlock";
/** 导出父块查询，供转换 owner 构造内核操作。 */
export {getParentBlock};
/** 用途：定位前一个块。使用范围：插入和撤销操作顺序。解耦评估：块查询保持在同域网关。 */
import {getPreviousBlockSibling} from "../../getBlock";
/** 导出前置块查询，供转换 owner 构造内核操作。 */
export {getPreviousBlockSibling};
/** 用途：统计超级块直属子块。使用范围：容器转换后的超级块取消判断。解耦评估：块查询保持在同域网关。 */
import {getSbChildBlockCount} from "../../getBlock";
/** 导出超级块子块计数，供容器 owner 判断是否取消外层超级块。 */
export {getSbChildBlockCount};

/** 用途：收窄可写 HTML 元素。使用范围：超级块宽度来源和替换节点校验。解耦评估：类型守卫通过同域网关集中。 */
import {isHTMLElement} from "../../../../util/DOM/element.guard";
/** 导出 HTML 元素守卫，供转换 owner 安全读取样式。 */
export {isHTMLElement};

/** 用途：生成超级块容器。使用范围：多块合并为超级块。解耦评估：容器工厂通过同域网关引入。 */
import {genSBElement} from "../../../../block/superBlock";
/** 导出超级块生成器，供容器 owner 构造标准超级块。 */
export {genSBElement};
/** 用途：取消只有单个子块的超级块。使用范围：容器转换收尾。解耦评估：超级块事务通过同域网关引入。 */
import {cancelSB} from "../../../../block/util.cancelSB";
/** 导出超级块取消函数，供容器 owner 合并反向操作。 */
export {cancelSB};

/** 用途：隐藏转换后的块标工具。使用范围：三个转换 owner 的提交收尾。解耦评估：UI 清理通过同域网关集中。 */
import {hideElements} from "../../../ui/hideElements";
/** 导出工具隐藏函数，供转换 owner 完成 UI 收尾。 */
export {hideElements};
/** 用途：更新标题折叠状态。使用范围：普通块转换的标题层级变化。解耦评估：折叠状态通过同域网关集中。 */
import {setFold} from "../../../util/blockFold";
/** 导出标题折叠函数，供普通块转换保留折叠语义。 */
export {setFold};

/** 用途：提交可撤销操作。使用范围：三个转换 owner 的事务提交。解耦评估：提交协议通过同域网关集中。 */
import {transaction} from "../submit";
/** 导出事务提交函数，供转换 owner 写入正反向操作。 */
export {transaction};
/** 用途：提交单块更新操作。使用范围：非取消型单块转换。解耦评估：更新 owner 通过同域网关集中。 */
import {updateTransaction} from "../update";
/** 导出单块更新函数，供单块转换保留编辑状态。 */
export {updateTransaction};
/** 用途：刷新超级块拖拽尺寸。使用范围：容器插入和子块移动完成后。解耦评估：超级块刷新通过同域网关集中。 */
import {refreshSbs} from "../refreshSbs";
/** 导出超级块刷新函数，供容器 owner 同步布局。 */
export {refreshSbs};
/** 用途：展开列表内折叠标题。使用范围：取消列表、引述和标注容器。解耦评估：折叠 owner 通过同域网关集中。 */
import {unfoldListHeadings} from "../foldedHeadings";
/** 导出折叠标题展开函数，供单块转换并入撤销操作。 */
export {unfoldListHeadings};

/** 用途：读取转换后的渲染能力。使用范围：转换提交后的精确视觉回放。解耦评估：低层 owner 不直接加载高层渲染模块。 */
import {getTransactionTransformVisualEffects} from "../transformVisual/port";
/** 导出转换视觉端口读取函数，供转换 owner 请求高层效果。 */
export {getTransactionTransformVisualEffects};
