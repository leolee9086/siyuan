/**
 * 导入转发文件
 * 用途：统一管理本目录的外部依赖，避免直接从父级目录导入
 */

// ============ 国际化与配置 ============

/**
 * 用途：获取国际化文本
 * 使用范围：菜单项label显示
 * 解耦评估：无法解耦，菜单文本必须使用全局i18n系统
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
// 导出国际化文本获取函数
export { siyuanI18n };

/**
 * 用途：获取系统配置（如快捷键）
 * 使用范围：菜单项快捷键显示
 * 解耦评估：无法解耦，快捷键配置是全局系统配置的一部分
 */
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
// 导出系统配置获取函数
export { getSiyuanConfig };

/**
 * 用途：系统常量（如上传地址、零宽空格）
 * 使用范围：图片上传、块HTML生成
 * 解耦评估：无法解耦，系统常量是全局配置
 */
import { Constants } from "../../../constants";
// 导出系统常量
export { Constants };

/**
 * 用途：获取SForge配置（ModelScope认证）
 * 使用范围：AI图片生成功能的认证管理
 * 解耦评估：可通过依赖注入解耦，但需要重构整个配置系统
 */
import { getSForgeConfigs } from "../../../config/sforge";
// 导出SForge配置获取函数
export { getSForgeConfigs };

/**
 * 用途：配置管理器类型
 * 使用范围：AI图片生成的认证参数
 * 解耦评估：可通过依赖注入解耦，但需要重构整个认证流程
 */
import { ProfileManager } from "../../../config/profileManager";
// 导出配置管理器类型
export { ProfileManager };

// ============ AI功能 ============

/**
 * 用途：打开AI操作菜单
 * 使用范围：原AI菜单项的点击处理
 * 解耦评估：可通过事件发射解耦，但当前架构中菜单项直接调用更简洁
 */
import { openAIActionsMenu } from "../../../ai/actions";
// 导出AI操作菜单打开函数
export { openAIActionsMenu };

// ============ UI组件 ============

/**
 * 用途：创建Vue应用实例
 * 使用范围：进度对话框的Vue组件挂载
 * 解耦评估：无法解耦，Vue组件必须使用Vue的createApp
 */
import { createApp } from "vue";
// 导出Vue应用创建函数
export { createApp };

/**
 * 用途：Vue应用类型定义
 * 使用范围：进度对话框函数返回值类型
 * 解耦评估：类型定义，无需解耦
 */
import type { App } from "vue";
// 导出Vue应用类型
export type { App };

/**
 * 用途：创建模态对话框
 * 使用范围：AI图片生成进度显示
 * 解耦评估：可通过依赖注入解耦，但需要重构调用方
 */
import { Dialog } from "../../../dialog";
// 导出对话框类
export { Dialog };

// ============ 网络与资源 ============

/**
 * 用途：HTTP POST请求
 * 使用范围：上传图片、插入块、获取块文本等API调用
 * 解耦评估：可通过依赖注入解耦，但需要重构所有API调用
 */
import { fetchPost } from "../../../util/network/fetch";
// 导出HTTP POST请求函数
export { fetchPost };

/**
 * 用途：生成资源HTML
 * 使用范围：插入图片时生成img标签HTML
 * 解耦评估：可通过依赖注入解耦，但需要重构HTML生成逻辑
 */
import { genAssetHTML } from "../../../asset/renderAssets";
// 导出资源HTML生成函数
export { genAssetHTML };

// ============ 工具库 ============

/**
 * 用途：日期时间格式化
 * 使用范围：生成块的更新时间戳
 * 解耦评估：可通过依赖注入解耦，但dayjs是标准库，直接使用更简洁
 */
import * as dayjs from "dayjs";
// 导出日期时间工具库
export { dayjs };

// ============ 类型定义 ============

/**
 * 用途：Gutter菜单上下文类型
 * 使用范围：buildGutterAiMenu函数参数类型
 * 解耦评估：类型定义，无需解耦
 */
import type { IGutterEditMenuContext } from "../gutter.types";
// 导出Gutter菜单上下文类型
export type { IGutterEditMenuContext };

/**
 * 用途：进度状态更新器接口
 * 使用范围：进度对话框组件类型约束
 * 解耦评估：类型定义，无需解耦
 */
import type { IProgressStatusUpdater } from "../gutter.types";
// 导出进度状态更新器接口
export type { IProgressStatusUpdater };

/**
 * 用途：类型守卫函数，验证组件是否实现IProgressStatusUpdater接口
 * 使用范围：进度对话框创建后的类型检查
 * 解耦评估：类型守卫，无需解耦
 */
import { isProgressStatusUpdater } from "../gutter.guard";
// 导出类型守卫函数
export { isProgressStatusUpdater };
