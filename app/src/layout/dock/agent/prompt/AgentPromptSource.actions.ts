/** 用途：打开提示词文档选择；使用范围：绑定来源动作；解耦评估：同领域对话框只返回已解析文档。 */
import {requestAgentPromptSourceDocument} from "./dialog/AgentPromptSourceDialog";
/** 用途：约束宿主菜单项；使用范围：提示词动作菜单。 */
import type {PanelMenuItem} from "./imports";
/** 用途：约束提示词命令；使用范围：动作分派。 */
import type {AgentPromptSourceAction} from "./AgentPromptSource.types";
/** 用途：读取公开状态与抽象端口；使用范围：全部提示词动作。 */
import type {AgentPromptSourceDomain} from "./AgentPromptSource.types";
/** 用途：约束来源状态；使用范围：菜单与动作提交。 */
import type {AgentPromptSourceState} from "./AgentPromptSource.types";
/** 用途：约束已通过资格检查的会话；使用范围：异步动作归属。 */
import type {NativePromptSourceConversation} from "./AgentPromptSource.types";
/** 用途：窄化原生会话；使用范围：提示词动作入口；解耦评估：类型守卫集中在合规 guard 模块。 */
import {isNativePromptSourceConversation} from "./AgentPromptSource.guard";
/** 用途：投影公开提示词状态；使用范围：动作开始、完成和失败；解耦评估：DOM 写入集中在 presentation 层。 */
import {updatePromptSourcePresentation} from "./AgentPromptSource.presentation";
/** 用途：登记异步操作编号；使用范围：菜单与来源命令；解耦评估：状态变化集中在同领域状态模块。 */
import {beginPromptSourceOperation} from "./AgentPromptSource.state";
/** 用途：结束匹配的异步操作；使用范围：动作 finally；解耦评估：状态变化集中在同领域状态模块。 */
import {finishPromptSourceOperation} from "./AgentPromptSource.state";
/** 用途：核对异步会话归属；使用范围：首次发送门禁；解耦评估：一致性条件集中在同领域状态模块。 */
import {isCurrentPromptSourceConversation} from "./AgentPromptSource.state";
/** 用途：核对加载编号与会话；使用范围：来源刷新；解耦评估：一致性条件集中在同领域状态模块。 */
import {isCurrentPromptSourceLoad} from "./AgentPromptSource.state";
/** 用途：核对操作编号与会话；使用范围：来源命令；解耦评估：一致性条件集中在同领域状态模块。 */
import {isCurrentPromptSourceOperation} from "./AgentPromptSource.state";

/** 提示词来源动作菜单的稳定宿主名称。 */
export const promptSourceMenuName = "agent-prompt-source-actions";

/** 关闭提示词来源动作菜单。 */
/** @同步豁免: UI构建 - 其它面板动作开始前必须立即关闭同名菜单，避免两个操作入口同时可见。 */
export function closePromptSourceActions(context: AgentPromptSourceDomain) {
    context.capabilities.closeMenu?.(promptSourceMenuName);
}

/** 将一次操作错误提交到可观察状态和宿主消息端口。 */
/** @同步豁免: UI构建 - 错误状态、控件投影和宿主消息必须在同一完成点同步提交。 */
export function reportPromptSourceError(context: AgentPromptSourceDomain, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    context.state.errorMessage = message;
    updatePromptSourcePresentation(context);
    console.error("[AgentPromptSourceController] operation failed", error);
    context.capabilities.showMessage?.(message, 5000);
}

/** 从权威会话仓储刷新提示词来源状态。 */
export async function refreshPromptSource(context: AgentPromptSourceDomain) {
    const conversation = context.runtime.getConversation();
    const loadID = ++context.state.loadSerial;
    // 非原生目标或尚未持久化的会话没有服务端提示词来源，立即清空旧会话投影。
    if (!isNativePromptSourceConversation(context, conversation) ||
        context.runtime.getSessionRevision(conversation.sessionId) < 1) {
        context.state.sourceState = null;
        context.state.errorMessage = "";
        updatePromptSourcePresentation(context);
        return;
    }
    try {
        const sourceState = await context.runtime.sourceRepository.getPromptSource(conversation.sessionId);
        // 会话切换或后续刷新已经递增编号时，丢弃这次迟到结果。
        if (!isCurrentPromptSourceLoad(context, loadID, conversation)) {
            return;
        }
        context.state.sourceState = sourceState;
        context.state.errorMessage = "";
        updatePromptSourcePresentation(context);
    } catch (error) {
        // 迟到失败不覆盖新会话或新请求已经提交的状态。
        if (!isCurrentPromptSourceLoad(context, loadID, conversation)) {
            return;
        }
        context.state.sourceState = null;
        context.state.errorMessage = error instanceof Error ? error.message : String(error);
        updatePromptSourcePresentation(context);
        console.error("[AgentPromptSourceController] state refresh failed", error);
    }
}

