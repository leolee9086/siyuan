/** 用途：约束工具状态和思考卡片 DOM；使用范围：本文件所有函数。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束查找返回的工具记录；使用范围：工具调用匹配。 */
import type {AgentToolCall} from "./imports";
/** 用途：渲染首个运行中工具徽标；使用范围：思考卡片工具行创建；解耦评估：渲染 HTML 属于展示边界，经目录网关集中导入避免重复实现。 */
import {renderToolsLineHTML} from "./imports";
/** 用途：工具徽标更新后维持贴底；使用范围：运行中状态展示；解耦评估：滚动是既有消息区域职责，经目录网关调用保持单一入口。 */
import {scrollToBottom} from "./imports";

/**
 * 按调用 ID 查找当前工具记录，缺少 ID 时回退到最后一个同名未完成调用。
 * @同步豁免: 性能考虑
 * @显式返回类型原因 该签名被方法契约与调用方共同使用，需固定返回边界，避免推导随实现细节漂移。
 */
export function findCurrentToolCall(runtime: AgentChatRuntime, callID: string, name: string): AgentToolCall | undefined {
    const byID = callID ? runtime.currentToolCalls.find((toolCall) => toolCall.id === callID) : undefined;
    if (byID) {
        return byID;
    }
    for (let index = runtime.currentToolCalls.length - 1; index >= 0; index--) {
        const toolCall = runtime.currentToolCalls[index];
        if (toolCall && toolCall.name === name && toolCall.result === undefined) {
            return toolCall;
        }
    }
    return undefined;
}

/** 在活动思考卡片中显示运行中工具。 @同步豁免: UI构建 */
export function appendRunningToolBadge(runtime: AgentChatRuntime, name: string) {
    const body = runtime.messagesContainer.querySelector<HTMLElement>(
        ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done) .agent-chat__thinking-body",
    );
    if (!body) {
        return;
    }
    runtime.toolCallStartedAt.set(name, Date.now());
    // 同名工具已在本轮渲染过时只切换运行态，避免重复追加徽标。
    if (runtime.renderedToolNames[name]) {
        setToolCallRunning(runtime, name, true);
        return;
    }
    runtime.renderedToolNames[name] = true;
    const toolLine = body.lastElementChild;
    // 最后一个子元素不是工具行时新建整行，否则在既有工具行末尾追加徽标。
    if (!toolLine?.classList.contains("agent-chat__thinking-tools-line")) {
        body.insertAdjacentHTML("beforeend", renderToolsLineHTML([{name, running: true}]));
        syncToolBadgeScroll(runtime, body);
        return;
    }
    const toolElement = document.createElement("span");
    toolElement.className = "agent-chat__thinking-tool agent-chat__thinking-tool--running";
    toolElement.textContent = name;
    toolLine.appendChild(toolElement);
    syncToolBadgeScroll(runtime, body);
}

/** 将工具行和消息区域同步到最新徽标。 */
function syncToolBadgeScroll(runtime: AgentChatRuntime, body: HTMLElement) {
    body.scrollTop = body.scrollHeight;
    scrollToBottom(runtime);
}

/** 切换指定工具徽标的运行状态。 @同步豁免: UI构建 */
export function setToolCallRunning(runtime: AgentChatRuntime, name: string, running: boolean) {
    const selector = running
        ? ".agent-chat__msg--thinking:not(.agent-chat__msg--thinking-done) .agent-chat__thinking-tool"
        : ".agent-chat__thinking-tool--running";
    const toolElements = runtime.messagesContainer.querySelectorAll(selector);
    for (let index = toolElements.length - 1; index >= 0; index--) {
        const toolElement = toolElements.item(index);
        if (toolElement?.textContent !== name) {
            continue;
        }
        toolElement.classList.toggle("agent-chat__thinking-tool--running", running);
        if (running) {
            return;
        }
    }
}

/** 在最后一个同名工具完成后清除运行徽标。 @同步豁免: 生命周期 */
export function finishToolCall(runtime: AgentChatRuntime, name: string) {
    const stillRunning = runtime.currentToolCalls.some((item) => item.name === name && item.result === undefined);
    if (stillRunning) {
        return;
    }
    setToolCallRunning(runtime, name, false);
    runtime.toolCallStartedAt.delete(name);
}

/** 读取网页搜索调用的查询参数。 @同步豁免: 性能考虑 */
export function webSearchQuery(runtime: AgentChatRuntime, callID: string) {
    const call = findCurrentToolCall(runtime, callID, "web_search");
    return call && typeof call.arguments.query === "string" ? call.arguments.query : "";
}

/** 按调用 ID 查找现有工具卡片。 @同步豁免: 需要绝对同步的DOM访问 */
export function findToolCallCard(runtime: AgentChatRuntime, callID: string) {
    if (!callID) {
        return null;
    }
    const cards = runtime.messagesContainer.querySelectorAll<HTMLElement>("[data-tool-call-id]");
    for (const card of cards) {
        if (card.getAttribute("data-tool-call-id") === callID) {
            return card;
        }
    }
    return null;
}
