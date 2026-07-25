// 跨目录依赖转发
/** 用途：应用常量定义。使用范围：editor 模块使用常量配置。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../constants";
/** 导出 Constants，供 editor 模块使用 */
export { Constants };

/** 用途：获取所有已打开的页签。使用范围：editor 模块查找未初始化页签。解耦评估：通过 imports.ts 转发。 */
import { getAllTabs } from "../layout/getAll";
/** 导出 getAllTabs，供 editor 模块使用 */
export { getAllTabs };

/** 用途：对象相等性比较工具。使用范围：editor 模块比较配置对象。解耦评估：通过 imports.ts 转发。 */
import { objEquals } from "../util/platform/functions";
/** 导出 objEquals，供 editor 模块使用 */
export { objEquals };

/** 用途：页签类型定义。使用范围：editor 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type {LayoutTab} from "../layout/layout.types";
/** 导出完整布局页签领域根，供 editor 模块使用。 */
export type {LayoutTab};

/** 用途：布局容器与窗口完整领域根。使用范围：editor 打开文件时遍历布局树。解耦评估：不依赖具体 class。 */
import type {LayoutDomain, LayoutWindow} from "../layout/layout.types";
/** 导出完整布局容器与窗口领域根。 */
export type {LayoutDomain, LayoutWindow};

/** 用途：布局页签结构守卫。使用范围：editor 从布局实例表收窄页签。解耦评估：守卫只依赖完整领域根。 */
import {isLayoutDomain, isLayoutTab, isLayoutWindow} from "../layout/layout.types.guard";
/** 导出布局领域结构守卫。 */
export {isLayoutDomain, isLayoutTab, isLayoutWindow};

/** 用途：应用实例类型。使用范围：editor 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { AppFacade } from "../app/AppFacade.types";
/** 导出 AppFacade 类型，供 editor 模块使用 */
export type { AppFacade };

/** 用途：路径处理工具。使用范围：editor 模块处理文件路径。解耦评估：通过 imports.ts 转发。 */
import { pathPosix } from "../util/file/pathName";
/** 导出 pathPosix，供 editor 模块使用 */
export { pathPosix };

/** 用途：按实例 ID 获取页签实例。使用范围：editor 模块查找编辑器页签。解耦评估：通过 imports.ts 转发。 */
import { getInstanceById } from "../layout/util";
/** 导出 getInstanceById，供 editor 模块使用 */
export { getInstanceById };

/** 用途：Protyle 编辑器类。使用范围：editor 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import { Protyle } from "../protyle";
/** 导出 Protyle，供 editor 模块使用 */
export { Protyle };

/** 用途：大纲模型完整领域根。使用范围：editor 更新大纲面板。解耦评估：不加载 Outline class。 */
import type {OutlineDomain} from "../layout/dock/outline/types";
/** 导出大纲模型完整领域根。 */
export type {OutlineDomain};

/** 用途：DOM 属性查找工具。使用范围：editor 高亮当前大纲项。解耦评估：通过 imports.ts 转发。 */
import { hasClosestByAttribute } from "../protyle/util/hasClosest";
/** 导出 hasClosestByAttribute，供 editor 模块使用 */
export { hasClosestByAttribute };

/** 用途：网络请求工具（POST）。使用范围：editor 获取大纲数据。解耦评估：通过 imports.ts 转发。 */
import { fetchPost } from "../util/network/fetch";
/** 导出 fetchPost，供 editor 模块使用 */
export { fetchPost };

/** 用途：获取所有模型（编辑器/搜索/自定义等）。使用范围：editor 查找并切换页签。解耦评估：通过 imports.ts 转发。 */
import { getAllModels } from "../layout/getAll";
/** 导出 getAllModels，供 editor 模块使用 */
export { getAllModels };

/** 用途：检查 PDF 是否正在加载。使用范围：editor 切换页签前检查加载状态。解耦评估：通过 imports.ts 转发。 */
import { pdfIsLoading } from "../layout/util";
/** 导出 pdfIsLoading，供 editor 模块使用 */
export { pdfIsLoading };

