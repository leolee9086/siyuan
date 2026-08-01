/** 用途：约束冲突恢复状态；使用范围：并发发送冲突。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：重载权威会话；使用范围：冲突响应后。 */
import {reloadFromDisk} from "./imports";
/** 用途：恢复未提交编辑草稿；使用范围：权威会话重载后。 */
import {restorePendingEditDraft} from "./imports";
/** 用途：解除流式交互锁；使用范围：冲突响应后。 */
import {setStreaming} from "./imports";

/** 在并发冲突后重载权威会话并恢复编辑草稿。 */
export async function handleConflictReject(runtime: AgentChatRuntime) {
    runtime.requestStartTime = 0;
    setStreaming(runtime, false);
    await reloadFromDisk(runtime, true);
    restorePendingEditDraft(runtime);
    const languages = window.siyuan.languages;
    runtime.capabilities.showMessage?.(
        languages.agentChatBusy || "This session is busy in another instance",
        3000,
    );
}
