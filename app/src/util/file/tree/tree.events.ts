/** 用途：从 SVG 或动作按钮定位所属列表项；使用范围：Tree 点击与拖拽分发；解耦评估：共享无状态 DOM 查询是既有唯一实现，注入只会扩大配置表面。 */
import {hasClosestByTag} from "./imports";
/** 用途：收窄原生事件目标；使用范围：Tree DOM 事件边界；解耦评估：共享守卫无业务状态，直接依赖可保持判断一致。 */
import {isElement} from "./imports";
/** 用途：收窄需要 HTMLElement 能力的 Tree 节点；使用范围：焦点和回调分发；解耦评估：与事件目标守卫共享唯一实现。 */
import {isHTMLElement} from "./imports";
/** 用途：让事件模块仅依赖 Tree 完整抽象；使用范围：本模块所有分发函数；边界：不导入具体 Tree class。 */
import type {TreeDomain} from "./imports";
/** 用途：读取 Tree 的完整宿主回调配置；使用范围：本模块所有分发函数；边界：不创建调用点碎片接口。 */
import type {TreeOptions} from "./imports";

/** 将当前交互节点设为唯一焦点；空状态项不参与树节点选择。 */
const setCurrent = (tree: TreeDomain, target: HTMLElement) => {
    // 空状态是说明文本而非可选树节点，不应获得焦点样式。
    if (target.classList.contains("b3-list--empty")) {
        return;
    }
    for (const liItem of tree.element.querySelectorAll("li")) {
        liItem.classList.remove("b3-list-item--focus");
    }
    target.classList.add("b3-list-item--focus");
};

/** 按 Ctrl、Alt、Shift、普通点击的原有优先级调用节点动作。 */
const runClickAction = (tree: TreeDomain, options: TreeOptions, event: MouseEvent) => (target: HTMLElement) => {
    // Ctrl 动作优先于其它修饰键，保持多键同时按下时的既有选择行为。
    if (options.ctrlClick && window.siyuan.ctrlIsPressed) {
        options.ctrlClick(target, event);
        return;
    }
    // Alt 仅在 Ctrl 未消费事件时生效。
    if (options.altClick && window.siyuan.altIsPressed) {
        options.altClick(target, event);
        return;
    }
    // Shift 仅在前两个修饰键均未消费事件时生效。
    if (options.shiftClick && window.siyuan.shiftIsPressed) {
        options.shiftClick(target);
        return;
    }
    tree.click(target, event);
};

/** 处理可见箭头点击；返回值让祖先遍历在消费事件后停止。 */
const handleToggleTarget = (tree: TreeDomain, target: Element, event: MouseEvent) => {
    const isToggle = target.classList.contains("b3-list-item__toggle") &&
        !target.classList.contains("fn__hidden") && !window.siyuan.ctrlIsPressed && !window.siyuan.altIsPressed;
    // 仅无 Ctrl/Alt 修饰的可见箭头触发折叠，其他点击继续向列表项分发。
    if (!isToggle) {
        return false;
    }
    const listItem = target.parentElement;
    // 脱离列表项的孤立箭头不具备可折叠目标。
    if (!listItem) {
        return false;
    }
    tree.toggleBlocks(listItem);
    setCurrent(tree, listItem);
    event.preventDefault();
    return true;
};

