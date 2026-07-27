// 跨目录依赖转发
/** 用途：Tab 注册中心，用于注册 export-preview 页签类型。使用范围：export-preview 模块注册页签。解耦评估：通过 imports.ts 转发。 */
import { tabRegistry } from "../registry";
/** 导出 tabRegistry，供 export-preview 模块使用 */
export { tabRegistry };

/** 用途：获取所有打开的模型实例。使用范围：export-preview 查找已有页签。解耦评估：通过 imports.ts 转发。 */
import { getAllModels } from "../layout/getAll";
/** 导出 getAllModels，供 export-preview 模块使用 */
export { getAllModels };

/** 用途：编辑器打开文件能力。使用范围：export-preview 创建新页签。解耦评估：通过 imports.ts 转发。 */
import {openFile} from "../editor/open/openFile";
/** 导出 openFile，供 export-preview 模块使用 */
export { openFile };

/** 用途：国际化文本资源。使用范围：export-preview 设置页签标题。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n，供 export-preview 模块使用 */
export { siyuanI18n };

/** 用途：应用实例类型定义。使用范围：export-preview 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { AppFacade } from "../app/AppFacade.types";
/** 导出 AppFacade 类型，供 export-preview 模块使用 */
export type { AppFacade };