/** 用途：清除对象块图标边框。使用范围：editor 打开文件时清除 OBG。解耦评估：通过 imports.ts 转发。 */
import {clearObjectBlockGraphs} from "../layout/dock/obg/clearObjectBlockGraphs";
/** 导出对象块图面板唯一重置实现，供 editor 传入已查询的完整模型集合。 */
export {clearObjectBlockGraphs};

/** 用途：显示提示消息。使用范围：editor 打开文件时显示错误信息。解耦评估：通过 imports.ts 转发。 */
import { showMessage } from "../dialog/message";
/** 导出 showMessage，供 editor 模块使用 */
export { showMessage };

/** 用途：同步 POST 请求工具。使用范围：editor 获取块信息。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "../util/network/fetch";
/** 导出 fetchSyncPost，供 editor 模块使用 */
export { fetchSyncPost };

/** 用途：通过类名查找最近的祖先元素。使用范围：editor 判断编辑器激活状态。解耦评估：通过 imports.ts 转发。 */
import { hasClosestByClassName } from "../protyle/util/hasClosest";
/** 导出 hasClosestByClassName，供 editor 模块使用 */
export { hasClosestByClassName };


/** 用途：调用系统 Shell 打开路径。使用范围：editor 在 Electron 中打开文件/文件夹。解耦评估：通过 imports.ts 转发。 */
import { useShell } from "../util/file/pathName";
/** 导出 useShell，供 editor 模块使用 */
export { useShell };

/** 用途：判断是否为 Electron 运行环境。使用范围：editor 仅在桌面端执行文件打开操作。解耦评估：通过 imports.ts 转发。 */
import { isElectron } from "../platform";
/** 导出 isElectron，供 editor 模块使用 */
export { isElectron };

/** 用途：安全获取 SiYuan 全局配置。使用范围：editor 读取系统平台配置。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig，供 editor 模块使用 */
export { getSiyuanConfig };

/** 用途：安全获取 window 全局对象。使用范围：editor 访问 window.siyuan 属性。解耦评估：通过 imports.ts 转发。 */
import { getWindow } from "../util/siyuanEnvironments/getWindow.environment";
/** 导出 getWindow，供 editor 模块使用 */
export { getWindow };

/** 用途：确认对话框。使用范围：editor 删除文件前用户确认。解耦评估：通过 imports.ts 转发。 */
import { confirmDialog } from "../dialog/confirmDialog";
/** 导出 confirmDialog，供 editor 模块使用 */
export { confirmDialog };

/** 用途：HTML 转义工具。使用范围：editor 安全显示文件名。解耦评估：通过 imports.ts 转发。 */
import { escapeHtml } from "../util/DOM/escape";
/** 导出 escapeHtml，供 editor 模块使用 */
export { escapeHtml };

/** 用途：DOM 标签查找工具。使用范围：editor 获取列表父元素属性。解耦评估：通过 imports.ts 转发。 */
import { hasTopClosestByTag } from "../protyle/util/hasClosest";
/** 导出 hasTopClosestByTag，供 editor 模块使用 */
export { hasTopClosestByTag };

/** 用途：获取显示名称和笔记本名称。使用范围：editor 文件操作路径显示。解耦评估：通过 imports.ts 转发。 */
import { getDisplayName, getNotebookName } from "../util/file/pathName";
/** 导出 getDisplayName，供 editor 模块使用 */
export { getDisplayName };
/** 导出 getNotebookName，供 editor 模块使用 */
export { getNotebookName };
/** 用途：判断笔记本是否加密。使用范围：编辑器文档查询需选择普通或 InBox 数据源。解耦评估：当前唯一实现仍位于兼容路径，先由 editor 网关转发，避免复制实现。 */
import { isEncryptedBox } from "../util/pathName";
/** 导出加密笔记本判断，供 editor 模块使用 */
export { isEncryptedBox };

