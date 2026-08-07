/** 用途：约束事件绑定与处理所需的运行时契约；使用范围：本文件全部事件处理函数；解耦评估：类型导入编译后消失，不增加运行时依赖。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：校验目标选择是否为 Agent 面板会话类型；使用范围：目标切换事件处理；解耦评估：守卫是纯类型判断函数，直接复用保持解析规则单一来源。 */
import {isAgentPanelConversationKind} from "./AgentChat.events.guard";
/** 用途：从自定义事件读取结构化详情；使用范围：用户编辑提交与重新生成请求事件；解耦评估：守卫是纯数据校验函数，集中复用可防止解析规则漂移。 */
import {readCustomEventDetail} from "./AgentChat.events.guard";
/** 用途：收窄事件目标为 HTMLElement；使用范围：面板点击处理；解耦评估：DOM 类型守卫是纯函数，直接复用避免重复平台判断。 */
import {isHTMLElement} from "./imports";
/** 用途：创建新会话；使用范围：新会话按钮点击；解耦评估：会话创建归会话领域所有，事件层只触发其公开入口。 */
import {createSession} from "./imports";
/** 用途：打开指定会话；使用范围：目标切换事件处理；解耦评估：会话切换边界集中在目标策略模块，复用其公开入口保持切换语义一致。 */
import {openConversation} from "./imports";
/** 用途：订阅用户编辑提交事件名；使用范围：输入区事件绑定；解耦评估：事件常量是消息领域的既有契约，集中引用避免字符串漂移。 */
import {agentChatUserEditSubmitEvent} from "./imports";
/** 用途：约束用户编辑提交载荷；使用范围：编辑提交事件解析；解耦评估：纯类型依赖，编译后消失。 */
/** 用途：重新生成响应；使用范围：编辑提交与重新生成请求事件；解耦评估：重新生成协议独立成模块，事件层只登记触发点。 */
import {regenerateResponse} from "./imports";
/** 用途：订阅重新生成请求事件名；使用范围：输入区事件绑定；解耦评估：事件常量是消息领域的既有契约，集中引用避免字符串漂移。 */
import {agentChatRegenerateRequestEvent} from "./imports";
/** 用途：关闭令牌明细弹窗；使用范围：令牌鼠标离开与点击；解耦评估：令牌弹窗生命周期归指标模块所有，事件层只触发公开命令。 */
import {closeTokenBreakdownPopup} from "./imports";
/** 用途：打开令牌明细弹窗；使用范围：令牌悬浮与点击；解耦评估：令牌弹窗生命周期归指标模块所有，事件层只触发公开命令。 */
import {showTokenBreakdownPopup} from "./imports";
/** 用途：发送输入区消息；使用范围：发送按钮点击；解耦评估：发送流程独立成模块，事件层只触发其公开入口。 */
import {sendMessage} from "./imports";
/** 用途：打开会话文件菜单；使用范围：文件按钮点击；解耦评估：文件菜单构建归文件模块所有，事件层只触发公开入口。 */
import {openSessionFilesMenu} from "./imports";
/** 用途：上传会话文件；使用范围：文件输入变化；解耦评估：上传流程独立成模块，事件层只触发其公开入口。 */
import {uploadSessionFiles} from "./imports";
/** 用途：报告会话文件错误；使用范围：文件操作 Promise 失败回调；解耦评估：错误报告集中归文件模块，事件层不复制错误处理。 */
import {reportSessionFileError} from "./imports";
/** 用途：停止当前生成；使用范围：停止按钮点击；解耦评估：停止流程独立成模块，事件层只触发其公开入口。 */
import {stopGeneration} from "./imports";
/** 用途：滚动消息视图到底部；使用范围：滚动到底按钮点击；解耦评估：滚动行为集中归反馈模块，事件层只触发公开入口。 */
import {scrollToBottom} from "./imports";

/** 鼠标离开令牌展示区域时关闭令牌明细弹窗。 */
function handleTokenMouseLeave(runtime: AgentChatRuntime, event: MouseEvent) {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && runtime.tokenPopup?.contains(relatedTarget)) {
        return;
    }
    closeTokenBreakdownPopup(runtime);
}

