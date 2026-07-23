/** 用途：移动端判断。使用范围：对话框尺寸适配。解耦评估：通过 ./imports 转发。 */
import { isMobile } from "./imports";
/** 用途：系统常量。使用范围：LOCAL_DIALOGPOSITION。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：安全获取对话框存储。使用范围：恢复对话框位置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanDialogStorage } from "./imports";
/** 用途：安全获取窗口尺寸。使用范围：验证对话框位置。解耦评估：通过 ./imports 转发。 */
import { getSiyuanWindowSize } from "./imports";
/** 用途：SVG 元素类型守卫。使用范围：全屏按钮图标更新。解耦评估：同目录直接导入。 */
/** 用途：SVG 元素类型守卫。使用范围：全屏按钮图标更新。解耦评估：同目录直接导入。 */
import { isSVGElement } from "./dialog.guard";
/** 用途：SVGUseElement 类型守卫。使用范围：全屏按钮 use 元素图标更新。解耦评估：同目录直接导入。 */
import { isSVGUseElement } from "./dialog.guard";
/** 用途：对话框选项和 HTML 参数类型。使用范围：函数参数类型标注。解耦评估：同目录直接导入。 */
/** 用途：对话框选项配置类型。使用范围：函数参数类型标注。解耦评估：同目录直接导入。 */
import { IDialogOptions } from "./dialog.types";
/** 用途：对话框 HTML 参数类型。使用范围：生成对话框 HTML 的参数。解耦评估：同目录直接导入。 */
import { I对话框HTML参数 } from "./dialog.types";

/**
 * @function 计算对话框位置
 * @zh-CN
 * @作用: 根据 positionId 从本地存储中恢复对话框的上次位置和尺寸
 * @意图: 为用户提供位置记忆功能，让对话框在重新打开时出现在上次关闭的位置
 * @调用时机: 在对话框初始化时调用，用于确定初始位置
 * @已知问题: 无
 * @改进方向: 可以考虑验证存储的位置是否在当前屏幕范围内（已实现）
 */
/**
 * @同步豁免: UI构建 - HTML生成操作必须同步执行，否则Dialog构造函数中innerHTML赋值会拿到Promise对象
 */
export function 计算对话框位置(options: IDialogOptions) {
    if (isMobile() || !options.positionId) {
        return {};
    }
    const storage = getSiyuanDialogStorage();
    if (!storage) {
        return {};
    }
    const dialogPositions = storage[Constants.LOCAL_DIALOGPOSITION];
    if (!dialogPositions) {
        return {};
    }
    const dialogPosition = dialogPositions[options.positionId];
    if (!dialogPosition) {
        return {};
    }
    const windowSize = getSiyuanWindowSize();
    const 位置有效 = dialogPosition.left + dialogPosition.width + 34 <= windowSize.innerWidth &&
        dialogPosition.top + dialogPosition.height <= windowSize.innerHeight;
    if (!位置有效) {
        return {};
    }
    return {
        left: dialogPosition.left + "px",
        top: dialogPosition.top + "px",
        width: dialogPosition.width + "px",
        height: dialogPosition.height + "px"
    };
}

/**
 * @function 生成关闭按钮HTML
 * @zh-CN
 * @作用: 根据配置生成对话框关闭按钮的 HTML 字符串
 * @意图: 动态生成关闭按钮，支持不同的位置（外部、标题内、内容区内）和显示/隐藏
 * @调用时机: 在对话框 HTML 结构生成时调用
 * @已知问题: 无
 * @改进方向: 可以考虑使用模板引擎而不是字符串拼接
 */
/**
 * @同步豁免: UI构建 - HTML生成操作必须同步执行
 */
export function 生成关闭按钮HTML(options: {
    disableClose: boolean;
    hideCloseIcon: boolean;
    closeButtonPosition: "outside" | "inside" | "inside-body";
    hasTitle: boolean;
}) {
    if (options.disableClose || options.hideCloseIcon) {
        return "";
    }
    if (options.closeButtonPosition === "outside") {
        return isMobile()
            ? "<svg class=\"b3-dialog__close\"><use xlink:href=\"#iconCloseRound\"></use></svg>"
            : "";
    }
    if (options.closeButtonPosition === "inside" && options.hasTitle) {
        return "<svg class=\"b3-dialog__close b3-dialog__close--inside\" style=\"position: absolute; top: 50%; right: 0px; transform: translateY(-50%);\"><use xlink:href=\"#iconCloseRound\"></use></svg>";
    }
    if (options.closeButtonPosition === "inside-body") {
        return "<svg class=\"b3-dialog__close b3-dialog__close--inside-body\" style=\"position: absolute; top: 10px; right: 10px; z-index: 1;\"><use xlink:href=\"#iconCloseRound\"></use></svg>";
    }
    return "";
}

/**
 * @function 生成全屏按钮HTML
 * @zh-CN
 * @作用: 生成对话框全屏按钮的 HTML 字符串
 * @意图: 为有标题的对话框提供全屏切换功能
 * @调用时机: 在对话框 HTML 结构生成时调用
 * @已知问题: 无
 * @改进方向: 无
 */
