import type {
    ConnectionStatus,
    SourceSimulationContext,
    WrappedSeel,
} from "./useMagi.types";
import type { MagiMessage, SageResponse, VoteResult } from "../utils/messageFactory.types";
import type { MagiEventBus } from "../events/magiEventBus.types";
import { createMessage } from "../utils/messageFactory";
import { getMagiI18nText } from "../utils/magiI18n";
import {
    handleTrinitySummary,
    processSagesResponses,
    processVoting,
    需要审慎决策,
} from "./magiConsensus";
import { generateConsensusReply } from "./magiConsensus.reply";
import {
    handleTrinityPostActionSummary,
    执行梅基奥尔主导行动,
    生成梅基奥尔行动提案,
} from "./magiConsensus.deliberation";
import {
    activateMagiRoundEventContext,
    deactivateMagiRoundEventContext,
    publishRoundFailed,
    publishConsensusMessage,
    publishTrinitySynthesis,
    publishVoteProgress,
} from "./consensus/magiRoundEvents";

/** 单次共识轮次的请求上下文（用于来源模拟与并发关联）。 */
export interface ConsensusRequestContext {
    requestId?: string;
    sourceSimulation?: SourceSimulationContext;
}

interface TrinityResolutionResult {
    publicOutput: string | null;
    internalReports: string[];
}

type SafeSourceChannel = "guardian" | "external-agent" | "system-cron" | "unknown";

interface SafeSourceSignal {
    channel: SafeSourceChannel;
    source: SourceSimulationContext["source"];
    trustBase: SourceSimulationContext["trustBase"];
    riskLevel: SourceSimulationContext["riskLevel"];
}

function isSafeSourceChannel(value: unknown): value is SafeSourceChannel {
    return value === "guardian"
        || value === "external-agent"
        || value === "system-cron"
        || value === "unknown";
}

/** 将外部来源通道归一化为安全白名单，避免把任意字符串喂入贤者输入。 */
function normalizeSafeSourceChannel(
    source: SourceSimulationContext,
): SafeSourceChannel {
    const rawChannel = source.sourceChannel;
    if (isSafeSourceChannel(rawChannel)) {
        return rawChannel;
    }
    if (isSafeSourceChannel(source.source)) {
        return source.source;
    }
    return "unknown";
}

/** 解析安全来源信号；缺失来源时回退 unknown/medium/medium。 */
function resolveSafeSourceSignal(
    requestContext?: ConsensusRequestContext,
): SafeSourceSignal {
    const source = requestContext?.sourceSimulation;
    if (!source) {
        return {
            channel: "unknown",
            source: "unknown",
            trustBase: "medium",
            riskLevel: "medium",
        };
    }
    return {
        channel: normalizeSafeSourceChannel(source),
        source: source.source,
        trustBase: source.trustBase,
        riskLevel: source.riskLevel,
    };
}

/** 构建给贤者的来源信封（仅使用枚举字段，避免语义注入）。 */
function buildSageSourceEnvelope(
    requestContext?: ConsensusRequestContext,
): string {
    const safeSource = resolveSafeSourceSignal(requestContext);
    const payload = JSON.stringify({
        channel: safeSource.channel,
        source: safeSource.source,
        trustBase: safeSource.trustBase,
        riskLevel: safeSource.riskLevel,
    });
    return `<request_source>${payload}</request_source>`;
}

/** 构建贤者输入：来源信封 + 标准 user_message 包裹。 */
function buildSourceAwareSageInput(
    userMessage: string,
    requestContext?: ConsensusRequestContext,
): string {
    const sourceEnvelope = buildSageSourceEnvelope(requestContext);
    return `${sourceEnvelope}
<source=user_message>
${userMessage}
</source>`;
}

/** 从请求上下文提取可持久化的消息元数据。 */
function buildRequestContextMeta(
    requestContext?: ConsensusRequestContext,
): Record<string, unknown> {
    if (!requestContext) {
        return {};
    }
    const source = requestContext.sourceSimulation;
    return {
        ...(requestContext.requestId ? { requestId: requestContext.requestId } : {}),
        ...(source
            ? {
                requestSource: source.source,
                callerId: source.callerId,
                trustBase: source.trustBase,
                riskLevel: source.riskLevel,
                sourceProfileId: source.profileId,
                sourceProfileLabel: source.profileLabel,
                ...(source.sourceChannel ? { sourceChannel: source.sourceChannel } : {}),
                ...(source.sourcePanelId ? { sourcePanelId: source.sourcePanelId } : {}),
                ...(source.sourcePanelTitle ? { sourcePanelTitle: source.sourcePanelTitle } : {}),
                sourceSimulated: true,
            }
            : {}),
    };
}