/** 点击令牌展示区域时切换令牌明细弹窗的显示状态。 */
function handleTokenClick(runtime: AgentChatRuntime, event: MouseEvent) {
    event.stopPropagation();
    if (runtime.tokenPopup) {
        closeTokenBreakdownPopup(runtime);
        return;
    }
    showTokenBreakdownPopup(runtime);
}

/** 绑定令牌明细的悬浮和点击交互。 */
/** @同步豁免: UI构建 - DOM 事件绑定必须在同一次渲染中完成，事件回调本身不启动异步任务。 */
export function bindAgentChatTokenEvents(runtime: AgentChatRuntime) {
    // 条件 window.matchMedia("(hover: hover)").matches 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (window.matchMedia("(hover: hover)").matches) {
        runtime.tokenDisplayEl.addEventListener("mouseenter", () => {
            showTokenBreakdownPopup(runtime);
        });
        runtime.tokenDisplayEl.addEventListener("mouseleave", (event: MouseEvent) => handleTokenMouseLeave(runtime, event));
    }
    runtime.tokenDisplayEl.addEventListener("click", (event: MouseEvent) => handleTokenClick(runtime, event));
}

/** 处理用户编辑提交事件，重新生成响应。 */
function handleUserEditSubmit(runtime: AgentChatRuntime, event: Event) {
    const detail = readCustomEventDetail<{entryID: string; content: string}>(event);
    if (!detail) {
        return;
    }
    void regenerateResponse(runtime, detail.entryID, detail.content);
}

/** 处理重新生成请求事件。 */
function handleRegenerateRequest(runtime: AgentChatRuntime, event: Event) {
    const userEntryID = readCustomEventDetail<string | undefined>(event);
    if (userEntryID === null) {
        return;
    }
    void regenerateResponse(runtime, userEntryID);
}

/** 处理会话文件按钮点击，打开文件菜单。 */
function handleSessionFilesClick(runtime: AgentChatRuntime, event: MouseEvent) {
    event.stopPropagation();
    if (runtime.isStreaming || runtime.sessionFileOperationPending ||
        runtime.sessionFilesBtn.getAttribute("aria-disabled") === "true") {
        return;
    }
    void openSessionFilesMenu(runtime).catch((error) => reportSessionFileError(runtime, error));
}

/** 处理会话文件选择变化，上传所选文件。 */
function handleSessionFilesChange(runtime: AgentChatRuntime) {
    const files = Array.from(runtime.sessionFilesInput.files || []);
    runtime.sessionFilesInput.value = "";
    // 条件 files.length > 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (files.length > 0) {
        void uploadSessionFiles(runtime, files).catch((error) => reportSessionFileError(runtime, error));
    }
}

/** 绑定目标、发送、上传和停止等输入区动作。 */
/** @同步豁免: UI构建 - DOM 事件绑定必须在同一次渲染中完成，事件回调本身不启动异步任务。 */
export function bindAgentChatComposerEvents(runtime: AgentChatRuntime) {
    runtime.messagesContainer.addEventListener(agentChatUserEditSubmitEvent, (event: Event) => handleUserEditSubmit(runtime, event));
    runtime.messagesContainer.addEventListener(agentChatRegenerateRequestEvent, (event: Event) => handleRegenerateRequest(runtime, event));
    runtime.targetSelect.addEventListener("change", () => {
        const kind = runtime.targetSelect.value;
        // 条件 isAgentPanelConversationKind(kind) 成立时才执行此分支，避免影响其它会话或响应阶段。
        if (isAgentPanelConversationKind(kind)) {
            void openConversation(runtime, {kind});
        }
    });
    runtime.sendBtn.addEventListener("click", (event: MouseEvent) => {
        event.stopPropagation();
        void sendMessage(runtime);
    });
    runtime.sessionFilesBtn.addEventListener("click", (event: MouseEvent) => handleSessionFilesClick(runtime, event));
    runtime.sessionFilesInput.addEventListener("change", () => handleSessionFilesChange(runtime));
    runtime.stopBtn.addEventListener("click", (event: MouseEvent) => {
        event.stopPropagation();
        void stopGeneration(runtime);
    });
}

/** 处理新会话按钮点击。 */
function handleNewSessionClick(runtime: AgentChatRuntime, event: MouseEvent) {
    event.stopPropagation();
    if (runtime.isStreaming) {
        return;
    }
    if (!runtime.isFloatingCopy) {
        runtime.capabilities.focusPanel?.(runtime.parent.panelElement);
    }
    void createSession(runtime);
}

