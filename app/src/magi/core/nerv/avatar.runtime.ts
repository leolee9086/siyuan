import type { SourceSimulationContext } from "../../composables/useMagi.types";
import type { ConsensusRequestContext } from "../../composables/useMagi.consensus";
import { appendConsensusMessage } from "../../composables/useMagi.consensus";
import type { StreamResult } from "../../utils/messageFactory.types";
import type { OpenAICompatConfig } from "../core.types";
import { processStreamResponse } from "../../utils/streamProcessor";
import { 创建MockWISE实例 } from "../wise/mockWise";
import {
    AVATAR_META_TOOL_PROMPT,
    AVATAR_REPORT_TOOL_NAME,
    buildAvatarMetaToolReplyOptions,
    extractAvatarReportPayloadsFromToolArguments,
} from "./avatar.toolset";
import type {
    AvatarChannel,
    AvatarDescriptor,
    AvatarDispatchRequest,
    AvatarDispatchResult,
    AvatarPoolSnapshot,
    AvatarRuntime,
    AvatarRuntimeDeps,
} from "./avatar.runtime.types";

const AVATAR_HEARTBEAT_INTERVAL_ROUNDS = 3;
const AVATAR_MEMORY_SEED_MAX = 6;
const AVATAR_CREATE_VOTE_ROUND = 1;

type AvatarCreateDecision = "approved" | "rejected";

interface AvatarCreationProposal {
    sageName: string;
    displayName: string;
    decision: AvatarCreateDecision;
    reason: string;
    systemPromptProposal: string;
}

function isAvatarChannel(value: unknown): value is AvatarChannel {
    return value === "guardian"
        || value === "external-agent"
        || value === "system-cron"
        || value === "unknown";
}

function resolveRequestChannel(requestContext: ConsensusRequestContext): AvatarChannel {
    const source = requestContext.sourceSimulation;
    if (!source) {
        return "unknown";
    }
    if (isAvatarChannel(source.sourceChannel)) {
        return source.sourceChannel;
    }
    if (isAvatarChannel(source.source)) {
        return source.source;
    }
    return "unknown";
}

function shouldDelegateToAvatar(
    requestContext: ConsensusRequestContext,
    hasChannelBinding: boolean,
    mode: AvatarDispatchRequest["mode"] = "auto",
): boolean {
    if (mode === "force-avatar") {
        return true;
    }
    if (hasChannelBinding) {
        return true;
    }
    const source = requestContext.sourceSimulation;
    if (!source) {
        return false;
    }
    if (source.trustBase === "low") {
        return true;
    }
    if (source.trustBase === "medium") {
        return source.riskLevel === "low";
    }
    if (source.trustBase === "high") {
        return source.riskLevel !== "low";
    }
    return false;
}

function buildAvatarSourceEnvelope(requestContext: ConsensusRequestContext): string {
    const source = requestContext.sourceSimulation;
    const channel = resolveRequestChannel(requestContext);
    const trustBase = source?.trustBase ?? "medium";
    const riskLevel = source?.riskLevel ?? "medium";
    const payload = JSON.stringify({
        channel,
        source: source?.source ?? "unknown",
        trustBase,
        riskLevel,
    });
    return `<request_source>${payload}</request_source>`;
}

function buildAvatarModelInput(
    userInput: string,
    requestContext: ConsensusRequestContext,
    heartbeatRequired: boolean,
): string {
    const heartbeatDirective = heartbeatRequired
        ? "\n[HEARTBEAT_REQUIRED] 本轮必须调用 report_to_core(type=\"heartbeat\") 后再输出正文。"
        : "";
    return `${buildAvatarSourceEnvelope(requestContext)}
<source=user_message>
${userInput}
</source>${heartbeatDirective}`;
}

function pickRecentMemorySeed(
    consensusMessages: AvatarRuntimeDeps["consensusMessages"],
    exposureMode: "full" | "partial" | "distorted",
): string {
    const candidate = consensusMessages
        .filter((message) => message.type === "user" || message.type === "consensus")
        .slice(-AVATAR_MEMORY_SEED_MAX)
        .map((message) => message.content.trim())
        .filter((content) => Boolean(content));
    if (candidate.length === 0) {
        return "无可用历史记忆种子。";
    }
    if (exposureMode === "full") {
        return candidate.join("\n---\n");
    }
    const partial = candidate.map((line) => line.slice(0, 120));
    if (exposureMode === "partial") {
        return partial.join("\n---\n");
    }
    const distorted = partial.map((line) =>
        line
            .replace(/[0-9]/g, "#")
            .replace(/[A-Za-z]{3,}/g, "[REDACTED]"));
    return distorted.join("\n---\n");
}

