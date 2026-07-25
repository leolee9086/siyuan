// 跨目录依赖转发
/** 用途：同步 POST 请求函数。使用范围：inNotePlugin 模块调用后端 API。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "../util/network/fetch";
/** 导出 fetchSyncPost，供 inNotePlugin 模块使用 */
export { fetchSyncPost };

/** 用途：插件基类。使用范围：inNotePlugin 模块创建器。解耦评估：通过 imports.ts 转发。 */
import { Plugin } from "../plugin";
/** 导出 Plugin，供 inNotePlugin 模块使用 */
export { Plugin };

/** 用途：应用实例类型。使用范围：inNotePlugin 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { AppFacade } from "../app/AppFacade.types";
/** 导出 AppFacade 类型，供 inNotePlugin 模块使用 */
export type { AppFacade };

/** 用途：安全模块创建器。使用范围：inNotePlugin 模块执行代码。解耦评估：通过 imports.ts 转发。 */
import { SecureModuleCreator } from "../util/lib/code/executor";
/** 导出 SecureModuleCreator，供 inNotePlugin 模块使用 */
export { SecureModuleCreator };

/** 用途：插件 API 基类。使用范围：inNotePlugin 模块生成 API 模块。解耦评估：通过 imports.ts 转发。 */
import { API } from "../plugin/API";
/** 导出 API，供 inNotePlugin 模块使用 */
export { API };

/** 用途：包名许可管理器。使用范围：inNotePlugin 模块管理外部包权限。解耦评估：通过 imports.ts 转发。 */
import { PackagePermissionManager } from "../util/lib/code/PackagePermissionManager";
/** 导出 PackagePermissionManager，供 inNotePlugin 模块使用 */
export { PackagePermissionManager };