/** 在首轮发送前验证来源快照，并显式要求用户处理已变化的来源。 */
export async function ensurePromptSourceDecisionBeforeFirstTurn(context: AgentPromptSourceDomain) {
    const conversation = context.runtime.getConversation();
    // 非原生目标或未落盘会话沿用默认提示词，不进入文档来源检查。
    if (!isNativePromptSourceConversation(context, conversation) ||
        context.runtime.getSessionRevision(conversation.sessionId) < 1) {
        return true;
    }
    try {
        const sourceState = await context.runtime.sourceRepository.getPromptSource(conversation.sessionId);
        // 请求期间切换会话或销毁面板时，本轮发送不再继续。
        if (!isCurrentPromptSourceConversation(context, conversation)) {
            return false;
        }
        context.state.sourceState = sourceState;
        context.state.errorMessage = "";
        updatePromptSourcePresentation(context);
        // 仅检测到来源版本变化时阻断首轮发送，其它权威状态可直接继续。
        if (sourceState.state !== "source-changed") {
            return true;
        }
        showPromptSourceActions(context, sourceState);
        context.capabilities.showMessage?.("系统提示词来源文档已变化，请选择刷新或保持当前快照", 5000);
        return false;
    } catch (error) {
        // 仍在同一会话时才展示读取失败，避免旧请求污染新会话。
        if (isCurrentPromptSourceConversation(context, conversation)) {
            reportPromptSourceError(context, error);
        }
        return false;
    }
}

/** 打开当前文档来源可执行的生命周期动作。 */
export async function openPromptSourceActions(context: AgentPromptSourceDomain) {
    const conversation = context.runtime.getConversation();
    // 菜单只属于可见的原生提示词控件，并依赖宿主显式提供 showMenu 能力。
    if (!isNativePromptSourceConversation(context, conversation) || !context.capabilities.showMenu) {
        return;
    }
    const operationID = beginPromptSourceOperation(context.state);
    updatePromptSourcePresentation(context);
    try {
        await context.runtime.ensurePersisted(conversation.sessionId);
        // 持久化期间发生会话切换时终止旧菜单操作。
        if (!isCurrentPromptSourceOperation(context, operationID, conversation)) {
            return;
        }
        const sourceState = await context.runtime.sourceRepository.getPromptSource(conversation.sessionId);
        // 来源读取完成后再次核对编号，避免在新会话锚点上展示旧菜单。
        if (!isCurrentPromptSourceOperation(context, operationID, conversation)) {
            return;
        }
        context.state.sourceState = sourceState;
        context.state.errorMessage = "";
        updatePromptSourcePresentation(context);
        showPromptSourceActions(context, sourceState);
    } finally {
        // 只有当前操作仍持有 pending 状态时才解除锁并刷新控件。
        if (finishPromptSourceOperation(context.state, operationID)) {
            updatePromptSourcePresentation(context);
        }
    }
}

/** 展示与当前来源状态匹配的确定动作集合。 */
/** @同步豁免: UI构建 - 菜单项必须从同一来源状态快照一次性构造并交给宿主。 */
export function showPromptSourceActions(context: AgentPromptSourceDomain, sourceState: AgentPromptSourceState) {
    const showMenu = context.capabilities.showMenu;
    const anchor = context.state.elements?.actionsButton;
    // 缺少宿主菜单、DOM 锚点或文档来源时没有可执行的来源生命周期动作。
    if (!showMenu || !anchor || sourceState.source.kind !== "document") {
        return;
    }
    /** 关闭当前菜单后异步执行选定动作，失败统一写入公开错误状态。 */
    // @柯里化：宿主菜单 click 无参数，闭包固定当前领域上下文并复用统一错误出口。
    const run = (action: AgentPromptSourceAction) => {
        context.capabilities.closeMenu?.(promptSourceMenuName);
        void runPromptSourceAction(context, action).catch((error) => reportPromptSourceError(context, error));
    };
    const items: PanelMenuItem[] = [];
    // 来源版本变化时同时提供刷新权威内容和保持当前快照两个明确选择。
    if (sourceState.state === "source-changed") {
        items.push({label: "刷新为当前文档", icon: "iconRefresh",
            /** 使用最新文档内容替换当前会话快照。 */
            click: () => run("refresh-document")});
        items.push({label: "保持当前快照", icon: "iconHistory",
            /** 确认继续使用当前会话已经保存的快照。 */
            click: () => run("keep-snapshot")});
    }
    items.push({label: "将当前系统提示词创建为文档", icon: "iconCopy",
        /** 在 AI 主笔记本创建当前快照的独立文档。 */
        click: () => run("create-document")});
    showMenu(promptSourceMenuName, anchor, items);
}

