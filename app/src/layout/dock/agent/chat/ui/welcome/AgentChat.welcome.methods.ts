/** 用途：约束欢迎流程读写的完整聊天状态；使用范围：本文件全部职责函数；解耦评估：纯类型通过本目录网关进入，不加载门面实现。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：生成欢迎页内容；使用范围：空会话视图；解耦评估：沿用统一消息渲染器，避免复制展示模板。 */
import {renderWelcomeHTML} from "./imports";
/** 用途：判定当前会话是否允许发送；使用范围：示例提问守卫；解耦评估：目标策略由共享纯函数统一计算。 */
import {resolveTargetPolicy} from "./imports";
/** 用途：打开人工智能设置；使用范围：没有可用模型的欢迎页入口；解耦评估：宿主动作经运行时能力执行。 */
import {openAiSetting} from "./imports";
/** 用途：保存欢迎示例建立的用户轮次；使用范围：未注册执行 adapter 的旧链路；解耦评估：复用会话持久化唯一入口。 */
import {saveSession} from "./imports";
/** 用途：恢复保存冲突后的会话；使用范围：旧链路错误路径；解耦评估：复用会话重载唯一入口。 */
import {reloadFromDisk} from "./imports";
/** 用途：分派欢迎示例请求；使用范围：已持久化用户轮次；解耦评估：原生 Agent 与 MAGI 路由集中在发送领域。 */
import {dispatchAgentChatWelcome} from "./imports";
/** 用途：追加欢迎示例用户消息；使用范围：旧链路轮次建立；解耦评估：复用用户消息唯一 DOM 投影入口。 */
import {appendUserMessage} from "./imports";
/** 用途：重建消息导航标记；使用范围：旧链路用户消息追加后；解耦评估：导航状态只由导航领域维护。 */
import {rebuildNavMarkers} from "./imports";
/** 用途：为新会话生成标题；使用范围：旧链路首条欢迎示例消息；解耦评估：标题规则集中在响应收尾领域。 */
import {tryGenerateTitle} from "./imports";
/** 用途：切换流式交互状态；使用范围：旧链路欢迎请求；解耦评估：流式 UI 状态由共享状态函数投影。 */
import {setStreaming} from "./imports";
/** 用途：回滚保存失败的用户条目；使用范围：旧链路冲突处理；解耦评估：条目与 DOM 回滚集中在响应错误领域。 */
import {rollbackUserEntry} from "./imports";
/** 用途：将欢迎示例交给统一发送入口；使用范围：示例点击；解耦评估：复用 Composer 快照和 adapter admission，避免第二套请求生命周期。 */
import {sendMessage} from "./imports";

/** 建立旧链路示例提问对应的用户轮次，并在保存冲突时恢复会话。 */
async function prepareWelcomeExample(runtime: AgentChatRuntime, text: string) {
    runtime.messagesContainer.innerHTML = "";
    const userEntryId = runtime.sessionPorts.repository.newSessionId();
    runtime.entries.push({id: userEntryId, type: "user", content: text, timestamp: Date.now()});
    appendUserMessage(runtime, text, {timestamp: Date.now(), entryId: userEntryId});
    rebuildNavMarkers(runtime);
    void tryGenerateTitle(runtime);
    setStreaming(runtime, true);
    try {
        await saveSession(runtime);
    } catch (error) {
        rollbackUserEntry(runtime, userEntryId);
        setStreaming(runtime, false);
        await reloadFromDisk(runtime);
        return null;
    }
    runtime.abortController = new AbortController();
    const requestConversation = {kind: runtime.conversationKind, sessionId: runtime.sessionId};
    runtime.requestStartTime = Date.now();
    runtime.currentThinkingDuration = 0;
    runtime.currentTurnID = "";
    runtime.currentRoundID = "";
    return {userEntryId, requestConversation, requestSignal: runtime.abortController.signal};
}

/** 响应欢迎页示例点击，串联轮次建立和请求分派。 */
async function handleWelcomeExample(runtime: AgentChatRuntime, text: string) {
    if (!text || !runtime.composer || !resolveTargetPolicy(runtime).sendingAvailable) {
        return;
    }
    if (runtime.conversationController) {
        runtime.composer.setText(text);
        await sendMessage(runtime);
        return;
    }
    const request = await prepareWelcomeExample(runtime, text);
    if (!request) {
        return;
    }
    await dispatchAgentChatWelcome(runtime, {
        text,
        userEntryId: request.userEntryId,
        requestConversation: request.requestConversation,
        requestSignal: request.requestSignal,
    });
}

/** @同步豁免: UI构建 欢迎页 DOM 与事件必须在会话清空的同一渲染周期完成，调用方随后立即读取消息容器。 */
/** 渲染欢迎页并绑定示例提问入口。 */
export function showWelcome(runtime: AgentChatRuntime) {
    runtime.editingUserEntryID = "";
    const hasModel = runtime.conversationKind === "magi" || runtime.modelOptions.length > 0;
    runtime.messagesContainer.innerHTML = renderWelcomeHTML(hasModel);
    if (!hasModel) {
        // 无模型：绑定「去配置」按钮，点击打开设置-人工智能面板。
        const goBtn = runtime.messagesContainer.querySelector(".agent-welcome__go-setting");
        goBtn?.addEventListener("click", () => {
            void openAiSetting(runtime);
        });
        return;
    }
    const examples = runtime.messagesContainer.querySelectorAll<HTMLElement>(".agent-welcome__example");
    for (const ex of examples) {
        ex.addEventListener("click", async () => {
            const text = ex.getAttribute("data-text") || "";
            await handleWelcomeExample(runtime, text);
        });
    }
}
