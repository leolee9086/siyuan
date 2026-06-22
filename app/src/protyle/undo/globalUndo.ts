/** 用途：应用全局常量（快捷键命令标识与 API 调用参数）。使用范围：撤销/重做 API 请求参数。解耦评估：通过 imports.ts 转发。 */
import {Constants} from "./imports";
/** 用途：异步 POST 请求。使用范围：撤销状态查询与撤销/重做请求。解耦评估：通过 imports.ts 转发。 */
import {fetchPost} from "./imports";
/** 用途：确认对话框。使用范围：跨文档撤销时用户确认提示。解耦评估：通过 imports.ts 转发。 */
import {confirmDialog} from "./imports";
/** 用途：消息提示。使用范围：撤销/重做失败时反馈用户。解耦评估：通过 imports.ts 转发。 */
import {showMessage} from "./imports";
/** 用途：获取当前激活的页签。使用范围：getActiveProtyle 定位当前编辑器。解耦评估：通过 imports.ts 转发。 */
import {getActiveTab} from "./imports";
/** 用途：判断运行时是否为移动端。使用范围：getActiveProtyle 分支选择编辑器获取路径。解耦评估：通过 imports.ts 转发。 */
import {isMobile} from "./imports";
/** 用途：安全获取 window.siyuan.mobile。使用范围：getActiveProtyle 移动端编辑器实例获取。解耦评估：通过 imports.ts 转发。 */
import {getSafeSiyuanMobile} from "./imports";
/** 用途：获取全局语言国际化对象。使用范围：跨文档撤销确认对话框文案。解耦评估：通过 imports.ts 转发。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：获取全局浮窗面板列表。使用范围：getActiveProtyle 兜底搜索编辑器。解耦评估：通过 imports.ts 转发。 */
import {getSiyuanBlockPanels} from "./imports";
/** 用途：DOM 元素类型守卫。使用范围：替代 as HTMLElement 断言获取按钮元素。解耦评估：通过 imports.ts 转发。 */
import {isHTMLElement} from "./imports";
/** 用途：撤销/重做状态镜像类型定义。使用范围：镜像 Map 值类型标注。解耦评估：同目录类型文件，直接同层导入。 */
import {IUndoStateMirror} from "./undo.types";
/** 用途：判断模型对象是否包含 editor.protyle 属性。使用范围：getActiveProtyle 类型收窄。解耦评估：同目录守卫文件。 */
import {hasEditorProtyle} from "./globalUndo.guard";

/** 全局镜像缓存：按 rootID 缓存 {canUndo, canRedo}，零 fetch 读取撤销状态 */
const undoStateMirror = new Map<string, IUndoStateMirror>();
/** @同步豁免: 生命周期 - 撤销/重做互斥锁，同步保证原子性 */
let isUndoing = false;

/**
 * 更新撤销/重做按钮的 disabled 状态（读镜像，零 fetch）。
 *
 * @param selector 按钮的 data-type 选择器
 * @param canDo    是否可操作
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 按钮 disabled 状态必须在同一 tick 内更新以保证 UI 响应
 */
const updateButton = (parent: HTMLElement, selector: string, canDo: boolean) => {
    const element = parent.querySelector(selector);
    if (!isHTMLElement(element)) {
        return;
    }
    if (canDo) {
        element.removeAttribute("disabled");
        return;
    }
    element.setAttribute("disabled", "disabled");
};

/** 跨文档提示确认期间拦截编辑器键盘输入 */
const blockInput = (e: Event) => {
    e.stopImmediatePropagation();
    e.preventDefault();
};

/**
 * 写入或合并更新指定文档的撤销状态镜像。
 *
 * @param rootID 文档根块 ID
 * @param state  需要更新的状态片段
 *
 * @同步豁免: 性能考虑 - Map 写入操作在编辑热路径中大量调用，避免 async 微任务开销
 */
export const markMirror = (rootID: string, state: Partial<IUndoStateMirror>) => {
    const cur = undoStateMirror.get(rootID) || {canUndo: false, canRedo: false};
    undoStateMirror.set(rootID, {...cur, ...state});
};

