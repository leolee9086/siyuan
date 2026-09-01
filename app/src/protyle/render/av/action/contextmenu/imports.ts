/**
 * 用途：contextmenu 子目录的上游依赖网关。
 * 使用范围：仅供 `contextmenu/` 子目录内部模块使用，避免右键菜单拆分后继续耦合父级目录与外部模块。
 */

/** 用途：创建右键菜单实例。使用范围：仅在 contextmenu 入口和菜单段追加流程中使用。解耦评估：菜单实例由 action 菜单流程直接拥有，继续走网关转发比额外注入工厂更稳定。 */
import { Menu } from "../../../../../plugin/Menu";
/** 导出 Menu 供 contextmenu 子模块复用。 */
export { Menu };

/** 用途：向插件系统广播菜单扩展事件。使用范围：右键菜单主项构建完成后。解耦评估：插件扩展点属于宿主协议，继续通过网关集中接入能减少子模块对宿主细节的直接感知。 */
import { emitOpenMenu } from "../../../../../plugin/menu/emitOpenMenu.factory";
/** 导出 emitOpenMenu 供 contextmenu 子模块复用。 */
export { emitOpenMenu };

/** 用途：生成“打开方式”子菜单。使用范围：桌面端单选 attached 记录的 openBy 段。解耦评估：菜单内容协议由外层菜单工具维护，当前子模块只消费结果即可。 */
import { openEditorTab } from "../../../../../menus/util";
/** 导出 openEditorTab 供 contextmenu 子模块复用。 */
export { openEditorTab };

/** 用途：打开块属性面板。使用范围：openBy 子菜单里的 attr 项。解耦评估：属性面板是全局能力，维持网关转发比在子模块直接散落路径更好维护。 */
import {openFileAttr} from "../../../../../menus/commonMenuItem/fileAttr/openFileAttr";
/** 导出 openFileAttr 供 contextmenu 子模块复用。 */
export { openFileAttr };

/** 用途：隐藏现有浮层。使用范围：右键菜单弹出前的 UI 清理。解耦评估：浮层清理属于通用 UI 能力，当前模块直接复用即可。 */
import { hideElements } from "../../../../ui/hideElements";
/** 导出 hideElements 供 contextmenu 子模块复用。 */
export { hideElements };

/** 用途：向上定位属性视图根块。使用范围：根据当前右键行反查所属 AV 根节点。解耦评估：DOM 结构定位属于基础工具，维持统一入口比在子模块复制选择器更安全。 */
import { hasClosestBlock } from "../../../../util/hasClosest";
/** 导出 hasClosestBlock 供 contextmenu 子模块复用。 */
export { hasClosestBlock };
/** 用途：定位卡片所属虚拟滚动 body。使用范围：右键选择卡片时同步选中快照。解耦评估：DOM 定位继续复用统一工具。 */
import {hasClosestByClassName} from "../../../../util/hasClosest";
/** 导出 hasClosestByClassName 供 contextmenu 子模块复用。 */
export {hasClosestByClassName};

/** 用途：提交事务。使用范围：添加到数据库、删除、解绑等需要写回文档状态的菜单动作。解耦评估：事务是 action 层的主要副作用出口，当前子模块直接消费更利于审计。 */
import {transaction} from "../../../../wysiwyg/transaction/submit";
/** 导出 transaction 供 contextmenu 子模块复用。 */
export { transaction };

/** 用途：清理当前选择状态。使用范围：右键前同步表格行或卡片选中范围。解耦评估：选择清理规则本就是共享 UI 能力，继续经网关复用即可。 */
import { clearSelect } from "../../../../util/clearSelect";
/** 导出 clearSelect 供 contextmenu 子模块复用。 */
export { clearSelect };

/** 用途：发送菜单流程中的网络请求。使用范围：读取块属性与复制 HPath。解耦评估：网络层能力已经统一封装，当前只在子模块内选择同步或异步接口即可。 */
import { fetchPost, fetchSyncPost } from "../../../../../util/network/fetch";
/** 导出 fetchPost 供 contextmenu 子模块复用。 */
export { fetchPost };
/** 导出 fetchSyncPost 供 contextmenu 子模块复用。 */
export { fetchSyncPost };

/** 用途：写入系统剪贴板。使用范围：所有复制子菜单动作。解耦评估：剪贴板兼容逻辑不应在右键菜单子模块重复实现。 */
import { writeText } from "../../../../util/compatibility";
/** 导出 writeText 供 contextmenu 子模块复用。 */
export { writeText };

/** 用途：打开“添加到数据库”目标搜索面板。使用范围：addToDatabase 菜单项。解耦评估：目标选择 UI 已由 relation 子模块维护，右键菜单只负责传入上下文和回调。 */
import { openSearchAV } from "../../relation";
/** 导出 openSearchAV 供 contextmenu 子模块复用。 */
export { openSearchAV };

/** 用途：生成更新时间戳。使用范围：添加到数据库事务里的 doUpdateUpdated。解耦评估：时间格式约定是全局共享的，继续直接复用基础库最稳妥。 */
import * as dayjs from "dayjs";
/** 导出 dayjs 供 contextmenu 子模块复用。 */
export { dayjs };

/** 用途：安全转义菜单文案。使用范围：字段编辑子菜单标题。解耦评估：HTML 转义属于基础安全工具，当前模块直接复用即可。 */
import { escapeHtml } from "../../../../../util/DOM/escape";
/** 导出 escapeHtml 供 contextmenu 子模块复用。 */
export { escapeHtml };

