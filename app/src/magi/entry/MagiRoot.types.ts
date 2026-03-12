import type { ComputedRef, InjectionKey, Ref } from "vue";
import type { WrappedSeel, UseMagiReturn } from "../composables/useMagi.types";
import type {
    MagiMainPanelMessageView,
    MagiMainPanelSeelView,
    MagiSeelPanelView,
} from "./magiView.types";
import type { PersonaSeedSavedEvent } from "./persona-seed-panel/PersonaSeedPanel.types";

/**
 * MagiRoot 上下文返回值
 *
 * 用途：定义 `MagiRoot.vue` 模板所需的状态与交互方法。
 * 使用场景：`useMagiRootContext` 返回对象的类型约束。
 * 关联类型：`UseMagiReturn`、`WrappedSeel`、`MagiMainPanelMessageView`。
 */
export interface MagiRootContext {
    ready: Ref<boolean>;
    bootError: Ref<string | null>;
    inputValue: Ref<string>;
    showMessages: Ref<boolean>;
    showSeels: Ref<boolean>;
    showTrinity: Ref<boolean>;
    showQuestionnairePanel: Ref<boolean>;
    showWindowControls: ComputedRef<boolean>;
    sourceSimulationProfiles: Ref<SourceSimulationProfileView[]>;
    sourceSimulationPanels: Ref<SourceSimulationPanelView[]>;
    seels: ComputedRef<WrappedSeel[]>;
    mainPanelSeels: ComputedRef<MagiMainPanelSeelView[]>;
    sageSeels: ComputedRef<WrappedSeel[]>;
    trinitySeel: ComputedRef<WrappedSeel | null>;
    sageSeelViews: ComputedRef<MagiSeelPanelView[]>;
    trinitySeelView: ComputedRef<MagiSeelPanelView | null>;
    displayMessages: ComputedRef<MagiMainPanelMessageView[]>;
    isAnySeelLoading: ComputedRef<boolean>;
    onSubmitInput: (value: string) => Promise<void>;
    onShowQuestionnaire: () => Promise<void>;
    onCloseQuestionnaire: () => void;
    onQuestionnaireSaved: (saved: PersonaSeedSavedEvent) => Promise<void>;
    onReconnect: () => Promise<void>;
    onExportSessionRecord: () => Promise<void>;
    onOpenConsole: () => Promise<void>;
    onMinimizeWindow: () => void;
    onToggleMaximizeWindow: () => Promise<void>;
    onCloseWindow: () => void;
    onCreateSourceSimulationPanel: () => void;
    onRemoveSourceSimulationPanel: (panelId: string) => void;
    onUpdateSourceSimulationInput: (panelId: string, value: string) => void;
    onUpdateSourceSimulationProfile: (panelId: string, profileId: string) => void;
    onUpdateSourceSimulationRequestField: (
        panelId: string,
        field: "identityId" | "password" | "nickname" | "channel" | "requestModel",
        value: string,
    ) => void;
    onSubmitSourceSimulationPanel: (panelId: string) => Promise<void>;
    onStopInput: () => void;
    magiState: Ref<UseMagiReturn | null>;
}

/** 来源模拟画像视图 */
export interface SourceSimulationProfileView {
    id: string;
    label: string;
    source: "guardian" | "external-agent" | "system-cron" | "unknown";
    trustBase: "low" | "medium" | "high";
    riskLevel: "low" | "medium" | "high";
    callerId: string;
}

/** 来源模拟面板消息 */
export interface SourceSimulationPanelMessageView {
    id: string;
    role: "user" | "assistant" | "system" | "error";
    content: string;
    timestamp: number;
    status: "pending" | "success" | "error";
}

/** 来源模拟面板视图 */
export interface SourceSimulationPanelView {
    id: string;
    title: string;
    selectedProfileId: string;
    identityId: string;
    password: string;
    nickname: string;
    channel: "magi-main-ui" | "tool-claude-code" | "tool-openai-sdk" | "tool-claude-sdk" | "tool-custom" | "system-cron";
    requestModel: string;
    inputValue: string;
    loading: boolean;
    messages: SourceSimulationPanelMessageView[];
}

/** provide/inject key for MagiRoot context */
export const MAGI_ROOT_CTX_KEY: InjectionKey<MagiRootContext> = Symbol("MagiRootContext");