/** 处理会话菜单按钮点击。 */
function handleSessionMenuClick(runtime: AgentChatRuntime, event: MouseEvent) {
    event.stopPropagation();
    if (runtime.isStreaming) {
        return;
    }
    if (!runtime.isFloatingCopy) {
        runtime.capabilities.focusPanel?.(runtime.parent.panelElement);
    }
    runtime.sessionPanel.toggle();
}

/** 处理副本按钮点击，打开浮窗或标签页副本。 */
function handleCopyButtonClick(runtime: AgentChatRuntime, event: MouseEvent, kind: "floating" | "tab") {
    event.stopPropagation();
    if (runtime.isFloatingCopy) {
        return;
    }
    const result = kind === "floating" ? runtime.capabilities.openFloat?.() : runtime.capabilities.openTab?.();
    void Promise.resolve(result).catch((error) => {
        console.error(`[agent-chat] failed to open ${kind} copy`, error);
    });
}

/** 处理"在标签页新建"按钮点击，打开空白会话的独立 Agent 面板。 */
function handleNewTabClick(runtime: AgentChatRuntime, event: MouseEvent) {
    event.stopPropagation();
    if (runtime.isFloatingCopy) {
        return;
    }
    const result = runtime.capabilities.openTabNew?.();
    void Promise.resolve(result).catch((error) => {
        console.error("[agent-chat] failed to open new tab copy", error);
    });
}

/** 绑定新会话、身份入口、会话菜单和副本窗口动作。 */
/** @同步豁免: UI构建 - DOM 事件绑定必须在同一次渲染中完成，事件回调本身不启动异步任务。 */
export function bindAgentChatSessionEvents(runtime: AgentChatRuntime) {
    runtime.newSessionBtn.addEventListener("click", (event: MouseEvent) => handleNewSessionClick(runtime, event));
    runtime.guardianAuthBtn.addEventListener("click", (event: MouseEvent) => {
        event.stopPropagation();
        void runtime.capabilities.openIdentityAccess?.();
    });
    runtime.sessionMenuBtn.addEventListener("click", (event: MouseEvent) => handleSessionMenuClick(runtime, event));
    runtime.floatingBtn.addEventListener("click", (event: MouseEvent) => handleCopyButtonClick(runtime, event, "floating"));
    runtime.tabBtn.addEventListener("click", (event: MouseEvent) => handleCopyButtonClick(runtime, event, "tab"));
    runtime.tabNewBtn.addEventListener("click", (event: MouseEvent) => handleNewTabClick(runtime, event));
}

/** 处理面板点击：关闭浮窗副本、最小化面板或聚焦输入框。 */
function handlePanelClick(runtime: AgentChatRuntime, event: MouseEvent) {
    const target = event.target;
    if (!isHTMLElement(target)) {
        return;
    }
    // 条件 runtime.isFloatingCopy && runtime.floatingCloseHandler 成立时关闭浮窗副本。
    if (runtime.isFloatingCopy && runtime.floatingCloseHandler && target.closest('[data-type="min"]')) {
        event.stopPropagation();
        runtime.floatingCloseHandler();
        return;
    }
    if (!runtime.isFloatingCopy) {
        runtime.capabilities.focusPanel?.(runtime.parent.panelElement);
    }
    const minimize = target.closest<HTMLElement>('.block__icon[data-type="min"]');
    if (minimize) {
        event.stopPropagation();
        runtime.capabilities.minimizeDock?.();
        return;
    }
    const ignored = ".block__icons, .agent-chat__msg, .agent-chat__header, .agent-session-popup, .b3-select";
    // 条件 !target.closest(ignored) 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (!target.closest(ignored)) {
        runtime.composer?.focus();
    }
}

/** 绑定面板聚焦、最小化和空白区域聚焦输入框的宿主行为。 */
/** @同步豁免: UI构建 - DOM 事件绑定必须在同一次渲染中完成，事件回调本身不启动异步任务。 */
export function bindAgentChatHostEvents(runtime: AgentChatRuntime) {
    runtime.parent.panelElement.addEventListener("click", (event: MouseEvent) => handlePanelClick(runtime, event));
    runtime.scrollBottomBtn.addEventListener("click", () => scrollToBottom(runtime, true, true));
}
