/**
 * 用途：从 constants 模块转发全局常量，用于网络模块中的 IPC 通信和配置
 * 使用范围：仅在 fetch.ts 中使用，用于 Electron IPC 退出消息的常量标识
 * 解耦评估：全局常量是基础设施配置，无法通过依赖注入替代；当前转发方式符合项目导入规范
 */
import { Constants } from "../../constants";
/**
 * 用途：从 platform/electron 模块转发 IPC 发送工具，用于与 Electron 主进程通信
 * 使用范围：仅在 fetch.ts 的错误处理流程中使用，用于在系统退出或工作空间切换时通知主进程
 * 解耦评估：IPC 通信是 Electron 环境的基础设施能力，无法通过依赖注入替代；当前转发方式符合项目导入规范
 */
import { ipcSend } from "../../platform/electron/ipcRenderer";
/**
 * 用途：从 platform 模块转发平台判断工具，用于网络模块中的环境检测
 * 使用范围：在 fetch.ts 中使用，用于判断是否在 Electron 环境执行特定逻辑（如 IPC 通信）
 * 解耦评估：平台判断是基础设施能力，无法通过依赖注入替代；当前转发方式符合项目导入规范，避免跨层级直接依赖
 */
import { isElectron } from "../../platform";
/**
 * 用途：从 platform 模块转发平台判断工具，用于网络模块中的环境检测
 * 使用范围：仅在 util/network 目录下的模块中使用，用于判断是否在浏览器环境执行网络相关逻辑（如 Service Worker 注册）
 * 解耦评估：平台判断是基础设施能力，无法通过依赖注入替代；当前转发方式符合项目导入规范，避免跨层级直接依赖
 */
import { isBrowser } from "../../platform";
/**
 * 用途：从 dialog 模块转发内核错误处理工具，用于网络请求失败时的错误处理
 * 使用范围：仅在 fetch.ts 的事务 API 错误处理流程中使用，用于在内核通信失败时触发重连或重启确认
 * 解耦评估：错误对话框是 UI 基础设施，无法通过依赖注入替代；当前转发方式符合项目导入规范
 */
import { kernelError } from "../../dialog/processSystem";
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
/**
 * 用途：从 siyuanEnvironments 模块转发请求 ID 管理工具，用于网络请求的竞态控制
 * 使用范围：仅在 fetch.ts 中使用，用于高频搜索/图谱请求的竞态检查，确保后发先至的响应不会覆盖最新请求
 * 解耦评估：请求 ID 管理是全局状态管理，无法通过依赖注入替代；当前转发方式符合项目导入规范
 */
import { getSiyuanReqId } from "../siyuanEnvironments/getSiyuanConfig.environment";
/**
 * 用途：从 siyuanEnvironments 模块转发请求 ID 设置工具，用于网络请求的竞态控制
 * 使用范围：仅在 fetch.ts 中使用，用于在发送高频请求时记录时间戳，供后续竞态检查使用
 * 解耦评估：请求 ID 管理是全局状态管理，无法通过依赖注入替代；当前转发方式符合项目导入规范
 */
import { setSiyuanReqId } from "../siyuanEnvironments/getSiyuanConfig.environment";
/**
 * 用途：从 windowLocation.environment 转发页面重载工具，用于认证失效时的页面刷新
 * 使用范围：仅在 fetch.ts 的 401 错误处理流程中使用，用于在认证失效时重新加载页面
 * 解耦评估：页面重载是浏览器基础设施能力，无法通过依赖注入替代；当前转发方式符合项目导入规范
 */
import { reloadLocation } from "../siyuanEnvironments/windowLocation.environment";

/**
 * 转发 Constants 常量对象
 */
export { Constants };
/**
 * 转发 ipcSend IPC 通信工具
 */
export { ipcSend };
/**
 * 转发 isElectron 平台判断工具
 */
export { isElectron };
/**
 * 转发 isBrowser 平台判断工具
 */
export { isBrowser };
/**
 * 转发 kernelError 内核错误处理工具
 */
export { kernelError };
/**
 * 转发 isServiceWorkerAvailable Service Worker 可用性检测工具
 */
export { isServiceWorkerAvailable };
/**
 * 转发 getServiceWorkerContainer Service Worker 容器获取工具
 */
export { getServiceWorkerContainer };
/**
 * 转发 getWindowWebkit WebKit 环境检测工具
 */
export { getWindowWebkit };
/**
 * 转发 getWindowJSAndroid Android 环境检测工具
 */
export { getWindowJSAndroid };
/**
 * 转发 getWindowJSHarmony Harmony 环境检测工具
 */
export { getWindowJSHarmony };
/**
 * 转发 confirmDialog 确认对话框工具
 */
export { confirmDialog };
/**
 * 转发 getSiyuanWebSocket WebSocket 连接获取工具
 */
export { getSiyuanWebSocket };
/**
 * 转发 getSiyuanReqId 请求 ID 获取工具
 */
export { getSiyuanReqId };
/**
 * 转发 setSiyuanReqId 请求 ID 设置工具
 */
export { setSiyuanReqId };
/**
 * 转发 reloadLocation 页面重载工具
 */
export { reloadLocation };
