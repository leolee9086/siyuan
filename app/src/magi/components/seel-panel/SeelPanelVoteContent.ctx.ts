/**
 * SeelPanelVoteContent 组件逻辑上下文
 *
 * 投票消息的结论解析与时间格式化。
 */

import { computed } from "vue";
import { getMagiI18nText } from "../../utils/magiI18n";
import type { VoteMeta } from "./SeelPanel.types";

/** 格式化时间戳为 HH:MM:SS */
export async function formatVoteTime(ts: number): Promise<string> {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/** 初始化投票内容组件的响应式状态 */
export async function useVoteContentCtx(props: {
    meta: VoteMeta;
    timestamp: number;
}) {
    const decision = computed(() => props.meta.decision ?? getMagiI18nText("pending"));
    const round = computed(() => props.meta.round ?? 1);
    const conclusionClass = computed(() => ({
        "conclusion-pass": decision.value === "批准",
        "conclusion-reject": decision.value === "否决",
        "conclusion-pending": !props.meta.decision,
    }));
    const initialTime = await formatVoteTime(props.timestamp);
    const formattedTime = computed(() => initialTime);
    return {
        decision,
        round,
        conclusionClass,
        formattedTime,
    };
}
