import {requestAgentPromptSourceDocument} from "./AgentPromptSourceDialog";
import {SessionStore} from "./SessionStore";
import type {AgentPromptSourceState} from "./SessionStore.types";
import type {AgentPanelCapabilities, AgentPanelConversation, AgentPanelConversationKind, PanelMenuItem} from "./runtime/agentPanel.ports.types";
import type {AgentPanelResolvedTargetPolicy} from "./runtime/agentPanel.targetPolicy.types";

const MENU_NAME = "agent-prompt-source-actions";

type AgentPromptSourceAction = "bind-document" | "refresh-document" | "keep-snapshot" | "create-document";

/** 提示词来源与会话聚合根之间的唯一协作边界。 */
export interface AgentPromptSourceSessionRuntime {
    getConversation: () => AgentPanelConversation;
    ensurePersisted: (sessionID: string) => Promise<void>;
    refreshSessionPanel: () => Promise<void>;
    isStreaming: () => boolean;
    isDestroyed: () => boolean;
    getTargetPolicy: () => AgentPanelResolvedTargetPolicy;
}

export interface AgentPromptSourceElements {
    row: HTMLElement;
    label: HTMLElement;
    selectButton: HTMLButtonElement;
    actionsButton: HTMLButtonElement;
}

/**
 * 管理文档系统提示词的完整 UI 状态机。它只依赖会话聚合根的持久化边界，
 * 不感知 Dock、Tab、MAGI 或独立页的具体实现。
 */
export class AgentPromptSourceController {
    private elements: AgentPromptSourceElements | undefined;
    private state: AgentPromptSourceState | null = null;
    private error = "";
    private loadSerial = 0;
    private operationSerial = 0;
    private operationPending = false;
    private destroyed = false;

    constructor(
        private readonly capabilities: AgentPanelCapabilities,
        private readonly runtime: AgentPromptSourceSessionRuntime,
    ) {}

    attach(elements: AgentPromptSourceElements) {
        this.elements = elements;
        elements.selectButton.addEventListener("click", (event) => {
            event.stopPropagation();
            if (!this.canInteract()) {
                return;
            }
            void this.runAction("bind-document").catch((error) => this.reportError(error));
        });
        elements.actionsButton.addEventListener("click", (event) => {
            event.stopPropagation();
            if (!this.canInteract() || !this.capabilities.menu) {
                return;
            }
            void this.openActions().catch((error) => this.reportError(error));
        });
        this.updatePresentation();
    }

    reset() {
        this.loadSerial++;
        this.operationSerial++;
        this.operationPending = false;
        this.state = null;
        this.error = "";
        this.closeActions();
        this.updatePresentation();
    }

    closeActions() {
        this.capabilities.menu?.close(MENU_NAME);
    }

    destroy() {
        this.destroyed = true;
        this.reset();
        this.elements = undefined;
    }

    async refresh() {
        const conversation = this.runtime.getConversation();
        const loadID = ++this.loadSerial;
        if (!this.isNativePromptSourceConversation(conversation) || SessionStore.getRevision(conversation.sessionId) < 1) {
            this.state = null;
            this.error = "";
            this.updatePresentation();
            return;
        }
        try {
            const state = await SessionStore.getPromptSource(conversation.sessionId);
            if (!this.isCurrentLoad(loadID, conversation)) {
                return;
            }
            this.state = state;
            this.error = "";
            this.updatePresentation();
        } catch (error) {
            if (!this.isCurrentLoad(loadID, conversation)) {
                return;
            }
            this.state = null;
            this.error = error instanceof Error ? error.message : String(error);
            this.updatePresentation();
            console.error("[AgentPromptSourceController] state refresh failed", error);
        }
    }

    async ensureDecisionBeforeFirstTurn() {
        const conversation = this.runtime.getConversation();
        if (!this.isNativePromptSourceConversation(conversation) || SessionStore.getRevision(conversation.sessionId) < 1) {
            return true;
        }
        try {
            const state = await SessionStore.getPromptSource(conversation.sessionId);
            if (!this.isCurrentConversation(conversation)) {
                return false;
            }
            this.state = state;
            this.error = "";
            this.updatePresentation();
            if (state.state !== "source-changed") {
                return true;
            }
            this.showActions(state);
            this.capabilities.message?.show("系统提示词来源文档已变化，请选择刷新或保持当前快照", 5000);
            return false;
        } catch (error) {
            if (this.isCurrentConversation(conversation)) {
                this.reportError(error);
            }
            return false;
        }
    }

    updatePresentation() {
        const elements = this.elements;
        if (!elements) {
            return;
        }
        const visible = this.runtime.getTargetPolicy().promptSourceVisible;
        elements.row.classList.toggle("fn__none", !visible);
        if (!visible) {
            return;
        }
        const source = this.state?.source;
        let label = "系统提示词：默认";
        let tooltip = "选择一篇文档作为系统提示词";
        if (this.error) {
            label = "系统提示词不可用";
            tooltip = this.error;
        } else if (source?.kind === "document") {
            label = `系统提示词：${source.titleSnapshot || "未命名文档"}`;
            tooltip = this.state?.state === "source-changed"
                ? "来源文档已变化；可重新选择文档，或在下拉菜单中刷新/保持当前快照"
                : "选择或更换系统提示词文档";
        }
        const locked = this.state?.state === "locked";
        if (locked) {
            label += "（已锁定）";
            tooltip = source?.kind === "document"
                ? "首次发送后已锁定当前快照；菜单中可创建独立副本"
                : "首次发送后已锁定默认系统提示词";
        }
        elements.label.textContent = label;
        elements.label.setAttribute("title", tooltip);
        const pending = this.runtime.isStreaming() || this.operationPending;
        elements.selectButton.setAttribute("title", locked ? tooltip : "选择系统提示词文档");
        elements.selectButton.setAttribute("aria-label", locked ? tooltip : "选择系统提示词文档");
        elements.selectButton.disabled = pending || locked;
        const showActions = !!this.capabilities.menu && source?.kind === "document";
        elements.actionsButton.classList.toggle("fn__none", !showActions);
        elements.actionsButton.disabled = pending;
        elements.row.classList.toggle("agent-chat__prompt-source-row--changed", this.state?.state === "source-changed");
        elements.row.classList.toggle("agent-chat__prompt-source-row--locked", locked);
    }