/** 用途：获取资产名称。使用范围：editor 重命名资产时显示旧名称。解耦评估：通过 imports.ts 转发。 */
import { getAssetName } from "../util/file/pathName";
/** 导出 getAssetName，供 editor 模块使用 */
export { getAssetName };

/** 用途：设置笔记本名称缓存。使用范围：editor 重命名笔记本后更新。解耦评估：通过 imports.ts 转发。 */
import { setNotebookName } from "../util/file/pathName";
/** 导出 setNotebookName，供 editor 模块使用 */
export { setNotebookName };

/** 用途：对话框类。使用范围：editor 重命名/确认对话框。解耦评估：通过 imports.ts 转发。 */
import { Dialog } from "../dialog";
/** 导出 Dialog，供 editor 模块使用 */
export { Dialog };

/** 用途：提示工具提示。使用范围：editor 文件名验证失败时提示。解耦评估：通过 imports.ts 转发。 */
import { showTooltip } from "../dialog/tooltip";
/** 导出 showTooltip，供 editor 模块使用 */
export { showTooltip };

/** 用途：获取所有编辑器实例。使用范围：editor 重命名后刷新编辑器。解耦评估：通过 imports.ts 转发。 */
import { getAllEditor } from "../layout/getAll";
/** 导出 getAllEditor，供 editor 模块使用 */
export { getAllEditor };

/** 用途：设置 Protyle 编辑器内边距。使用范围：全屏切换时重算布局。解耦评估：通过 imports.ts 转发。 */
import { setPadding } from "../protyle/ui/initUI";
/** 导出 setPadding，供 editor 模块使用 */
export { setPadding };

/** 用途：Protyle 全屏切换。使用范围：编辑器初始化时进入全屏模式。解耦评估：通过 imports.ts 转发。 */
import { fullscreen } from "../protyle/breadcrumb/action";
/** 导出 fullscreen，供 editor 模块使用 */
export { fullscreen };

/** 用途：布局模型基类。使用范围：Editor 委托 Model 管理生命周期。解耦评估：通过 imports.ts 转发。 */
import { Model } from "../layout/Model";
/** 导出 Model，供 editor 模块使用 */
export { Model };


/** 用途：Electron IPC 调用。使用范围：editor 在 Electron 中打开文件。解耦评估：通过 imports.ts 转发。 */
import { ipcInvoke } from "../platform/electron/ipcRenderer";
/** 导出 ipcInvoke，供 editor 模块使用 */
export { ipcInvoke };


/** 用途：创建新页签。使用范围：editor 打开文件时创建新页签。解耦评估：通过 imports.ts 转发。 */
import { newTab } from "../layout/utils/newTab";
/** 导出 newTab，供 editor 模块使用 */
export { newTab };

/** 用途：通过布局获取窗口实例。使用范围：editor 页签操作。解耦评估：通过 imports.ts 转发。 */
import { getWndByLayout } from "../layout/util";
/** 导出 getWndByLayout，供 editor 模块使用 */
export { getWndByLayout };

/** 用途：安全获取 SiYuan 配置和布局。使用范围：editor 读取配置。解耦评估：通过 imports.ts 转发。 */
import { getSafeSiyuanConfig, getSafeSiyuanLayout } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSafeSiyuanConfig，供 editor 模块使用 */
export { getSafeSiyuanConfig };
/** 导出 getSafeSiyuanLayout，供 editor 模块使用 */
export { getSafeSiyuanLayout };

/** 用途：编辑器菜单缩放。使用范围：editor 切换编辑器时放大块。解耦评估：通过 imports.ts 转发。 */
import { zoomOut } from "../menus/protyleMenus/editorMenu/protyle.zoomOut";
/** 导出 zoomOut，供 editor 模块使用 */
export { zoomOut };

