/**
 * 用途：click 子目录的上游依赖网关。
 * 使用范围：仅供 `click/` 子目录内部模块使用，避免子模块继续经由父级 imports.ts 间接耦合。
 */

/** 用途：复用 cell 装饰子域中的拖拽手柄能力。使用范围：普通单元格点击。解耦评估：直达唯一实现，避免加载 cell 聚合入口。 */
import {addDragFill} from "../../cell/decoration";
/** 用途：复用 cell 文本读取能力。使用范围：block-more 与 copy。解耦评估：直达渲染子域唯一实现。 */
import {getCellText} from "../../cell/render";
/** 用途：复用 cell 类型解析能力。使用范围：普通单元格点击。解耦评估：直达位置子域唯一实现。 */
import {getTypeByCellElement} from "../../cell/position";
/** 用途：复用 cell 编辑能力。使用范围：block-more 点击。解耦评估：直达编辑子域唯一实现。 */
import {popTextCell} from "../../cell/edit";
/** 导出 addDragFill 供 click 子模块复用。 */
export { addDragFill };
/** 导出 getCellText 供 click 子模块复用。 */
export { getCellText };
/** 导出 getTypeByCellElement 供 click 子模块复用。 */
export { getTypeByCellElement };
/** 导出 popTextCell 供 click 子模块复用。 */
export { popTextCell };

/** 用途：复用 row 子模块中的行级操作。使用范围：选中、插入、删除、分页大小与头部刷新。 */
import { deleteRow, insertRows, selectRow, setPageSize } from "../../row";
/** 导出 deleteRow 供批量选择工具栏复用。 */
export {deleteRow};
/** 用途：同步 AV 选择计数与表头状态。使用范围：普通单元格点击；解耦评估：直达选择子域唯一实现，避免加载行渲染组合根。 */
import {updateHeader} from "../../selection/header";
/** 导出 insertRows 供 click 子模块复用。 */
export { insertRows };
/** 导出 selectRow 供 click 子模块复用。 */
export { selectRow };
/** 导出 setPageSize 供 click 子模块复用。 */
export { setPageSize };
/** 导出 updateHeader 供 click 子模块复用。 */
export { updateHeader };

/** 用途：复用 view 子模块的新增视图能力。使用范围：视图新增按钮；解耦评估：新增事务由 view 模块定义，click 侧直接消费即可。 */
import { addView } from "../../view";
/** 导出 addView 供 click 子模块复用。 */
export { addView };
/** 用途：打开视图菜单。使用范围：视图标题点击；解耦评估：菜单与配置面板的双向导航由 Panel 控制器统一拥有。 */
import {openViewMenu} from "../../openMenuPanel";
/** 导出 openViewMenu 供 click 子模块复用。 */
export { openViewMenu };

/** 用途：打开新增列菜单。使用范围：表头加号点击。解耦评估：列操作入口由 col 模块维护更稳妥。 */
import {addCol} from "../../col/add/menu.factory";
/** 导出 addCol 供 click 子模块复用。 */
export { addCol };
/** 用途：提供添加列后的完整面板导航外观。使用范围：表头新增列。解耦评估：直达具体外观组合边界，Add 子域只依赖参数化抽象。 */
import {avMenuPanel} from "../../openMenuPanel";
/** 导出完整面板领域外观 */
export {avMenuPanel};

/** 用途：打开表头列菜单。使用范围：表头单元格点击。解耦评估：列菜单行为由 col 模块维护更一致。 */
import { showColMenu } from "../../col/menu/menu.factory";
/** 导出 showColMenu 供 click 子模块复用。 */
export { showColMenu };

/** 用途：打开属性视图配置面板。使用范围：properties/config/switcher/sorts/filters 按钮。解耦评估：配置面板入口由 openMenuPanel 模块维护更稳定。 */
import { openMenuPanel } from "../../openMenuPanel";
/** 导出 openMenuPanel 供 click 子模块复用。 */
export { openMenuPanel };

/** 用途：打开统计菜单。使用范围：`.av__calc` 点击。解耦评估：统计菜单能力由 calc 模块维护更清晰。 */
import { openCalcMenu } from "../../calc";
/** 导出 openCalcMenu 供 click 子模块复用。 */
export { openCalcMenu };

