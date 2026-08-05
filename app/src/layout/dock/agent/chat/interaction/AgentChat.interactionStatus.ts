/** 用途：约束 Kernel 交互终态；使用范围：确认和问题卡片标签；解耦评估：经本目录网关复用协议状态集合。 */
import type {AgentInteractionResolutionStatus} from "./imports";

/** 将协议终态映射到现有本地化文案，不通过工具结果文本推断状态。 @同步豁免: UI构建 - 卡片结算必须同步取得标签后原子替换操作区。 */
export function resolveInteractionStatusLabel(
    kind: "confirm" | "question",
    status: AgentInteractionResolutionStatus | "pending" | string | undefined,
) {
    const languages = window.siyuan.languages;
    if (status === "approved") {
        return languages.agentConfirmApprove || "Approved";
    }
    if (status === "always") {
        return languages.agentConfirmAlways || "Session Allow";
    }
    if (status === "rejected") {
        return languages.agentConfirmReject || "Rejected";
    }
    if (status === "submitted") {
        return languages.agentQuestionSubmitted || "Submitted";
    }
    if (status === "expired") {
        return languages.agentConfirmTimeout || "Expired";
    }
    if (status === "cancelled") {
        return languages.cancel || "Cancelled";
    }
    if (status === "error") {
        return languages.agentQueueFailed || "Failed";
    }
    return kind === "confirm"
        ? languages.agentConfirmPending || "Pending"
        : languages.agentQuestionPending || "Awaiting answer";
}