/** 构建传递给 Trinity 的来源摘要，确保来源信息真正进入综合输入。 */
function buildRequestSourceBrief(requestContext?: ConsensusRequestContext): string {
    const safeSource = resolveSafeSourceSignal(requestContext);
    const lines = [
        "请求来源情报：",
        `- channel=${safeSource.channel}`,
        `- source=${safeSource.source}`,
        `- trustBase=${safeSource.trustBase}`,
        `- riskLevel=${safeSource.riskLevel}`,
    ];
    return lines.join("\n");
}

/** 追加消息到主消息流并统一状态字段。 */
export async function appendConsensusMessage(
    consensusMessages: MagiMessage[],
    type: string,
    content: string,
    meta?: Record<string, unknown>,
): Promise<void> {
    const msg = await createMessage(type, content, meta);
    msg.status = type === "error" ? "error" : "success";
    if (await publishConsensusMessage(msg)) {
        return;
    }
    consensusMessages.push(msg);
}

/** 追加投票状态消息，兼容现有主面板 vote-status 展示。 */
async function appendVoteStatusMessage(
    consensusMessages: MagiMessage[],
    progress: number,
    vote?: VoteResult,
    proposedAction?: string,
): Promise<void> {
    const details = vote
        ? [
            { name: "MELCHIOR", decision: vote.melchior },
            { name: "BALTHASAR", decision: vote.balthazar },
            { name: "CASPER", decision: vote.casper },
        ]
        : [];
    if (await publishVoteProgress(progress, details, proposedAction)) {
        return;
    }
    const meta: Record<string, unknown> = {
        type: "vote-status",
        progress,
        details,
        ...(proposedAction ? { proposedAction } : {}),
    };
    await appendConsensusMessage(
        consensusMessages,
        "system",
        getMagiI18nText("evaluationCompleted"),
        meta,
    );
}

/** 追加三贤者有效响应，保持既有消息结构。 */
async function appendSageResponses(
    consensusMessages: MagiMessage[],
    validResponses: SageResponse[],
): Promise<void> {
    for (const response of validResponses) {
        await appendConsensusMessage(
            consensusMessages,
            "consensus",
            `${response.displayName}: ${response.content}`,
            {
                type: "sage-response",
                seel: response.seel,
                displayName: response.displayName,
                ...(typeof response.requiresDeliberation === "boolean"
                    ? { requiresDeliberation: response.requiresDeliberation }
                    : {}),
                ...(typeof response.usedToolCall === "boolean"
                    ? { usedToolCall: response.usedToolCall }
                    : {}),
            },
        );
    }
}

/** 从本轮贤者响应中提取 Melchior 是否发起工具调用（实测值）。 */
function resolveMelchiorUsedToolCall(validResponses: SageResponse[]): boolean {
    const melchior = validResponses.find((response) => response.seel.includes("MELCHIOR"));
    return melchior?.usedToolCall === true;
}

/** 将 Trinity 原文输出写入三贤人各自历史栈，作为下一轮可见历史。 */
async function appendTrinityHistoryToSages(
    sages: WrappedSeel[],
    trinityContent: string,
): Promise<void> {
    const history = trinityContent.trim();
    if (!history) {
        return;
    }
    for (const sage of sages) {
        await sage.replaceLatestAssistantContextMessage(history);
    }
}

/** 执行审慎决策投票链路并返回决策结果。 */
async function resolveVoteResult(
    consensusMessages: MagiMessage[],
    sages: WrappedSeel[],
    validResponses: SageResponse[],
    userMessage: string,
): Promise<{ deliberationRequired: boolean; voteResult: VoteResult | null; proposedAction: string | null }> {
    const deliberationRequired = await 需要审慎决策(validResponses);
    if (!deliberationRequired) {
        return { deliberationRequired, voteResult: null, proposedAction: null };
    }

    const proposedAction = await 生成梅基奥尔行动提案(sages, validResponses, userMessage);
    const melchiorConclusion =
        validResponses.find((response) => response.seel.includes("MELCHIOR"))?.content ?? "无附加判断";
    await appendVoteStatusMessage(consensusMessages, 0, undefined, proposedAction);
    const voteResult = await processVoting(
        sages,
        proposedAction,
        { userMessage, melchiorConclusion },
        (progress) => {
            void appendVoteStatusMessage(consensusMessages, progress, undefined, proposedAction);
        },
    );

    if (voteResult !== null) {
        await appendVoteStatusMessage(consensusMessages, 100, voteResult, proposedAction);
    }

    return { deliberationRequired, voteResult, proposedAction };
}

