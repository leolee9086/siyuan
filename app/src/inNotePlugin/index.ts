/**
 * 笔记内插件模块入口
 * 导出所有公共 API
 */

// 导出管理器
export { inNotePluginManager } from "./manager";

// 导出类型
export type {
    笔记内插件配置,
    笔记内插件运行状态,
    编译结果
} from "./types";

// 导出编译器函数
export {
    编译文档,
    是插件文档,
    获取文档属性,
    设置为插件文档
} from "./compiler";

// 导出加载器函数
export {
    加载笔记内插件,
    卸载笔记内插件
} from "./loader";

// 导出权限管理器
export { persistentPermissionManager } from "./permissionManager";

// 导出 siyuan API 工具
export { getSiyuanApiUrl, cleanupSiyuanApiUrl } from "./siyuanApi";
