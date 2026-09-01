/** 用途：应用全局常量（快捷键命令标识与 API 调用参数）。使用范围：撤销/重做 API 请求参数。解耦评估：通过 imports.ts 转发。 */
import {Constants} from "./imports";
/** 用途：异步 POST 请求。使用范围：撤销状态查询、文档名解析与撤销/重做请求。解耦评估：通过 imports.ts 转发。 */
import {fetchPost} from "./imports";
/** 用途：确认对话框。使用范围：跨文档撤销时用户确认提示。解耦评估：通过 imports.ts 转发。 */
import {confirmDialog} from "./imports";
/** 用途：消息提示。使用范围：撤销/重做失败时反馈用户。解耦评估：通过 imports.ts 转发。 */
import {showMessage} from "./imports";
/** 用途：获取当前激活的页签。使用范围：getActiveProtyle 定位当前编辑器。解耦评估：通过 imports.ts 转发。 */
import {getActiveTab} from "./imports";
/** 用途：判断运行时是否为移动端。使用范围：getActiveProtyle 与软键盘工具栏按钮同步的分支选择。解耦评估：通过 imports.ts 转发。 */
import {isMobile} from "./imports";
/** 用途：安全获取 window.siyuan.mobile。使用范围：getActiveProtyle 移动端编辑器实例获取。解耦评估：通过 imports.ts 转发。 */
import {getSafeSiyuanMobile} from "./imports";
/** 用途：获取全局语言国际化对象。使用范围：跨文档撤销确认对话框文案。解耦评估：通过 imports.ts 转发。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：获取全局浮窗面板列表。使用范围：getActiveProtyle 兜底搜索编辑器。解耦评估：通过 imports.ts 转发。 */
import {getSiyuanBlockPanels} from "./imports";
/** 用途：DOM 元素类型守卫。使用范围：替代 as HTMLElement 断言获取按钮元素。解耦评估：通过 imports.ts 转发。 */
import {isHTMLElement} from "./imports";
/** 用途：向上按 className 查找祖先元素。使用范围：getRangeRootID 识别嵌入块投影容器。解耦评估：通过 imports.ts 转发。 */
import {hasClosestByClassName} from "./imports";
/** 用途：从候选元素中定位撤销焦点目标。使用范围：嵌入块与源文档同 ID 块共存时的焦点定位。解耦评估：通过 imports.ts 转发。 */
import {getUndoFocusTarget} from "./imports";
/** 用途：撤销/重做状态镜像类型定义。使用范围：镜像 Map 值类型标注。解耦评估：同目录类型文件，直接同层导入。 */
import {IUndoStateMirror} from "./undo.types";
/** 用途：Editor 完整领域根守卫。使用范围：嵌套反链编辑器的撤销目标解析。解耦评估：守卫只依赖领域品牌。 */
import {isEditorDomain} from "../../editor/model/editorDomain.types";
/** 用途：等待当前输入事务提交完成。使用范围：撤销和重做请求发出前。解耦评估：通过 imports.ts 转发。 */
import {waitForPendingTransactions} from "./imports";

/**
 * 全局镜像缓存：按 rootID 缓存 {canUndo, canRedo}，零 fetch 读取撤销状态。
 *
 * 在编辑（add 落点）、撤销/重做响应、WS 广播（context.undoState）时更新。
 */
const undoStateMirror = new Map<string, IUndoStateMirror>();
/** 镜像初始化去重表：同一 rootID 的并发 initMirror 共享同一个请求 Promise */
const undoStateInitializers = new Map<string, Promise<boolean>>();
/** @同步豁免: 生命周期 - 撤销/重做互斥锁，同步保证原子性；防重入：撤销/重做进行中忽略后续触发 */
let isUndoing = false;

/**
 * 更新撤销/重做按钮的 disabled 状态（读镜像，零 fetch）。
 *
 * @param parent   按钮所在容器节点（面包屑父级或软键盘工具栏）
 * @param selector 按钮的 data-type 选择器
 * @param canDo    是否可操作
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 按钮 disabled 状态必须在同一 tick 内更新以保证 UI 响应
 */
