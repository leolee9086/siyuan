/**
 * 用途：引入应用实例类型，标注键盘导航入口需要的应用上下文参数。
 * 使用范围：仅供 [`dialogArrow`](app/src/boot/globalEvent/keydown/dialogArrow.ts:191) 与内部确认逻辑的参数类型标注使用。
 * 解耦评估：`AppFacade` 属于纯类型依赖，不引入运行时耦合；通过同目录 [`imports.ts`](app/src/boot/globalEvent/keydown/imports.ts) 转发后，当前文件无需直接依赖跨层路径。
 */
import type { AppFacade } from "./imports";
/**
 * 用途：引入共享常量，供打开文档时传递焦点与滚动动作标记。
 * 使用范围：仅供 [`activateDialogItem`](app/src/boot/globalEvent/keydown/dialogArrow.ts:93) 构造 [`openFileById`](app/src/boot/globalEvent/keydown/imports.ts:55) 参数时使用。
 * 解耦评估：共享常量属于稳定契约，不应重写为硬编码；经网关转发后已把路径耦合限制在目录边界内。
 */
import { Constants } from "./imports";
/**
 * 用途：引入 HTML 转义工具，保证路径预览写回 DOM 时不会注入未转义内容。
 * 使用范围：仅供 [`updatePathPreview`](app/src/boot/globalEvent/keydown/dialogArrow.ts:127) 处理后端返回路径文本时使用。
 * 解耦评估：安全转义属于基础工具能力，不应在事件模块中重复实现；通过网关转发可减少跨目录直接依赖。
 */
import { escapeHtml } from "./imports";
/**
 * 用途：引入异步 POST 请求能力，用于查询文档完整路径。
 * 使用范围：仅供 [`updatePathPreview`](app/src/boot/globalEvent/keydown/dialogArrow.ts:120) 在焦点切换后刷新底部预览区域时使用。
 * 解耦评估：网络请求属于基础设施能力，理论上可抽象为 service 注入，但当前键盘入口层直接消费统一请求封装的成本更低；经网关转发后耦合面已经收敛。
 */
import { fetchPost } from "./imports";
/**
 * 用途：引入 dock 查询能力，供回车确认 dock 类项目时切换对应面板。
 * 使用范围：仅供 [`activateDialogItem`](app/src/boot/globalEvent/keydown/dialogArrow.ts:89) 处理带 `data-type` 的列表项时使用。
 * 解耦评估：布局系统当前以全局查询 API 暴露 dock 能力，未来可进一步命令化；在现阶段通过网关转发已经是较稳妥的低成本解耦。
 */
import { getDockByType } from "./imports";
/**
 * 用途：引入浮层隐藏工具，供确认当前项后关闭对话框。
 * 使用范围：仅供 [`dialogArrow`](app/src/boot/globalEvent/keydown/dialogArrow.ts:202) 在处理回车分支时使用。
 * 解耦评估：UI 清理逻辑目前集中于公共工具函数，未来可迁移到更显式的对话框控制器；当前通过网关转发已减少路径耦合。
 */
import { hideElements } from "./imports";
/**
 * 用途：引入卡片入口，处理 `riffCard` 类型列表项的确认动作。
 * 使用范围：仅供 [`activateDialogItem`](app/src/boot/globalEvent/keydown/dialogArrow.ts:84) 处理特殊业务项时使用。
 * 解耦评估：该动作是明确的业务入口，理论上可继续抽象到命令层；现阶段经网关转发即可避免业务文件直接跨层导入。
 */
import { openCard } from "./imports";
/**
 * 用途：引入按节点 ID 打开文档的统一入口。
 * 使用范围：仅供 [`activateDialogItem`](app/src/boot/globalEvent/keydown/dialogArrow.ts:93) 在文档列表项回车确认时使用。
 * 解耦评估：文档打开逻辑已经封装为稳定工具函数，未来如改为命令总线只需替换网关导出；当前做法已显著降低路径耦合。
 */
import { openFileById } from "./imports";

const FOCUS_SELECTOR = ".b3-list-item--focus";
const FOCUS_CLASS = "b3-list-item--focus";
const PATH_SELECTOR = ".switch-doc__path";

/**
 * 作用：为合法的列表项元素补充焦点样式，并返回可继续使用的 HTMLElement。
 * 意图：统一处理 DOM 类型收窄与焦点样式写入，避免在多个分支中重复进行空值判断。
 * 调用时机：方向键计算出下一焦点项之后，由对话框导航流程立即调用。
 * 问题/改进：如果未来焦点样式类名发生变化，应同步更新顶部常量以保持行为一致。
 */
const focusListItem = (target: Element | null) => {
    // 场景：只有真实的 HTMLElement 才允许写入 classList，避免对 null 或非 HTMLElement 执行 DOM 操作。
    if (!(target instanceof HTMLElement)) {
        throw new Error("dialogArrow: target list item must be an HTMLElement");
    }
    target.classList.add(FOCUS_CLASS);
    return target;
};

