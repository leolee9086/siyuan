/**
 * 用途：汇集 moveResize 对 dialog 外部模块的依赖，通过网关避免直接使用父级路径导入。
 * 使用范围：moveResize.ts 拖拽/调整大小功能。
 * 解耦评估：util/hasClosest、hideElements、compatibility、Constants 均为通用工具，当前通过 imports.ts 收敛；后续若拆分为独立 service 则仅需修改 imports.ts。
 */
import { hasClosestByClassName } from "./imports";
/**
 * 用途：提供与编辑器相关的共享常量（如工具栏高度）。
 * 使用范围：moveResize.ts 位置/尺寸边界计算。
 * 解耦评估：常量是跨模块契约，保留在 imports.ts 中转发。
 */
import { Constants } from "./imports";
/**
 * 用途：隐藏指定类型的 UI 浮动层。
 * 使用范围：拖拽结束后清理 gutter 等浮动层。
 * 解耦评估：UI 清理逻辑短期内仍需直接调用，通过 imports.ts 收敛路径耦合。
 */
import { hideAllElements } from "./imports";
/**
 * 用途：存储键值对到 localStorage 兼容封装。
 * 使用范围：拖拽结束后保存对话框位置。
 * 解耦评估：存储操作已被 environment 层封装，继续通过 imports.ts 转发。
 */
import { setStorageVal } from "./imports";
/**
 * 用途：安全获取 window 对象的封装。
 * 使用范围：访问 window.siyuan 全局状态。
 * 解耦评估：全局状态访问通过 environment 层封装，避免业务代码直接耦合 window。
 */
import { getWindow } from "./imports";
/**
 * 用途：获取视口宽度（window.innerWidth 的封装）。
 * 使用范围：moveResize 中的位置/尺寸边界计算。
 * 解耦评估：尺寸读取已被 environment 层封装，通过 imports.ts 转发。
 */
import { getWindowWidth } from "./imports";
/**
 * 用途：获取视口高度（window.innerHeight 的封装）。
 * 使用范围：moveResize 中的位置/尺寸边界计算。
 * 解耦评估：尺寸读取已被 environment 层封装，通过 imports.ts 转发。
 */
import { getWindowHeight } from "./imports";
/**
 * 用途：获取工具栏高度，用于拖拽时元素不应被工具栏遮挡的边界约束计算。
 * 使用范围：handleEdgeResize/handleCornerResize/handleMovePosition 中的 Y 轴边界计算。
 * 解耦评估：工具高度是运行时动态值（移动端/桌面端工具栏不同），通过 imports.ts 从环境读取合理；
 *   若后续改为 CSS env() 方案可修改 imports.ts 实现。
 */
import { getTopBarHeight } from "./imports";

/**
 * 用途：按 resize 类型分别处理元素尺寸变更
 * 使用范围：mousemove 事件中 type 不为 "move" 时调用
 */
const handleEdgeResize = (moveEvent: MouseEvent, type: string, x: number, y: number, width: number, height: number, element: HTMLElement) => {
    const clientXOffset = moveEvent.clientX - x + width;
    const clientYOffset = moveEvent.clientY - y + height;
    const windowWidth = getWindowWidth();
    const windowHeight = getWindowHeight();

    // 右侧拖拽：宽度须 > 200 且不超过视口右边界
    if (type === "r" && clientXOffset > 200 && clientXOffset < windowWidth) {
        element.style.width = clientXOffset + "px";
        element.style.maxWidth = "none";
        return;
    }
    // 下侧拖拽：高度须 > 160 且不超过视口下边界（排除工具栏）
    if (type === "d" && clientYOffset > 160 && clientYOffset < windowHeight - getTopBarHeight()) {
        element.style.height = clientYOffset + "px";
        element.style.maxHeight = "";
        return;
    }
    // 上侧拖拽：鼠标须在工具栏下方、且新高度 > 160
    if (type === "t" && moveEvent.clientY > getTopBarHeight() && y - moveEvent.clientY + height > 160) {
        element.style.top = moveEvent.clientY + "px";
        element.style.maxHeight = "";
        element.style.height = (y - moveEvent.clientY + height) + "px";
        return;
    }
    // 左侧拖拽：鼠标须在视口内、且新宽度 > 200
    if (type === "l" && moveEvent.clientX > 0 && x - moveEvent.clientX + width > 200) {
        element.style.left = moveEvent.clientX + "px";
        element.style.width = (x - moveEvent.clientX + width) + "px";
        element.style.maxWidth = "none";
    }
};

/**
 * 用途：按 corner resize 类型处理对角线方向的尺寸变更
 * 使用范围：mousemove 事件中 type 为 rd/rt/lt/ld 时调用
 */
