/** 用途：提供应用 ID 和编辑属性名。使用范围：递归列表事务请求和 DOM 标记。解耦评估：常量属于稳定基础协议。 */
import {Constants} from "../../../../../constants";
/** 导出事务所需常量。 */
export {Constants};

/** 用途：读取相关块 ID 与提交折叠事务。使用范围：递归列表转换。解耦评估：网络访问由唯一请求层提供。 */
import {fetchPost} from "../../../../../util/network/fetch";
/** 导出异步请求函数。 */
export {fetchPost};

/** 用途：读取相关块 ID 与提交折叠事务。使用范围：递归列表转换。解耦评估：网络访问由唯一请求层提供。 */
import {fetchSyncPost} from "../../../../../util/network/fetch";
/** 导出同步事务请求函数。 */
export {fetchSyncPost};

/** 用途：清理标题编号展示标记。使用范围：递归列表生成的更新 HTML。解耦评估：编号规则由 Protyle 工具域独占。 */
import {cleanHeadingNumberHTML} from "../../../../util/headingNumber";
/** 导出标题编号清理函数。 */
export {cleanHeadingNumberHTML};

/** 用途：识别仅视图级的折叠上下文。使用范围：递归列表的提交分支。解耦评估：折叠状态由 Protyle 工具域独占。 */
import {hasViewFoldContext} from "../../../../util/viewFold";
/** 导出视图折叠上下文查询函数。 */
export {hasViewFoldContext};

/** 用途：定位列表的可编辑子节点。使用范围：递归列表转换的光标保留。解耦评估：块树查询由 WYSIWYG 工具域唯一提供。 */
import {getContenteditableElement} from "../../../getBlock";
/** 导出可编辑节点查询函数。 */
export {getContenteditableElement};

/** 用途：计算嵌入块中的父块 ID。使用范围：递归列表拆分插入操作。解耦评估：块树查询由 WYSIWYG 工具域唯一提供。 */
import {getEmbedChildOperationParentID} from "../../../getBlock";
/** 导出嵌入父级查询函数。 */
export {getEmbedChildOperationParentID};

/** 用途：计算列表父块 ID。使用范围：递归列表拆分插入操作。解耦评估：块树查询由 WYSIWYG 工具域唯一提供。 */
import {getParentBlock} from "../../../getBlock";
/** 导出父块查询函数。 */
export {getParentBlock};

/** 用途：读取列表前置块 ID。使用范围：递归列表插入顺序。解耦评估：块树查询由 WYSIWYG 工具域唯一提供。 */
import {getPreviousBlockSibling} from "../../../getBlock";
/** 导出前置块查询函数。 */
export {getPreviousBlockSibling};

/** 用途：转换后恢复光标。使用范围：递归列表转换结束。解耦评估：选择协议由 Protyle 工具域唯一提供。 */
import {focusByWbr} from "../../../../util/selection";
/** 导出 WBR 焦点恢复函数。 */
export {focusByWbr};

/** 用途：读取转换前后的编辑范围。使用范围：递归列表转换结束。解耦评估：选择协议由 Protyle 工具域唯一提供。 */
import {getEditorRange} from "../../../../util/selection";
/** 导出编辑范围读取函数。 */
export {getEditorRange};

/** 用途：展开列表内部的折叠标题。使用范围：递归列表转换前。解耦评估：列表 owner 只消费折叠操作协议。 */
import {unfoldListHeadings} from "../../foldedHeadings/index";
/** 导出列表折叠展开函数。 */
export {unfoldListHeadings};

/** 用途：提交转换的可撤销操作。使用范围：递归列表转换。解耦评估：提交协议由事务 owner 唯一提供。 */
import {transaction} from "../../submit";
/** 导出事务提交函数。 */
export {transaction};

/** 用途：请求转换后的视觉回放和刷新。使用范围：递归列表转换完成后。解耦评估：低层命令只访问稳定端口。 */
import {getTransactionTransformVisualEffects} from "../../transformVisual/port";
/** 导出转换视觉端口读取函数。 */
export {getTransactionTransformVisualEffects};