/**
 * 读取指定文档的撤销状态镜像。
 *
 * @param rootID 文档根块 ID
 * @returns 撤销状态对象，保证不为 undefined
 *
 * @同步豁免: 性能考虑 - 频繁读取，避免 async 微任务开销
 */
export const getMirror = (rootID: string) => {
    return undoStateMirror.get(rootID) || {canUndo: false, canRedo: false};
};

/**
 * 从 WS 广播 context.undoState 批量更新镜像（多窗口/多端同步）。
 *
 * @param undoState 以 rootID 为键的撤销状态映射
 *
 * @同步豁免: 性能考虑 - WS 广播在同步上下文中处理，避免异步排队导致按钮态闪烁
 */
export const syncMirrorFromBroadcast = (undoState: { [rootID: string]: { canUndo: boolean; canRedo: boolean } }) => {
    if (!undoState) {
        return;
    }
    for (const [rootID, state] of Object.entries(undoState)) {
        undoStateMirror.set(rootID, {canUndo: !!state.canUndo, canRedo: !!state.canRedo});
    }
};

/**
 * 文档打开时主动初始化撤销状态镜像（低频操作）。
 *
 * @param rootID 文档根块 ID
 *
 * @同步豁免: 遗留代码 - callback API，仅触发请求不等待响应
 */
