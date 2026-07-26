/**
 * 用途：集中管理 commonMenuItem 模块的所有外部依赖导入
 * 使用范围：本模块内所有文件通过此文件导入外部依赖
 * 解耦评估：作为导入转发层，已经是解耦的最佳实践，无需进一步解耦
 */

// ============ 平台相关导入 ============
/**
 * 用途：在 Electron 环境中打开外部链接
 * 使用范围：exportMd 函数中打开导出文件
 * 解耦评估：平台相关功能，已通过平台抽象层封装，无需进一步解耦
 */
import { openExternal } from "../../platform/electron/shell";
/** 导出 openExternal 用于在 Electron 环境中打开外部链接 */
export { openExternal };

/**
 * 用途：检测当前是否在 Electron 环境中运行
 * 使用范围：exportMd 函数中根据平台显示不同的导出选项
 * 解耦评估：平台检测是基础设施功能，通过环境变量或配置注入会增加复杂度，当前方式合理
 */
import { isElectron } from "../../platform";
/** 导出 isElectron 用于检测 Electron 环境 */
export { isElectron };

/**
 * 用途：检测当前是否在移动设备上运行
 * 使用范围：exportMd 函数中调整对话框宽度
 * 解耦评估：平台检测功能，已通过工具函数封装，无需进一步解耦
 */
import { isMobile } from "../../util/platform/functions";
/** 导出 isMobile 用于检测移动设备 */
export { isMobile };

// ============ 移动端兼容性导入 ============
/**
 * 用途：检测是否在 Android 环境中运行
 * 使用范围：exportMd 函数中处理 Android 特定的打印逻辑
 * 解耦评估：平台检测功能，已通过工具函数封装，无需进一步解耦
 */
import { isInAndroid } from "../../protyle/util/compatibility";
/** 导出 isInAndroid 用于检测 Android 环境 */
export { isInAndroid };

/**
 * 用途：检测是否在 Harmony 环境中运行
 * 使用范围：exportMd 函数中处理 Harmony 特定的打印逻辑
 * 解耦评估：平台检测功能，已通过工具函数封装，无需进一步解耦
 */
import { isInHarmony } from "../../protyle/util/compatibility";
/** 导出 isInHarmony 用于检测 Harmony 环境 */
export { isInHarmony };

/**
 * 用途：检测是否在 iOS 环境中运行
 * 使用范围：exportMd 函数中处理 iOS 特定的打印逻辑
 * 解耦评估：平台检测功能，已通过工具函数封装，无需进一步解耦
 */
import { isInIOS } from "../../protyle/util/compatibility";
/** 导出 isInIOS 用于检测 iOS 环境 */
export { isInIOS };

/**
 * 用途：检测是否在移动应用中运行
 * 使用范围：exportMd 函数中判断是否显示打印选项
 * 解耦评估：平台检测功能，已通过工具函数封装，无需进一步解耦
 */
import { isInMobileApp } from "../../protyle/util/compatibility";
/** 导出 isInMobileApp 用于检测移动应用环境 */
export { isInMobileApp };

/**
 * 用途：在移动端打开文件
 * 使用范围：exportMd 函数中打开导出的文件
 * 解耦评估：平台兼容层，已通过工具函数封装，无需进一步解耦
 */
import {saveExportFile} from "../../protyle/util/compatibility";
import {openByMobile} from "../../editor/openLink";
/** 导出 openByMobile 用于在移动端打开文件 */
export { openByMobile };
/** 导出 saveExportFile 用于保存导出文件 */
export { saveExportFile };

/**
 * 用途：写入文本到剪贴板
 * 使用范围：未在当前文件中使用，可能是历史遗留
 * 解耦评估：如果未使用，应该移除此导入
 */
import { writeText } from "../../protyle/util/compatibility";
/** 导出 writeText 用于写入剪贴板 */
export { writeText };

// ============ UI 组件导入 ============
/**
 * 用途：显示确认对话框，用于用户操作确认
 * 使用范围：exportMd 函数中覆盖模板时的确认
 * 解耦评估：UI组件，可通过依赖注入解耦，但考虑到使用频率和项目规模，当前直接导入是合理的
 */
import { confirmDialog } from "../../dialog/confirmDialog";
/** 导出 confirmDialog 用于显示确认对话框 */
export { confirmDialog };

/**
 * 用途：对话框类，用于构建复杂对话框
 * 使用范围：exportMd 函数中创建文件名输入对话框
 * 解耦评估：核心UI组件，是本模块的直接依赖，无需解耦
 */