/** 用途：重渲染属性视图。使用范围：load-more 与历史视图切换。解耦评估：整体渲染由 render 模块维护，click 只保留触发时机。 */
import { avRender, initUnfoldedGroupTables } from "../../render";
/** 导出 avRender 供 click 子模块复用。 */
export { avRender };
/** 导出展开分组表格的延迟初始化能力。 */
export {initUnfoldedGroupTables};
/** 用途：记录分组折叠快照。使用范围：Alt 批量折叠的 do/undo 数据。 */
import {getGroupFoldTip, getGroupFoldedStates, updateGroupFoldedStates} from "../../groupFold";
export {getGroupFoldTip, getGroupFoldedStates, updateGroupFoldedStates};

/** 用途：复用 gallery 子模块能力。使用范围：gallery 编辑与更多菜单。解耦评估：gallery 特有交互由 gallery 模块维护更合理。 */
import { editGalleryItem, openGalleryItemMenu } from "../../gallery/util";
/** 导出 editGalleryItem 供 click 子模块复用。 */
export { editGalleryItem };
/** 导出 openGalleryItemMenu 供 click 子模块复用。 */
export { openGalleryItemMenu };

/** 用途：打开批量字段编辑器并写入布尔字段。使用范围：选择工具栏编辑菜单。 */
import {getEditableAVFields, openAVFieldEditor, updateAVFieldValue} from "../../batchEdit";
export {getEditableAVFields, openAVFieldEditor, updateAVFieldValue};
/** 用途：读取列类型的默认图标与名称。使用范围：批量字段编辑菜单。 */
import {getColIconByType, getColNameByType} from "../../col/col.typeUtils";
export {getColIconByType, getColNameByType};
/** 用途：启动画廊封面位置调整。使用范围：封面位置按钮。 */
import {startCardCoverPosition} from "../../coverPosition";
export {startCardCoverPosition};
/** 用途：从选择工具栏打开完整 AV 右键菜单。 */
import {avContextmenu} from "../contextmenu";
export {avContextmenu};
/** 用途：构建批量字段编辑菜单。 */
import {Menu} from "../../../../../plugin/Menu";
export {Menu};
/** 用途：安全输出字段名称。 */
import {escapeHtml} from "../../../../../util/DOM/escape";
export {escapeHtml};
/** 用途：决定批量编辑菜单是否使用移动端全屏样式。 */
import {isMobile} from "../../../../../platform";
export {isMobile};

/** 用途：打开看板分组快捷操作菜单。使用范围：分组标题更多按钮。 */
import {openKanbanGroupMenu} from "../../kanban/groupMenu";
export {openKanbanGroupMenu};

/** 用途：访问通用常量。使用范围：视图切换、emoji、本地图标与定时器。解耦评估：常量属于跨模块共享协议，继续直接复用即可。 */
import { Constants } from "../../../../../constants";
/** 导出 Constants 供 click 子模块复用。 */
export { Constants };

/** 用途：恢复选区焦点。使用范围：block-more 点击后选中文本。解耦评估：焦点工具属于共享基础能力，click 不应重复实现。 */
import { focusByRange } from "../../../../util/selection";
/** 导出 focusByRange 供 click 子模块复用。 */
export { focusByRange };

/** 用途：按类名向上查找容器。使用范围：定位 body、group-title 和局部滚动容器。解耦评估：DOM 遍历规则统一维护更可靠。 */
import { hasClosestByClassName } from "../../../../util/hasClosest";
/** 导出 hasClosestByClassName 供 click 子模块复用。 */
export { hasClosestByClassName };

/** 用途：打开引用提示。使用范围：block-more 点击。解耦评估：提示面板由 hint 模块维护，click 只传上下文。 */
import { hintRef } from "../../../../hint/extend.hintRef";
/** 导出 hintRef 供 click 子模块复用。 */
export { hintRef };

/** 用途：访问共享的 DOM 守卫。使用范围：收窄 querySelector 与 querySelectorAll 结果。解耦评估：DOM 守卫继续集中维护更稳妥。 */
import { isHTMLElement } from "../../../../../util/DOM/element.guard";
/** 导出 isHTMLElement 供 click 子模块复用。 */
export { isHTMLElement };