/** 处理移动端列表项动作按钮，并将实际所属列表项交给宿主回调。 */
const handleActionTarget = (tree: TreeDomain, options: TreeOptions, event: MouseEvent) => (target: Element) => {
    // 动作按钮只有在 Tree 配置了业务点击回调时才独立消费事件。
    if (!target.classList.contains("b3-list-item__action") || !options.click) {
        return false;
    }
    const liElement = hasClosestByTag(target, "LI");
    // 动作图标可能已脱离列表；此时仍消费按钮事件，但不调用业务动作。
    if (liElement) {
        tree.click(liElement, event);
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/** 处理普通列表项选择；无业务标识的节点仅执行展开或收起。 */
const handleListItemTarget = (tree: TreeDomain, options: TreeOptions, event: MouseEvent) => (target: Element) => {
    // SVG 等子元素继续沿祖先链查找，只有实际 LI 承担节点动作。
    if (!isHTMLElement(target) || target.tagName !== "LI") {
        return false;
    }
    setCurrent(tree, target);
    const hasAction = target.hasAttribute("data-node-id") || target.getAttribute("data-treetype") === "tag";
    // 没有业务标识的分组节点只负责展开和收起。
    if (!hasAction) {
        tree.toggleBlocks(target);
        event.preventDefault();
        return true;
    }
    runClickAction(tree, options, event)(target);
    event.stopPropagation();
    event.preventDefault();
    return true;
};

/** 从实际点击目标向 Tree 根遍历，并在首个可处理目标处停止分发。 */
const handleClickEvent = (tree: TreeDomain, options: TreeOptions, event: MouseEvent) => {
    // 非元素目标不具备 Tree 的 class、属性和祖先语义。
    if (!isElement(event.target)) {
        return;
    }
    let target: Element | null = event.target;
    const handleAction = handleActionTarget(tree, options, event);
    const handleListItem = handleListItemTarget(tree, options, event);
    while (target && !target.isEqualNode(tree.element)) {
        const handled = handleToggleTarget(tree, target, event) ||
            handleAction(target) || handleListItem(target);
        // 首个匹配节点拥有本次点击，避免祖先列表项重复执行动作。
        if (handled) {
            return;
        }
        target = target.parentElement;
    }
};

/** 定位右键命中的列表项，并在宿主回调消费后阻止浏览器默认菜单。 */
const handleContextMenuEvent = (tree: TreeDomain, options: TreeOptions, event: MouseEvent) => {
    // 非元素目标不存在可查找的列表项祖先。
    if (!isElement(event.target)) {
        return;
    }
    let target: Element | null = event.target;
    while (target && !target.isEqualNode(tree.element)) {
        // 右键动作只接受实际列表项，SVG 等子元素继续向父级查找。
        if (isHTMLElement(target) && target.tagName === "LI" && options.rightClick) {
            options.rightClick(target, event);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        target = target.parentElement;
    }
};

/** 执行默认拖拽开始行为；宿主返回 true 时保持其完全接管语义。 */
const handleDragStartEvent = (options: TreeOptions, event: DragEvent) => {
    // 非元素目标无法归属到可拖拽列表项。
    if (!isElement(event.target)) {
        return;
    }
    const liElement = hasClosestByTag(event.target, "LI");
    // 脱离列表的拖拽事件没有可建立的默认载荷。
    if (!liElement) {
        return;
    }
    // 宿主必须先获得接管机会，保持旧 Tree 的回调顺序。
    if (options.dragStart?.(liElement, event)) {
        return;
    }
    const dataTransfer = event.dataTransfer;
    // 原生 dragstart 应始终携带 DataTransfer；缺失代表事件契约已损坏，必须明确暴露。
    if (!dataTransfer) {
        throw new Error("Tree dragstart event is missing DataTransfer");
    }
    dataTransfer.setData("text/html", liElement.outerHTML);
    // 设置 dropEffect 后 drop 无法监听 Alt，因此只记录默认载荷和拖拽节点。
    liElement.style.opacity = "0.38";
    window.siyuan.dragElement = liElement;
};

/** 执行默认拖拽结束清理；宿主返回 true 时保留其接管后的状态。 */
const handleDragEndEvent = (options: TreeOptions, event: DragEvent) => {
    // 非元素事件目标不存在可恢复项，但仍需清理默认全局状态。
    if (!isElement(event.target)) {
        window.siyuan.dragElement = undefined;
        return;
    }
    const liElement = hasClosestByTag(event.target, "LI");
    // 脱离列表的拖拽事件同样只需要清理全局状态。
    if (!liElement) {
        window.siyuan.dragElement = undefined;
        return;
    }
    // 宿主接管结束动作时也接管样式和全局状态的后续处理。
    if (options.dragEnd?.(liElement, event)) {
        return;
    }
    liElement.style.opacity = "1";
    window.siyuan.dragElement = undefined;
};

/** 一次性注册 Tree 拥有的四类 DOM 事件，具体分支保持在可独立测试的模块函数中。 */
/** @同步豁免: UI构建 - Tree 构造返回前必须完成全部监听注册；异步注册会产生已显示但尚不可交互的时间窗，且现有构造器没有 Promise 生命周期。 */
export const bindTreeEvents = (tree: TreeDomain, options: TreeOptions) => {
    tree.element.addEventListener("contextmenu", (event) => handleContextMenuEvent(tree, options, event));
    tree.element.addEventListener("click", (event) => handleClickEvent(tree, options, event));
    tree.element.addEventListener("dragstart", (event) => handleDragStartEvent(options, event));
    tree.element.addEventListener("dragend", (event) => handleDragEndEvent(options, event));
};