    isOperationPending() {
        return this.operationPending;
    }

    private canInteract() {
        return !this.destroyed && !this.runtime.isDestroyed() && !this.runtime.isStreaming() &&
            !this.operationPending && this.runtime.getTargetPolicy().promptSourceVisible;
    }

    private isNativePromptSourceConversation(conversation: AgentPanelConversation): conversation is AgentPanelConversation & {kind: "native-agent"; sessionId: string} {
        return conversation.kind === "native-agent" && !!conversation.sessionId &&
            this.runtime.getTargetPolicy().promptSourceVisible;
    }

    private isCurrentConversation(conversation: AgentPanelConversation) {
        const current = this.runtime.getConversation();
        return !this.destroyed && !this.runtime.isDestroyed() && current.kind === conversation.kind && current.sessionId === conversation.sessionId;
    }

    private isCurrentLoad(loadID: number, conversation: AgentPanelConversation) {
        return loadID === this.loadSerial && this.isCurrentConversation(conversation);
    }

    private beginOperation() {
        const operationID = ++this.operationSerial;
        this.operationPending = true;
        this.updatePresentation();
        return operationID;
    }

    private finishOperation(operationID: number) {
        if (operationID !== this.operationSerial) {
            return;
        }
        this.operationPending = false;
        this.updatePresentation();
    }

    private isCurrentOperation(operationID: number, conversation: AgentPanelConversation) {
        return operationID === this.operationSerial && this.isCurrentConversation(conversation);
    }

    private async openActions() {
        const conversation = this.runtime.getConversation();
        if (!this.isNativePromptSourceConversation(conversation) || !this.capabilities.menu) {
            return;
        }
        const operationID = this.beginOperation();
        try {
            await this.runtime.ensurePersisted(conversation.sessionId);
            if (!this.isCurrentOperation(operationID, conversation)) {
                return;
            }
            const state = await SessionStore.getPromptSource(conversation.sessionId);
            if (!this.isCurrentOperation(operationID, conversation)) {
                return;
            }
            this.state = state;
            this.error = "";
            this.updatePresentation();
            this.showActions(state);
        } finally {
            this.finishOperation(operationID);
        }
    }

    private showActions(state: AgentPromptSourceState) {
        const menu = this.capabilities.menu;
        const anchor = this.elements?.actionsButton;
        if (!menu || !anchor || state.source.kind !== "document") {
            return;
        }
        const items: PanelMenuItem[] = [];
        const run = (action: AgentPromptSourceAction) => {
            menu.close(MENU_NAME);
            void this.runAction(action).catch((error) => this.reportError(error));
        };
        if (state.state === "source-changed") {
            items.push({label: "刷新为当前文档", icon: "iconRefresh", click: run.bind(null, "refresh-document")});
            items.push({label: "保持当前快照", icon: "iconHistory", click: run.bind(null, "keep-snapshot")});
        }
        items.push({label: "将当前系统提示词创建为文档", icon: "iconCopy", click: run.bind(null, "create-document")});
        menu.popup(MENU_NAME, anchor, items);
    }

    private async runAction(action: AgentPromptSourceAction) {
        const conversation = this.runtime.getConversation();
        if (!this.isNativePromptSourceConversation(conversation)) {
            return;
        }
        const operationID = this.beginOperation();
        try {
            await this.runtime.ensurePersisted(conversation.sessionId);
            if (!this.isCurrentOperation(operationID, conversation)) {
                return;
            }
            let state = await SessionStore.getPromptSource(conversation.sessionId);
            if (!this.isCurrentOperation(operationID, conversation)) {
                return;
            }
            if (state.state === "locked" && action !== "create-document") {
                throw new Error("首次发送后不能更改系统提示词");
            }
            if (action === "bind-document") {
                const document = await requestAgentPromptSourceDocument();
                if (!document || !this.isCurrentOperation(operationID, conversation)) {
                    return;
                }
                state = await SessionStore.bindPromptSourceDocument(conversation.sessionId, document, state.revision);
            } else if (action === "refresh-document") {
                state = await SessionStore.refreshPromptSourceDocument(conversation.sessionId, state.revision);
            } else if (action === "keep-snapshot") {
                state = await SessionStore.keepPromptSourceDocument(conversation.sessionId, state.revision);
            } else {
                if (state.source.kind !== "document") {
                    throw new Error("当前会话没有可创建副本的文档系统提示词");
                }
                const document = await SessionStore.createPromptSourceDocument(conversation.sessionId);
                if (this.isCurrentOperation(operationID, conversation)) {
                    this.capabilities.message?.show(`已创建系统提示词文档：${document.title}`, 3000);
                }
                return;
            }
            if (!this.isCurrentOperation(operationID, conversation)) {
                return;
            }
            this.state = state;
            this.error = "";
            this.updatePresentation();
            await this.runtime.refreshSessionPanel();
        } finally {
            this.finishOperation(operationID);
        }
    }

    private reportError(error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.error = message;
        this.updatePresentation();
        console.error("[AgentPromptSourceController] operation failed", error);
        this.capabilities.message?.show(message, 5000);
    }
}
