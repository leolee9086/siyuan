/** 用途：Vue 组件挂载配置类型。使用范围：dialog.types 接口定义。解耦评估：通过 imports.ts 转发。 */
import type { VueComponentMountConfig } from "./imports";
/** 用途：Vue 组件加载上下文类型。使用范围：dialog.types 接口定义。解耦评估：通过 imports.ts 转发。 */
import type { VueComponentLoaderContext } from "./imports";

/**
 * 对话框选项接口
 */
export interface IDialogOptions {
    positionId?: string,
    title?: string,
    titleVueConfig?: VueComponentMountConfig, // 新增：标题Vue组件配置
    titleVueContext?: VueComponentLoaderContext, // 新增：标题Vue组件上下文
    transparent?: boolean,
    content: string,
    width?: string,
    height?: string,
    destroyCallback?: (options?: IObject) => void,
    disableClose?: boolean,
    hideCloseIcon?: boolean,
    disableAnimation?: boolean,
    resizeCallback?: (type: string) => void,
    containerClassName?: string,
    disableScrimClose?: boolean, // 是否禁用点击遮罩关闭
    disableEscapeClose?: boolean,  // 是否禁用 Escape 键关闭
    scrimPointerEvents?: boolean, // 是否允许遮罩层鼠标事件穿透
    closeButtonPosition?: "outside" | "inside" | "inside-body", // 关闭按钮位置：外部(默认)、内部标题栏、内部内容区域
    data?: IObject // 自定义数据
}

/** 对话框接口，用于辅助函数引用 */
export interface IDialog {
    id: string;
    destroy: (options?: IObject) => void;
    fullscreen: () => void;
}

/** 对话框HTML生成参数 */
export interface I对话框HTML参数 {
    zIndex: number;
    left?: string | undefined;
    top?: string | undefined;
    scrimPointerEvents: boolean;
    transparent?: boolean | undefined;
    containerClassName?: string | undefined;
    width?: string | undefined;
    height?: string | undefined;
    closeButtonPosition: string;
    closeButtonHtml: string;
    fullscreenButtonHtml: string;
    headerPaddingRight: string;
    hasTitle: boolean;
    title?: string | undefined;
    content: string;
}