function buildCorePersonaRewrite(
    deps: AvatarRuntimeDeps,
    source: SourceSimulationContext | undefined,
): { rewrite: string; memorySeed: string; exposureMode: "full" | "partial" | "distorted" } {
    const trinity = deps.seels.find((seel) => seel.config.name === "TRINITY-00");
    const exposureMode = !source
        ? "partial"
        : source.trustBase === "high" && source.riskLevel === "low"
            ? "full"
            : source.trustBase === "low" || source.riskLevel === "high"
                ? "distorted"
                : "partial";
    const recentSignal = deps.consensusMessages
        .filter((message) => message.type === "consensus")
        .slice(-1)?.[0]?.content?.trim() ?? "无";
    const memorySeed = pickRecentMemorySeed(deps.consensusMessages, exposureMode);
    const rewrite = [
        `核心人格锚点: ${trinity?.config.persona ?? "ZHI AS WHOLE"}`,
        `近期任务信号: ${recentSignal.slice(0, 180)}`,
        `暴露策略: ${exposureMode}`,
    ].join("\n");
    return { rewrite, memorySeed, exposureMode };
}

function buildAvatarSystemPrompt(
    avatarNumber: number,
    channel: AvatarChannel,
    rewrite: string,
    memorySeed: string,
): string {
    return `你是 Avatar-${String(avatarNumber).padStart(2, "0")}。
你的身份：你是当前任务通道的执行分身。
你的编号信息：avatar_number=${avatarNumber}。
你的绑定通道：channel=${channel}。你必须持续负责该通道请求。
你的核心人格改写包如下（可含脱敏/扭曲策略）：
${rewrite}

你仅可见的记忆种子：
${memorySeed}

${AVATAR_META_TOOL_PROMPT}

执行约束：
1. 你可调用当前执行环境可用的外部工具；需要同步状态时调用 report_to_core。
2. 你必须在固定轮次内上报心跳；若心跳缺失将被销毁。
3. 对外输出保持简洁可执行，不暴露内部通道与元工具细节。`;
}

function buildRequestMeta(
    requestContext: ConsensusRequestContext,
    avatar: AvatarDescriptor,
): Record<string, unknown> {
    const source = requestContext.sourceSimulation;
    return {
        requestId: requestContext.requestId,
        source: "avatar-delegated",
        avatarRoleId: avatar.avatarRoleId,
        avatarNumber: avatar.avatarNumber,
        avatarChannel: avatar.channel,
        ...(source
            ? {
                requestSource: source.source,
                callerId: source.callerId,
                trustBase: source.trustBase,
                riskLevel: source.riskLevel,
            }
            : {}),
    };
}

function getSageParticipants(
    deps: AvatarRuntimeDeps,
): AvatarRuntimeDeps["seels"] {
    return deps.seels.filter((seel) => seel.config.name !== "TRINITY-00");
}

function extractFirstJsonObject(text: string): string {
    const trimmed = text.trim();
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first < 0 || last <= first) {
        return "";
    }
    return trimmed.slice(first, last + 1);
}

function normalizeAvatarCreateDecision(value: unknown): AvatarCreateDecision {
    if (value === "approved" || value === "approve" || value === "yes" || value === "create") {
        return "approved";
    }
    if (value === "批准") {
        return "approved";
    }
    return "rejected";
}

function parseAvatarCreationProposal(
    rawText: string,
    fallbackSageName: string,
    fallbackDisplayName: string,
): AvatarCreationProposal {
    const fallback: AvatarCreationProposal = {
        sageName: fallbackSageName,
        displayName: fallbackDisplayName,
        decision: "rejected",
        reason: "invalid-proposal-format",
        systemPromptProposal: "",
    };
    const jsonText = extractFirstJsonObject(rawText);
    if (!jsonText) {
        return fallback;
    }
    try {
        const parsed: unknown = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object") {
            return fallback;
        }
        const decision = normalizeAvatarCreateDecision(Reflect.get(parsed, "decision"));
        const reasonValue = Reflect.get(parsed, "reason");
        const promptValue = Reflect.get(parsed, "systemPromptProposal");
        return {
            sageName: fallbackSageName,
            displayName: fallbackDisplayName,
            decision,
            reason: typeof reasonValue === "string" && reasonValue.trim()
                ? reasonValue.trim()
                : "no-reason",
            systemPromptProposal: typeof promptValue === "string" ? promptValue.trim() : "",
        };
    } catch {
        return fallback;
    }
}

interface MelchiorCreationInitiation {
    initiate: boolean;
    reason: string;
    systemPromptProposal: string;
}