/** 用途：渲染 emoji 图标 HTML。使用范围：表格字段编辑子菜单图标。解耦评估：图标渲染规则由 emoji 模块维护，当前子模块只消费结果。 */
import { unicode2Emoji } from "../../../../../emoji";
/** 导出 unicode2Emoji 供 contextmenu 子模块复用。 */
export { unicode2Emoji };

/** 用途：判断是否为移动端布局。使用范围：决定是否展示 openBy 子菜单。解耦评估：平台判断属于全局环境能力，保持网关转发即可。 */
import { isMobile } from "../../../../../platform";
/** 导出 isMobile 供 contextmenu 子模块复用。 */
export { isMobile };

/** 用途：DOM 节点类型守卫。使用范围：收窄 querySelector / querySelectorAll 结果与输入框节点。解耦评估：DOM 守卫是基础能力，应通过网关统一接入。 */
import { isHTMLElement, isHTMLInputElement } from "../../../../../util/DOM/element.guard";
/** 导出 isHTMLElement 供 contextmenu 子模块复用。 */
export { isHTMLElement };
/** 导出 isHTMLInputElement 供 contextmenu 子模块复用。 */
export { isHTMLInputElement };

/** 用途：从 DOM 生成单元格值。使用范围：添加到数据库。解耦评估：直达 cell value 唯一实现。 */
import {genCellValueByElement} from "../../cell.value";
/** 用途：打开文本单元格编辑。使用范围：字段编辑和解绑块菜单。解耦评估：直达 cell edit 唯一实现。 */
import {popTextCell} from "../../cell/edit";
/** 用途：提交单元格值更新。使用范围：字段编辑和解绑块菜单。解耦评估：直达 cell update 唯一实现。 */
import {updateCellsValue} from "../../cell.update";
/** 导出 genCellValueByElement 供 contextmenu 子模块复用。 */
export { genCellValueByElement };
/** 导出 popTextCell 供 contextmenu 子模块复用。 */
export { popTextCell };
/** 导出 updateCellsValue 供 contextmenu 子模块复用。 */
export { updateCellsValue };

/** 用途：根据字段类型获取图标。使用范围：表格字段编辑子菜单。解耦评估：列类型图标映射属于 col 子模块稳定能力，当前直接复用即可。 */
import { getColIconByType } from "../../col/col.typeUtils";
/** 导出 getColIconByType 供 contextmenu 子模块复用。 */
export { getColIconByType };

/** 用途：复用行级能力。使用范围：插入前后、删除和头部选择态刷新。解耦评估：行操作语义集中在 row 子模块，比在右键菜单里分散实现更符合边界。 */
import { deleteRow, insertRows } from "../../row";
/** 用途：同步 AV 选择计数与表头状态。使用范围：右键选择操作；解耦评估：直达选择子域唯一实现，避免加载行渲染组合根。 */
import {updateHeader} from "../../selection/header";
/** 导出 deleteRow 供 contextmenu 子模块复用。 */
export { deleteRow };
/** 导出 insertRows 供 contextmenu 子模块复用。 */
export { insertRows };
/** 导出 updateHeader 供 contextmenu 子模块复用。 */
export { updateHeader };
/** 用途：同步虚拟滚动选择快照。使用范围：卡片右键选择。解耦评估：选择快照由 virtualScroll 唯一维护。 */
import {updateAVRowSelect} from "../../virtualScroll/state";
/** 导出 updateAVRowSelect 供 contextmenu 子模块复用。 */
export {updateAVRowSelect};

/** 用途：记录右键项作为 Shift 范围选择锚点。使用范围：右键菜单选择同步及范围选择状态维护。解耦评估：锚点状态由 rangeSelect 唯一维护，通过网关转发可避免子模块直接操作选择状态，保持单一职责。 */
import { setAVItemAnchor } from "../../rangeSelect";
/** 导出右键项锚点同步能力。 */
export {setAVItemAnchor};

/** 用途：读取 AV view 属性名。使用范围：生成数据库条目协议链接。解耦评估：协议键由常量统一维护。 */
import {Constants} from "../../../../../constants";
/** 导出 Constants 供 contextmenu 子模块复用。 */
export {Constants};

/** 用途：读取国际化文案。使用范围：copy/openBy/fields 等整条右键菜单链路。解耦评估：文案对象属于只读全局上下文，通过网关统一转发即可。 */
import { siyuanI18n } from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供 contextmenu 子模块复用。 */
export { siyuanI18n };

/** 用途：转发 action 层的视图/列类型收窄守卫。使用范围：contextmenu 子模块内部避免越级导入父目录 guards。解耦评估：在本层网关转发后，子模块只依赖同层入口，后续迁移更容易。 */
import { toAttrColType, toAttrViewType } from "../action.guards";
/** 导出 toAttrColType 供 contextmenu 子模块复用。 */
export { toAttrColType };
/** 导出 toAttrViewType 供 contextmenu 子模块复用。 */
export { toAttrViewType };

/** 用途：构建选择工具栏与右键菜单共用的批量字段编辑子菜单。使用范围：右键菜单 fields 子菜单及对应工具栏字段编辑。解耦评估：子菜单由领域工厂统一生成，上下文菜单仅消费其返回的 IMenu[]，不直接依赖内部实现，适合通过共享模块复用。 */
import { getAVEditFieldMenuItems } from "../editFieldMenu";
/** 导出 getAVEditFieldMenuItems 供 contextmenu 子模块复用。 */
export { getAVEditFieldMenuItems };
