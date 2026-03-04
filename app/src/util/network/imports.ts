/**
 * 用途：从 platform 模块转发平台判断工具，用于网络模块中的环境检测
 * 使用范围：仅在 util/network 目录下的模块中使用，用于判断是否在浏览器环境执行网络相关逻辑（如 Service Worker 注册）
 * 解耦评估：平台判断是基础设施能力，无法通过依赖注入替代；当前转发方式符合项目导入规范，避免跨层级直接依赖
 */
import { isBrowser } from "../../platform";
/**
 * 用途：从 windowStandard.environment 转发标准浏览器环境的 Service Worker 相关 API 访问器
 * 使用范围：仅在 Service Worker 注册流程中使用，用于检测和获取 Service Worker 容器
 * 解耦评估：无法通过依赖注入或参数传递替代，这些是浏览器标准 API 的封装访问器，必须直接导入
 */
import { isServiceWorkerAvailable, getServiceWorkerContainer } from "../siyuanEnvironments/windowStandard.environment";
/**
 * 用途：从 windowNative.environment 转发原生客户端环境检测工具
 * 使用范围：仅在 Service Worker 注册流程中使用，用于判断是否在原生客户端环境（WebKit/Android/Harmony）中运行
 * 解耦评估：无法通过依赖注入或参数传递替代，这些是原生环境检测的封装访问器，必须直接导入
 */
import { getWindowWebkit, getWindowJSAndroid, getWindowJSHarmony } from "../siyuanEnvironments/windowNative.environment";
/**
 * 用途：从 dialog 模块转发确认对话框工具，用于 CronJob 鉴权时显示用户确认界面
 * 使用范围：仅在 processMessage.ts 的 CronJob 鉴权依赖注入适配层中使用
 * 解耦评估：无法通过依赖注入或参数传递替代，对话框是 UI 基础设施，必须直接导入
 */
import { confirmDialog } from "../../dialog/confirmDialog";
/**
 * 用途：从 siyuanEnvironments 模块转发 WebSocket 连接获取器，用于向内核发送鉴权响应
 * 使用范围：仅在 processMessage.ts 的 CronJob 鉴权依赖注入适配层中使用
 * 解耦评估：无法通过依赖注入或参数传递替代，WebSocket 连接是全局单例资源，必须直接导入
 */
import { getSiyuanWebSocket } from "../siyuanEnvironments/getSiyuanConfig.environment";

export {
    isBrowser,
    isServiceWorkerAvailable,
    getServiceWorkerContainer,
    getWindowWebkit,
    getWindowJSAndroid,
    getWindowJSHarmony,
    confirmDialog,
    getSiyuanWebSocket
};
