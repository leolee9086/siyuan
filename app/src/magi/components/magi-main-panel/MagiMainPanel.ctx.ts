/**
 * MagiMainPanel 组件逻辑上下文
 *
 * 分离主面板组件的业务逻辑，遵循 Fat Script 规则。
 */

// [TASK] T3.2 迁移主面板组件 - MagiMainPanel上下文

import { computed } from "vue";
import type { MagiMainPanelMessageView } from "../../entry/magiView.types";
import type {
    ConnectionStatusItem,
    MagiMainPanelContext,
    MagiMainPanelTexts,
    UseMagiMainPanelContextParams,
} from "./MagiMainPanel.types";
import {
    getNumericProgressMeta,
    getSseStreamProgress,
    getVoteStatusMeta,
    hasNumericProgressMeta,
    isSseStreamMessage,
} from "./MagiMainPanel.guard";

/** 消息类型到对齐方式的映射 */
const ALIGN_MAP: Record<string, string> = {
    user: "right",
    system: "center",
};

/** 消息类型到显示标签的映射 */
const TYPE_LABEL_MAP: Record<string, string> = {
    consensus: "MAGI CONSENSUS",
    assistant: "MAGI",
    user: "USER INPUT",
    system: "SYSTEM PROCESS",
    error: "ERROR",
};

/** 投票结论到图标的映射 */
const VOTE_STATUS_ICON_MAP: Record<string, string> = {
    批准: "✓",
    否决: "✕",
    通过: "✓",
    复议: "⚠",
    弃权: "➖",
    超时: "⌛",
    异常: "❗",
};

/**
 * 计算单个贤者连接状态
 *
 * 作用：把后端连接状态映射为 UI class。
 * 意图：收敛状态转换规则，避免模板中维护三元表达式。
 * 调用时机：计算连接状态列表时逐项调用。
 */
function computeSeelStatusClass(seel: UseMagiMainPanelContextParams["seels"]["value"][number]): ConnectionStatusItem["class"] {
    if (seel.connectionStatus === "connecting") {
        return "loading";
    }
    return seel.connectionStatus === "connected" ? "connected" : "disconnected";
}

/**
 * 计算消息对齐方式
 *
 * 作用：根据消息类型返回对齐方向。
 * 意图：解耦展示规则，降低模板条件判断复杂度。
 * 调用时机：渲染每条消息时通过 MessageBubble.align 使用。
 */
function getMessageAlign(type: string): string {
    return ALIGN_MAP[type] ?? "left";
}

/**
 * 计算消息类型标签
 *
 * 作用：将内部类型标识转换为可读标签。
 * 意图：统一标签映射，避免模板散落硬编码。
 * 调用时机：渲染每条消息时通过 MessageBubble.typeLabel 使用。
 */
function getTypeLabel(type: string): string {
    return TYPE_LABEL_MAP[type] ?? type.toUpperCase();
}

/**
 * 格式化 SSE 流消息内容
 *
 * 作用：拼接实时前缀与可选进度。
 * 意图：让流式输出在一行中保持信息完整且可读。
 * 调用时机：formatContent 识别为 sse_stream 时调用。
 */
function formatSseStreamContent(msg: MagiMainPanelMessageView, texts: MagiMainPanelTexts, progress?: number): string {
    const parts = [`[${texts.realtimePrefixText}] ${msg.content}`];

    // 当流消息包含进度时，附加百分比，便于用户观察处理进展。
    if (progress !== undefined) {
        parts.push(`${texts.progressPrefixText}: ${progress}%`);
    }

    return parts.join(" | ");
}

/**
 * 格式化投票状态消息
 *
 * 作用：把投票总进度与明细转换为多行文本。
 * 意图：在单条消息中完整表达投票过程与结论。
 * 调用时机：formatContent 命中 vote-status 元数据时调用。
 */