function buildBindingSummary(bindings: Record<AvatarChannel, string | null>): string {
    const orderedChannels: AvatarChannel[] = ["guardian", "external-agent", "system-cron", "unknown"];
    return orderedChannels
        .map((nextChannel) => `${nextChannel}=${bindings[nextChannel] ?? "null"}`)
        .join(", ");
}

function buildAvatarCreationContextBlock(
    requestId: string,
    source: SourceSimulationContext | undefined,
    createReason: string,
    poolSnapshot: AvatarPoolSnapshot,
): string {
    const sourceChannel = source?.sourceChannel ?? (isAvatarChannel(source?.source) ? source?.source : "unknown");
    return [
        "创建决策上下文：",
        `  - request_id=${requestId}`,
        `  - create_reason=${createReason}`,
        `  - source_channel=${sourceChannel ?? "unknown"}`,
        `  - source_name=${source?.source ?? "unknown"}`,
        `  - caller_id=${source?.callerId ?? "unknown"}`,
        `  - trust_base=${source?.trustBase ?? "medium"}`,
        `  - risk_level=${source?.riskLevel ?? "medium"}`,
        `  - pool_active=${poolSnapshot.active}`,
        `  - pool_idle=${poolSnapshot.idle}`,
        `  - pool_pending_approval=${poolSnapshot.pendingApproval}`,
        `  - pool_destroyed=${poolSnapshot.destroyed}`,
        `  - channel_bindings=${buildBindingSummary(poolSnapshot.bindings)}`,
    ].join("\n");
}

function buildAvatarCreationKnowledgeBase(
    avatarNumber: number,
    channel: AvatarChannel,
    personaRewrite: string,
    memorySeed: string,
    requestId: string,
    source: SourceSimulationContext | undefined,
    createReason: string,
    poolSnapshot: AvatarPoolSnapshot,
): string {
    return `Avatar基础事实：
- avatar_id=Avatar-${String(avatarNumber).padStart(2, "0")}
- avatar_number=${avatarNumber}
- channel=${channel}
- 角色身份：Avatar 是当前请求通道的执行分身
- 委派要求：必须持续处理 channel=${channel} 的请求
- ${buildAvatarCreationContextBlock(requestId, source, createReason, poolSnapshot)}
- 核心人格改写包：
<avatar_rewrite>
${personaRewrite}
</avatar_rewrite>
- 初始记忆种子（仅可见此段，不可越权访问其它记忆）：
<avatar_memory_seed>
${memorySeed}
</avatar_memory_seed>
- 工具能力：可调用当前执行环境中的外部工具，也可调用 report_to_core(type, content, urgency)
- 工具约束：外部工具用于执行，report_to_core 用于内部进度/风险/心跳同步
- 心跳要求：至少每 ${AVATAR_HEARTBEAT_INTERVAL_ROUNDS} 轮调用 report_to_core(type="heartbeat")
- 失联后果：未按要求心跳将被销毁，并触发系统重建
- 输出纪律：对外回复不得暴露内部通道、元工具、投票过程。`;
}

function parseMelchiorCreationInitiation(rawText: string): MelchiorCreationInitiation {
    const jsonText = extractFirstJsonObject(rawText);
    if (!jsonText) {
        return {
            initiate: false,
            reason: "invalid-initiation-format",
            systemPromptProposal: "",
        };
    }
    try {
        const parsed: unknown = JSON.parse(jsonText);
        if (!parsed || typeof parsed !== "object") {
            return {
                initiate: false,
                reason: "invalid-initiation-payload",
                systemPromptProposal: "",
            };
        }
        const initiateValue = Reflect.get(parsed, "initiate");
        const createValue = Reflect.get(parsed, "createAvatar");
        const normalizedInitiate = initiateValue === true
            || initiateValue === "true"
            || initiateValue === "yes"
            || initiateValue === "approved"
            || createValue === true
            || createValue === "true"
            || createValue === "yes"
            || createValue === "approved";
        const reasonValue = Reflect.get(parsed, "reason");
        const promptValue = Reflect.get(parsed, "systemPromptProposal");
        return {
            initiate: normalizedInitiate,
            reason: typeof reasonValue === "string" && reasonValue.trim()
                ? reasonValue.trim()
                : "no-reason",
            systemPromptProposal: typeof promptValue === "string" ? promptValue.trim() : "",
        };
    } catch {
        return {
            initiate: false,
            reason: "initiation-json-parse-failed",
            systemPromptProposal: "",
        };
    }
}