import { Dialog } from "../../dialog";
/** 导出 Dialog 类用于构建对话框 */
export { Dialog };

/**
 * 用途：显示消息提示
 * 使用范围：exportMd 函数中显示导出进度
 * 解耦评估：UI反馈组件，可通过事件系统解耦，但当前直接导入更简洁
 */
import { showMessage } from "../../dialog/message";
/** 导出 showMessage 用于显示消息提示 */
export { showMessage };

/**
 * 用途：隐藏消息提示
 * 使用范围：exportMd 函数中隐藏导出进度提示
 * 解耦评估：UI反馈组件，可通过事件系统解耦，但当前直接导入更简洁
 */
import { hideMessage } from "../../dialog/message";
/** 导出 hideMessage 用于隐藏消息提示 */
export { hideMessage };

/**
 * 用途：菜单项类，用于构建菜单
 * 使用范围：所有导出的菜单构建函数
 * 解耦评估：核心UI组件，是本模块的直接依赖，无需解耦
 */
import { MenuItem } from "../Menu.Item";
/** 导出 MenuItem 类用于构建菜单项 */
export { MenuItem };

// ============ 网络请求导入 ============
/**
 * 用途：发送异步 POST 请求
 * 使用范围：所有需要与后端通信的函数
 * 解耦评估：基础设施功能，可通过依赖注入解耦，但考虑到使用频率，当前方式合理
 */
import { fetchPost } from "../../util/network/fetch";
/** 导出 fetchPost 用于发送异步 POST 请求 */
export { fetchPost };

/** 用途：恢复 Range 焦点。使用范围：属性和微信提醒对话框；解耦评估：稳定 Protyle 选区实现。 */
import {focusByRange} from "../../protyle/util/selection";
/** 导出 Range 焦点恢复。 */
export {focusByRange};

/**
 * 用途：发送同步 POST 请求
 * 使用范围：exportMd 函数中获取引用文本
 * 解耦评估：基础设施功能，可通过依赖注入解耦，但考虑到使用频率，当前方式合理
 */
import { fetchSyncPost } from "../../util/network/fetch";
/** 导出 fetchSyncPost 用于发送同步 POST 请求 */
export { fetchSyncPost };

// ============ 文件路径处理导入 ============
/**
 * 用途：检测是否为本地路径
 * 使用范围：未在当前文件中使用，可能是历史遗留
 * 解耦评估：纯工具函数，无副作用，无需解耦
 */
import { isLocalPath } from "../../util/file/pathName";
/** 导出 isLocalPath 用于检测本地路径 */
export { isLocalPath };

/**
 * 用途：移动文件到指定路径
 * 使用范围：movePathToMenu 函数中执行文件移动
 * 解耦评估：业务逻辑函数，可通过服务层解耦，但当前模块职责明确，直接导入合理
 */
import { moveToPath } from "../../util/file/pathName";
/** 导出 moveToPath 用于移动文件 */
export { moveToPath };

/**
 * 用途：获取 POSIX 风格的路径处理工具
 * 使用范围：movePathToMenu 函数中处理文件路径
 * 解耦评估：纯工具函数，无副作用，无需解耦
 */
import { pathPosix } from "../../util/file/pathName";
/** 导出 pathPosix 用于 POSIX 路径处理 */
export { pathPosix };

/**
 * 用途：移动文件路径的业务逻辑
 * 使用范围：movePathToMenu 函数中执行文件移动
 * 解耦评估：业务逻辑函数，可通过服务层解耦，但当前模块职责明确，直接导入合理
 */
import {movePathTo} from "../../util/file/movePath/movePathTo";
/** 导出 movePathTo 用于移动文件路径 */
export { movePathTo };

// ============ 导出功能导入 ============
/**
 * 用途：处理导出时的内容转换
 * 使用范围：exportMd 函数中处理 HTML 导出
 * 解耦评估：核心业务逻辑，已通过模块化封装，无需进一步解耦
 */
import { onExport } from "../../protyle/export";
/** 导出 onExport 用于处理导出内容转换 */
export { onExport };

/**
 * 用途：保存导出文件
 * 使用范围：exportMd 函数中执行各种格式的导出
 * 解耦评估：核心业务逻辑，已通过模块化封装，无需进一步解耦
 */
import { saveExport } from "../../protyle/export";
/** 导出 saveExport 用于保存导出文件 */
export { saveExport };

