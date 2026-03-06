import type { ConnectionStatus, WrappedSeel } from "../../../composables/useMagi.types";
import type { ConsensusRequestContext } from "../../../composables/useMagi.consensus";
import type { MagiMessage } from "../../../utils/messageFactory.types";
import type { ReplyOptions } from "../../core.types";
import type { MockWISE实例 } from "../../wise/wise.types";

/** Avatar 通道白名单（与来源信封保持一致） */
export type AvatarChannel = "guardian" | "external-agent" | "system-cron" | "unknown";

/** Avatar 生命周期状态 */
export type AvatarStatus = "idle" | "active" | "destroyed";

/** Avatar 路由模式 */
export type AvatarDispatchMode = "auto" | "force-avatar";

/** Avatar 描述符（运行时驻留） */
export interface AvatarDescriptor {
    avatarRoleId: string;
    avatarNumber: number;
    channel: AvatarChannel;
    status: AvatarStatus;
    systemPrompt: string;
    memorySeed: string;
    exposureMode: "full" | "partial" | "distorted";
    corePersonaRewrite: string;
    heartbeatIntervalRounds: number;
    roundsSinceMetaReport: number;
    lastHeartbeatAt: number | null;
    createdAt: number;
    destroyedAt: number | null;
    ai: MockWISE实例;
}

/** Avatar 运行时依赖 */
export interface AvatarRuntimeDeps {
    seels: WrappedSeel[];
    consensusMessages: MagiMessage[];
    connectionStatus: { value: ConnectionStatus };
}

/** Avatar 派发请求 */
export interface AvatarDispatchRequest {
    userInput: string;
    requestContext: ConsensusRequestContext;
    requestId: string;
    mode?: AvatarDispatchMode;
    toolOptions?: Pick<ReplyOptions, "tools" | "toolChoice">;
}

/** Avatar 派发结果 */
export interface AvatarDispatchResult {
    handled: boolean;
    content: string;
    usedAvatar: boolean;
    avatarRoleId?: string;
    escalatedToTrinity?: boolean;
    reason?: string;
}

/** Avatar 池快照 */
export interface AvatarPoolSnapshot {
    active: number;
    idle: number;
    pendingApproval: number;
    destroyed: number;
    bindings: Record<AvatarChannel, string | null>;
}

/** Avatar 运行时接口 */
export interface AvatarRuntime {
    tryDispatch(request: AvatarDispatchRequest): Promise<AvatarDispatchResult>;
    getPoolSnapshot(): AvatarPoolSnapshot;
}