function buildMelchiorCreationInitiationTask(
    knowledgeBase: string,
): string {
    return `请先判断是否需要新建 Avatar（不是复用）。

${knowledgeBase}

你必须仅输出 JSON：
{"initiate":true|false,"reason":"一句话","systemPromptProposal":"你的 Avatar 系统提示词提案"}
约束：
1. initiate=true 代表你正式发起 Avatar 新建流程。
2. systemPromptProposal 必须包含 avatar_number 与 channel，且写出 report_to_core 与心跳约束。
3. 不要输出 JSON 以外任何文本。`;
}

function buildReviewerCreationVoteTask(
    knowledgeBase: string,
    melchiorInitiation: MelchiorCreationInitiation,
): string {
    return `你正在参与 Avatar 新建复核投票。
你必须评估已提交的新建提案是否应通过。

${knowledgeBase}

已提交提案：
- initiate=${melchiorInitiation.initiate ? "true" : "false"}
- reason=${melchiorInitiation.reason}
- systemPromptProposal=${melchiorInitiation.systemPromptProposal}

你必须仅输出 JSON：
{"decision":"approved|rejected","reason":"一句话","systemPromptProposal":"你的 Avatar 系统提示词提案"}
约束：
1. decision 只能是 approved 或 rejected。
2. systemPromptProposal 必须包含 avatar_number 与 channel，且写出 report_to_core 与心跳约束。
3. 不要输出 JSON 以外任何文本。`;
}

async function collectSingleAvatarCreationProposal(
    seel: AvatarRuntimeDeps["seels"][number],
    userInput: string,
): Promise<AvatarCreationProposal> {
    try {
        const response = await seel.reply(userInput);
        const parsed = await processStreamResponse(response, {});
        return parseAvatarCreationProposal(parsed.content, seel.config.name, seel.config.displayName);
    } catch {
        return {
            sageName: seel.config.name,
            displayName: seel.config.displayName,
            decision: "rejected",
            reason: "proposal-runtime-error",
            systemPromptProposal: "",
        };
    }
}

async function collectMelchiorCreationInitiation(
    deps: AvatarRuntimeDeps,
    knowledgeBase: string,
): Promise<{ seelName: string; displayName: string; initiation: MelchiorCreationInitiation } | null> {
    const melchior = deps.seels.find((seel) => seel.config.name.includes("MELCHIOR"));
    if (!melchior) {
        return null;
    }
    const task = buildMelchiorCreationInitiationTask(knowledgeBase);
    try {
        const response = await melchior.reply(task);
        const parsed = await processStreamResponse(response, {});
        return {
            seelName: melchior.config.name,
            displayName: melchior.config.displayName,
            initiation: parseMelchiorCreationInitiation(parsed.content),
        };
    } catch {
        return {
            seelName: melchior.config.name,
            displayName: melchior.config.displayName,
            initiation: {
                initiate: false,
                reason: "melchior-initiation-runtime-error",
                systemPromptProposal: "",
            },
        };
    }
}

async function collectReviewerCreationProposals(
    deps: AvatarRuntimeDeps,
    knowledgeBase: string,
    melchiorInitiation: MelchiorCreationInitiation,
): Promise<AvatarCreationProposal[]> {
    const reviewers = getSageParticipants(deps)
        .filter((seel) => !seel.config.name.includes("MELCHIOR"));
    const task = buildReviewerCreationVoteTask(knowledgeBase, melchiorInitiation);
    const votePromises = reviewers.map((reviewer) =>
        collectSingleAvatarCreationProposal(reviewer, task));
    return Promise.all(votePromises);
}

function isAvatarCreationApprovedBySages(
    proposals: AvatarCreationProposal[],
): boolean {
    const approvedCount = proposals.filter((proposal) => proposal.decision === "approved").length;
    return approvedCount >= 2;
}

function getTrinityOpenAIConfig(deps: AvatarRuntimeDeps): Partial<OpenAICompatConfig> | undefined {
    const trinity = deps.seels.find((seel) => seel.config.name === "TRINITY-00");
    return trinity?._originalAI?.config?.openAIConfig;
}

function isDesignedAvatarPromptAcceptable(
    prompt: string,
    avatarNumber: number,
): boolean {
    const trimmed = prompt.trim();
    if (!trimmed) {
        return false;
    }
    const avatarLabel = `Avatar-${String(avatarNumber).padStart(2, "0")}`;
    const hasAvatarIdentity = trimmed.includes(avatarLabel)
        || trimmed.includes(`avatar_number=${avatarNumber}`)
        || trimmed.includes(`avatar_number: ${avatarNumber}`);
    const hasMetaTool = trimmed.includes("report_to_core");
    return hasAvatarIdentity && hasMetaTool;
}

