/**
 * Gutter 模块类型定义
 * 包含 gutter 相关的接口和类型定义
 */

import type { ProfileManager } from "../../config/profileManager";

/**
 * Gutter 编辑菜单上下文接口
 */
export interface IGutterEditMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
}

/**
 * 进度状态更新器接口
 * 用于更新 UI 组件的加载状态和消息
 */
export interface IProgressStatusUpdater {
    updateStatus?: (msg: string, isLoading: boolean) => void;
}

/**
 * 生成图片的参数
 */
export interface 生成块内容图片参数 {
    /** 提示词（块内容） */
    prompt: string;
    /** Protyle 实例 */
    protyle: IProtyle;
    /** 当前块元素 */
    nodeElement: Element;
    /** Auth 配置管理器 */
    authManager: ProfileManager;
    /** 进度回调 */
    onProgress?: (msg: string) => void;
    /** 完成回调，传入生成的图片 base64 数据 */
    onComplete?: (base64Data: string) => void | Promise<void>;
}