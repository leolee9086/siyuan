/** 用途：DOM 元素类型守卫。使用范围：config 模块 DOM 操作。解耦评估：通过 imports.ts 转发。 */
import { isHTMLElement, isHTMLInputElement, isInputEvent } from "../util/DOM/element.guard";
/** 导出 isHTMLElement，供 config 模块使用 */
export { isHTMLElement };
/** 导出 isHTMLInputElement，供 config 模块使用 */
export { isHTMLInputElement };
/** 导出 isInputEvent，供 config 模块使用 */
export { isInputEvent };

/** 用途：HTTP POST 请求封装。使用范围：config 模块 kernel API 通信。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "../util/network/fetch";
/** 导出 fetchSyncPost，供 config 模块使用 */
export { fetchSyncPost };
/** 用途：HTTP POST 请求封装（原始响应）。使用范围：config 模块文件读取。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPostRaw } from "../util/network/fetch";
/** 导出 fetchSyncPostRaw，供 config 模块使用 */
export { fetchSyncPostRaw };
/** 用途：UUID 生成。使用范围：config 模块创建 Profile ID。解耦评估：通过 imports.ts 转发。 */
import { genUUID } from "../util/platform/genID";
/** 导出 genUUID，供 config 模块使用 */
export { genUUID };

/** 用途：移动端菜单弹出。使用范围：设置页面入口。解耦评估：通过 imports.ts 转发。 */
import { popMenu } from "../mobile/menu";
/** 导出 popMenu，供 config 模块使用 */
export { popMenu };

/** 用途：移动端判断。使用范围：config 模块各功能适配。解耦评估：通过 imports.ts 转发。 */
import { isMobile } from "../platform";
/** 导出 isMobile，供 config 模块使用 */
export { isMobile };

/** 用途：对话框组件。使用范围：config 模块弹窗操作。解耦评估：通过 imports.ts 转发。 */
import { Dialog } from "../dialog";
/** 导出 Dialog，供 config 模块使用 */
export { Dialog };

/** 用途：系统常量。使用范围：config 模块常量引用。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../constants";
/** 导出 Constants，供 config 模块使用 */
export { Constants };

/** 用途：选区焦点恢复。使用范围：设置对话框关闭后恢复焦点。解耦评估：通过 imports.ts 转发。 */
import { focusByRange } from "../protyle/util/selection";
/** 导出 focusByRange，供 config 模块使用 */
export { focusByRange };

/** 用途：Vue 应用工厂。使用范围：config 模块内部 Vue 组件挂载。解耦评估：第三方依赖，通过 imports.ts 转发。 */
import { createApp } from "vue";
/** 导出 createApp，供 config 模块使用 */
export { createApp };

/** 用途：Tab 注册器。使用范围：文件树配置 Tab 延迟注册。解耦评估：通过 imports.ts 转发。 */
import { tabRegistry } from "../registry";
/** 导出 tabRegistry，供 config 模块使用 */
export { tabRegistry };

/** 用途：Vue 组件（文件树配置面板）。使用范围：设置对话框 Tab 挂载。解耦评估：Vue SFC，通过 imports.ts 转发。 */
import fileTreeConfigPanel from "../components/panels/fileTreeConfig.panel.vue";
/** 导出 fileTreeConfigPanel，供 config 模块使用 */
export { fileTreeConfigPanel };
