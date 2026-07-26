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
import { Dialog } from "../../runtime/dialog.port";
// 导出对话框类
export { Dialog };

/**
 * 用途：转义 HTML 属性值
 * 使用范围：块背景外链输入框与定位预览图片地址安全回填
 * 解耦评估：属于纯函数工具，可通过参数传递解耦，但当前在菜单 UI 构建中直接复用成本最低
 */
import { escapeAttr } from "../../../util/DOM/escape";
// 导出属性值转义工具
export { escapeAttr };

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
 * 用途：图片资源上传入口
 * 使用范围：块背景菜单选择本地图片后上传并回填块属性
 * 解耦评估：可通过上层回调注入解耦，但该模块本身就是 protyle 侧交互编排层，直接依赖上传模块更贴近现有架构
 */
import { uploadFiles } from "../../upload";
// 导出资源上传函数
export { uploadFiles };

/**
 * 用途：全局资源选择对话框
 * 使用范围：块背景菜单从资源库中选择图片作为背景
 * 解耦评估：可通过依赖注入解耦，但当前全局单例对话框已是标准资源选择入口，直接复用更稳定
 */
import { openAssetDialog } from "../../runtime/dialog.port";
// 导出资源选择对话框
export { openAssetDialog };

/**
 * 用途：背景内联样式清理工具
 * 使用范围：块背景切换时清空旧背景相关样式，避免与宽度、对齐等其他样式互相覆盖
 * 解耦评估：属于通用 DOM 工具，可通过参数传递解耦，但通过 imports.ts 转发更符合本目录网关约束
 */
import { clearElementBackgroundStyle } from "../../../util/DOM/style/clearInlineStyleProperties";
// 导出背景样式清理工具
export { clearElementBackgroundStyle };

/**
 * 用途：内置背景样式数据集
 * 使用范围：块背景菜单中的内置背景与随机背景来源
 * 解耦评估：属于共享静态数据，直接复用比重复维护副本更合理
 */
import { bgs } from "../../../util/assets/backgrounds.ts";
// 导出内置背景数据
export { bgs };

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
 * 用途：生成块内容图片的参数类型
 * 使用范围：AI图片生成函数的参数类型约束
 * 解耦评估：类型定义，无需解耦
 */
import type { 生成块内容图片参数 } from "../gutter.types";
// 导出生成块内容图片参数类型
export type { 生成块内容图片参数 };

/**
 * 用途：类型守卫函数，验证组件是否实现IProgressStatusUpdater接口
 * 使用范围：进度对话框创建后的类型检查
 * 解耦评估：类型守卫，无需解耦
 */
import { isProgressStatusUpdater } from "../gutter.guard";
// 导出类型守卫函数
export { isProgressStatusUpdater };

// ============ ModelScope API ============

/**
 * 用途：ModelScope文生图API客户端函数
 * 使用范围：AI图片生成流程的任务提交、轮询、图片获取
 * 解耦评估：可通过依赖注入解耦，但需要重构整个AI图片生成流程
 */
import { 提交生成任务 } from "../../../apis/modelscope/client";
// 导出ModelScope任务提交函数
export { 提交生成任务 };

/**
 * 用途：ModelScope任务轮询函数
 * 使用范围：AI图片生成流程的任务状态查询
 * 解耦评估：可通过依赖注入解耦，但需要重构整个AI图片生成流程
 */
import { 轮询任务直到完成 } from "../../../apis/modelscope/client";
// 导出ModelScope任务轮询函数
export { 轮询任务直到完成 };

/**
 * 用途：ModelScope图片获取函数
 * 使用范围：AI图片生成完成后下载图片数据
 * 解耦评估：可通过依赖注入解耦，但需要重构整个AI图片生成流程
 */
import { 获取图片 } from "../../../apis/modelscope/client";
// 导出ModelScope图片获取函数
export { 获取图片 };

/**
 * 用途：从ModelScope响应中提取图片URL
 * 使用范围：AI图片生成流程的结果解析
 * 解耦评估：可通过依赖注入解耦，但需要重构整个AI图片生成流程
 */
import { 提取图片URL } from "../../../apis/modelscope/client";
// 导出ModelScope图片URL提取函数
export { 提取图片URL };

/**
 * 用途：ModelScope认证数据类型
 * 使用范围：AI图片生成的认证参数类型约束
 * 解耦评估：类型定义，无需解耦
 */
import type { ModelScopeAuthData } from "../../../apis/modelscope/types";
// 导出ModelScope认证数据类型
export type { ModelScopeAuthData };

// ============ 消息提示 ============

/**
 * 用途：显示用户提示消息
 * 使用范围：AI图片生成失败时的错误提示
 * 解耦评估：可通过事件发射解耦，但当前架构中直接调用更简洁
 */
import { showMessage } from "../../runtime/dialog.port";
// 导出消息提示函数
export { showMessage };

// ============ 平台能力 ============

/**
 * 用途：移动端运行时判断
 * 使用范围：块背景菜单与对话框尺寸、是否展示拖拽定位入口等平台分支
 * 解耦评估：运行时平台判断属于环境能力，若通过参数层层透传会增加调用复杂度，直接转发更符合现有项目模式
 */
import { isMobile } from "../../../platform";
// 导出移动端判断
export { isMobile };

/**
 * 用途：生成块内容图片核心函数
 * 使用范围：AI图片生成菜单功能
 * 解耦评估：直接依赖 AI 图片生成实现，避免 imports 网关多跳转发
 */
import { 生成块内容图片 } from "../../../ai/imageGeneration";
// 导出生成块内容图片函数
export { 生成块内容图片 };