/** 请求一个文档并在操作仍属于当前会话时提交绑定。 */
async function bindSelectedPromptSourceDocument(
    context: AgentPromptSourceDomain,
    operation: Readonly<{conversation: NativePromptSourceConversation; operationID: number}>,
    expectedRevision: number,
) {
    const createDialog = context.capabilities.createDialog;
    if (!createDialog) {
        throw new Error("当前宿主未提供系统提示词文档选择界面");
    }
    const document = await requestAgentPromptSourceDocument(context.runtime.sourceRepository, createDialog);
    // 用户取消或选择完成前会话已变化时，不向仓储提交绑定。
    if (!document || !isCurrentPromptSourceOperation(context, operation.operationID, operation.conversation)) {
        return null;
    }
    return context.runtime.sourceRepository.bindPromptSourceDocument({
        id: operation.conversation.sessionId,
        document,
        expectedRevision,
    });
}

/** 执行已持久化会话的一项来源变更，并保留异步操作的会话归属检查。 */
async function executePromptSourceAction(
    context: AgentPromptSourceDomain,
    action: AgentPromptSourceAction,
    operation: Readonly<{conversation: NativePromptSourceConversation; operationID: number}>,
) {
    const sourceState = await context.runtime.sourceRepository.getPromptSource(operation.conversation.sessionId);
    // 来源读取完成后只允许仍属于当前操作的结果继续执行命令。
    if (!isCurrentPromptSourceOperation(context, operation.operationID, operation.conversation)) {
        return null;
    }
    // 已锁定会话只允许导出快照副本，不允许改变本会话正在使用的来源。
    if (sourceState.state === "locked" && action !== "create-document") {
        throw new Error("首次发送后不能更改系统提示词");
    }
    // 绑定动作先经过对话框解析，再提交包含期望修订的文档命令。
    if (action === "bind-document") {
        return bindSelectedPromptSourceDocument(context, operation, sourceState.revision);
    }
    // 刷新动作要求 Kernel 重新读取已绑定文档并替换快照。
    if (action === "refresh-document") {
        return context.runtime.sourceRepository.refreshPromptSourceDocument({
            id: operation.conversation.sessionId,
            expectedRevision: sourceState.revision,
        });
    }
    // 保持动作确认当前快照，同时记录已经观察到的来源版本。
    if (action === "keep-snapshot") {
        return context.runtime.sourceRepository.keepPromptSourceDocument({
            id: operation.conversation.sessionId,
            expectedRevision: sourceState.revision,
        });
    }
    // 剩余动作是创建副本，只对已有文档来源有定义。
    if (sourceState.source.kind !== "document") {
        throw new Error("当前会话没有可创建副本的文档系统提示词");
    }
    const document = await context.runtime.sourceRepository.createPromptSourceDocument(
        operation.conversation.sessionId,
    );
    // 创建期间仍处于同一会话时才展示完成消息。
    if (isCurrentPromptSourceOperation(context, operation.operationID, operation.conversation)) {
        context.capabilities.showMessage?.(`已创建系统提示词文档：${document.title}`, 3000);
    }
    return null;
}

/** 执行一次提示词来源领域动作并提交权威状态。 */
export async function runPromptSourceAction(context: AgentPromptSourceDomain, action: AgentPromptSourceAction) {
    const conversation = context.runtime.getConversation();
    // 文档来源动作只处理通过目标策略守卫的原生 Agent 会话。
    if (!isNativePromptSourceConversation(context, conversation)) {
        return;
    }
    const operationID = beginPromptSourceOperation(context.state);
    updatePromptSourcePresentation(context);
    try {
        await context.runtime.ensurePersisted(conversation.sessionId);
        // 持久化完成后先核对操作归属，再读取或修改来源。
        if (!isCurrentPromptSourceOperation(context, operationID, conversation)) {
            return;
        }
        const sourceState = await executePromptSourceAction(context, action, {conversation, operationID});
        // 取消选择和创建副本不产生需要投影的新来源状态。
        if (!sourceState) {
            return;
        }
        // 领域命令返回后再次核对会话，避免将旧修订写入新会话状态。
        if (!isCurrentPromptSourceOperation(context, operationID, conversation)) {
            return;
        }
        context.state.sourceState = sourceState;
        context.state.errorMessage = "";
        updatePromptSourcePresentation(context);
        await context.runtime.refreshSessionPanel();
    } finally {
        // 只有当前操作仍持有 pending 状态时才解除锁并刷新控件。
        if (finishPromptSourceOperation(context.state, operationID)) {
            updatePromptSourcePresentation(context);
        }
    }
}
