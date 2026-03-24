import type { ConnectionStatus, MagiRuntimeStatus } from "../../composables/useMagi.types";
import type { MagiSeelPanelMessageView, MagiSeelPanelView } from "../../entry/magiView.types";

export interface TrinityMonitorPanelProps {
    ai: MagiSeelPanelView;
    runtimeStatus?: MagiRuntimeStatus | null;
    showMessages?: boolean;
    accentColor?: string;
}

export type TrinityMonitorTone = "accent" | "good" | "warn" | "danger" | "muted";

export interface TrinityMonitorStat {
    label: string;
    value: string;
    tone: TrinityMonitorTone;
}

export interface TrinityMonitorFact {
    label: string;
    value: string;
}

export interface TrinityMonitorStreamItem {
    id: string;
    eventType: string;
    tone: TrinityMonitorTone;
    timestampText: string;
    seqText: string;
    roundId: string;
    sourceLabel: string;
    summary: string;
    payloadText: string;
}

export type TrinityMonitorMessage = MagiSeelPanelMessageView;
export type TrinityMonitorConnectionStatus = ConnectionStatus;