/**
 * 作用：根据上下方向键解析同一列中的下一个焦点项，并支持首尾循环。
 * 意图：把纵向导航规则收敛到单个函数，降低导出函数的复杂度和实际代码行数。
 * 调用时机：按下 ArrowUp 或 ArrowDown 时由导航入口调用。
 * 问题/改进：当前循环逻辑假设父容器只包含可聚焦项，如果后续引入分隔元素需要额外过滤。
 */
const getVerticalTarget = (currentLiElement: HTMLElement, isPrev: boolean) => {
    const parentElement = currentLiElement.parentElement;
    // 场景：焦点项必须位于列表容器中，缺失父容器时说明 DOM 结构不符合导航约定，需立即报错。
    if (!(parentElement instanceof HTMLElement)) {
        throw new Error("dialogArrow: focused list item must have a parent list container");
    }
    if (isPrev) {
        return currentLiElement.previousElementSibling ?? parentElement.lastElementChild;
    }
    return currentLiElement.nextElementSibling ?? parentElement.firstElementChild;
};

/**
 * 作用：根据当前索引在左右列之间寻找最合适的对应焦点项。
 * 意图：避免直接链式访问 DOM 返回值，顺便统一处理缺失同索引项时的降级策略。
 * 调用时机：按下 ArrowLeft 或 ArrowRight 时由导航入口调用。
 * 问题/改进：当前优先命中同 data-index 项，否则退化到目标列最后一项；若未来产品需要更精确的行对齐，可在此扩展匹配策略。
 */
const getHorizontalTarget = (currentLiElement: HTMLElement) => {
    const parentElement = currentLiElement.parentElement;
    // 场景：横向切列依赖当前项所在列，父容器不存在时说明 DOM 结构异常，需立即报错。
    if (!(parentElement instanceof HTMLElement)) {
        throw new Error("dialogArrow: focused list item must have a parent column");
    }
    const sideElement = parentElement.previousElementSibling ?? parentElement.nextElementSibling;
    // 场景：按下左右方向键却找不到相邻列时，说明输入场景与布局结构不匹配，需直接报错而非静默回退。
    if (!(sideElement instanceof HTMLElement)) {
        throw new Error("dialogArrow: horizontal navigation requires an adjacent column");
    }
    const currentIndex = currentLiElement.getAttribute("data-index");
    const sameIndexElement = currentIndex ? sideElement.querySelector(`[data-index="${currentIndex}"]`) : null;
    const fallbackElement = sideElement.lastElementChild;
    if (!sameIndexElement && !fallbackElement) {
        throw new Error("dialogArrow: adjacent column does not contain any navigable item");
    }
    return sameIndexElement ?? fallbackElement;
};

/**
 * 作用：执行回车确认后的目标激活逻辑，包括打开卡片、切换 dock 或打开文档。
 * 意图：把业务动作与导航动作分离，既减少主函数分支深度，也便于补充空值保护。
 * 调用时机：用户在切换对话框或最近文档对话框中按下 Enter 时调用。
 * 问题/改进：当前 dock 和文档打开逻辑仍沿用既有业务接口，若后续这些接口统一 Promise 错误处理，可在此补充捕获与上报。
 */
const activateDialogItem = async (app: AppFacade, currentLiElement: HTMLElement) => {
    const currentType = currentLiElement.getAttribute("data-type");
    // 场景：riffCard 属于特殊入口，不经过通用 dock 切换流程，需要单独触发开卡逻辑。
    if (currentType === "riffCard") {
        openCard(app);
        return;
    }
    // 场景：其余带 data-type 的项表示 dock 入口；若类型存在但 dock 实例不存在，说明输入数据与运行时布局状态不一致，必须立即报错。
    const dock = currentType ? getDockByType(currentType) : null;
    if (currentType && !dock) {
        throw new Error(`dialogArrow: dock type \"${currentType}\" could not be resolved`);
    }
    // 场景：只有同时拿到合法的 data-type 与对应 dock 实例时，才允许执行面板切换，避免把空类型传入布局层接口。
    if (dock && currentType) {
        dock.toggleModel(currentType, true);
        return;
    }
    const nodeId = currentLiElement.getAttribute("data-node-id");
    // 场景：文档项缺失 data-node-id 说明输入数据不符合预期，必须直接报错而不是静默跳过。
    if (!nodeId) {
        throw new Error("dialogArrow: document list item must provide data-node-id");
    }
    await openFileById({
        action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL],
        app,
        id: nodeId,
    });
};

/**
 * 作用：根据当前焦点项更新对话框底部的路径预览文本。
 * 意图：集中处理路径面板、文档标题面板和异步路径查询，消除散落的空值与回调风险。
 * 调用时机：方向键移动焦点成功后立即调用。
 * 问题/改进：异步路径请求存在返回顺序不可控的问题，这里通过 dataset 令牌避免旧请求覆盖新焦点内容。
 */