function formatVoteStatusContent(
    texts: MagiMainPanelTexts,
    progress: number,
    details?: Array<{ name: string; decision: string; reason?: string }>,
    deliberationInitiator?: string,
    deliberationReason?: string
): string {
    const lines = [`[${texts.voteStatusPrefixText}] ${texts.progressPrefixText}: ${progress}%`];

    if (deliberationInitiator || deliberationReason) {
        lines.push(`🔔 审慎决策${deliberationInitiator ? ` | 发起者: ${deliberationInitiator}` : ""}`);
    }
    if (deliberationReason) {
        lines.push(`原因: ${deliberationReason}`);
    }

    if (details && details.length > 0) {
        lines.push(
            ...details.map((detail) => {
                const statusIcon = VOTE_STATUS_ICON_MAP[detail.decision] ?? "❓";
                const reasonText = typeof detail.reason === "string" && detail.reason.trim().length > 0
                    ? ` | 理由: ${detail.reason.trim()}`
                    : "";
                return `${detail.name} ${statusIcon} | ${detail.decision}${reasonText}`;
            })
        );
    }

    return lines.join("\n");
}

/**
 * 格式化消息内容
 *
 * 作用：根据消息类型与元数据生成最终展示文本。
 * 意图：把复杂分支从组件脚本中抽离，满足 Fat Script 约束并提升可测试性。
 * 调用时机：模板渲染消息内容时调用。
 */
function formatContent(texts: MagiMainPanelTexts, msg: MagiMainPanelMessageView): string {
    // SSE 消息需要实时前缀，并在进度可用时追加进度信息。
    if (isSseStreamMessage(msg)) {
        return formatSseStreamContent(msg, texts, getSseStreamProgress(msg));
    }

    const voteMeta = getVoteStatusMeta(msg);

    // vote-status 消息改为多行展示，包含总进度和每位贤者投票结果。
    if (voteMeta) {
        return formatVoteStatusContent(
            texts,
            voteMeta.progress ?? 0,
            voteMeta.details,
            voteMeta.deliberationInitiator,
            voteMeta.deliberationReason
        );
    }

    return msg.content;
}

/**
 * 判断是否展示系统进度条
 *
 * 作用：为模板层提供安全条件判断。
 * 意图：替代 any/断言访问，避免运行时类型错误。
 * 调用时机：MessageBubble 插槽分支判断时调用。
 */
function hasSystemProgress(msg: MagiMainPanelMessageView): boolean {
    if (msg.type !== "system") {
        return false;
    }
    return hasNumericProgressMeta(msg.meta);
}

/**
 * 读取系统消息进度值
 *
 * 作用：返回可用于样式宽度的百分比数值。
 * 意图：为模板提供稳定数值，避免 undefined 进入样式表达式。
 * 调用时机：hasSystemProgress 为 true 的分支内调用。
 */
function getSystemProgress(msg: MagiMainPanelMessageView): number {
    if (msg.type !== "system") {
        return 0;
    }
    return getNumericProgressMeta(msg.meta) ?? 0;
}

/**
 * 计算当前同步率
 *
 * 作用：从响应式 seels 中计算同步百分比。
 * 意图：拆分超长 computed 内联回调，符合 no-inline-callback 规则。
 * 调用时机：syncRate 计算属性每次依赖变更时调用。
 */
function computeCurrentSyncRate(
    seels: UseMagiMainPanelContextParams["seels"]["value"]
): number {
    if (seels.length === 0) {
        return 0;
    }
    const connectedCount = seels.filter((seel) => seel.connectionStatus === "connected").length;
    return Math.round((connectedCount / seels.length) * 100);
}

/**
 * 创建主面板逻辑上下文
 *
 * 作用：集中装配计算属性、消息格式化函数与自动滚动监听。
 * 意图：将组件脚本压缩为装配层，满足 Script 行数和逻辑抽离规范。
 * 调用时机：MagiMainPanel 组件 setup 阶段调用一次。
 */
export async function useMagiMainPanelContext(
    params: UseMagiMainPanelContextParams
): Promise<MagiMainPanelContext> {
    const connectionStatuses = computed(() =>
        params.seels.value.map((seel) => ({
            name: seel.config.name,
            class: computeSeelStatusClass(seel),
        }))
    );

    const syncRate = computed(() => computeCurrentSyncRate(params.seels.value));

    return {
        connectionStatuses,
        syncRate,
        getMessageAlign,
        getTypeLabel,
        formatContent: formatContent.bind(null, params.texts),
        hasSystemProgress,
        getSystemProgress,
    };
}
