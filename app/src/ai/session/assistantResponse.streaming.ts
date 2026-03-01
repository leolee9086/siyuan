import type { AssistantResponseState } from "./session.types";

/**
 * 更新响应内容（全量替换）
 *
 * 作用：将状态的响应内容替换为新值
 * 意图：供外部直接设置完整响应内容（区别于 appendResponseContent 的增量追加）
 * 调用时机：需要覆盖当前响应内容时调用，如重置或纠错场景
 * @同步豁免: 性能考虑 - SSE 流式回调的同步处理器，异步化会导致事件发射顺序不确定
 */
export function updateResponseContent(state: AssistantResponseState, content: string): void {
    state.responseContentStr = content;
}

/**
 * 追加响应内容（增量）
 *
 * 作用：将新内容追加到现有响应字符串末尾
 * 意图：SSE 流式响应逐块到达时，每块内容通过此方法累积
 * 调用时机：handleStreamMessage 解析出新内容后调用
 * @同步豁免: 性能考虑 - SSE 流式回调的同步处理器，异步化会导致事件发射顺序不确定
 */
export function appendResponseContent(state: AssistantResponseState, content: string): void {
    state.responseContentStr += content;
}

/**
 * 标记流式传输开始
 *
 * 作用：将 isStreaming 设为 true、isDone 设为 false，记录开始时间
 * 意图：流式请求发起时需要同步更新 UI 状态（显示加载动画等）
 * 调用时机：AIRequestController 的 onStart 回调中调用
 * @同步豁免: 性能考虑 - SSE 流式回调的同步处理器，异步化会导致事件发射顺序不确定
 */
export function startStreaming(state: AssistantResponseState, startTimeRef: { value: number }): void {
    state.isStreaming = true;
    state.isDone = false;
    startTimeRef.value = Date.now();
}

/**
 * 标记流式传输停止（不代表完成）
 *
 * 作用：将 isStreaming 设为 false
 * 意图：区分"停止接收数据"和"任务完成"两种状态，停止可能是暂停或中止
 * 调用时机：暂停、中止、错误等需要停止流式接收的场景
 * @同步豁免: 性能考虑 - SSE 流式回调的同步处理器，异步化会导致事件发射顺序不确定
 */
export function stopStreaming(state: AssistantResponseState): void {
    state.isStreaming = false;
}

/**
 * 标记响应完成
 *
 * 作用：将 isStreaming 设为 false、isDone 设为 true
 * 意图：流式响应正常结束时，通知 UI 切换到完成状态（显示确认按钮等）
 * 调用时机：SSE 流结束（onComplete）或收到 finish 标记时调用
 * @同步豁免: 性能考虑 - SSE 流式回调的同步处理器，异步化会导致事件发射顺序不确定
 */
export function setDone(state: AssistantResponseState): void {
    state.isStreaming = false;
    state.isDone = true;
}

/**
 * 中止当前响应
 *
 * 作用：调用 abort 函数取消网络请求，停止流式状态
 * 意图：用户主动点击取消按钮时触发
 * 调用时机：UI 层的 onCancelClick 回调中调用
 * @同步豁免: 性能考虑 - 中止操作必须同步执行以立即取消网络请求
 */
export function abortResponse(state: AssistantResponseState): void {
    state.abortFunction?.();
    stopStreaming(state);
}

/**
 * 暂停流式响应
 *
 * 作用：标记暂停状态、保存当前消息、中止网络请求
 * 意图：暂停后可以执行工具调用，完成后再恢复对话
 * 调用时机：用户点击暂停按钮，或同步工具调用检测到需要中断流式响应时
 * @同步豁免: 性能考虑 - 暂停操作必须同步执行以立即中止网络请求并保存状态
 */
export function pauseResponse(state: AssistantResponseState): void {
    // 仅在正在流式传输且未暂停时生效，避免重复暂停导致消息重复保存
    if (!state.isStreaming || state.isPaused) {
        return;
    }
    state.isPaused = true;
    saveCurrentMessage(state);
    state.abortFunction?.();
}

/**
 * 恢复流式响应状态（仅状态切换，不重发请求）
 *
 * 作用：重置暂停标记、恢复流式状态
 * 意图：与 autoResumeIfNeeded 配合，先恢复状态再重发请求
 * 调用时机：AIRequestController 的 onResume 回调中调用
 * @同步豁免: 性能考虑 - 恢复操作必须同步切换状态以保证事件发射顺序
 */
export function resumeResponse(state: AssistantResponseState, startTimeRef: { value: number }): void {
    // 仅在暂停状态下生效，非暂停状态调用 resume 是无效操作
    if (!state.isPaused) {
        return;
    }
    state.isPaused = false;
    state.isStreaming = true;
    state.isDone = false;
    startTimeRef.value = Date.now();
}

/**
 * 保存当前响应内容到消息历史
 *
 * 作用：将当前 responseContentStr 作为 assistant 消息追加到 savedMessages
 * 意图：暂停或工具调用前需要保存已接收的部分响应，以便恢复时作为上下文发送
 * 调用时机：pauseResponse() 内部调用，确保暂停前保存当前内容
 * @同步豁免: 性能考虑 - 由 pauseResponse() 同步调用链中调用，必须同步完成消息保存
 */
export function saveCurrentMessage(state: AssistantResponseState): void {
    // 仅在有实际内容时保存，避免空消息污染历史
    if (!state.responseContentStr.trim()) {
        return;
    }
    state.savedMessages.push({
        role: "assistant" as const,
        content: state.responseContentStr,
        timestamp: Date.now()
    });
}

/**
 * 更新块级 DOM 内容
 *
 * 作用：替换 state.blockDOMContent
 * 意图：lute 渲染 Markdown 为 HTML 后，通过此方法更新 DOM 内容供 UI 展示
 * 调用时机：processBlockDOMContent 处理完成后调用
 * @同步豁免: 性能考虑 - SSE 流式回调的同步处理器，异步化会导致 DOM 更新延迟
 */
export function updateBlockDOMContent(state: AssistantResponseState, content: string): void {
    state.blockDOMContent = content;
}