/** 收集并落盘贤者响应；若全部无效则写入错误并返回 null。 */
async function collectValidResponses(
    consensusMessages: MagiMessage[],
    sages: WrappedSeel[],
    userMessage: string,
    requestContext?: ConsensusRequestContext,
): Promise<SageResponse[] | null> {
    const sourceAwareInput = buildSourceAwareSageInput(userMessage, requestContext);
    const validResponses = await processSagesResponses(sages, userMessage, {
        modelInput: sourceAwareInput,
    });
    await appendSageResponses(consensusMessages, validResponses);

    // 三贤者全部失败或返回空内容时，终止本轮并给出可见错误，避免继续进入 Trinity/投票产生误导结果。
    if (validResponses.length === 0) {
        await appendConsensusMessage(consensusMessages, "error", getMagiI18nText("noConsensus"));
        return null;
    }
    return validResponses;
}

/** 根据分支条件生成本轮 Trinity 输出文本。 */
async function resolveTrinityResult(
    deliberationRequired: boolean,
    voteResult: VoteResult | null,
    proposedAction: string | null,
    userMessage: string,
    sages: WrappedSeel[],
    trinity: WrappedSeel | null,
    validResponses: SageResponse[],
    requestContext?: ConsensusRequestContext,
): Promise<TrinityResolutionResult> {
    const requestSourceBrief = buildRequestSourceBrief(requestContext);
    if (!deliberationRequired && !trinity) {
        return {
            publicOutput: validResponses.map((response) => response.content).join("\n"),
            internalReports: [],
        };
    }
    if (!deliberationRequired) {
        const summary = await handleTrinitySummary(
            validResponses,
            trinity,
            userMessage,
            requestSourceBrief,
        );
        return {
            publicOutput: summary.content,
            internalReports: summary.internalToolMessages,
        };
    }
    if (!voteResult?.passed) {
        // 审慎决策未通过时，不进入主导执行分支，交由后续反刍入口处理。
        return {
            publicOutput: null,
            internalReports: [],
        };
    }

    const action = proposedAction ?? userMessage;
    const melchiorActionResult = await 执行梅基奥尔主导行动(sages, userMessage, action);
    const safeActionResult = melchiorActionResult ?? "已进入执行阶段，但暂未产生可见输出。";
    if (!trinity) {
        return {
            publicOutput: safeActionResult,
            internalReports: [],
        };
    }
    const summary = await handleTrinityPostActionSummary(
        validResponses,
        trinity,
        action,
        voteResult,
        safeActionResult,
        userMessage,
        requestSourceBrief,
    );
    return {
        publicOutput: summary.content,
        internalReports: summary.internalToolMessages,
    };
}

/** 执行单轮完整共识计算并写入消息流。 */
async function runConsensusRound(
    consensusMessages: MagiMessage[],
    sages: WrappedSeel[],
    trinity: WrappedSeel | null,
    userMessage: string,
    requestContext?: ConsensusRequestContext,
): Promise<void> {
    const validResponses = await collectValidResponses(
        consensusMessages,
        sages,
        userMessage,
        requestContext,
    );
    if (!validResponses) {
        return;
    }
    const melchiorUsedToolCall = resolveMelchiorUsedToolCall(validResponses);
    const { deliberationRequired, voteResult, proposedAction } = await resolveVoteResult(
        consensusMessages,
        sages,
        validResponses,
        userMessage,
    );
    const trinityResult = await resolveTrinityResult(
        deliberationRequired,
        voteResult,
        proposedAction,
        userMessage,
        sages,
        trinity,
        validResponses,
        requestContext,
    );
    await appendFinalConsensus(
        consensusMessages,
        trinityResult.publicOutput,
        voteResult,
        deliberationRequired,
        userMessage,
        melchiorUsedToolCall,
        sages,
        trinity !== null,
        trinityResult.internalReports,
        requestContext,
    );
}