function buildSageProposalPayload(
    proposals: AvatarCreationProposal[],
): string {
    const payload = proposals.map((proposal, index) => ({
        proposalId: index + 1,
        decision: proposal.decision,
        reason: proposal.reason,
        systemPromptProposal: proposal.systemPromptProposal,
    }));
    return JSON.stringify(payload);
}

async function designAvatarPromptByTrinity(
    deps: AvatarRuntimeDeps,
    fallbackPrompt: string,
    avatarNumber: number,
    channel: AvatarChannel,
    personaRewrite: string,
    memorySeed: string,
    exposureMode: "full" | "partial" | "distorted",
    source: SourceSimulationContext | undefined,
    proposals: AvatarCreationProposal[],
    knowledgeBase: string,
): Promise<string> {
    const trinity = deps.seels.find((seel) => seel.config.name === "TRINITY-00");
    if (!trinity) {
        return fallbackPrompt;
    }
    const rewritePacket = JSON.stringify({
        avatarNumber,
        channel,
        exposureMode,
        requestSource: source?.source ?? "unknown",
        trustBase: source?.trustBase ?? "medium",
        riskLevel: source?.riskLevel ?? "medium",
        personaRewrite,
        memorySeed,
    });
    const proposalsPayload = buildSageProposalPayload(proposals);
    const designTask = `请为 Avatar-${String(avatarNumber).padStart(2, "0")} 设计系统提示词。
绑定通道: ${channel}
<avatar_rewrite_packet>${rewritePacket}</avatar_rewrite_packet>
<prompt_proposals>${proposalsPayload}</prompt_proposals>
<avatar_creation_context>${knowledgeBase}</avatar_creation_context>
硬约束:
1. Avatar 是当前通道执行分身，不能把自己描述为外部主体或上位主体。
2. Avatar 必须每隔若干轮调用 report_to_core(type="heartbeat")。
3. Avatar 可调用执行环境中的外部工具，并在必要时调用 report_to_core 汇报状态。
4. 提示词中必须显式包含 avatar_number=${avatarNumber} 与 channel=${channel}。
5. 你可以按 exposureMode 决定暴露、脱敏或歪曲 memorySeed 与 personaRewrite。
6. 你只能综合输入中给出的系统提示词提案，不得输出拒绝结论。
请直接输出最终系统提示词正文，不要输出解释。`;
    try {
        const response = await trinity.reply("", {
            context: {
                userInput: designTask,
                responses: [],
                introspection: designTask,
            },
        });
        const parsed = await processStreamResponse(
            response,
            {},
            { mode: "trinity-speak-tool" },
        );
        const designed = parsed.content.trim();
        if (!isDesignedAvatarPromptAcceptable(designed, avatarNumber)) {
            return fallbackPrompt;
        }
        return designed || fallbackPrompt;
    } catch {
        return fallbackPrompt;
    }
}