const updateButton = (parent: ParentNode, selector: string, canDo: boolean) => {
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
export const getMirror = (rootID: string): IUndoStateMirror => {
    return undoStateMirror.get(rootID) || {canUndo: false, canRedo: false};
};

/** 判断指定文档的撤销状态镜像是否已初始化（未初始化时按钮态不可信） */
export const hasUndoStateMirror = (rootID: string) => undoStateMirror.has(rootID);

/** 从选区锚点向上解析其所属文档：落在嵌入块内则取嵌入块的 data-root-id，否则取编辑器当前文档 */
const getRangeRootID = (protyle: IProtyle, range?: Range) => {
    if (!range?.startContainer?.isConnected || !protyle.wysiwyg.element.contains(range.startContainer)) {
        return;
    }
    const embedElement = hasClosestByClassName(range.startContainer, "protyle-wysiwyg__embed");
    if (embedElement) {
        const rootID = embedElement.getAttribute("data-root-id");
        if (rootID) {
            return rootID;
        }
    }
    return protyle.block?.rootID;
};

// 嵌入块是源文档在当前编辑器中的投影，撤销目标应由具体查询结果决定，外层查询块不绑定单一文档。
export const getUndoRootID = (protyle: IProtyle, range?: Range, fallbackRootID?: string) => {
    if (!protyle) {
        return fallbackRootID;
    }
    const rangeRootID = getRangeRootID(protyle, range);
    if (rangeRootID) {
        return rangeRootID;
    }
    const selection = getSelection();
    if (selection.rangeCount > 0) {
        const selectionRootID = getRangeRootID(protyle, selection.getRangeAt(0));
        if (selectionRootID) {
            return selectionRootID;
        }
    }
    const toolbarRootID = getRangeRootID(protyle, protyle.toolbar?.range);
    return toolbarRootID || fallbackRootID || protyle.block?.rootID;
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
 * 文档打开时主动初始化撤销状态镜像（低频操作，不在 selectionchange 热路径）。
 * 同一 rootID 的并发初始化共享同一个请求，完成后从去重表移除。
 *
 * @param rootID 文档根块 ID
 * @returns 镜像是否完成初始化（kernel 响应携带了状态数据）
 */
export const initMirror = (rootID: string): Promise<boolean> => {
    if (!rootID) {
        return Promise.resolve(false);
    }
    const pending = undoStateInitializers.get(rootID);
    if (pending) {
        return pending;
    }
    const initializer = fetchPost("/api/transactions/undoState", {rootID}, (response: IWebSocketData) => {
        const data = response.data;
        if (data) {
            undoStateMirror.set(rootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
        }
    }).then(() => {
        return undoStateMirror.has(rootID);
    }).finally(() => {
        undoStateInitializers.delete(rootID);
    });
    undoStateInitializers.set(rootID, initializer);
    return initializer;
};

/**
 * 将镜像中的撤销/重做状态应用到指定 protyle 的所有按钮宿主（桌面面包屑 + 移动端软键盘工具栏）。
 *
 * @param protyle 编辑器实例
 * @param rootID  撤销目标文档根块 ID
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
const applyUndoButtons = (protyle: IProtyle, rootID: string) => {
    const state = getMirror(rootID);
    const applyState = (parent: ParentNode) => {
        updateButton(parent, '[data-type="undo"]', state.canUndo);
        updateButton(parent, '[data-type="redo"]', state.canRedo);
    };
    const breadcrumbParent = protyle.breadcrumb?.element.parentElement;
    if (breadcrumbParent) {
        applyState(breadcrumbParent);
    }
    // 移动端：软键盘工具栏上的撤销/重做按钮只属于当前编辑器，需一并同步按钮态
    if (isMobile()) {
        const siyuanMobile = getSafeSiyuanMobile();
        const editor = siyuanMobile?.popEditor || siyuanMobile?.editor;
        if (editor?.protyle === protyle && getUndoRootID(protyle, protyle.toolbar?.range) === rootID) {
            const keyboardToolbar = document.getElementById("keyboardToolbar");
            if (keyboardToolbar) {
                applyState(keyboardToolbar);
            }
        }
    }
};

/**
 * 刷新指定 protyle 的撤销/重做按钮 disabled 状态（读镜像，零 fetch）；
 * 首次进入嵌入源文档等镜像缺失场景时按需初始化并回填按钮态。
 *
 * @param protyle 编辑器实例
 * @param rootID  撤销目标文档根块 ID，缺省时按选区/工具栏范围推断（嵌入块感知）
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const refreshUndoButtons = (protyle: IProtyle, rootID = getUndoRootID(protyle)) => {
    if (!rootID) {
        return;
    }
    applyUndoButtons(protyle, rootID);
    if (!hasUndoStateMirror(rootID)) {
        initMirror(rootID).then((initialized) => {
            if (initialized && getUndoRootID(protyle) === rootID) {
                applyUndoButtons(protyle, rootID);
            }
        });
    }
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
    if (isEditorDomain(model)) {
        const selection = window.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
        return model.getCurrentProtyle(range);
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
const resolveRootNames = async (rootIDs: string[]): Promise<string[]> => {
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
    const wysiwygElement = protyle?.wysiwyg?.element;
    if (protyle && rootIDs.includes(protyle.block?.rootID) && focusBlockId && wysiwygElement) {
        const targets = Array.from(wysiwygElement.querySelectorAll(`[data-node-id="${focusBlockId}"]`));
        const selection = getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
        // 同 ID 块可能同时存在于嵌入块和源文档中，优先定位撤销后选区所在的副本。
        const target = getUndoFocusTarget(targets, item =>
            !!range && wysiwygElement.contains(range.startContainer) && item.contains(range.startContainer)
        );
        if (target) {
            const rect = target.getBoundingClientRect();
            // 仅在变更块不在视口内时才滚动，避免打断用户当前的滚动位置
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
                target.scrollIntoView({behavior: "smooth", block: "center"});
            }
        }
    }
};

/** 使用 kernel API 查询权威撤销状态：可用性 + 栈顶跨文档变更涉及的 rootID 列表 */
const fetchUndoState = async (rootID: string): Promise<{
    canUndo: boolean;
    canRedo: boolean;
    peekMutatedRootIDs: string[];
} | undefined> => {
    let state: {
        canUndo: boolean;
        canRedo: boolean;
        peekMutatedRootIDs: string[];
    } | undefined;
    await fetchPost("/api/transactions/undoState", {rootID}, (response: IWebSocketData) => {
        if (response.data) {
            state = {
                canUndo: !!response.data?.canUndo,
                canRedo: !!response.data?.canRedo,
                peekMutatedRootIDs: response.data?.peekMutatedRootIDs || [],
            };
        }
    });
    return state;
};

/** 发起撤销/重做请求并在回调中捕获完整响应（fetchPost 回调先于 Promise 兑现） */
const fetchUndoOperation = async (path: "/api/transactions/undo" | "/api/transactions/redo", data: {
    rootID: string;
    app: string;
    session: string;
}) => {
    let response: IWebSocketData | undefined;
    await fetchPost(path, data, (fetchResponse: IWebSocketData) => {
        response = fetchResponse;
    });
    return response;
};

/**
 * 请求撤销：读取 kernel 权威状态 → 跨文档提示 → 调 kernel undo → 本地乐观应用 + 更新镜像。
 *
 * @param protyle 发起撤销的编辑器实例
 * @param rootID  撤销目标文档根块 ID；缺省时回退为编辑器当前文档（嵌入块场景由调用方显式传入）
 */
export const requestUndo = async (protyle: IProtyle, rootID?: string) => {
    if (!protyle || isUndoing) {
        return;
    }
    const targetRootID = rootID || protyle.block?.rootID;
    if (!targetRootID) {
        return;
    }

    // 尽早置锁，阻止确认对话框期间触发新的撤销/重做（含 peek 与确认阶段）
    isUndoing = true;
    try {
        await waitForPendingTransactions(protyle);

        // 等待输入事务提交后读取权威状态，避免本地镜像尚未更新时吞掉立即撤销。
        const state = await fetchUndoState(targetRootID);
        if (!state) {
            return;
        }
        markMirror(targetRootID, {canUndo: state.canUndo, canRedo: state.canRedo});
        if (!state.canUndo) {
            refreshUndoButtons(protyle, targetRootID);
            return;
        }

        if (state.peekMutatedRootIDs.length > 1) {
            const names = await resolveRootNames(state.peekMutatedRootIDs);
            // 确认期间拦截当前编辑器的键盘输入（遮罩只挡鼠标点击，不挡键盘冒泡）
            protyle.wysiwyg?.element.addEventListener("keydown", blockInput, true);
            protyle.wysiwyg?.element.addEventListener("beforeinput", blockInput, true);
            const languages = getSiyuanLanguages();
            let confirmed = false;
            try {
                confirmed = await new Promise<boolean>((resolve) => {
                    confirmDialog(`⚠️ ${languages.undo}`,
                        `${languages.undoCrossDocConfirm}<div style="margin-top: 8px;">${names.map(n => `• ${n}`).join("<br>")}</div>`,
                        () => resolve(true),
                        () => resolve(false));
                });
            } finally {
                protyle.wysiwyg?.element.removeEventListener("keydown", blockInput, true);
                protyle.wysiwyg?.element.removeEventListener("beforeinput", blockInput, true);
            }
            if (!confirmed) {
                return;
            }
        }

        const response = await fetchUndoOperation("/api/transactions/undo", {
            rootID: targetRootID,
            app: Constants.SIYUAN_APPID,
            session: protyle.id,
        });
        const data = response?.data;
        if (!data) {
            return;
        }
        if (data.failed) {
            // 撤销执行失败：kernel 已回滚栈，镜像不动，用 msg 提示用户
            if (data.msg) {
                showMessage(data.msg);
            }
            return;
        }
        if (!data.undoOperations || data.undoOperations.length === 0) {
            // 栈空或无可撤销：kernel 已返回空操作结果，仅记录状态后返回
            markMirror(targetRootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
            refreshUndoButtons(protyle, targetRootID);
            return;
        }
        markMirror(targetRootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
        const mutatedRootIDs: string[] = data.mutatedRootIDs || [];
        if (mutatedRootIDs.length > 1) {
            // 跨文档撤销：doOperations 的锚点分散在多个文档，当前 protyle 无法本地乐观应用。
            // 改为靠 kernel 广播（含发起方）刷新所有涉及文档的 DOM。
            // 这里不调 renderLocal，避免在错误 protyle 上应用跨文档 move 导致前后端不一致。
            refreshUndoButtons(protyle, targetRootID);
            // 广播会到达当前窗口（/undo 对跨文档用 PushModeBroadcast），触发 onTransaction 刷新 DOM
        } else {
            // 单文档撤销：发起窗口本地乐观应用 doOperations（kernel 实际执行的操作，如 insert 恢复块）
            protyle.undo?.renderLocal(protyle, data.doOperations);
            refreshUndoButtons(protyle, targetRootID);
            const focusBlockId = data.doOperations?.find((op: IOperation) => op.id)?.id;
            focusRootIDs(mutatedRootIDs, focusBlockId);
        }
    } finally {
        isUndoing = false;
    }
};

/**
 * 请求重做：对称，redo 不提示（其逆已在 undo 中确认）。
 *
 * @param protyle 发起重做的编辑器实例
 * @param rootID  重做目标文档根块 ID；缺省时回退为编辑器当前文档
 */
export const requestRedo = async (protyle: IProtyle, rootID?: string) => {
    if (!protyle || isUndoing) {
        return;
    }
    const targetRootID = rootID || protyle.block?.rootID;
    if (!targetRootID) {
        return;
    }

    isUndoing = true;
    try {
        await waitForPendingTransactions(protyle);
        // 等待输入事务提交后读取权威状态，避免本地镜像尚未更新时吞掉立即重做。
        const state = await fetchUndoState(targetRootID);
        if (!state) {
            return;
        }
        markMirror(targetRootID, {canUndo: state.canUndo, canRedo: state.canRedo});
        if (!state.canRedo) {
            refreshUndoButtons(protyle, targetRootID);
            return;
        }
        const response = await fetchUndoOperation("/api/transactions/redo", {
            rootID: targetRootID,
            app: Constants.SIYUAN_APPID,
            session: protyle.id,
        });
        const data = response?.data;
        if (!data) {
            return;
        }
        if (data.failed) {
            // 重做执行失败：kernel 已回滚栈，镜像不动，用 msg 提示用户
            if (data.msg) {
                showMessage(data.msg);
            }
            return;
        }
        if (!data.doOperations || data.doOperations.length === 0) {
            // 栈顶无可重做：kernel 已返回空操作结果，仅记录状态后返回
            markMirror(targetRootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
            refreshUndoButtons(protyle, targetRootID);
            return;
        }
        markMirror(targetRootID, {canUndo: !!data.canUndo, canRedo: !!data.canRedo});
        const mutatedRootIDs: string[] = data.mutatedRootIDs || [];
        if (mutatedRootIDs.length > 1) {
            // 跨文档重做：锚点分散在多个文档，靠 kernel 广播（含发起方）刷新
            refreshUndoButtons(protyle, targetRootID);
        } else {
            // 单文档重做：发起窗口本地乐观应用 doOperations
            protyle.undo?.renderLocal(protyle, data.doOperations);
            refreshUndoButtons(protyle, targetRootID);
            const focusBlockId = data.doOperations?.find((op: IOperation) => op.id)?.id;
            focusRootIDs(mutatedRootIDs, focusBlockId);
        }
    } finally {
        isUndoing = false;
    }
};