const handleCornerResize = (moveEvent: MouseEvent, type: string, x: number, y: number, width: number, height: number, element: HTMLElement) => {
    const clientXOffset = moveEvent.clientX - x + width;
    const clientYOffset = moveEvent.clientY - y + height;
    const windowWidth = getWindowWidth();
    const windowHeight = getWindowHeight();

    // 右下角拖拽：同时满足右边界和下边界约束
    if (type === "rd" && clientXOffset > 200 && clientXOffset < windowWidth &&
        clientYOffset > 160 && clientYOffset < windowHeight - getTopBarHeight()) {
        element.style.height = clientYOffset + "px";
        element.style.maxHeight = "";
        element.style.maxWidth = "none";
        element.style.width = clientXOffset + "px";
        return;
    }
    // 右上角拖拽：同时满足右边界和上边界约束
    if (type === "rt" && clientXOffset > 200 && clientXOffset < windowWidth &&
        moveEvent.clientY > getTopBarHeight() && y - moveEvent.clientY + height > 160) {
        element.style.width = clientXOffset + "px";
        element.style.top = moveEvent.clientY + "px";
        element.style.maxHeight = "";
        element.style.maxWidth = "none";
        element.style.height = (y - moveEvent.clientY + height) + "px";
        return;
    }
    // 左上角拖拽：同时满足左边界和上边界约束
    if (type === "lt" && moveEvent.clientX > 0 && x - moveEvent.clientX + width > 200 &&
        moveEvent.clientY > getTopBarHeight() && y - moveEvent.clientY + height > 160) {
        element.style.left = moveEvent.clientX + "px";
        element.style.width = (x - moveEvent.clientX + width) + "px";
        element.style.top = moveEvent.clientY + "px";
        element.style.maxHeight = "";
        element.style.maxWidth = "none";
        element.style.height = (y - moveEvent.clientY + height) + "px";
        return;
    }
    // 左下角拖拽：同时满足左边界和下边界约束
    if (type === "ld" && moveEvent.clientX > 0 && x - moveEvent.clientX + width > 200 &&
        clientYOffset > 160 && clientYOffset < windowHeight - getTopBarHeight()) {
        element.style.left = moveEvent.clientX + "px";
        element.style.width = (x - moveEvent.clientX + width) + "px";
        element.style.height = clientYOffset + "px";
        element.style.maxHeight = "";
        element.style.maxWidth = "none";
    }
};

/**
 * 用途：处理拖拽移动中的元素位置更新（move 模式）
 * 调用时机：mousemove 事件中 type 为 "move" 时调用
 */
const handleMovePosition = (moveEvent: MouseEvent, x: number, y: number, width: number, height: number, element: HTMLElement) => {
    let positionX = moveEvent.clientX - x;
    let positionY = moveEvent.clientY - y;
    const windowWidth = getWindowWidth();
    const windowHeight = getWindowHeight();

    // 防止元素超出视口右边界
    if (positionX > windowWidth - width) {
        positionX = windowWidth - width;
    }
    // 防止元素超出视口下边界
    if (positionY > windowHeight - height) {
        positionY = windowHeight - height;
    }
    element.style.left = Math.max(positionX, 0) + "px";
    element.style.top = Math.max(positionY, getTopBarHeight()) + "px";
};

/**
 * 用途：保存对话框的最终位置到 localStorage
 * 调用时机：mouseup 事件中，元素为 b3-dialog--open 且存在 dialogId 时调用
 */
const saveDialogPosition = (element: HTMLElement) => {
    const windowObj = getWindow();
    const dialogElement = hasClosestByClassName(element, "b3-dialog--open");
    if (!dialogElement) {
        return;
    }
    const dialogId = dialogElement.dataset.key;
    // 仅当 dialog 已渲染且有实际宽高时才保存位置
    if (dialogId && element.offsetWidth) {
        // 提取存储对象引用，避免隐式上下文切换
        const storageMap = windowObj.siyuan.storage[Constants.LOCAL_DIALOGPOSITION];
        storageMap[dialogId] = {
            width: element.offsetWidth,
            height: element.offsetHeight,
            left: parseInt(element.style.left),
            top: parseInt(element.style.top),
        };
        setStorageVal(Constants.LOCAL_DIALOGPOSITION, storageMap);
    }
};

/**
 * 用途：清理拖拽过程中的全局事件监听及临时样式
 * 调用时机：mouseup 事件触发时调用
 */
const cleanupDrag = (element: HTMLElement) => {
    const windowObj = getWindow();
    // 清理反向链接拖拽后的残留状态 https://ld246.com/article/1632915506502
    if (windowObj.siyuan.dragElement) {
        windowObj.siyuan.dragElement.style.opacity = "";
        windowObj.siyuan.dragElement = undefined;
    }
    element.style.userSelect = "auto";
    document.onmousemove = null;
    document.onmouseup = null;
    document.ondragstart = null;
    document.onselectstart = null;
    document.onselect = null;
    hideAllElements(["gutter"]);
};

/**
 * 用途：处理鼠标释放事件——清理拖拽状态、保存位置、触发回调
 * 调用时机：拖拽过程中鼠标 button up 时触发
 */
const handleMouseUp = (element: HTMLElement, type: string, hasMove: boolean, afterCB?: (type: string) => void) => {
    if (!element) {
        return;
    }
    cleanupDrag(element);
    saveDialogPosition(element);
    // 仅在发生了实际移动且提供了回调时才触发
    if (hasMove && afterCB) {
        afterCB(type);
    }
};

