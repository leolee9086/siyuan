// 跨目录依赖转发：undo 模块的上游依赖网关

/** 用途：事务处理核心函数。使用范围：undo 模块 renderLocal 本地乐观应用操作。解耦评估：通过 imports.ts 转发。 */
import { onTransaction } from "../wysiwyg/transaction";
/** 导出 onTransaction 事务函数，供 undo 模块调用 */
export { onTransaction };

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

/** 用途：匹配键盘事件与用户自定义快捷键组合。使用范围：electronUndo 处理器判断快捷键是否匹配。解耦评估：通过 imports.ts 转发。 */
import { matchHotKey } from "../util/hotKey";
/** 导出 matchHotKey，供 undo 模块调用 */
export { matchHotKey };

/** 用途：运行时平台环境判断（是否 Electron）。使用范围：electronUndo 处理器条件守卫。解耦评估：通过 imports.ts 转发。 */
import { isElectron } from "../../platform";
/** 导出 isElectron，供 undo 模块调用 */
export { isElectron };

/** 用途：向 Electron 主进程发送 IPC 消息。使用范围：electronUndo 处理器触发撤销/重做命令。解耦评估：通过 imports.ts 转发。 */
import { ipcSend } from "../../platform/electron/ipcRenderer";
/** 导出 ipcSend，供 undo 模块调用 */
export { ipcSend };

/** 用途：读取用户自定义的编辑器快捷键映射。使用范围：electronUndo 处理器加载快捷键配置。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanEditorGeneralKeymap } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanEditorGeneralKeymap，供 undo 模块调用 */
export { getSiyuanEditorGeneralKeymap };

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
import { getActiveTab } from "../../layout/tabUtil";
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
