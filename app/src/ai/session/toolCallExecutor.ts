import { createTemporaryModule } from "../../util/lib/code/scripts.executor";
import type { AssistantResponseState } from "./session.types";

/**
 * 工具调用执行器配置
 */
export interface ToolCallExecutorConfig {
    getState: () => AssistantResponseState;
    emitToolCallEvent: (toolCode: string, result: any, isAsync: boolean) => void;
    startAIRequest: (messages: Array<{ role: "user" | "assistant"; content: string; timestamp: number }>) => Promise<void>;
    pause: () => void;
    autoResumeIfNeeded: () => Promise<void>;
}

/**
 * 同步工具调用执行器
 */
export async function executeSyncToolCall(
    toolCode: string,
    config: ToolCallExecutorConfig,
    syncToolLimitNotified: { value: boolean }
): Promise<void> {
    const state = config.getState();

    // 检查同步工具调用次数限制
    if (state.syncToolCallCount >= 10) {
        await handleSyncToolCallLimit(toolCode, config, syncToolLimitNotified);
        return;
    }

    // 立刻中止当前响应
    if (state.isStreaming && !state.isPaused) {
        config.pause();
    }

    // 确保状态已正确设置
    state.isStreaming = false;

    try {
        // 增加同步工具调用计数
        state.syncToolCallCount += 1;
        console.log(`同步工具调用次数: ${state.syncToolCallCount}/10`);

        // 执行工具调用
        const result = await createTemporaryModule(toolCode);
        console.log("工具调用执行结果:", result);

        // 检查是否有default导出
        if (!result.moduleExport.default) {
            throw new Error("必须使用default导出你需要查看的结果");
        }

        // 将工具执行结果添加到消息历史中
        state.savedMessages.push({
            role: "user",
            content: `Tool execution result: ${JSON.stringify(await result.moduleExport.default)}`,
            timestamp: Date.now()
        });

        // 触发工具调用事件
        config.emitToolCallEvent(toolCode, result, false);
    } catch (error) {
        console.error("工具调用执行失败:", error);

        // 增加错误计数
        state.errorCount += 1;

        // 将错误信息添加到消息历史中
        if (error instanceof Error) {
            state.savedMessages.push({
                role: "user",
                content: `system:工具调用执行失败: ${error.message},\n你必须使用标准esm语法并且以default导出你需要的结果`,
                timestamp: Date.now()
            });
        }

        // 触发工具调用事件（失败情况）
        config.emitToolCallEvent(toolCode, error, false);
    } finally {
        // 在工具调用完成后自动恢复对话
        await config.autoResumeIfNeeded();
    }
}

/**
 * 处理同步工具调用次数达到上限的情况
 */
async function handleSyncToolCallLimit(
    toolCode: string,
    config: ToolCallExecutorConfig,
    syncToolLimitNotified: { value: boolean }
) {
    const state = config.getState();

    console.error("同步工具调用次数已达上限(10次)");
    state.savedMessages.push({
        role: "user",
        content: "system:同步工具调用次数已达上限(10次)，无法继续执行工具调用",
        timestamp: Date.now()
    });

    // 触发工具调用事件（限制情况）
    config.emitToolCallEvent(
        toolCode,
        new Error("同步工具调用次数已达上限(10次)，无法继续执行工具调用"),
        false
    );

    // 工具调用到达上限后，仅仅发起一次请求，告知AI它的工具调用次数已经达到上限
    // 如果已经通知过，则直接返回
    if (syncToolLimitNotified.value) {
        return;
    }

    syncToolLimitNotified.value = true;
    try {
        await config.startAIRequest([
            ...state.savedMessages,
            {
                role: "user",
                content: "system:同步工具调用次数已达上限(10次)，无法继续执行工具调用",
                timestamp: Date.now()
            }
        ]);
    } catch (error) {
        console.error("发送工具调用上限通知失败:", error);
    }
}

/**
 * 异步工具调用执行器
 */
export async function executeAsyncToolCallFn(
    toolCode: string,
    config: ToolCallExecutorConfig,
    asyncToolLimitNotified: { value: boolean }
): Promise<void> {
    const state = config.getState();

    // 检查异步工具调用次数限制
    if (state.asyncToolCallCount >= 10) {
        await handleAsyncToolCallLimit(toolCode, config, asyncToolLimitNotified);
        return;
    }

    let toolPromise: Promise<any> | null = null;
    try {
        // 增加异步工具调用计数
        state.asyncToolCallCount += 1;
        console.log(`异步工具调用次数: ${state.asyncToolCallCount}/10`);

        // 创建异步工具调用Promise并添加到结果堆栈
        toolPromise = createTemporaryModule(toolCode);
        state.asyncToolResults.push(toolPromise);

        // 等待工具调用完成
        const result = await toolPromise;
        console.log("异步工具调用执行结果:", result);

        // 将结果替换到asyncToolResults中，而不是添加到消息历史
        const index = state.asyncToolResults.indexOf(toolPromise);
        if (index !== -1) {
            state.asyncToolResults[index] = result;
        }

        // 触发工具调用事件
        config.emitToolCallEvent(toolCode, result, true);
    } catch (error) {
        console.error("异步工具调用执行失败:", error);

        // 将错误信息替换到asyncToolResults中
        const index = toolPromise ? state.asyncToolResults.indexOf(toolPromise) : -1;
        if (index !== -1) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            state.asyncToolResults[index] = { error: errorMessage };
        }

        // 触发工具调用事件（失败情况）
        config.emitToolCallEvent(toolCode, error, true);
    }
}

/**
 * 处理异步工具调用次数达到上限的情况
 */
async function handleAsyncToolCallLimit(
    toolCode: string,
    config: ToolCallExecutorConfig,
    asyncToolLimitNotified: { value: boolean }
) {
    const state = config.getState();
    console.error("异步工具调用次数已达上限(10次)");
    // 不执行工具调用，直接返回错误结果
    state.asyncToolResults.push({ error: "异步工具调用次数已达上限(10次)，无法继续执行工具调用" });

    // 触发工具调用事件（限制情况）
    config.emitToolCallEvent(
        toolCode,
        new Error("异步工具调用次数已达上限(10次)，无法继续执行工具调用"),
        true
    );

    // 工具调用到达上限后，仅仅发起一次请求，告知AI它的工具调用次数已经达到上限
    // 如果已经通知过，则直接返回
    if (asyncToolLimitNotified.value) {
 return; 
}
    asyncToolLimitNotified.value = true;
    try {
        await config.startAIRequest([
            ...state.savedMessages,
            {
                role: "user",
                content: "system:异步工具调用次数已达上限(10次)，无法继续执行工具调用",
                timestamp: Date.now()
            }
        ]);
    } catch (error) {
        console.error("发送工具调用上限通知失败:", error);
    }
}