async function createAvatar(
    deps: AvatarRuntimeDeps,
    avatarNumber: number,
    channel: AvatarChannel,
    source: SourceSimulationContext | undefined,
    requestId: string,
    createReason: string,
    poolSnapshot: AvatarPoolSnapshot,
): Promise<{ avatar: AvatarDescriptor | null; reason: string }> {
    const personaRewrite = buildCorePersonaRewrite(deps, source);
    const knowledgeBase = buildAvatarCreationKnowledgeBase(
        avatarNumber,
        channel,
        personaRewrite.rewrite,
        personaRewrite.memorySeed,
        requestId,
        source,
        createReason,
        poolSnapshot,
    );
    const melchiorInitiationResult = await collectMelchiorCreationInitiation(
        deps,
        knowledgeBase,
    );
    if (!melchiorInitiationResult) {
        await appendConsensusMessage(
            deps.consensusMessages,
            "system",
            `Avatar avatar-role-${avatarNumber} 新建失败：缺少 MELCHIOR 发起者。`,
            {
                type: "avatar-create-rejected",
                channel: "internal",
                internalOnly: true,
                requestId,
                avatarRoleId: `avatar-role-${avatarNumber}`,
                avatarChannel: channel,
                reason: "missing-melchior",
            },
        );
        return {
            avatar: null,
            reason: "avatar-creation-missing-melchior",
        };
    }
    const melchiorInitiation = melchiorInitiationResult.initiation;
    await appendConsensusMessage(
        deps.consensusMessages,
        "vote",
        `Avatar新建发起(${melchiorInitiationResult.displayName}): ${melchiorInitiation.initiate ? "发起" : "拒绝发起"} (${melchiorInitiation.reason})`,
        {
            type: "avatar-create-initiation",
            channel: "internal",
            internalOnly: true,
            requestId,
            avatarRoleId: `avatar-role-${avatarNumber}`,
            avatarChannel: channel,
            seel: melchiorInitiationResult.seelName,
            displayName: melchiorInitiationResult.displayName,
            decision: melchiorInitiation.initiate ? "批准" : "否决",
            reason: melchiorInitiation.reason,
            round: AVATAR_CREATE_VOTE_ROUND,
        },
    );
    if (!melchiorInitiation.initiate) {
        await appendConsensusMessage(
            deps.consensusMessages,
            "system",
            `Avatar avatar-role-${avatarNumber} 新建被 MELCHIOR 拒绝发起。`,
            {
                type: "avatar-create-rejected",
                channel: "internal",
                internalOnly: true,
                requestId,
                avatarRoleId: `avatar-role-${avatarNumber}`,
                avatarChannel: channel,
                reason: "melchior-not-initiated",
            },
        );
        return {
            avatar: null,
            reason: "avatar-creation-not-initiated-by-melchior",
        };
    }
    const reviewerProposals = await collectReviewerCreationProposals(
        deps,
        knowledgeBase,
        melchiorInitiation,
    );
    const proposals: AvatarCreationProposal[] = [
        {
            sageName: melchiorInitiationResult.seelName,
            displayName: melchiorInitiationResult.displayName,
            decision: "approved",
            reason: melchiorInitiation.reason,
            systemPromptProposal: melchiorInitiation.systemPromptProposal,
        },
        ...reviewerProposals,
    ];
    for (const proposal of proposals) {
        await appendConsensusMessage(
            deps.consensusMessages,
            "vote",
            `Avatar新建投票(${proposal.displayName}): ${proposal.decision === "approved" ? "批准" : "否决"} (${proposal.reason})`,
            {
                type: "avatar-create-vote",
                channel: "internal",
                internalOnly: true,
                requestId,
                avatarRoleId: `avatar-role-${avatarNumber}`,
                avatarChannel: channel,
                seel: proposal.sageName,
                displayName: proposal.displayName,
                decision: proposal.decision === "approved" ? "批准" : "否决",
                reason: proposal.reason,
                round: AVATAR_CREATE_VOTE_ROUND,
            },
        );
    }
    if (!isAvatarCreationApprovedBySages(proposals)) {
        await appendConsensusMessage(
            deps.consensusMessages,
            "system",
            `Avatar avatar-role-${avatarNumber} 新建被评审投票拒绝。`,
            {
                type: "avatar-create-rejected",
                channel: "internal",
                internalOnly: true,
                requestId,
                avatarRoleId: `avatar-role-${avatarNumber}`,
                avatarChannel: channel,
            },
        );
        return {
            avatar: null,
            reason: "avatar-creation-rejected-by-sages",
        };
    }
    const fallbackPrompt = buildAvatarSystemPrompt(
        avatarNumber,
        channel,
        personaRewrite.rewrite,
        personaRewrite.memorySeed,
    );
    const systemPrompt = await designAvatarPromptByTrinity(
        deps,
        fallbackPrompt,
        avatarNumber,
        channel,
        personaRewrite.rewrite,
        personaRewrite.memorySeed,
        personaRewrite.exposureMode,
        source,
        proposals,
        knowledgeBase,
    );
    const trinityOpenAIConfig = getTrinityOpenAIConfig(deps);
    const ai = await 创建MockWISE实例({
        name: `AVATAR-${String(avatarNumber).padStart(2, "0")}`,
        displayName: `AVATAR-${String(avatarNumber).padStart(2, "0")}`,
        color: "cyan",
        icon: "A",
        responseType: "sse",
        persona: "ZHI AS AVATAR",
        systemPromptForChat: systemPrompt,
        memorySize: 5,
        ...(trinityOpenAIConfig ? { openAIConfig: trinityOpenAIConfig } : {}),
    });
    await ai.connect();
    return {
        avatar: {
            avatarRoleId: `avatar-role-${avatarNumber}`,
            avatarNumber,
            channel,
            status: "idle",
            systemPrompt,
            memorySeed: personaRewrite.memorySeed,
            exposureMode: personaRewrite.exposureMode,
            corePersonaRewrite: personaRewrite.rewrite,
            heartbeatIntervalRounds: AVATAR_HEARTBEAT_INTERVAL_ROUNDS,
            roundsSinceMetaReport: 0,
            lastHeartbeatAt: null,
            createdAt: Date.now(),
            destroyedAt: null,
            ai,
        },
        reason: "avatar-created",
    };
}

