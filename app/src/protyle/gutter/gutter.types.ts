/**
 * Gutter 模块类型定义
 * 包含 gutter 相关的接口和类型定义
 */

/** 用途：读取图像生成所需的当前认证配置；使用范围：块内容图像生成参数；解耦评估：只读能力由调用方注入，不依赖 ProfileManager 的文件存储实现。 */
import type {ProfileReader} from "../../config/profile.types";

/**
 * Gutter 编辑菜单上下文接口
 */
export interface IGutterEditMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
    isEmbedMenu?: boolean;
    allowStructuralMutation?: boolean;
    allowRemoval?: boolean;
}

/** Gutter 菜单在普通文档或嵌入查询边界内的操作能力。 */
export interface IGutterMenuCapabilities {
    isEmbedMenu: boolean;
    allowStructuralMutation: boolean;
    allowRemoval: boolean;
}

/** Gutter 通用菜单从导航、编辑、视图到扩展动作共享的完整构建上下文。 */
export interface IGutterCommonMenuContext extends IGutterMenuCapabilities {
    protyle: IProtyle;
    nodeElement: Element;
    id: string;
    type: string;
}

/** Gutter 块类型转换菜单及其各类型构建器共享的完整上下文。 */
export interface IGutterTurnIntoContext {
    nodeElement: Element;
    id: string;
    type: string;
    subType: string;
    protyle: IProtyle;
}

/** 标题转换目标的静态菜单描述。 */
export interface IGutterHeadingTargetDescriptor {
    subType: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    menuId: string;
    icon: string;
    labelKey: keyof typeof import("../../util/siyuanEnvironments/i18n.getI18n.environment").siyuanI18n;
    level: 1 | 2 | 3 | 4 | 5 | 6;
}

/** 空段落可直接转换的目标描述。 */
export interface IGutterEmptyParagraphTargetDescriptor {
    id: "code" | "table" | "line" | "math";
    icon: string;
    labelKey: keyof typeof import("../../util/siyuanEnvironments/i18n.getI18n.environment").siyuanI18n;
    type: "code" | "table" | "line" | "math";
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
    authManager: ProfileReader;
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
