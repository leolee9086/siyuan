/** 用途：从同层键盘网关取得应用宿主和反链完整领域类型。使用范围：事件入口参数与树导航。解耦评估：仅类型依赖，具体实现仍在组合根。 */
import type {AppFacade} from "./imports";
/** 用途：从同层键盘网关取得反链完整领域类型。使用范围：树导航参数。解耦评估：仅类型依赖，具体实现仍在组合根。 */
import type {BacklinkDomain} from "./imports";
/** 用途：取得当前布局中的反链模型集合。使用范围：底部反链面板识别。解耦评估：复用布局聚合根现有索引。 */
import {getAllModels} from "./imports";
/** 用途：按布局 ID 查询实例。使用范围：普通布局反链面板解析。解耦评估：布局参数显式传入。 */
import {getInstanceById} from "./imports";
/** 用途：读取 DOM 最近祖先状态。使用范围：判定输入控件和嵌套编辑器。解耦评估：纯谓词可替换。 */
import {hasClosestByAttribute} from "./imports";
/** 用途：读取 DOM 最近祖先状态。使用范围：判定反链和 Protyle 容器。解耦评估：纯谓词可替换。 */
import {hasClosestByClassName} from "./imports";
/** 用途：校验模型是否为反链领域根。使用范围：普通布局页签查询。解耦评估：守卫只依赖厂牌。 */
import {isBacklinkDomain} from "./imports";
/** 用途：收窄布局查询结果为页签。使用范围：读取页签模型。解耦评估：守卫不依赖具体 Tab class。 */
import {isLayoutTab} from "./imports";
/** 用途：匹配用户键盘快捷键。使用范围：插件命令和面板动作。解耦评估：函数只消费参数。 */
import {matchHotKey} from "./imports";
/** 用途：分派面板键盘状态空间。使用范围：DOM 事实收集后。解耦评估：路由只接收值对象。 */
import {resolveBacklinkPanelKeyCommand} from "./imports";

/** 处理面板树键盘事件，并把底部反链的领域动作交给 Backlink 根。需要在同一 DOM 事件栈内完成默认行为判定。 @同步豁免: 需要绝对同步的DOM访问 */
export const panelTreeKeydown = (app: AppFacade, event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLElement)) {
        return false;
    }
    const target = event.target;
    const bottomBacklinkElement = hasClosestByClassName(target, "sy__backlink--bottom", true) || null;
    const keyCommand = resolveBacklinkPanelKeyCommand({
        insideBottomBacklink: bottomBacklinkElement !== null,
        insideTextControl: ["INPUT", "TEXTAREA"].includes(target.tagName),
        insideContentEditable: hasClosestByAttribute(target, "contenteditable", null) !== null,
        insideNestedProtyle: hasClosestByClassName(target, "protyle", true) !== null,
    });
    if (keyCommand === "ignore") {
        return false;
    }

    const bottomBacklink = keyCommand === "bottom-backlink" && bottomBacklinkElement ?
        getAllModels().backlink.find(item => item.type === "bottom" && item.element === bottomBacklinkElement) : undefined;
    const activePanelElement = getActivePanelElement(bottomBacklinkElement);
    if (!activePanelElement) {
        return false;
    }
    if (!bottomBacklink && activePanelElement.className.indexOf("sy__") === -1) {
        return false;
    }
    if (!bottomBacklink && handlePluginDockCommand(app, activePanelElement, event)) {
        return true;
    }
    const config = window.siyuan.config;
    if (!config) {
        return false;
    }
    // 底部反链面板不再拦截折叠/展开快捷键：底部工具栏不提示这些快捷键，
    // 命中时把事件交还编辑器自身处理，避免面板与正文折叠互相干扰。
    if (bottomBacklink && (matchHotKey(config.keymap.editor.general.collapse.custom, event) ||
        matchHotKey(config.keymap.editor.general.expand.custom, event))) {
        return false;
    }
    if (!matchHotKey(config.keymap.editor.general.collapse.custom, event) &&
        !matchHotKey(config.keymap.editor.general.expand.custom, event) &&
        !event.key.startsWith("Arrow") && event.key !== "Enter") {
        return false;
    }
    if (handlePanelToolbarCommand(bottomBacklink || getBacklinkModel(activePanelElement), activePanelElement, event)) {
        return true;
    }
    if (activePanelElement.classList.contains("sy__inbox") ||
        activePanelElement.classList.contains("sy__globalGraph") ||
        activePanelElement.classList.contains("sy__graph")) {
        return false;
    }
    const backlinkModel = bottomBacklink || getBacklinkModel(activePanelElement);
    if (!backlinkModel) {
        return false;
    }
    return navigateBacklinkTree(backlinkModel, event);
};

