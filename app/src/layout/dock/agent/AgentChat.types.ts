/** AgentChat 的完整公开领域表面；外部布局与面板工厂只依赖此聚合根。 */
import type {ModelDomain} from "../../lifecycle/model.types";
import type {AgentPanelConversation} from "./runtime/agentPanel.ports.types";
import type {LayoutTab} from "../../layout.types";
import type {AppFacade} from "../../../app/AppFacade.types";

export interface AgentChatDomain<
    TApplication extends object | undefined = AppFacade | undefined,
    TParent extends LayoutTab = LayoutTab,
> extends ModelDomain<TApplication, TParent> {
    parent: TParent;
    ready(): Promise<void>;
    getConversation(): AgentPanelConversation;
    refreshSessions(): Promise<void>;
    setDraft(text: string, focus?: boolean): Promise<void>;
    openConversation(conversation: AgentPanelConversation): Promise<void>;
    setFloatingCopyOptions(options?: {onClose?: () => void}): void;
    getSessionId(): string;
    readonly layoutSerialization: {readonly instance: "AgentChat"; readonly sessionId: string};
    restoreSessionById(sessionId: string): Promise<void>;
    createFloatingCopy(tab: TParent): Promise<AgentChatDomain<TApplication, TParent>>;
    destroy(): void;
    insertBlockMentions(mentions: Array<{id: string; label: string}>): void;
    refreshModelOptions(): void;
}
