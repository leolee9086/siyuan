/** 用途：约束跨实例会话变更处理所需的运行时契约；使用范围：本文件全部函数；解耦评估：纯类型依赖，编译后消失，运行时方法经该契约访问。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：校验并读取会话变更载荷的 sessionID 与 action；使用范围：onWsMessage 入口载荷解析；解耦评估：同一切换领域的守卫直接依赖，避免内部模块经外部依赖网关转发。 */
import {readSessionChangePayload} from "./AgentChat.sessionChange.guard";
/** 用途：从权威会话重载当前视图；使用范围：streamStart 快照加载与 update 权威刷新；解耦评估：重载是既有存储边界，本模块只触发其公开职责，异步结果经回调继续处理。 */
import {reloadFromDisk} from "./imports";
/** 用途：恢复被中断的 Agent 轮次；使用范围：update 重载完成后存在待恢复轮次时；解耦评估：恢复协议已独立在会话恢复模块，本文件只登记触发点，不复制其轮询与提交逻辑。 */
import {recoverInterruptedTurn} from "./imports";
/** 用途：当前会话被其他实例删除时切换到可用会话；使用范围：delete 分支；解耦评估：会话切换边界集中在 switch 模块，复用其公开入口保持切换语义一致。 */
import {handleCurrentSessionDeleted} from "./AgentChat.switch";

/**
 * 处理当前会话的跨实例变更通知。
 * @同步豁免: 生命周期 - 作为 ws 事件回调，镜像锁定、占位条移除等状态切换必须在同一事件派发周期内原子完成，异步化会造成镜像态与后续事件错序。
 */
export function onWsMessage(runtime: AgentChatRuntime, data: IWebSocketData) {
    // 仅处理 agentSessionChanged 命令，忽略其它推送，避免无关消息进入会话逻辑。
    if (!data || data.cmd !== "agentSessionChanged") {
        return;
    }
    const payload = readSessionChangePayload(data.data);
    // 载荷缺少 sessionID 或 action 字段时无法继续处理，直接忽略。
    if (!payload) {
        return;
    }
    void runtime.sessionPanel?.refresh();
    // 仅响应当前会话的变更；本实例自身正在流式输出时由 SSE 驱动 UI，不响应镜像事件。
    if (payload.sessionID !== runtime.sessionId || runtime.isStreaming) {
        return;
    }
    // 本实例已订阅该会话的事件流时，事件流是权威实时源（tool_call/tool_progress 等进度事件
    // 都在其中），磁盘快照重载或镜像占位会清掉已投影的实时进度卡片，因此跳过镜像分支。
    const controller = runtime.conversationController;
    const eventStreamActive = controller !== null && controller.state.sessionID === payload.sessionID &&
        controller.state.connected;
    // streamStart：发起实例的流已开始。未订阅事件流的实例进入镜像锁定态，并加载流开始前的快照、显示对话中占位条。
    if (payload.action === "streamStart") {
        if (eventStreamActive) {
            return;
        }
        runtime.mirrorLocked = true;
        void reloadFromDisk(runtime);
        return;
    }
    // streamEnd：发起实例的流已结束，解除镜像锁定并移除占位条，恢复用户未提交的编辑草稿。
    // 流结束与发起实例的落盘保存存在时序竞态，此刻重载可能读到半截数据，
    // 因此不在此重载视图，完整内容由保存完成后到达的 update 事件负责刷新。
    if (payload.action === "streamEnd") {
        runtime.mirrorLocked = false;
        runtime.sessionPorts.presentation.removeMirror(runtime);
        runtime.sessionPorts.turnLifecycle.restorePendingEditDraft(runtime);
        return;
    }
    if (payload.action === "permission") {
        void reloadFromDisk(runtime);
        return;
    }
    // update：会话已落盘变更，重载权威视图；存在待恢复的中断轮次时继续恢复，非锁定态下恢复编辑草稿。
    if (payload.action === "update") {
        void reloadFromDisk(runtime).then(() => settleAfterUpdateReload(runtime, payload));
        return;
    }
    // delete：当前会话被其他实例删除，解除锁定并切换到可用会话。
    if (payload.action === "delete") {
        runtime.mirrorLocked = false;
        handleCurrentSessionDeleted(runtime);
    }
}

/** 在 update 重载完成后恢复中断轮次或用户编辑草稿。 */
function settleAfterUpdateReload(runtime: AgentChatRuntime, payload: {sessionID: string; action: string}) {
    // 该会话存在待恢复的中断轮次时，在重载完成后继续恢复流程。
    if (runtime.pendingRecoverySessionIDs.has(payload.sessionID)) {
        void recoverInterruptedTurn(runtime, payload.sessionID, runtime.currentTurnID);
    }
    // 镜像锁定期间（其他实例仍在流式）不恢复草稿，避免草稿与占位视图冲突。
    if (!runtime.mirrorLocked) {
        runtime.sessionPorts.turnLifecycle.restorePendingEditDraft(runtime);
    }
}