/** 作用：选择底部反链、活动页签或活动窗口中的面板元素。意图：统一 DOM 入口并保持布局查找顺序。调用时机：面板键盘事件完成所有权分派后。 */
const getActivePanelElement = (bottomBacklinkElement: HTMLElement | null) => {
    if (bottomBacklinkElement) {
        return bottomBacklinkElement;
    }
    const activePanel = document.querySelector<HTMLElement>(".layout__tab--active");
    if (activePanel) {
        return activePanel;
    }
    return Array.from(document.querySelectorAll<HTMLElement>(".layout__wnd--active .layout-tab-container > div"))
        .find(item => !item.classList.contains("fn__none") && item.className.indexOf("sy__") > -1) || null;
};

/** 作用：执行匹配当前面板和快捷键的插件 Dock 命令。意图：保持插件命令优先级。调用时机：普通布局面板已取得键盘所有权时。 */
const handlePluginDockCommand = (app: AppFacade, panelElement: HTMLElement, event: KeyboardEvent) => {
    for (const plugin of app.plugins) {
        for (const command of plugin.commands) {
            // 只有插件声明 Dock 回调且快捷键命中时才把事件交给插件。
            if (command.dockCallback && matchHotKey(command.customHotkey, event)) {
                command.dockCallback(panelElement);
                return true;
            }
        }
    }
    return false;
};

/** 作用：处理面板折叠和展开快捷键。意图：优先使用反链领域动作，否则触发既有 DOM 控件。调用时机：树导航前的通用面板阶段。 */
const handlePanelToolbarCommand = (backlink: BacklinkDomain | undefined, panelElement: HTMLElement, event: KeyboardEvent) => {
    const config = window.siyuan.config;
    if (!config || event.repeat) {
        return false;
    }
    const action = matchHotKey(config.keymap.editor.general.collapse.custom, event) ? "collapse" :
        matchHotKey(config.keymap.editor.general.expand.custom, event) ? "expand" : undefined;
    if (!action) {
        return false;
    }
    if (backlink) {
        backlink.executeKeyboardToolbarAction(action);
        event.preventDefault();
        return true;
    }
    const actionElement = panelElement.querySelector(`.block__icon[data-type="${action}"]`);
    if (!actionElement) {
        return false;
    }
    actionElement.dispatchEvent(new CustomEvent("click"));
    event.preventDefault();
    return true;
};

/** 作用：定位当前反链树节点并进入节点级键盘处理。意图：让面板入口只编排领域行为。调用时机：活动面板已确认是反链模型时。 */
const navigateBacklinkTree = (backlinkModel: BacklinkDomain, event: KeyboardEvent) => {
    const visibleTreeElements = getVisibleTreeElements(backlinkModel);
    const focusedItemElement = findTreeItem(visibleTreeElements, ".b3-list-item--focus");
    const activeItemElement = focusedItemElement || findTreeItem(visibleTreeElements, ".b3-list-item");
    if (!activeItemElement) {
        return false;
    }
    if (!focusedItemElement) {
        activeItemElement.classList.add("b3-list-item--focus");
        backlinkModel.reportKeyboardTreeNavigation(activeItemElement);
        return false;
    }
    const ulElement = hasClosestByClassName(activeItemElement, "b3-list");
    if (!ulElement) {
        return false;
    }
    return handleTreeItemKey({backlink: backlinkModel, item: activeItemElement, treeElement: ulElement, event});
};

/** 作用：执行单个反链树节点的激活、展开和方向移动。意图：集中维护键盘动作顺序。调用时机：已找到焦点树节点和所属列表时。 */
const handleTreeItemKey = (context: {
    backlink: BacklinkDomain;
    item: HTMLElement;
    treeElement: HTMLElement;
    event: KeyboardEvent;
}) => {
    const {backlink, item, treeElement, event} = context;
    // Enter 激活当前节点并由领域根记录键盘触发来源。
    if (event.key === "Enter") {
        backlink.activateTreeItem(item, "keyboard");
        event.preventDefault();
        return true;
    }
    const arrowElement = item.querySelector(".b3-list-item__arrow");
    // 方向键仅在节点存在可见箭头时改变展开状态。
    if (arrowElement && arrowElement.parentElement &&
        ((event.key === "ArrowRight" && !arrowElement.classList.contains("b3-list-item__arrow--open") && !arrowElement.parentElement.classList.contains("fn__hidden")) ||
            (event.key === "ArrowLeft" && arrowElement.classList.contains("b3-list-item__arrow--open") && !arrowElement.parentElement.classList.contains("fn__hidden")))) {
        backlink.toggleTreeItem(item, "keyboard");
        event.preventDefault();
        return true;
    }
    const next = event.key === "ArrowLeft" ? getParentTreeItem(item, treeElement) :
        event.key === "ArrowUp" ? findPreviousTreeItem(item) :
            event.key === "ArrowDown" || event.key === "ArrowRight" ? findNextTreeItem(item) : null;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowRight") {
        return false;
    }
    focusTreeItem({current: item, next, backlink, treeElement});
    event.preventDefault();
    return true;
};

