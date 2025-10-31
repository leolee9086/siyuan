/**
 * AI模块的跨文件夹导入统一管理文件
 * 根据ts文件规则，所有跨文件夹的导入都应该通过此文件进行
 */

// 常量导入
export { Constants } from "../constants";

// 对话框相关导入
export { Dialog } from "../dialog";

// Vue工具相关导入
export type { VueComponentMountConfig } from "../util/vue/mount";
export { createVueDialog } from "../util/dialog/createVueDialog";

// 组件导入
export { default as AiCustomDialog } from "../components/aiCustomDialog.panel.vue";
export { default as AiEditDialog } from "../components/aiEditDialog.vue";

// 数据存储相关导入
export { saveCustomAIAction } from "../data/localStorage";
export { localKernel } from "../data/kernelAPI/defaultClient";

// 存储工具相关导入
export { setStorageVal } from "../protyle/util/compatibility";

// 渲染相关导入
export { blockRender } from "../protyle/render/blockRender";
export { highlightRender } from "../protyle/render/highlightRender";
export { insertHTML } from "../protyle/util/insertHTML";
export { processRender } from "../protyle/util/processCode";
export { setLastNodeRange } from "../protyle/util/selection";
export { getContenteditableElement } from "../protyle/wysiwyg/getBlock";

// DOM工具相关导入
export { switchFnNoneByFlag } from "../util/DOM/fnClasses";
export { createBlockMasks } from "../util/DOM/blockDecorations";

// 工具函数相关导入
export { isMobile } from "../util/functions";
export { genUUID } from "../util/genID";
export { genRandomColor } from "../util/color";

// 组件相关导入
export { default as AIChatDialog } from "../components/StreamChat.panel.vue";
export { handleAIRequest } from "../components/streamChat.componentLogic";

// 业务逻辑相关导入
///#if !MOBILE
export { selectRecentDoc } from "../business/selectRecentDoc";
///#endif

// 对话框相关导入
export { showMessage } from "../dialog/message";

// 插件相关导入
export { Menu } from "../plugin/Menu";

// 网络请求相关导入
export { fetchPost } from "../util/fetch";

// 编辑器工具相关导入
export { focusByRange } from "../protyle/util/selection";
export { escapeAriaLabel, escapeAttr, escapeHtml } from "../util/escape";
export { upDownHint } from "../util/upDownHint";
export { getElementsBlockId } from "../util/DOM/blockLikeElements";