/**
 * @同步豁免: UI构建 - HTML生成操作必须同步执行
 */
export function 生成全屏按钮HTML(hasTitle: boolean, closeButtonPosition: string) {
    if (!hasTitle) {
        return "";
    }
    const fullscreenButtonStyle = (closeButtonPosition === "inside" && hasTitle)
        ? "position: absolute; top: 50%; right: 30px; transform: translateY(-50%);"
        : "position: absolute; top: 50%; right: 10px; transform: translateY(-50%);";
    return `<svg class="b3-dialog__fullscreen" style="${fullscreenButtonStyle}" title="全屏"><use xlink:href="#iconFullscreen"></use></svg>`;
}

/**
 * @function 计算标题栏样式
 * @zh-CN
 * @作用: 计算标题栏的右侧内边距样式，为按钮预留空间
 * @意图: 根据关闭按钮位置动态调整标题栏的内边距，避免标题文字与按钮重叠
 * @调用时机: 在对话框 HTML 结构生成时调用
 * @已知问题: 无
 * @改进方向: 无
 */
/**
 * @同步豁免: UI构建 - 样式计算必须同步执行
 */
export function 计算标题栏样式(hasTitle: boolean, closeButtonPosition: string) {
    if (!hasTitle) {
        return "";
    }
    if (isMobile() && closeButtonPosition === "outside") {
        return "position: relative; padding-right: 38px;";
    }
    return closeButtonPosition === "inside"
        ? "position: relative; padding-right: 60px;"
        : "position: relative; padding-right: 30px;";
}

/**
 * @function 更新全屏按钮状态
 * @zh-CN
 * @作用: 更新全屏按钮的图标和标题，反映当前的全屏状态
 * @意图: 为用户提供视觉反馈，显示当前是否处于全屏模式
 * @调用时机: 在全屏状态切换时调用
 * @已知问题: 无
 * @改进方向: 无
 */
/**
 * @同步豁免: UI构建 - DOM状态更新必须同步执行
 */
export function 更新全屏按钮状态(dialogElement: Element, isFullscreen: boolean) {
    const fullscreenButton = dialogElement.querySelector(".b3-dialog__fullscreen use");
    const fullscreenButtonSvg = dialogElement.querySelector(".b3-dialog__fullscreen");
    // 更新全屏按钮图标
    if (isSVGUseElement(fullscreenButton)) {
        fullscreenButton.setAttribute("xlink:href", isFullscreen ? "#iconFullscreenExit" : "#iconFullscreen");
    }
    // 更新全屏按钮标题提示
    if (isSVGElement(fullscreenButtonSvg)) {
        fullscreenButtonSvg.setAttribute("title", isFullscreen ? "退出全屏" : "全屏");
    }
}

/**
 * @function 生成对话框HTML
 * @zh-CN
 * @作用: 生成完整的对话框 HTML 结构
 * @意图: 根据配置参数构建对话框的 DOM 结构，包括遮罩、容器、标题、内容和调整手柄
 * @调用时机: 在对话框初始化时调用
 * @已知问题: 无
 * @改进方向: 可以考虑使用模板引擎或 JSX 来改善可读性
 */
/**
 * @同步豁免: UI构建 - HTML生成操作必须同步执行，否则Dialog构造函数中innerHTML赋值会拿到Promise对象
 */
export function 生成对话框HTML(params: I对话框HTML参数) {
    return `<div class="b3-dialog${params.rootClassName ? " " + params.rootClassName : ""}" style="z-index: ${params.zIndex};${typeof params.left === "string" ? "display:block" : ""};${params.scrimPointerEvents ? " pointer-events:none" : ""}">
${params.showScrim ? `<div class="b3-dialog__scrim"${params.transparent ? ' style="background-color:transparent"' : ""}></div>` : ""}
<div class="b3-dialog__container ${params.containerClassName || ""}" style="width:${params.width || "auto"};height:${params.height || "auto"};
left:${params.left || "auto"};top:${params.top || "auto"};${params.scrimPointerEvents ? " pointer-events:auto" : ""}">
  ${params.closeButtonPosition === "outside" ? params.closeButtonHtml : ""}
  <div class="resize__move b3-dialog__header${params.hasTitle ? "" : " fn__none"}" onselectstart="return false;" style="${params.headerPaddingRight}">${params.title || ""}${params.closeButtonPosition === "inside" ? params.closeButtonHtml : ""}${params.fullscreenButtonHtml}</div>
  <div class="b3-dialog__body" style="${params.closeButtonPosition === "inside-body" ? "position: relative;" : ""}">${params.content}${params.closeButtonPosition === "inside-body" ? params.closeButtonHtml : ""}</div>
  <div class="resize__rd"></div><div class="resize__ld"></div><div class="resize__lt"></div><div class="resize__rt"></div><div class="resize__r"></div><div class="resize__d"></div><div class="resize__t"></div><div class="resize__l"></div>
</div></div>`;
}
