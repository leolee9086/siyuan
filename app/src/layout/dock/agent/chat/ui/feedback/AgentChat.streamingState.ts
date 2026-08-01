/** 用途：约束流式反馈函数读写的公开状态；使用范围：本文件全部导出函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：计算当前目标的发送能力；使用范围：发送按钮状态刷新。 */
import {resolveTargetPolicy} from "./imports";

/**
 * 判断编辑器中是否存在可发送内容。
 * @同步豁免: 输入事件需要在当前事件回调内立即刷新按钮状态，读取编辑器快照不涉及异步工作。
 */
export function hasComposerInput(runtime: AgentChatRuntime) {
    const sendData = runtime.composer?.getSendData();
    return Boolean(sendData?.text.length);
}

/**
 * 同步当前会话文件入口的禁用状态。
 * @同步豁免: 文件入口必须与流式和上传状态在同一界面更新周期内保持一致。
 */
export function updateSessionFileActionState(runtime: AgentChatRuntime) {
    runtime.sessionFilesBtn?.setAttribute(
        "aria-disabled",
        runtime.isStreaming || runtime.sessionFileOperationPending ? "true" : "false",
    );
}

/**
 * 根据目标、模型、输入和流式状态刷新发送控件。
 * @同步豁免: 输入、模型和流式事件均要求按钮与编辑器禁用态在当前 DOM 更新周期内一致。
 */
export function updateSendButtonState(runtime: AgentChatRuntime) {
    const targetUnavailable = !resolveTargetPolicy(runtime).sendingAvailable ||
        (runtime.conversationKind === "native-agent" && runtime.modelOptions.length === 0);
    const disabled = runtime.isStreaming || targetUnavailable || !hasComposerInput(runtime);
    runtime.sendBtn.toggleAttribute("disabled", disabled);
    // 编辑器宿主完成初始化后才同步禁用样式。
    if (runtime.composerHost) {
        runtime.composerHost.classList.toggle(
            "agent-chat__composer-host--disabled",
            runtime.isStreaming || targetUnavailable,
        );
    }
}

/**
 * 将流式锁同步到 AgentChat 已公开的会话交互状态。
 * @同步豁免: SSE 生命周期要求目标与会话动作在当前处理周期内原子切换。
 */
export function applyAgentPanelInteractionLock(runtime: AgentChatRuntime, locked: boolean) {
    if (locked) {
        runtime.sessionPanel.close();
    }
    runtime.targetSelect.disabled = locked;
    for (const button of [runtime.newSessionBtn, runtime.sessionMenuBtn, runtime.sessionFilesBtn]) {
        button.setAttribute("aria-disabled", locked ? "true" : "false");
    }
}

/**
 * 切换流式交互锁并同步相关控件状态。
 * @同步豁免: SSE 生命周期要求所有交互锁在开始或结束事件的当前处理周期内原子切换。
 */
export function setStreaming(runtime: AgentChatRuntime, streaming: boolean) {
    runtime.isStreaming = streaming;
    // 开始生成时关闭文件菜单，避免菜单操作越过流式锁。
    if (streaming) {
        runtime.capabilities.closeMenu?.("agent-current-session-files");
    }
    applyAgentPanelInteractionLock(runtime, streaming);
    updateSessionFileActionState(runtime);
    runtime.sendBtn.classList.toggle("fn__none", streaming);
    runtime.stopBtn.classList.toggle("fn__none", !streaming);
    updateSendButtonState(runtime);
}
