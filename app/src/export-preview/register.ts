/**
 * 导出预览页签注册
 *
 * 作用：将 export-preview 页签类型注册到 TabRegistry
 * 调用时机：应用初始化时，在模块加载阶段自动执行
 */

import { tabRegistry } from "../registry";
import { initExportPreview } from "./init";
import { EXPORT_PREVIEW_TAB_TYPE } from "./constants";

tabRegistry.register({
    type: EXPORT_PREVIEW_TAB_TYPE,
    init: initExportPreview,
});