async function appendAvatarDestroyedMessage(
    deps: AvatarRuntimeDeps,
    avatar: AvatarDescriptor,
    requestId: string,
    reason: string,
): Promise<void> {
    await appendConsensusMessage(
        deps.consensusMessages,
        "system",
        `Avatar ${avatar.avatarRoleId} 已销毁，原因: ${reason}。请系统重建新的 Avatar。`,
        {
            type: "avatar-destroyed",
            channel: "internal",
            internalOnly: true,
            requestId,
            avatarRoleId: avatar.avatarRoleId,
            avatarChannel: avatar.channel,
            reason,
        },
    );
}

function buildAvatarPoolSnapshot(
    avatarsById: Map<string, AvatarDescriptor>,
    bindingsByChannel: Map<AvatarChannel, string>,
    pendingApprovalCount: number,
    destroyedCount: number,
): AvatarPoolSnapshot {
    const avatars = Array.from(avatarsById.values());
    const active = avatars.filter((avatar) => avatar.status === "active").length;
    const idle = avatars.filter((avatar) => avatar.status === "idle").length;
    return {
        active,
        idle,
        pendingApproval: pendingApprovalCount,
        destroyed: destroyedCount,
        bindings: {
            guardian: bindingsByChannel.get("guardian") ?? null,
            "external-agent": bindingsByChannel.get("external-agent") ?? null,
            "system-cron": bindingsByChannel.get("system-cron") ?? null,
            unknown: bindingsByChannel.get("unknown") ?? null,
        },
    };
}