/**
 * 用途：处理拖拽过程中的鼠标移动事件——按拖拽类型更新元素位置或尺寸
 * 调用时机：mousedown 后 mouse move 时触发
 */
const handleMouseMove = (moveEvent: MouseEvent, element: HTMLElement, type: string, x: number, y: number, width: number, height: number, hasMove: { value: boolean }) => {
    hasMove.value = true;
    if (!element) {
        return;
    }
    // move 模式：更新元素位置
    if (type === "move") {
        handleMovePosition(moveEvent, x, y, width, height, element);
        return;
    }
    // resize 模式：按类型更新元素尺寸
    handleEdgeResize(moveEvent, type, x, y, width, height, element);
    handleCornerResize(moveEvent, type, x, y, width, height, element);
};

/**
 * 用途：解析拖拽/调整大小的目标类型
 * 使用范围：mousedown 初始化时，从 iconsElement className 中提取 resize 类型
 */
const getResizeTypeFromElement = (iconsElement: Element) => {
    const className = iconsElement.className;
    const afterResize = className.split("resize__")[1];
    if (!afterResize) {
        return "";
    }
    return afterResize.split(" ")[0];
};

/**
 * 用途：初始化拖拽/调整大小所需的坐标偏移量
 * 使用范围：mousedown 事件触发时，根据是否有 iconsElement 计算 x/y
 */
const initDragOffsets = (event: MouseEvent & { target: HTMLElement }, element: HTMLElement, elementRect: DOMRect) => {
    const moveIcon = hasClosestByClassName(event.target, "resize__move");
    let x: number;
    let y: number;
    let iconsElement = moveIcon;

    if (iconsElement) {
        // move 模式：偏移量为鼠标相对于元素左上角的距离
        x = event.clientX - elementRect.left;
        y = event.clientY - elementRect.top;
        return { iconsElement, x, y };
    }
    // resize 模式：查找 resize 图标并记录鼠标落点
    x = event.clientX;
    y = event.clientY;
    iconsElement = hasClosestByClassName(event.target, "resize__rd") ||
        hasClosestByClassName(event.target, "resize__r") ||
        hasClosestByClassName(event.target, "resize__rt") ||
        hasClosestByClassName(event.target, "resize__d") ||
        hasClosestByClassName(event.target, "resize__l") ||
        hasClosestByClassName(event.target, "resize__ld") ||
        hasClosestByClassName(event.target, "resize__lt") ||
        hasClosestByClassName(event.target, "resize__t");

    return { iconsElement, x, y };
};

/**
 * 用途：处理对话框容器的首次显示——将 dialog container 设为 block 并初始化位置
 * 调用时机：mousedown 时，若元素为 b3-dialog__container 且未显示
 */
const ensureDialogContainerDisplay = (element: HTMLElement, elementRect: DOMRect) => {
    // 首次拖拽时强制显示 dialog container 并初始化位置
    if (element.classList.contains("b3-dialog__container") && element.parentElement.style.display !== "block") {
        element.parentElement.style.display = "block";
        element.style.left = elementRect.left + "px";
        element.style.top = elementRect.top + "px";
        element.style.width = elementRect.width + "px";
    }
};

/**
 * 用途：处理 mousedown 事件——初始化拖拽/调整大小状态
 * 调用时机：moveResize 注册的 mousedown 事件触发时调用
 */
const handleMoveResizeMouseDown = (
    event: MouseEvent & { target: HTMLElement },
    element: HTMLElement,
    afterCB?: (type: string) => void,
) => {
    // https://github.com/siyuan-note/siyuan/issues/8746
    if (hasClosestByClassName(event.target, "protyle-util") && !element.classList.contains("protyle-util")) {
        return;
    }

    const elementRect = element.getBoundingClientRect();
    const { iconsElement, x, y } = initDragOffsets(event, element, elementRect);

    if (!iconsElement) {
        return;
    }

    const height = element.clientHeight;
    const width = element.clientWidth;
    const type = getResizeTypeFromElement(iconsElement);

    element.style.userSelect = "none";
    ensureDialogContainerDisplay(element, elementRect);

    document.ondragstart = () => false;

    const hasMove = { value: false };

    document.onmousemove = (moveEvent: MouseEvent) => {
        handleMouseMove(moveEvent, element, type, x, y, width, height, hasMove);
    };

    document.onmouseup = () => {
        handleMouseUp(element, type, hasMove.value, afterCB);
    };
};

/**
 * 用途：为指定元素注册拖拽/调整大小事件监听
 * 使用范围：dialog 模块初始化对话框拖拽功能
 * @柯里化: 本质上是一个事件绑定函数，将 addEventListener 封装为可导出的设置函数，调用方通过 import { moveResize } 使用。
 */
export const moveResize = async (element: HTMLElement, afterCB?: (type: string) => void) => {
    element.addEventListener("mousedown", (event: MouseEvent & { target: HTMLElement }) => {
        handleMoveResizeMouseDown(event, element, afterCB);
    });
};