/** 用途：阻止编辑器滚动。使用范围：editor 定位内容时防止滚动偏移。解耦评估：通过 imports.ts 转发。 */
import { preventScroll } from "../protyle/scroll/preventScroll";
/** 导出 preventScroll，供 editor 模块使用 */
export { preventScroll };

/** 用途：嵌入块判断和最近块查找。使用范围：editor 查找定位目标元素。解耦评估：通过 imports.ts 转发。 */
import { isInEmbedBlock, hasClosestBlock } from "../protyle/util/hasClosest";
/** 导出 isInEmbedBlock，供 editor 模块使用 */
export { isInEmbedBlock };
/** 导出 hasClosestBlock，供 editor 模块使用 */
export { hasClosestBlock };

/** 用途：编辑器内容加载后处理。使用范围：editor 动态加载块内容。解耦评估：通过 imports.ts 转发。 */
import { onGet } from "../protyle/util/onGet";
/** 导出 onGet，供 editor 模块使用 */
export { onGet };

/** 用途：代码高亮和滚动居中。使用范围：editor 定位到指定块。解耦评估：通过 imports.ts 转发。 */
import { highlightById, scrollCenter } from "../util/DOM/highlightById";
/** 导出 highlightById，供 editor 模块使用 */
export { highlightById };
/** 导出 scrollCenter，供 editor 模块使用 */
export { scrollCenter };

/** 用途：统计字数。使用范围：editor 聚焦时更新字数。解耦评估：通过 imports.ts 转发。 */
import { countBlockWord } from "../protyle/runtime/status.port";
/** 导出 countBlockWord，供 editor 模块使用 */
export { countBlockWord };

/** 用途：获取 SiYuan 国际化文案。使用范围：editor 对话框文案。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanLanguages } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanLanguages，供 editor 模块使用 */
export { getSiyuanLanguages };

/** 用途：移动端平台判断。使用范围：editor 区分移动端/桌面端。解耦评估：通过 imports.ts 转发。 */
import { isMobile } from "../platform";
/** 导出 isMobile，供 editor 模块使用 */
export { isMobile };

/** 用途：Electron Shell 外部打开。使用范围：editor 桌面端打开外部链接。解耦评估：通过 imports.ts 转发。 */
import { openExternal } from "../platform/electron/shell";
/** 导出 openExternal，供 editor 模块使用 */
export { openExternal };

/** 用途：Electron IPC 发送。使用范围：editor 发送窗口前置命令。解耦评估：通过 imports.ts 转发。 */
import { ipcSend } from "../platform/electron/ipcRenderer";
/** 导出 ipcSend，供 editor 模块使用 */
export { ipcSend };

/** 用途：检查折叠状态。使用范围：editor 打开链接时检查。解耦评估：通过 imports.ts 转发。 */
import { checkFold } from "../util/platform/noRelyPCFunction";
/** 导出 checkFold，供 editor 模块使用 */
export { checkFold };

/** 用途：移动端通过 ID 打开文件。使用范围：editor 移动端打开块链接。解耦评估：通过 imports.ts 转发。 */
import { openMobileFileById } from "../mobile/editor";
/** 导出 openMobileFileById，供 editor 模块使用 */
export { openMobileFileById };

/** 用途：SiYuan 协议解析。使用范围：editor 处理 siyuan:// 链接。解耦评估：通过 imports.ts 转发。 */
import { getIdFromSYProtocol, isLocalPath, isSYProtocol } from "../util/file/pathName";
/** 用途：SiYuan URI 协议解析。使用范围：editor 处理 siyuan:// 与 web+siyuan:// 链接。解耦评估：通过 imports.ts 转发。 */
import { isSiYuanUriProtocol, parseSiYuanUriInfo } from "../util/pathName";
/** 导出 getIdFromSYProtocol，供 editor 模块使用 */
export { getIdFromSYProtocol };
/** 导出 isLocalPath，供 editor 模块使用 */
export { isLocalPath };
/** 导出 isSYProtocol，供 editor 模块使用 */
export { isSYProtocol };
/** 导出 isSiYuanUriProtocol，供 editor 模块使用 */
export { isSiYuanUriProtocol };
/** 导出 parseSiYuanUriInfo，供 editor 模块使用 */
export { parseSiYuanUriInfo };