/** 生成最终共识消息并写入主消息流。 */
async function appendFinalConsensus(
    consensusMessages: MagiMessage[],
    trinityResult: string | null,
    voteResult: VoteResult | null,
    deliberationRequired: boolean,
    userMessage: string,
    melchiorUsedToolCall: boolean,
    sages: WrappedSeel[],
    hasTrinity: boolean,
    internalReports: string[],
    requestContext?: ConsensusRequestContext,
): Promise<void> {
    const consensusReply = await generateConsensusReply(
        trinityResult,
        voteResult,
        deliberationRequired,
        userMessage,
        melchiorUsedToolCall,
    );
    const finalMessage = await createMessage(
        consensusReply.type,
        consensusReply.content,
        consensusReply.meta,
    );
    finalMessage.status = consensusReply.status;
    finalMessage.timestamp = consensusReply.timestamp;
    const requestMeta = buildRequestContextMeta(requestContext);
    if (Object.keys(requestMeta).length > 0) {
        finalMessage.meta = {
            ...(finalMessage.meta ?? {}),
            ...requestMeta,
        };
    }
    // 事件桥接不可用时回退到原始数组写入，保证离线模式仍可用。
    if (!await publishConsensusMessage(finalMessage)) {
        consensusMessages.push(finalMessage);
    }

    const source = Reflect.get(finalMessage.meta ?? {}, "source");
    const eligible = Reflect.get(finalMessage.meta ?? {}, "trinityHistoryEligible");
    const rawTrinityOutput = typeof trinityResult === "string" ? trinityResult.trim() : "";
    // 仅在本轮明确可复用且来源为 Trinity 综合输出时写入三贤人历史栈。
    if (hasTrinity && source === "trinity-synthesis" && eligible === true && rawTrinityOutput) {
        await appendTrinityHistoryToSages(sages, rawTrinityOutput);
    }
    if (rawTrinityOutput) {
        void publishTrinitySynthesis(rawTrinityOutput, finalMessage.timestamp);
    }
    if (internalReports.length > 0) {
        for (const report of internalReports) {
            await appendConsensusMessage(
                consensusMessages,
                "system",
                report,
                {
                    type: "trinity-channel-report",
                    channel: "internal",
                    internalOnly: true,
                    ...requestMeta,
                },
            );
        }
    }
}

/**
 * 发送用户消息并执行完整共识链路（T2.2 Step A）。
 * 作用：三贤者响应 -> Trinity 统合 -> 可选投票 -> 最终共识落盘。
 * 调用时机：输入栏 submit 事件触发后。
 */
export async function sendUserMessageWithConsensus(
    text: string,
    connectionStatus: { value: ConnectionStatus },
    consensusMessages: MagiMessage[],
    seels: WrappedSeel[],
    eventBus?: MagiEventBus,
    requestContext?: ConsensusRequestContext,
): Promise<void> {
    const userMessage = text.trim();
    if (!userMessage || connectionStatus.value !== "connected") {
        return;
    }
    await activateMagiRoundEventContext(eventBus, userMessage);
    try {
        const inputMeta: Record<string, unknown> = {
            type: "round-input",
            ...buildRequestContextMeta(requestContext),
        };
        await appendConsensusMessage(
            consensusMessages,
            "user",
            userMessage,
            inputMeta,
        );
        const sages = seels.filter((seel) => seel.config.name !== "TRINITY-00");
        const trinity = seels.find((seel) => seel.config.name === "TRINITY-00") ?? null;
        // 三贤者为空时后续流程无法成立，必须提前兜底退出。
        if (sages.length === 0) {
            void publishRoundFailed("未找到可用贤者，无法完成共识流程");
            await appendConsensusMessage(consensusMessages, "error", "未找到可用贤者，无法完成共识流程");
            return;
        }
        await runConsensusRound(
            consensusMessages,
            sages,
            trinity,
            userMessage,
            requestContext,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void publishRoundFailed(message);
        await appendConsensusMessage(
            consensusMessages,
            "error",
            `共识链路异常，已执行兜底并结束本轮: ${message}`,
        );
    } finally {
        await deactivateMagiRoundEventContext();
    }
}
