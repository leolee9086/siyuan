/**
 * 导出预览页签注册
 *
 * 作用：将 export-preview 页签类型注册到 TabRegistry
 * 调用时机：应用初始化时，在模块加载阶段自动执行
 */

/** 用途：Tab 注册中心。使用范围：export-preview 模块注册页签类型。解耦评估：通过 imports.ts 转发。 */
import { tabRegistry } from "./imports";
/** 用途：导出预览初始化函数。使用范围：register.ts 注册初始化回调。解耦评估：同目录模块依赖，直接同层导入。 */
import { initExportPreview } from "./init";
/** 用途：导出预览页签类型常量。使用范围：register.ts 指定注册类型。解耦评估：同目录常量，直接同层导入。 */
import { EXPORT_PREVIEW_TAB_TYPE } from "./constants";

tabRegistry.register({
    type: EXPORT_PREVIEW_TAB_TYPE,
    init: initExportPreview,
});