/** 用途：URL 查询参数提取。使用范围：editor 从链接提取参数。解耦评估：通过 imports.ts 转发。 */
import { getSearch } from "../util/platform/functions";
/** 导出 getSearch，供 editor 模块使用 */
export { getSearch };

/** 用途：嵌入块移除。使用范围：editor 新文件内容提取。解耦评估：通过 imports.ts 转发。 */
import { removeEmbed } from "../protyle/wysiwyg/removeEmbed";
/** 导出 removeEmbed，供 editor 模块使用 */
export { removeEmbed };

/** 用途：文件树模型完整领域根。使用范围：更新文件树选中状态。解耦评估：不加载 Files class。 */
import type {FilesDomain} from "../layout/dock/Files/eventHandlers.types";
/** 导出文件树模型完整领域根。 */
export type {FilesDomain};
/** 用途：文件树领域守卫。使用范围：收窄 Dock 模型查询结果。解耦评估：不加载 Files class。 */
import {isFilesDomain} from "../layout/dock/Files/eventHandlers.guard";
/** 导出文件树领域守卫。 */
export {isFilesDomain};

/** 用途：反链模型完整领域根。使用范围：editor 同步反链面板状态。解耦评估：不加载 Backlink class。 */
import type {BacklinkDomain} from "../layout/dock/backlink/backlink.types";
/** 导出反链模型完整领域根。 */
export type {BacklinkDomain};

/** 用途：关系图模型完整领域根。使用范围：editor 同步关系图状态。解耦评估：不加载 Graph class。 */
import type {GraphDomain} from "../layout/dock/graph/graph.types";
/** 导出关系图模型完整领域根。 */
export type {GraphDomain};

/** 用途：前链模型完整领域根。使用范围：editor 同步前链面板状态。解耦评估：不加载 Forwardlink class。 */
import type {ForwardlinkDomain} from "../layout/dock/forwardlink/Forwardlink.types";
/** 导出前链模型完整领域根。 */
export type {ForwardlinkDomain};

/** 用途：统计选中字数。使用范围：编辑器聚焦时更新统计。解耦评估：通过 imports.ts 转发。 */
import { countSelectWord } from "../protyle/runtime/status.port";
/** 导出 countSelectWord，供 editor 模块使用 */
export { countSelectWord };

/** 用途：按类型获取 Dock 实例。使用范围：获取文件树实例。解耦评估：通过 imports.ts 转发。 */
import { getDockByType } from "../layout/tabUtil";
/** 导出 getDockByType，供 editor 模块使用 */
export { getDockByType };

/** 用途：编辑器大小重绘。使用范围：面板展开/收起时重绘。解耦评估：通过 imports.ts 转发。 */
import { resize } from "../protyle/util/resize";
/** 导出 resize，供 editor 模块使用 */
export { resize };

/** 用途：按选区范围聚焦编辑器。使用范围：还原编辑器焦点。解耦评估：通过 imports.ts 转发。 */
import { focusByRange } from "../protyle/util/selection.focus";
/** 导出 focusByRange，供 editor 模块使用 */
export { focusByRange };

/** 用途：聚焦到指定块元素。使用范围：无选区时聚焦第一个块。解耦评估：通过 imports.ts 转发。 */
import { focusBlock } from "../protyle/util/selection.focus";
/** 导出 focusBlock，供 editor 模块使用 */
export { focusBlock };

/** 用途：后退栈记录。使用范围：记录编辑器状态到后退栈。解耦评估：通过 imports.ts 转发。 */
import { pushBack } from "../util/platform/backForward";
/** 导出 pushBack，供 editor 模块使用 */
export { pushBack };
