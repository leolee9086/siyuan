/**
 * 用途：action 子目录的外部依赖网关。
 * 使用范围：仅供 `action/` 当前层级文件使用，承接 click/contextmenu 已下沉后剩余的共享上游依赖。
 */

/** 用途：定位属性视图根块。使用范围：click 入口与局部动画刷新。解耦评估：DOM 结构定位属于基础能力，继续集中转发更稳妥。 */
import { hasClosestBlock, hasClosestByClassName } from "../../../util/hasClosest";
/** 导出 hasClosestBlock 供 action 当前层级模块复用。 */
export { hasClosestBlock };
/** 导出类名祖先定位供 AV 标题点击清理选择。 */
export {hasClosestByClassName};
/** 用途：清理 AV 选择状态。使用范围：点击标题时取消当前行/单元格选择。 */
import {clearSelect} from "../../../util/clearSelect";
export {clearSelect};

/** 用途：提交事务。使用范围：标题同步与完整复制事务登记。解耦评估：事务是 action 层主要副作用出口，继续经网关接入更利于审计。 */
import {transaction} from "../../../wysiwyg/transaction/submit";
/** 导出 transaction 供 action 当前层级模块复用。 */
export { transaction };

/** 用途：复用 cell 位置子域的拖拽填充与表头刷新能力。使用范围：动画刷新模块。解耦评估：直达唯一实现，避免加载聚合入口中的 cell.update 反向动作依赖。 */
import {addDragFill, updateHeaderCell} from "../cell/decoration";
/** 用途：判断 cell 值是否为空。使用范围：卡片布局空态回写。解耦评估：直达纯值领域唯一实现。 */
import {cellValueIsEmpty} from "../cell.value";
/** 用途：生成 cell HTML 与补充属性。使用范围：动画局部刷新。解耦评估：直达渲染领域唯一实现，不加载 cell 聚合入口。 */
import {renderCell, renderCellAttr} from "../cell/render";
/** 导出 addDragFill 供 action 当前层级模块复用。 */
export { addDragFill };
/** 导出 cellValueIsEmpty 供 action 当前层级模块复用。 */
export { cellValueIsEmpty };
/** 导出 renderCell 供 action 当前层级模块复用。 */
export { renderCell };
/** 导出 renderCellAttr 供 action 当前层级模块复用。 */
export { renderCellAttr };
/** 导出 updateHeaderCell 供 action 当前层级模块复用。 */
export { updateHeaderCell };

/** 用途：整体渲染属性视图。使用范围：完整复制后的首渲染。解耦评估：整体渲染由 render 模块维护，当前层级只保留触发时机。 */
import { avRender } from "../render";
/** 导出 avRender 供 action 当前层级模块复用。 */
export { avRender };

/** 用途：发送异步请求。使用范围：完整复制接口。解耦评估：网络层能力继续统一复用即可。 */
import { fetchPost } from "../../../../util/network/fetch";
/** 导出 fetchPost 供 action 当前层级模块复用。 */
export { fetchPost };

/** 用途：聚焦复制后的新块。使用范围：完整复制完成后的交互闭环。解耦评估：焦点能力属于共享基础工具，继续转发即可。 */
import { focusBlock } from "../../../util/selection";
/** 导出 focusBlock 供 action 当前层级模块复用。 */
export { focusBlock };

/** 用途：滚动到当前焦点块。使用范围：完整复制完成后的视口对齐。解耦评估：滚动能力属于共享 DOM 工具，继续转发即可。 */
import { scrollCenter } from "../../../../util/DOM/highlightById";
/** 导出 scrollCenter 供 action 当前层级模块复用。 */
export { scrollCenter };

/** 用途：访问通用常量。使用范围：标题长度校验。解耦评估：常量属于跨模块共享协议，继续直接复用即可。 */
import { Constants } from "../../../../constants";
/** 导出 Constants 供 action 当前层级模块复用。 */
export { Constants };

/** 用途：提供时间格式化能力。使用范围：标题同步中的 updated 时间戳。解耦评估：时间格式约定是全局共享的，继续复用基础库即可。 */
import * as dayjs from "dayjs";
/** 导出 dayjs 供 action 当前层级模块复用。 */
export { dayjs };

/** 用途：显示轻量消息提示。使用范围：标题超长提示。解耦评估：消息提示属于 UI 基础能力，继续复用即可。 */
import { showMessage } from "../../../runtime/dialog.port";
/** 导出 showMessage 供 action 当前层级模块复用。 */
export { showMessage };

/** 用途：读取国际化文案。使用范围：标题超长提示。解耦评估：文案对象继续经环境层转发即可。 */
import { siyuanI18n } from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供 action 当前层级模块复用。 */
export { siyuanI18n };

/** 用途：判断节点是否为 HTMLElement。使用范围：动画刷新、完整复制与标题同步中的 DOM 收窄。解耦评估：DOM 守卫属于共享基础能力，继续转发即可。 */
import { isHTMLElement } from "../../../../util/DOM/element.guard";
/** 导出 isHTMLElement 供 action 当前层级模块复用。 */
export { isHTMLElement };

/** 用途：识别模板值内可交互元素与链接。使用范围：AV 点击入口在普通分发前放行原生交互。 */
import {getAVTemplateInteractiveElement, isAVTemplateLink} from "../attributeValue";
export {getAVTemplateInteractiveElement, isAVTemplateLink};

/** 用途：判断是否仅点击了元键。使用范围：click 入口快速放行。解耦评估：兼容性判断属于共享环境能力，不应在入口层重复实现。 */
import { isOnlyMeta } from "../../../util/compatibility";
/** 导出 isOnlyMeta 供 action 当前层级模块复用。 */
export { isOnlyMeta };

/** 用途：获取可编辑字段集合。使用范围：批量字段编辑菜单。解耦评估：字段判定属 AV 领域规则，继续通过 batchEdit 网关复用最稳妥。 */
import {getEditableAVFields, openAVFieldEditor, updateAVFieldValue} from "../batchEdit";
export {getEditableAVFields, openAVFieldEditor, updateAVFieldValue};

/** 用途：获取列图标与名称。使用范围：批量字段编辑菜单图标与回退标签。解耦评估：列类型工具集中复用更易跟随类型演进。 */
import {getColIconByType, getColNameByType} from "../col/col.typeUtils";
export {getColIconByType, getColNameByType};

/** 用途：渲染 emoji 图标。使用范围：字段图标为 emoji 时渲染。解耦评估：emoji 渲染为通用 UI 能力，继续通过网关复用最稳妥。 */
import {unicode2Emoji} from "../../../../emoji";
export {unicode2Emoji};

/** 用途：转义 HTML。使用范围：字段名渲染到菜单 label 时防止注入。解耦评估：转义为通用 DOM 安全能力，继续复用最稳妥。 */
import {escapeHtml} from "../../../../util/DOM/escape";
export {escapeHtml};