/** 作用：从布局页签安全取得反链完整领域根。意图：避免键盘模块依赖 Backlink class。调用时机：普通布局面板需要反链行为时。 */
const getBacklinkModel = (panelElement: HTMLElement) => {
    const id = panelElement.getAttribute("data-id");
    const layout = window.siyuan.layout;
    if (!id || !layout) {
        return undefined;
    }
    const instance = getInstanceById(id, layout.layout);
    if (!instance || !isLayoutTab(instance)) {
        return undefined;
    }
    return isBacklinkDomain(instance.model) ? instance.model : undefined;
};

/** 作用：筛出当前可见的反链和反向提及树。意图：键盘焦点只进入可见树。调用时机：每次反链树导航开始时。 */
const getVisibleTreeElements = (backlink: BacklinkDomain) => [backlink.tree.element, backlink.mTree.element]
    .filter(element => !element.classList.contains("fn__none"));

/** 作用：按树顺序查找匹配选择器的节点。意图：兼容反链和反向提及两个树容器。调用时机：恢复焦点或初始化焦点时。 */
const findTreeItem = (treeElements: readonly HTMLElement[], selector: string) => {
    for (const treeElement of treeElements) {
        const item = treeElement.querySelector<HTMLElement>(selector);
        if (item) {
            return item;
        }
    }
    return null;
};

/** 作用：收窄 DOM 元素为 HTMLElement。意图：拒绝 SVG 或空兄弟节点进入键盘布局计算。调用时机：遍历树的兄弟和父节点时。 */
const getHTMLElement = (element: Element | null) => element instanceof HTMLElement ? element : null;

/** 作用：计算当前节点的可聚焦父级节点。意图：保持左箭头返回上级的原有树结构语义。调用时机：处理 ArrowLeft 节点移动时。 */
const getParentTreeItem = (item: HTMLElement, treeElement: HTMLElement) => {
    const parent = item.parentElement;
    const previous = getHTMLElement(parent?.previousElementSibling || null);
    if (!previous) {
        return null;
    }
    return previous.tagName === "LI" ? previous : treeElement.querySelector<HTMLElement>(".b3-list-item");
};

/** 作用：按展开状态计算下一个树节点。意图：跳过折叠内容和反链预览 DOM。调用时机：处理 ArrowDown 或未展开的 ArrowRight 时。 */
const findNextTreeItem = (item: HTMLElement) => {
    let current: HTMLElement | null = item;
    while (current) {
        const sibling = getHTMLElement(current.nextElementSibling);
        if (sibling && sibling.tagName === "UL") {
            return sibling.classList.contains("fn__none") ? getHTMLElement(sibling.nextElementSibling) :
                getHTMLElement(sibling.firstElementChild);
        }
        if (sibling && sibling.classList.contains("protyle")) {
            return getHTMLElement(sibling.nextElementSibling);
        }
        if (sibling) {
            return sibling;
        }
        const parent: HTMLElement | null = current.parentElement;
        if (!parent || parent.classList.contains("fn__flex-1")) {
            return null;
        }
        current = parent;
    }
    return null;
};

/** 作用：按树结构计算上一个树节点。意图：在折叠内容和嵌套预览间保持可见顺序。调用时机：处理 ArrowUp 时。 */
const findPreviousTreeItem = (item: HTMLElement) => {
    let current: HTMLElement | null = item;
    while (current) {
        const sibling = getHTMLElement(current.previousElementSibling);
        if (sibling && sibling.tagName === "LI") {
            return sibling;
        }
        if (sibling && (sibling.classList.contains("protyle") ||
            (sibling.tagName === "UL" && sibling.classList.contains("fn__none")))) {
            return getHTMLElement(sibling.previousElementSibling);
        }
        if (sibling) {
            const items = sibling.querySelectorAll<HTMLElement>(".b3-list-item");
            return items.item(items.length - 1) || null;
        }
        const parent: HTMLElement | null = current.parentElement;
        if (!parent || parent.classList.contains("fn__flex-1")) {
            return null;
        }
        current = parent;
    }
    return null;
};

/** 作用：更新树节点焦点、上报键盘意图并按需滚动。意图：集中保证 DOM、领域事件和视口同步。调用时机：方向键得到新节点后。 */
const focusTreeItem = (context: {
    current: HTMLElement;
    next: HTMLElement | null;
    backlink: BacklinkDomain;
    treeElement: HTMLElement;
}) => {
    const {current, next, backlink, treeElement} = context;
    if (!next || !next.classList.contains("b3-list-item") || next.classList.contains("b3-list-item--focus")) {
        return;
    }
    current.classList.remove("b3-list-item--focus");
    next.classList.add("b3-list-item--focus");
    backlink.reportKeyboardTreeNavigation(next);
    const scrollContainer = treeElement.parentElement;
    if (!scrollContainer) {
        return;
    }
    const itemRect = next.getBoundingClientRect();
    const scrollRect = scrollContainer.getBoundingClientRect();
    // 仅在新节点越过可视滚动区域时调整滚动位置。
    if (itemRect.top < scrollRect.top || itemRect.bottom > scrollRect.bottom) {
        next.scrollIntoView(itemRect.top < scrollRect.top);
    }
};
