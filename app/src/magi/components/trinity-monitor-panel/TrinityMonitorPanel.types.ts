import type { ConnectionStatus, MagiRuntimeStatus } from "../../composables/useMagi.types";
import type { MagiSeelPanelMessageView, MagiSeelPanelView } from "../../entry/magiView.types";

export interface MagiMonitorPanelProps {
    ai: MagiSeelPanelView;
    runtimeStatus?: MagiRuntimeStatus | null;
    showMessages?: boolean;
    accentColor?: string;
}

export type MagiMonitorTone = "accent" | "good" | "warn" | "danger" | "muted";

export interface MagiMonitorStat {
    label: string;
    value: string;
    tone: MagiMonitorTone;
}

export interface MagiMonitorFact {
    label: string;
    value: string;
}

export interface MagiMonitorStreamItem {
    id: string;
    eventType: string;
    tone: MagiMonitorTone;
    timestampText: string;
    seqText: string;
    roundId: string;
    sourceLabel: string;
    summary: string;
    payloadText: string;
}

export interface MagiMonitorVoteDetail {
    key: string;
    name: string;
    decision: string;
    reason: string;
}

export interface MagiMonitorVoteSummary {
    token: string;
    roundId: string;
    round?: number;
    progress: number;
    tone: MagiMonitorTone;
    statusLabel: string;
    proposedAction: string;
    deliberationInitiator: string;
    deliberationReason: string;
    updatedAt: string;
    details: MagiMonitorVoteDetail[];
}

export type MagiMonitorMessage = MagiSeelPanelMessageView;
export type MagiMonitorConnectionStatus = ConnectionStatus;
