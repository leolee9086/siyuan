/**
 * Gutter 模块类型定义
 * 包含 gutter 相关的接口和类型定义
 */

/**
 * 用途：配置管理器类型，用于 AI 认证配置
 * 使用范围：生成块内容图片参数接口
 * 解耦评估：类型定义本身不产生运行时依赖，通过 type import 可被 tree-shaking；若需解耦可将 ProfileManager 改为通用接口
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

/**
 * 代码块菜单构建上下文
 */
export interface IGutterCodeBlockMenuContext {
    /** 目标节点元素 */
    nodeElement: Element;
    /** 节点 ID */
    id: string;
}

/**
 * 代码块开关选项配置
 */
export interface ICodeBlockSwitchConfig {
    /** 菜单项 ID */
    menuId: string;
    /** 属性名 (linewrap/ligatures/linenumber) */
    attrName: "linewrap" | "ligatures" | "linenumber";
    /** 显示标签（i18n key） */
    labelKey: keyof typeof import("../../util/siyuanEnvironments/i18n.getI18n.environment").siyuanI18n;
    /** 编辑器默认配置的属性名 */
    editorConfigKey: "codeLineWrap" | "codeLigatures" | "codeSyntaxHighlightLineNum";
}