const updatePathPreview = (element: HTMLElement, currentLiElement: HTMLElement) => {
    const pathElement = element.querySelector<HTMLElement>(PATH_SELECTOR);
    // 场景：路径预览容器缺失说明当前对话框结构不满足导航模块契约，必须立即报错。
    if (!pathElement) {
        throw new Error("dialogArrow: dialog must contain a .switch-doc__path element");
    }
    const rootId = currentLiElement.getAttribute("data-node-id");
    // 场景：缺失 rootId 说明当前焦点项不满足路径预览的最小输入条件，必须直接报错而不是回退展示文本。
    if (!rootId) {
        throw new Error("dialogArrow: focused list item must provide data-node-id for path preview");
    }
    pathElement.dataset.nodeId = rootId;
    fetchPost("/api/filetree/getFullHPathByID", {
        id: rootId,
    }, (response) => {
        // 场景：用户快速切换焦点时，旧请求返回后不应覆盖当前项的路径预览。
        if (pathElement.dataset.nodeId !== rootId) {
            return;
        }
        pathElement.innerHTML = escapeHtml(response.data);
    });
};

/**
 * 作用：确保当前焦点项在其滚动容器的可视区域内。
 * 意图：把滚动修正逻辑独立出来，避免主流程在导航、预览和滚动三类职责之间混杂。
 * 调用时机：焦点移动并更新预览之后调用。
 * 问题/改进：当前使用 scrollIntoView 的布尔参数保持旧行为，未来可改为 options 形式获得更细的滚动控制。
 */
const keepFocusedItemVisible = (currentLiElement: HTMLElement) => {
    const parentElement = currentLiElement.parentElement;
    // 场景：只有在存在滚动父容器时，焦点可见性修正才有意义。
    if (!(parentElement instanceof HTMLElement)) {
        return;
    }
    const currentRect = currentLiElement.getBoundingClientRect();
    const currentParentRect = parentElement.getBoundingClientRect();
    // 场景：焦点项滚动到容器上方不可见时，需要向上滚动把它带回视口。
    if (currentRect.top < currentParentRect.top) {
        currentLiElement.scrollIntoView(true);
        return;
    }
    // 场景：焦点项滚动到容器下方不可见时，需要向下滚动保证用户持续看到当前选择。
    if (currentRect.bottom > currentParentRect.bottom) {
        currentLiElement.scrollIntoView(false);
    }
};

/**
 * 作用：根据输入按键决定对话框焦点应移动到哪个列表项。
 * 意图：以早返回方式集中描述方向键导航规则，避免额外映射对象、类型断言或更深层的嵌套分支。
 * 调用时机：键盘导航入口在处理非 Enter 键时调用。
 * 问题/改进：当前仅处理方向键；如果后续引入 Home/End，可继续在本函数内追加新分支规则。
 */
const resolveNextFocusTarget = (currentLiElement: HTMLElement, key: string) => {
    // 场景：按下上方向键时，需要在当前列内向前移动焦点并支持首尾循环。
    if (key === "ArrowUp") {
        return getVerticalTarget(currentLiElement, true);
    }
    // 场景：按下下方向键时，需要在当前列内向后移动焦点并支持首尾循环。
    if (key === "ArrowDown") {
        return getVerticalTarget(currentLiElement, false);
    }
    // 场景：按下左右方向键时，需要在相邻列之间按 data-index 对齐切换焦点。
    if (key === "ArrowLeft" || key === "ArrowRight") {
        return getHorizontalTarget(currentLiElement);
    }
    throw new Error(`dialogArrow: unsupported key \"${key}\"`);
};

/**
 * 作用：处理切换对话框与最近文档对话框中的方向键/回车导航。
 * 意图：统一焦点移动、回车激活、路径预览刷新与滚动修正逻辑，避免多个入口各自维护一套脆弱的 DOM 分支。
 * 调用时机：由 [`windowKeyDown`](app/src/boot/globalEvent/keydown/windowKeyDown.ts:52) 在相关对话框获得键盘事件时调用。
 * 问题/改进：当前实现仍依赖对话框 DOM 结构中的 data-index 与 data-node-id 约定；若结构未来调整，应同步更新对应辅助函数。
 */
// 导出语句注释：导出异步对话框方向键处理函数，供全局键盘事件入口复用。
export const dialogArrow = async (app: AppFacade, element: HTMLElement, event: KeyboardEvent) => {
    const currentLiElement = element.querySelector<HTMLElement>(FOCUS_SELECTOR);
    // 场景：导航入口没有当前焦点项时，说明调用方没有满足前置条件，必须直接报错。
    if (!currentLiElement) {
        throw new Error("dialogArrow: dialog navigation requires an existing focused list item");
    }
    // 场景：回车表示确认当前项，不应再继续执行焦点移动与预览刷新。
    if (event.key === "Enter") {
        await activateDialogItem(app, currentLiElement);
        hideElements(["dialog"]);
        return;
    }
    currentLiElement.classList.remove(FOCUS_CLASS);
    const nextLiElement = focusListItem(resolveNextFocusTarget(currentLiElement, event.key));
    updatePathPreview(element, nextLiElement);
    keepFocusedItemVisible(nextLiElement);
};
