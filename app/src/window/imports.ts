/**
 * 用途：转发父目录导入，避免直接使用 ../ 导入
 * 使用范围：window 目录下所有需要引用父目录模块的文件
 * 解耦评估：集中管理外部依赖，便于追踪和重构
 */

/**
 * 用途：提供应用主类型定义，用于窗口关闭等生命周期操作
 * 使用范围：closeWin.ts 等需要操作 App 实例的模块
 * 解耦评估：App 是核心依赖，当前无法解耦
 */
import type { App } from "../index";

/**
 * 用途：提供全局常量定义，用于 IPC 通信等场景
 * 使用范围：closeWin.ts 等需要使用常量的模块
 * 解耦评估：Constants 是全局常量集合，当前无法解耦
 */
import { Constants } from "../constants";

/**
 * 用途：提供 IPC 通信函数，用于向 Electron 主进程发送消息
 * 使用范围：closeWin.ts 等需要与主进程通信的模块
 * 解耦评估：依赖 Electron 平台特定实现，桌面端无法解耦
 */
import { ipcSend } from "../platform/electron/ipcRenderer";

/**
 * 用途：提供布局实例查找功能，用于根据ID获取标签页等布局元素
 * 使用范围：onWindowsMsg.ts 等需要操作标签页的模块
 * 解耦评估：依赖布局系统核心功能，当前无法解耦
 */
import { getInstanceById } from "../layout/util";

/**
 * 用途：提供标签页类型定义，用于标签页操作和类型检查
 * 使用范围：onWindowsMsg.ts 等需要操作标签页的模块
 * 解耦评估：Tab 是布局系统核心类型，当前无法解耦
 */
import { Tab } from "../layout/Tab";

/**
 * 用途：提供平台检测功能，用于判断是否在窗口环境中运行
 * 使用范围：onWindowsMsg.ts 等需要平台特定逻辑的模块
 * 解耦评估：依赖平台检测工具函数，当前无法解耦
 */
import { isWindow } from "../util/platform/functions";

/**
 * 用途：提供思源配置访问功能，用于读取系统配置
 * 使用范围：onWindowsMsg.ts 等需要访问配置的模块
 * 解耦评估：依赖环境配置系统，当前无法解耦
 */
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 用途：提供锁屏功能，用于系统安全控制
 * 使用范围：onWindowsMsg.ts 等需要锁屏功能的模块
 * 解耦评估：依赖对话框系统，当前无法解耦
 */
import { lockScreen } from "../dialog/processSystem";

/**
 * 用途：提供布局序列化功能，用于将标签页布局转换为JSON格式
 * 使用范围：openNewWindow.ts 等需要序列化布局状态的模块
 * 解耦评估：依赖布局系统核心功能，当前无法解耦
 */
import { layoutToJSON } from "../layout/util";

/**
 * 用途：提供平台检测功能，用于判断是否在 Electron 环境中运行
 * 使用范围：openNewWindow.ts 等需要平台特定逻辑的模块
 * 解耦评估：依赖平台检测工具函数，当前无法解耦
 */
import { isElectron } from "../platform";

/**
 * 用途：提供网络请求功能，用于与后端API通信
 * 使用范围：openNewWindow.ts 等需要发起API请求的模块
 * 解耦评估：依赖网络层实现，当前无法解耦
 */
import { fetchSyncPost } from "../util/network/fetch";

/**
 * 用途：提供消息提示功能，用于向用户显示提示信息
 * 使用范围：openNewWindow.ts 等需要用户交互反馈的模块
 * 解耦评估：依赖对话框系统，当前无法解耦
 */
import { showMessage } from "../dialog/message";

/**
 * 用途：提供文件路径处理功能，用于获取文件显示名称和路径操作
 * 使用范围：openNewWindow.ts 等需要处理文件路径的模块
 * 解耦评估：依赖文件系统工具函数，当前无法解耦
 */
import { getDisplayName, pathPosix } from "../util/file/pathName";

/**
 * 用途：提供URL查询参数解析功能，用于从URL中提取参数
 * 使用范围：openNewWindow.ts 等需要解析URL参数的模块
 * 解耦评估：依赖平台工具函数，当前无法解耦
 */
import { getSearch } from "../util/platform/functions";

/**
 * 用途：提供窗口位置信息获取功能，用于构建新窗口URL
 * 使用范围：openNewWindow.ts 等需要获取当前窗口位置的模块
 * 解耦评估：依赖环境配置系统，当前无法解耦
 */
import { getLocationProtocol, getLocationHost } from "../util/siyuanEnvironments/windowLocation.environment";

export type { App };
export { Constants, ipcSend, getInstanceById, Tab, isWindow, getSiyuanConfig, lockScreen, layoutToJSON, isElectron, fetchSyncPost, showMessage, getDisplayName, pathPosix, getSearch, getLocationProtocol, getLocationHost };
