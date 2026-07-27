/**
 * 笔记内插件模块入口
 * 导出所有公共 API
 */

/** 用途：笔记内插件配置类型。使用范围：外部模块类型约束。解耦评估：同目录类型文件。 */
import type { 笔记内插件配置 } from "./types";
/** 用途：笔记内插件运行状态类型。使用范围：外部模块状态管理。解耦评估：同目录类型文件。 */
import type { 笔记内插件运行状态 } from "./types";
/** 用途：编译结果类型。使用范围：外部模块编译 API。解耦评估：同目录类型文件。 */
import type { 编译结果 } from "./types";
/** 用途：文档编译函数。使用范围：外部模块编译插件。解耦评估：同目录模块。 */
import { 编译文档 } from "./compiler";
/** 用途：插件文档检测函数。使用范围：外部模块判断文档类型。解耦评估：同目录模块。 */
import { 是插件文档 } from "./compiler";
/** 用途：文档属性读取函数。使用范围：外部模块获取文档元数据。解耦评估：同目录模块。 */
import { 获取文档属性 } from "./compiler";
/** 用途：文档标记函数。使用范围：外部模块标记插件文档。解耦评估：同目录模块。 */
import { 设置为插件文档 } from "./compiler";
/** 用途：插件加载函数。使用范围：外部模块加载笔记内插件。解耦评估：同目录模块。 */
import { 加载笔记内插件 } from "./loader";
/** 用途：插件卸载函数。使用范围：外部模块卸载笔记内插件。解耦评估：同目录模块。 */
import { 卸载笔记内插件 } from "./loader";
/** 用途：权限管理器实例。使用范围：外部模块管理插件权限。解耦评估：同目录模块。 */
import { persistentPermissionManager } from "./permissionManager";
/** 用途：获取 siyuan API URL。使用范围：外部模块获取 API 模块。解耦评估：同目录模块。 */
import { getSiyuanApiUrl } from "./siyuanApi";
/** 用途：清理 siyuan API URL。使用范围：外部模块清理 API 模块。解耦评估：同目录模块。 */
import { cleanupSiyuanApiUrl } from "./siyuanApi";

/** 导出插件类型定义 */
export type { 笔记内插件配置, 笔记内插件运行状态, 编译结果 };
/** 导出编译器函数 */
export { 编译文档, 是插件文档, 获取文档属性, 设置为插件文档 };
/** 导出加载器函数 */
export { 加载笔记内插件, 卸载笔记内插件 };
/** 导出权限管理器 */
export { persistentPermissionManager };
/** 导出 siyuan API 工具 */
export { getSiyuanApiUrl, cleanupSiyuanApiUrl };