export const initMirror = (rootID: string) => {
    if (!rootID) {
        return;
    }
    fetchPost("/api/transactions/undoState", {rootID}, (response: IWebSocketData) => {
        const data = response.data;
        if (data) {
            undoStateMirror.set(rootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
        }
    });
};

/**
 * 刷新指定 protyle 的撤销/重做按钮 disabled 状态（读镜像，零 fetch）。
 *
 * @param protyle 编辑器实例
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const refreshUndoButtons = (protyle: IProtyle) => {
    const rootID = protyle.block?.rootID;
    if (!rootID) {
        return;
    }
    const state = getMirror(rootID);
    const parent = protyle.breadcrumb?.element.parentElement;
    if (!parent) {
        return;
    }
    updateButton(parent, '[data-type="undo"]', state.canUndo);
    updateButton(parent, '[data-type="redo"]', state.canRedo);
};

/**
 * 获取当前激活的 Protyle 编辑器实例。
 *
 * 支持多窗口、移动端以及浮窗面板场景，按优先级：
 * 1. 移动端：优先 popEditor，其次 editor
 * 2. 桌面端：取当前激活页签的编辑器
 * 3. 兜底：搜索所有浮窗面板中聚焦的那个
 *
 * @returns 编辑器实例，未找到时返回 undefined
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 返回值立即用于编辑器滚动操作
 */
export const getActiveProtyle = () => {
    // 移动端：从 popEditor 或 editor 获取当前编辑器的 protyle 实例
    if (isMobile()) {
        const siyuanMobile = getSafeSiyuanMobile();
        const editor = siyuanMobile?.popEditor || siyuanMobile?.editor;
        return editor?.protyle;
    }
    // 桌面端从当前激活页签的模型中获取 protyle 实例
    const activeTab = getActiveTab();
    const model = activeTab?.model;
    if (hasEditorProtyle(model)) {
        return model.editor.protyle;
    }
    // 兜底：搜索/反链/自定义编辑器中聚焦的那个
    try {
        const allProtyle = getSiyuanBlockPanels();
        for (const panel of allProtyle) {
            // 只检查当前 activeElement 所在的浮窗面板，确保在面板内容区域中聚焦
            if (panel.element && document.activeElement && panel.element.contains(document.activeElement)) {
                const firstEditor = panel.editors?.[0];
                return firstEditor?.protyle;
            }
        }
    } catch {
        // getSiyuanBlockPanels 在 blockPanels 不存在时抛出异常
    }
    return undefined;
};

/** 解析单个 rootID 为文档名（API 回调）。用于跨文档撤销确认提示。 */
const handleGetHPathResponse = (names: string[], id: string, resolve: () => void) => (response: IWebSocketData) => {
    // 仅在 API 返回成功（code === 0）且有数据时将响应数据推入列表，否则使用原始 ID 兜底
    if (response.code === 0 && response.data) {
        names.push(String(response.data));
        resolve();
        return;
    }
    names.push(id);
    resolve();
};

/** 解析 rootID 列表为文档名，用于跨文档撤销确认提示 */
const resolveRootNames = async (rootIDs: string[]) => {
    const names: string[] = [];
    for (const id of rootIDs) {
        await new Promise<void>((resolve) => {
            fetchPost("/api/filetree/getHPathByID", {id}, handleGetHPathResponse(names, id, resolve));
        });
    }
    return names;
};

/** 滚动发起窗口的焦点 protyle 到指定的变更块位置 */
const focusRootIDs = (rootIDs: string[], focusBlockId?: string) => {
    // 只滚动发起窗口的焦点 protyle 到变更块；其它文档不强制重开（撤销物理结果在发起文档）
    const protyle = getActiveProtyle();
    if (!protyle || !protyle.block?.rootID || !rootIDs.includes(protyle.block.rootID)) {
        return;
    }
    // 优先滚动到指定的变更块；未指定时滚到文档首块（兜底）
    const firstNode = protyle.wysiwyg?.element.querySelector("[data-node-id]");
    const targetId = focusBlockId || firstNode?.getAttribute("data-node-id");
    if (!targetId) {
        return;
    }
    const target = protyle.wysiwyg?.element.querySelector(`[data-node-id="${targetId}"]`);
    target?.scrollIntoView({behavior: "smooth", block: "center"});
};

/** 使用 kernel API 查询 undoState，获取栈顶跨文档变更涉及的 rootID 列表 */
const fetchPeekMutatedRootIDs = (rootID: string) => {
    return new Promise<string[]>((resolve) => {
        fetchPost("/api/transactions/undoState", {rootID}, (response: IWebSocketData) => {
            resolve(response.data?.peekMutatedRootIDs || []);
        });
    });
};

/** 弹出跨文档撤销确认对话框，等待用户确认 */
const showCrossDocConfirm = async (protyle: IProtyle, rootIDs: string[]) => {
    const names = await resolveRootNames(rootIDs);
    // 确认期间拦截当前编辑器的键盘输入（遮罩只挡鼠标点击，不挡键盘冒泡）
    protyle.wysiwyg?.element.addEventListener("keydown", blockInput, true);
    protyle.wysiwyg?.element.addEventListener("beforeinput", blockInput, true);
    const languages = getSiyuanLanguages();
    const confirmed = await new Promise<boolean>((resolve) => {
        confirmDialog(`⚠️ ${languages.undo}`,
            `${languages.undoCrossDocConfirm}<div style="margin-top: 8px;">${names.map(n => `• ${n}`).join("<br>")}</div>`,
            () => resolve(true),
            () => resolve(false));
    });
    protyle.wysiwyg?.element.removeEventListener("keydown", blockInput, true);
    protyle.wysiwyg?.element.removeEventListener("beforeinput", blockInput, true);
    return confirmed;
};

/** 处理撤销 API 返回结果：更新镜像 → 本地乐观应用 → 刷新按钮态 → 滚动到变更块 */
const handleUndoResponse = (protyle: IProtyle, rootID: string) => (response: IWebSocketData) => {
    isUndoing = false;
    const data = response.data;
    if (!data) {
        return;
    }
    // 撤销执行失败：kernel 已回滚栈，镜像不动，用 msg 提示用户
    if (data.failed && data.msg) {
        showMessage(data.msg);
        return;
    }
    // 栈空或无可撤销：kernel 已返回空操作结果，仅记录状态后返回
    if (!data.undoOperations || data.undoOperations.length === 0) {
        markMirror(rootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
        refreshUndoButtons(protyle);
        return;
    }
    markMirror(rootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
    const mutatedRootIDs: string[] = data.mutatedRootIDs || [];
    // 跨文档撤销：doOperations 的锚点分散在多个文档，当前 protyle 无法本地乐观应用。
    // 改为靠 kernel 广播（含发起方）刷新所有涉及文档的 DOM。
    if (mutatedRootIDs.length > 1) {
        refreshUndoButtons(protyle);
        // 广播会到达当前窗口（/undo 对跨文档用 PushModeBroadcast），触发 onTransaction 刷新 DOM
        return;
    }
    // 单文档撤销：发起窗口本地乐观应用 doOperations
    protyle.undo?.renderLocal(protyle, data.doOperations, false);
    refreshUndoButtons(protyle);
    const focusBlockId = data.doOperations?.find((op: IOperation) => op.action === "insert")?.id;
    focusRootIDs(mutatedRootIDs, focusBlockId);
};

/**
 * 请求撤销：读镜像判可撤销 → 跨文档提示 → 调 kernel undo → 本地乐观应用 + 更新镜像。
 *
 * @param protyle 发起撤销的编辑器实例
 */
export const requestUndo = async (protyle: IProtyle) => {
    if (!protyle || isUndoing) {
        return;
    }
    const rootID = protyle.block?.rootID;
    if (!rootID) {
        return;
    }
    const state = getMirror(rootID);
    if (!state.canUndo) {
        return; // 语义 B：栈空不做事
    }
    // 尽早置锁，阻止确认对话框期间触发新的撤销/重做（含 peek 与确认阶段）
    isUndoing = true;
    // 跨文档提示：先 peek 栈顶的 mutatedRootIDs（超过 1 个说明涉及跨文档撤销，需要用户确认）
    const mutatedRootIDs = await fetchPeekMutatedRootIDs(rootID);
    // 仅当栈顶操作涉及多个文档时才弹出跨文档确认对话框；用户拒绝则复位锁
    if (mutatedRootIDs.length > 1 && !(await showCrossDocConfirm(protyle, mutatedRootIDs))) {
        isUndoing = false; // 拒绝，复位锁，栈与镜像不动
        return;
    }
    fetchPost("/api/transactions/undo", {
        rootID,
        app: Constants.SIYUAN_APPID,
        session: protyle.id,
    }, handleUndoResponse(protyle, rootID));
};

/** 处理重做 API 返回结果：更新镜像 → 本地乐观应用 → 刷新按钮态 → 滚动到变更块 */
const handleRedoResponse = (protyle: IProtyle, rootID: string) => (response: IWebSocketData) => {
    isUndoing = false;
    const data = response.data;
    if (!data) {
        return;
    }
    // 重做执行失败：kernel 已回滚栈，镜像不动，用 msg 提示用户
    if (data.failed && data.msg) {
        showMessage(data.msg);
        return;
    }
    // 栈空或无可重做：kernel 已返回空操作结果，仅记录状态后返回
    if (!data.doOperations || data.doOperations.length === 0) {
        markMirror(rootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
        refreshUndoButtons(protyle);
        return;
    }
    markMirror(rootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
    const mutatedRootIDs: string[] = data.mutatedRootIDs || [];
    // 跨文档重做：锚点分散在多个文档，靠 kernel 广播（含发起方）刷新
    if (mutatedRootIDs.length > 1) {
        refreshUndoButtons(protyle);
        return;
    }
    // 单文档重做：发起窗口本地乐观应用 doOperations
    protyle.undo?.renderLocal(protyle, data.doOperations, true);
    refreshUndoButtons(protyle);
    const focusBlockId = data.doOperations?.find((op: IOperation) => op.action === "insert")?.id;
    focusRootIDs(mutatedRootIDs, focusBlockId);
};

/**
 * 请求重做：对称，redo 不提示（其逆已在 undo 中确认）。
 *
 * @param protyle 发起重做的编辑器实例
 */
export const requestRedo = async (protyle: IProtyle) => {
    if (!protyle || isUndoing) {
        return;
    }
    const rootID = protyle.block?.rootID;
    if (!rootID) {
        return;
    }
    const state = getMirror(rootID);
    if (!state.canRedo) {
        return;
    }
    isUndoing = true;
    fetchPost("/api/transactions/redo", {
        rootID,
        app: Constants.SIYUAN_APPID,
        session: protyle.id,
    }, handleRedoResponse(protyle, rootID));
};
