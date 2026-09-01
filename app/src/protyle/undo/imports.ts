// 跨目录依赖转发：undo 模块的上游依赖网关

/** 用途：事务处理核心函数。使用范围：undo 模块 renderLocal 本地乐观应用操作。解耦评估：通过 imports.ts 转发。 */
import {onTransaction} from "../wysiwyg/transaction.onTransaction";
/** 用途：提交本地撤销回放事务。使用范围：undo 模块在 lite 编辑器跳过远端同步地应用操作。解耦评估：事务入口属于 Protyle 基础设施，经 undo 网关转发而不向调用方暴露实现。 */
import {transaction} from "../wysiwyg/transaction/submit";
/** 用途：等待编辑器事务队列清空。使用范围：仅供全局撤销请求建立提交屏障。解耦评估：队列属于 Protyle 事务基础设施，经本依赖网关转发比向调用方注入更细且不暴露实现。 */
import {waitForPendingTransactions} from "../util/transactionQueue";
/** 用途：从事务上下文恢复撤销焦点。使用范围：仅供两种撤销回放实现。解耦评估：焦点恢复依赖 Protyle DOM 语义，经本依赖网关转发可避免 undo 模块直连跨目录实现。 */
import {restoreUndoFocus} from "../util/selection";
/** 导出 onTransaction 事务函数，供 undo 模块调用 */
export { onTransaction };
/** 导出 transaction，供 lite 撤销回放跳过远端同步地提交本地操作。 */
export { transaction };

/** 用途：等待当前编辑器事务队列清空。使用范围：发起 kernel 撤销/重做前建立提交屏障。解耦评估：通过 imports.ts 转发。 */
export {waitForPendingTransactions};

/** 用途：按事务上下文恢复撤销焦点。使用范围：kernel 与 lite 回放完成后。解耦评估：通过 imports.ts 转发。 */
export {restoreUndoFocus};

/** 用途：阻止滚动容器在操作应用期间滚动。使用范围：renderLocal 操作应用前后。解耦评估：通过 imports.ts 转发。 */
import { preventScroll } from "../scroll/preventScroll";
/** 导出 preventScroll，供 undo 模块调用 */
export { preventScroll };

/** 用途：应用全局常量（快捷键命令标识与 API 调用参数）。使用范围：undo 模块快捷键命令发送。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../../constants";
/** 导出 Constants，供 undo 模块调用 */
export { Constants };

/** 用途：隐藏编辑器浮动 UI 元素（hint/gutter）。使用范围：renderLocal 操作应用前清理界面。解耦评估：通过 imports.ts 转发。 */
import { hideElements } from "../ui/hideElements";
/** 导出 hideElements，供 undo 模块调用 */
export { hideElements };

/** 用途：将编辑器滚动到指定高亮块位置。使用范围：renderLocal 操作应用后恢复视口。解耦评估：通过 imports.ts 转发。 */
import { scrollCenter } from "../../util/DOM/highlightById";
/** 导出 scrollCenter，供 undo 模块调用 */
export { scrollCenter };

/** 用途：异步 POST 请求。使用范围：undo 模块发起撤销状态查询与撤销/重做请求。解耦评估：通过 imports.ts 转发。 */
import { fetchPost } from "../../util/network/fetch";
/** 导出 fetchPost，供 undo 模块调用 */
export { fetchPost };

/** 用途：确认对话框。使用范围：跨文档撤销时提示用户确认。解耦评估：通过 imports.ts 转发。 */
import { confirmDialog } from "../runtime/dialog.port";
/** 导出 confirmDialog，供 undo 模块调用 */
export { confirmDialog };

/** 用途：消息提示。使用范围：撤销/重做失败时提示用户。解耦评估：通过 imports.ts 转发。 */
import { showMessage } from "../runtime/dialog.port";
/** 导出 showMessage，供 undo 模块调用 */
export { showMessage };

/** 用途：获取当前激活的页签。使用范围：getActiveProtyle 定位当前编辑器。解耦评估：通过 imports.ts 转发。 */
import { getActiveTab } from "../../layout/query/activeTab";
/** 导出 getActiveTab，供 undo 模块调用 */
export { getActiveTab };

/** 用途：判断运行时是否为移动端。使用范围：getActiveProtyle 分支选择编辑器获取路径。解耦评估：通过 imports.ts 转发。 */
import { isMobile } from "../../util/platform/functions";
/** 导出 isMobile，供 undo 模块调用 */
export { isMobile };

/** 用途：安全获取 window.siyuan.mobile。使用范围：getActiveProtyle 获取移动端编辑器实例。解耦评估：通过 imports.ts 转发。 */
import { getSafeSiyuanMobile } from "../../util/siyuanEnvironments/mobile.environment";
/** 导出 getSafeSiyuanMobile，供 undo 模块调用 */
export { getSafeSiyuanMobile };

/** 用途：获取窗口语言国际化对象。使用范围：跨文档撤销确认对话框文案。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanLanguages } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanLanguages，供 undo 模块调用 */
export { getSiyuanLanguages };

/** 用途：获取全局浮窗面板列表。使用范围：getActiveProtyle 兜底搜索编辑器。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanBlockPanels } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanBlockPanels，供 undo 模块调用 */
export { getSiyuanBlockPanels };

/** 用途：DOM 元素类型守卫（HTMLElement）。使用范围：替代 as HTMLElement 断言。解耦评估：通过 imports.ts 转发。 */
import { isHTMLElement } from "../../util/DOM/element.guard";
/** 导出 isHTMLElement，供 undo 模块调用 */
export { isHTMLElement };

/** 用途：向上按 className 查找祖先元素。使用范围：getRangeRootID 识别嵌入块投影容器。解耦评估：通过 imports.ts 转发。 */
import { hasClosestByClassName } from "../util/hasClosest";
/** 导出 hasClosestByClassName，供 undo 模块调用 */
export { hasClosestByClassName };

/** 用途：从候选元素中定位撤销焦点目标。使用范围：嵌入块与源文档同 ID 块共存时的焦点定位。解耦评估：通过 imports.ts 转发。 */
import { getUndoFocusTarget } from "../util/selectionFocus";
/** 导出 getUndoFocusTarget，供 undo 模块调用 */
export { getUndoFocusTarget };