/**
 * 用途：导出图片功能
 * 使用范围：exportMd 函数中的图片导出选项
 * 解耦评估：业务逻辑函数，已通过模块化封装，无需进一步解耦
 */
import { exportImage } from "../../protyle/export/util";
/** 导出 exportImage 用于导出图片 */
export { exportImage };

// ============ 编辑器功能导入 ============
/**
 * 用途：打开资源文件
 * 使用范围：未在当前文件中使用，可能是历史遗留
 * 解耦评估：如果未使用，应该移除此导入
 */
/**
 * 用途：打开文档的通用函数
 * 使用范围：未在当前文件中使用，可能是历史遗留
 * 解耦评估：如果未使用，应该移除此导入
 */
import {openBy} from "../../platform/localPath/openBy";
/** 导出 openBy 用于打开文档 */
export { openBy };

/**
 * 用途：执行重命名操作
 * 使用范围：renameMenu 函数中执行重命名操作
 * 解耦评估：核心业务逻辑，已通过模块化封装，无需进一步解耦
 */
import { rename } from "../../editor/rename";
/** 导出 rename 用于执行重命名操作 */
export { rename };

/**
 * 用途：替换文件名中的非法字符
 * 使用范围：exportMd 函数中处理用户输入的文件名
 * 解耦评估：纯工具函数，无副作用，无需解耦
 */
import { replaceFileName } from "../../editor/rename";
/** 导出 replaceFileName 用于替换文件名非法字符 */
export { replaceFileName };

// ============ 工具库导入 ============
/**
 * 用途：日期时间处理库
 * 使用范围：未在当前文件中直接使用，可能是历史遗留
 * 解耦评估：如果未使用，应该移除此导入
 */
import * as dayjs from "dayjs";
/** 导出 dayjs 日期时间处理库 */
export { dayjs };

// ============ 常量和配置导入 ============
/**
 * 用途：全局常量定义
 * 使用范围：多处使用，如对话框标识、配置键等
 * 解耦评估：全局常量，是项目的基础设施，无需解耦
 */
import { Constants } from "../../constants";
/** 导出 Constants 全局常量 */
export { Constants };

/**
 * 用途：国际化文本获取
 * 使用范围：所有需要显示文本的地方
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 用于国际化文本 */
export { siyuanI18n };

/**
 * 用途：获取思源配置
 * 使用范围：renameMenu 和 movePathToMenu 函数中获取快捷键配置
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig 用于获取思源配置 */
export { getSiyuanConfig };

/**
 * 用途：获取发布模式状态
 * 使用范围：exportMd 函数中判断是否显示导出菜单
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getSiyuanIsPublish } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanIsPublish 用于获取发布模式状态 */
export { getSiyuanIsPublish };

/**
 * 用途：获取思源本地存储
 * 使用范围：移动端导出功能中读取导出配置
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanStorage 用于获取本地存储 */
export { getSiyuanStorage };

/**
 * 用途：获取 location.protocol
 * 使用范围：移动端导出功能中构建服务路径
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getLocationProtocol } from "../../util/siyuanEnvironments/windowLocation.environment";
/** 导出 getLocationProtocol 用于获取协议 */
export { getLocationProtocol };

/**
 * 用途：获取 location.host
 * 使用范围：移动端导出功能中构建服务路径
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getLocationHost } from "../../util/siyuanEnvironments/windowLocation.environment";
/** 导出 getLocationHost 用于获取主机 */
export { getLocationHost };

/**
 * 用途：获取 Android 原生接口
 * 使用范围：移动端导出功能中调用 Android 打印
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getWindowJSAndroid } from "../../util/siyuanEnvironments/windowNative.environment";
/** 导出 getWindowJSAndroid 用于获取 Android 接口 */
export { getWindowJSAndroid };

/**
 * 用途：获取 Harmony 原生接口
 * 使用范围：移动端导出功能中调用 Harmony 打印
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getWindowJSHarmony } from "../../util/siyuanEnvironments/windowNative.environment";
/** 导出 getWindowJSHarmony 用于获取 Harmony 接口 */
export { getWindowJSHarmony };

/**
 * 用途：获取 iOS 原生接口
 * 使用范围：移动端导出功能中调用 iOS 打印
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getWindowWebkit } from "../../util/siyuanEnvironments/windowNative.environment";
/** 导出 getWindowWebkit 用于获取 iOS 接口 */
export { getWindowWebkit };