/** 用途：打开 emoji 面板与渲染 emoji HTML。使用范围：表头 emoji 图标点击。解耦评估：emoji 交互由 emoji 模块维护更一致。 */
import { openEmojiPanel, unicode2Emoji } from "../../../../../emoji";
/** 导出 openEmojiPanel 供 click 子模块复用。 */
export { openEmojiPanel };
/** 导出 unicode2Emoji 供 click 子模块复用。 */
export { unicode2Emoji };

/** 用途：预览属性视图图片。使用范围：`.av__cellassetimg` 点击。解耦评估：图片预览入口由 preview 模块维护更稳定。 */
import { previewAttrViewImages } from "../../../../preview/image";
/** 导出 previewAttrViewImages 供 click 子模块复用。 */
export { previewAttrViewImages };

/** 用途：还原压缩图 URL。使用范围：图片预览前。解耦评估：资源地址处理属于资产工具层能力。 */
import { removeCompressURL } from "../../../../../util/assets/image";
/** 导出 removeCompressURL 供 click 子模块复用。 */
export { removeCompressURL };

/** 用途：访问全局菜单与存储环境。使用范围：首列点击、block-more 和 emoji 默认图标回填。解耦评估：环境访问必须继续走 environment 封装。 */
import { getSiyuanStorage, removeSiyuanMenu } from "../../../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanStorage 供 click 子模块复用。 */
export { getSiyuanStorage };
/** 导出 removeSiyuanMenu 供 click 子模块复用。 */
export { removeSiyuanMenu };

/** 用途：访问原生桥接对象。使用范围：搜索图标点击后判断是否可唤起移动端键盘。解耦评估：桥接对象访问应继续集中在 environment 层。 */
import { getWindowJSAndroid, getWindowJSHarmony } from "../../../../../util/siyuanEnvironments/windowNative.environment";
/** 导出 getWindowJSAndroid 供 click 子模块复用。 */
export { getWindowJSAndroid };
/** 导出 getWindowJSHarmony 供 click 子模块复用。 */
export { getWindowJSHarmony };

/** 用途：唤起移动端原生键盘。使用范围：搜索图标点击。解耦评估：移动端桥接细节应继续由 mobile util 封装。 */
import {callMobileAppShowKeyboard} from "../../../../../mobile/keyboard/mobileAppUtil";
/** 导出 callMobileAppShowKeyboard 供 click 子模块复用。 */
export { callMobileAppShowKeyboard };

/** 用途：按默认模板新增数据库条目。使用范围：新增按钮已配置默认模板时。解耦评估：模板创建由 AV 模板模块维护，点击层只提供位置。 */
import {createAttributeViewItem, openNewItemTemplateMenu} from "../../newItemTemplate";
/** 导出 createAttributeViewItem 供 click 子模块复用。 */
export {createAttributeViewItem};
/** 导出 openNewItemTemplateMenu 供 click 子模块复用。 */
export {openNewItemTemplateMenu};

/** 用途：显示轻量消息提示。使用范围：copy 成功反馈。解耦评估：消息提示属于 UI 基础能力，继续复用即可。 */
import { showMessage } from "../../../../runtime/dialog.port";
/** 导出 showMessage 供 click 子模块复用。 */
export { showMessage };

/** 用途：读取国际化文案。使用范围：copy 成功提示等文本。解耦评估：文案对象继续经环境层转发即可。 */
import { siyuanI18n } from "../../../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供 click 子模块复用。 */
export { siyuanI18n };

/** 用途：提交等待服务端投影的普通 View 切换；使用范围：非历史页签点击；解耦评估：直达严格 View 命令。 */
import {submitAVViewTransaction} from "../../../../wysiwyg/transaction/prepared/av/view/avView";
/** 导出普通 View 严格命令。 */
export {submitAVViewTransaction};

/** 用途：提交分组折叠事务；使用范围：高级 data-type 点击；解耦评估：直达 Groups Prepared 命令，不加载通用事务主图。 */
import {submitAVGroupTransaction} from "../../../../wysiwyg/transaction/prepared/av/group/avGroup";
/** 导出 Groups 严格命令。 */
export {submitAVGroupTransaction};

/** 用途：写入系统剪贴板。使用范围：copy 按钮。解耦评估：剪贴板兼容逻辑应继续复用共享实现。 */
import { writeText } from "../../../../util/compatibility";
/** 导出 writeText 供 click 子模块复用。 */
export { writeText };
