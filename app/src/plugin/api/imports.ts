/**
 * 用途：布局模型类，表示页签容器
 * 使用范围：插件API模块中需要操作页签模型的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import type { Model } from "../../layout/Model";

/**
 * 用途：页签类，表示单个页签实例
 * 使用范围：插件API模块中需要操作页签的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import type { Tab } from "../../layout/Tab";

/**
 * 用途：常量定义，包含编辑器动作常量
 * 使用范围：插件API模块中需要使用系统常量的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import { Constants } from "../../constants";

/**
 * 用途：国际化文本获取函数
 * 使用范围：插件API模块中需要显示多语言文本的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 用途：文件打开工具函数
 * 使用范围：插件API模块中需要打开文件的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import {openFile} from "../../editor/open/openFile";

/**
 * 用途：通过ID打开文件的工具函数
 * 使用范围：插件API模块中需要通过文档ID打开文件的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import { openFileById } from "../../editor/utils.openFileById";

/**
 * 用途：平台检测函数，判断是否为移动端
 * 使用范围：插件API模块中需要根据平台调整行为的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import { isMobile } from "../../util/platform/functions";

/**
 * 用途：网络请求工具函数，用于与后端API通信
 * 使用范围：插件API模块中需要调用后端接口的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import { fetchSyncPost } from "../../util/network/fetch";

/**
 * 用途：文件树管理类，用于操作文件树UI
 * 使用范围：插件API模块中需要操作文件树的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import { Files } from "../../layout/dock/Files";

/**
 * 用途：环境配置访问函数，用于安全访问全局笔记本列表
 * 使用范围：插件API模块中需要访问笔记本配置的场景
 * 解耦评估：通过本地转发减少跨目录依赖
 */
import { getSiyuanNotebooks } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

// 导出应用主类类型

// 导出布局模型类型
export type { Model };

// 导出页签类型
export type { Tab };

// 导出常量定义
export { Constants };

// 导出国际化文本获取函数
export { siyuanI18n };

// 导出文件打开工具函数
export { openFile };

// 导出通过ID打开文件的工具函数
export { openFileById };

// 导出平台检测函数
export { isMobile };

// 导出网络请求工具函数
export { fetchSyncPost };

// 导出文件树管理类
export { Files };

// 导出环境配置访问函数
export { getSiyuanNotebooks };
