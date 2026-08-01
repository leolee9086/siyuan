/** 用途：约束异步操作的会话目标；使用范围：操作身份核对输入。 */
import type {AgentPanelConversationKind} from "./imports";
/** 用途：约束文件操作状态；使用范围：本文件全部职责函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：同步文件入口禁用态；使用范围：操作开始与结束。 */
import {updateSessionFileActionState} from "./imports";

/**
 * 开始一次会话文件操作并返回可核对的操作序号。
 * @同步豁免: 操作序号和入口锁必须在异步请求发出前同步登记，防止并发操作共享身份。
 */
export function beginSessionFileOperation(runtime: AgentChatRuntime) {
    const operationID = ++runtime.sessionFileOperationSerial;
    runtime.sessionFileOperationPending = true;
    updateSessionFileActionState(runtime);
    return operationID;
}

/**
 * 在操作序号仍有效时结束文件操作。
 * @同步豁免: finally 清理阶段必须立即核对序号并释放当前入口锁。
 */
export function finishSessionFileOperation(runtime: AgentChatRuntime, operationID: number) {
    // 较旧请求结束时保留较新请求持有的入口锁。
    if (operationID !== runtime.sessionFileOperationSerial) {
        return;
    }
    runtime.sessionFileOperationPending = false;
    updateSessionFileActionState(runtime);
}

/**
 * 核对异步文件操作仍属于当前会话与目标。
 * @同步豁免: 异步结果应用前必须同步读取同一状态快照，类型守卫式判断不包含可异步化工作。
 */
export function isCurrentSessionFileOperation(
    runtime: AgentChatRuntime,
    identity: Readonly<{
        operationID: number;
        sessionID: string;
        targetKind: AgentPanelConversationKind;
    }>,
) {
    return !runtime.agentDestroyed && identity.operationID === runtime.sessionFileOperationSerial &&
        identity.sessionID === runtime.sessionId && identity.targetKind === runtime.conversationKind;
}

/**
 * 向日志和面板消息端口报告会话文件错误。
 * @同步豁免: 错误必须在当前失败回调内立即送达日志与用户消息端口，避免丢失异常上下文。
 */
export function reportSessionFileError(runtime: AgentChatRuntime, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[AgentChat] session file operation failed", error);
    runtime.capabilities.showMessage?.(message, 5000);
}
