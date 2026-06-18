/**
 * 用途：统一转发card模块所需的外部依赖
 * 使用范围：card模块内所有需要使用这些依赖的文件
 * 解耦评估：作为转发层，已经是解耦的最佳实践
 */

/**
 * 用途：提供HTTP POST请求功能，用于与后端API通信
 * 使用范围：获取文档信息、文档内容等API调用
 * 解耦评估：fetchPost是底层网络请求工具，无法通过依赖注入解耦，必须直接导入
 */
import { fetchPost } from "../ai/imports";

/**
 * 用途：提供应用常量定义
 * 使用范围：使用SIZE_GET_MAX等常量配置API请求参数
 * 解耦评估：Constants是全局常量定义，无法解耦，必须直接导入
 */
import { Constants } from "../constants";

/**
 * 用途：提供protyle文档渲染功能
 * 使用范围：将API返回的文档数据渲染到编辑器中
 * 解耦评估：onGet是protyle核心渲染函数，与编辑器强耦合，无法通过参数传递解耦
 */
import { onGet } from "../protyle/util/onGet";

// 导出网络请求工具
export { fetchPost };

// 导出应用常量
export { Constants };

// 导出文档渲染函数
export { onGet };

/**
 * 用途：平台检测标志，判断是否为移动端
 * 使用范围：card模块根据平台调整UI交互
 * 解耦评估：平台检测属于环境层稳定依赖，通过网关导入可降低路径耦合
 */
import { isMobile } from "../platform";
// 导出平台检测
export { isMobile };