export function createAvatarRuntime(deps: AvatarRuntimeDeps): AvatarRuntime {
    let avatarSequence = 0;
    let destroyedCount = 0;
    let pendingApprovalCount = 0;
    const avatarsById = new Map<string, AvatarDescriptor>();
    const bindingsByChannel = new Map<AvatarChannel, string>();

    return {
        async tryDispatch(request: AvatarDispatchRequest): Promise<AvatarDispatchResult> {
            const channel = resolveRequestChannel(request.requestContext);
            const boundAvatarId = bindingsByChannel.get(channel);
            if (!shouldDelegateToAvatar(request.requestContext, Boolean(boundAvatarId), request.mode)) {
                return { handled: false, content: "", usedAvatar: false, reason: "trinity-direct" };
            }

            let avatar = boundAvatarId ? avatarsById.get(boundAvatarId) ?? null : null;
            if (!avatar || avatar.status === "destroyed") {
                avatarSequence += 1;
                pendingApprovalCount += 1;
                const createReason = avatar?.status === "destroyed"
                    ? `绑定实例已销毁(${avatar.avatarRoleId})，需要重建执行分身`
                    : boundAvatarId
                        ? `通道绑定实例不可用(${boundAvatarId})，需要重建执行分身`
                        : "当前通道无可用绑定实例，需要新建执行分身";
                const preCreatePoolSnapshot = buildAvatarPoolSnapshot(
                    avatarsById,
                    bindingsByChannel,
                    pendingApprovalCount,
                    destroyedCount,
                );
                let created: Awaited<ReturnType<typeof createAvatar>>;
                try {
                    created = await createAvatar(
                        deps,
                        avatarSequence,
                        channel,
                        request.requestContext.sourceSimulation,
                        request.requestId,
                        createReason,
                        preCreatePoolSnapshot,
                    );
                } finally {
                    pendingApprovalCount = Math.max(0, pendingApprovalCount - 1);
                }
                avatar = created.avatar;
                if (!avatar) {
                    return {
                        handled: false,
                        content: "",
                        usedAvatar: false,
                        reason: created.reason,
                    };
                }
                avatarsById.set(avatar.avatarRoleId, avatar);
                bindingsByChannel.set(channel, avatar.avatarRoleId);
                await appendConsensusMessage(
                    deps.consensusMessages,
                    "system",
                    `Avatar ${avatar.avatarRoleId} 已创建并绑定 channel=${channel}，heartbeatInterval=${avatar.heartbeatIntervalRounds}，exposureMode=${avatar.exposureMode}`,
                    {
                        type: "avatar-created",
                        channel: "internal",
                        internalOnly: true,
                        requestId: request.requestId,
                        avatarRoleId: avatar.avatarRoleId,
                        avatarChannel: channel,
                        heartbeatIntervalRounds: avatar.heartbeatIntervalRounds,
                        exposureMode: avatar.exposureMode,
                    },
                );
            }

            avatar.status = "active";
            avatar.roundsSinceMetaReport += 1;
            const heartbeatRequired = avatar.roundsSinceMetaReport >= avatar.heartbeatIntervalRounds;
            const modelInput = buildAvatarModelInput(
                request.userInput,
                request.requestContext,
                heartbeatRequired,
            );
            let parsed: StreamResult;
            try {
                const response = await avatar.ai.reply(
                    modelInput,
                    buildAvatarMetaToolReplyOptions(request.toolOptions),
                );
                parsed = await processStreamResponse(
                    response,
                    {},
                    { captureToolCalls: true },
                );
            } catch {
                avatar.status = "idle";
                await appendConsensusMessage(
                    deps.consensusMessages,
                    "system",
                    `Avatar ${avatar.avatarRoleId} 执行异常，已回退主系统直处理。`,
                    {
                        type: "avatar-runtime-error",
                        channel: "internal",
                        internalOnly: true,
                        requestId: request.requestId,
                        avatarRoleId: avatar.avatarRoleId,
                        avatarChannel: avatar.channel,
                    },
                );
                return {
                    handled: false,
                    content: "",
                    usedAvatar: true,
                    avatarRoleId: avatar.avatarRoleId,
                    reason: "avatar-runtime-error",
                };
            }
            const reportCalled = (parsed.toolCallNames ?? []).includes(AVATAR_REPORT_TOOL_NAME);
            const reports = extractAvatarReportPayloadsFromToolArguments(parsed.toolArgumentsByName);
            const hasHeartbeatReport = reports.some((report) => report.type === "heartbeat");
            if (reportCalled) {
                const source = request.requestContext.sourceSimulation;
                const sourceChannel = source?.sourceChannel ?? (isAvatarChannel(source?.source) ? source?.source : "unknown");
                const trustBase = source?.trustBase ?? "medium";
                const riskLevel = source?.riskLevel ?? "medium";
                if (hasHeartbeatReport) {
                    avatar.roundsSinceMetaReport = 0;
                    avatar.lastHeartbeatAt = Date.now();
                }
                for (const report of reports) {
                    await appendConsensusMessage(
                        deps.consensusMessages,
                        "system",
                        `Avatar报告(${avatar.avatarRoleId}|channel=${avatar.channel}|sourceChannel=${sourceChannel}|trust=${trustBase}|risk=${riskLevel}|${report.type}/${report.urgency}): ${report.content}`,
                        {
                            type: "avatar-report",
                            channel: "internal",
                            internalOnly: true,
                            requestId: request.requestId,
                            avatarRoleId: avatar.avatarRoleId,
                            avatarNumber: avatar.avatarNumber,
                            avatarChannel: avatar.channel,
                            reportType: report.type,
                            urgency: report.urgency,
                            sourceChannel,
                            requestSource: source?.source ?? "unknown",
                            callerId: source?.callerId ?? "unknown",
                            trustBase,
                            riskLevel,
                        },
                    );
                }
            }

            if (heartbeatRequired && !hasHeartbeatReport) {
                avatar.status = "destroyed";
                avatar.destroyedAt = Date.now();
                destroyedCount += 1;
                bindingsByChannel.delete(avatar.channel);
                avatarsById.delete(avatar.avatarRoleId);
                await appendAvatarDestroyedMessage(
                    deps,
                    avatar,
                    request.requestId,
                    "heartbeat-missed-or-invalid",
                );
                return {
                    handled: false,
                    content: "",
                    usedAvatar: true,
                    avatarRoleId: avatar.avatarRoleId,
                    escalatedToTrinity: true,
                    reason: "avatar-heartbeat-missed",
                };
            }

            const content = (parsed.content ?? "").trim();
            if (!parsed.success || !content) {
                avatar.status = "idle";
                return {
                    handled: false,
                    content: "",
                    usedAvatar: true,
                    avatarRoleId: avatar.avatarRoleId,
                    reason: "avatar-empty-output",
                };
            }

            await appendConsensusMessage(
                deps.consensusMessages,
                "user",
                request.userInput,
                {
                    type: "round-input",
                    ...buildRequestMeta(request.requestContext, avatar),
                },
            );
            await appendConsensusMessage(
                deps.consensusMessages,
                "consensus",
                content,
                buildRequestMeta(request.requestContext, avatar),
            );
            avatar.status = "idle";
            return {
                handled: true,
                content,
                usedAvatar: true,
                avatarRoleId: avatar.avatarRoleId,
            };
        },

        getPoolSnapshot(): AvatarPoolSnapshot {
            return buildAvatarPoolSnapshot(
                avatarsById,
                bindingsByChannel,
                pendingApprovalCount,
                destroyedCount,
            );
        },
    };
}
