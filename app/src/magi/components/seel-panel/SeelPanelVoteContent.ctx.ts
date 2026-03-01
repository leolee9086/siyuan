/**
 * SeelPanelVoteContent 组件逻辑上下文
 *
 * 投票消息的结论解析、时间格式化和贤者信息查找。
 */

import { computed } from "vue";
import type { VoteMeta, VoteScore, SeelData } from "./SeelPanel.types";

/**
 * 将结论原始值转换为显示文本
 *
 * 作用：将 pending/error 等特殊状态翻译为中文
 * 调用时机：投票消息渲染时
 */
/** @同步豁免: 纯字符串映射，无I/O操作，作为computed回调的内部调用 */
function resolveConclusion(raw: string): string {
    // pending状态翻译为进行中
    if (raw === "pending") {
        return "评估进行中";
    }
    // error状态显示异常提示
    if (raw === "error") {
        return "评估异常";
    }
    return raw;
}

/**
 * 格式化时间戳为 HH:MM:SS
 *
 * 作用：投票消息头部显示投票时间
 * 调用时机：投票消息渲染时
 */
export async function formatVoteTime(ts: number): Promise<string> {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/**
 * 根据索引获取贤者显示名称
 *
 * 作用：投票评分项中显示被评分贤者的名称
 * 调用时机：投票消息渲染时
 */
export async function resolveSeelName(seels: SeelData[], index: number): Promise<string> {
    const seel = seels[index];
    return seel?.config.displayName ?? `MAGI-${index + 1}`;
}

/**
 * 根据索引获取贤者角色描述
 *
 * 作用：投票评分项中显示被评分贤者的角色
 * 调用时机：投票消息渲染时
 */
export async function resolveSeelRole(seels: SeelData[], index: number): Promise<string> {
    const seel = seels[index];
    return seel?.config.persona ?? "UNKNOWN PROTOCOL";
}

/**
 * 决策状态到CSS类的映射
 *
 * 作用：根据决策结果（通过/否决/复议）返回对应的CSS类
 * 调用时机：投票评分项渲染时
 */
export async function resolveDecisionClass(
    decision: string | undefined,
): Promise<Record<string, boolean>> {
    return {
        "text-green": decision === "通过",
        "text-red": decision === "否决",
        "text-yellow": decision === "复议",
    };
}

/**
 * 初始化投票内容组件的响应式状态
 *
 * 作用：集中管理投票结论解析、评分列表和CSS类计算
 * 调用时机：SeelPanelVoteContent.vue 的 setup 阶段
 */
/**
 * 初始化投票内容组件的响应式状态
 *
 * 作用：集中管理投票结论解析、评分列表、CSS类和模板辅助函数
 * 调用时机：SeelPanelVoteContent.vue 的 setup 阶段
 */
export async function useVoteContentCtx(props: {
    meta: VoteMeta;
    timestamp: number;
    seels: SeelData[];
}) {
    const scores = computed((): VoteScore[] => props.meta.scores ?? []);
    const conclusion = computed(() => props.meta.conclusion ?? "评估未完成");
    const displayConclusion = computed(() => resolveConclusion(conclusion.value));

    const conclusionClass = computed(() => ({
        "conclusion-pass": conclusion.value === "通过",
        "conclusion-reject": conclusion.value === "否决",
        "conclusion-pending": !props.meta.conclusion,
    }));

    const initialTime = await formatVoteTime(props.timestamp);
    const formattedTime = computed(() => initialTime);

    return {
        scores,
        displayConclusion,
        conclusionClass,
        formattedTime,
        /** @同步豁免: 模板内联调用必须同步返回 */
        getSeelName: (index: number) => {
            const seel = props.seels[index];
            return seel?.config.displayName ?? `MAGI-${index + 1}`;
        },
        /** @同步豁免: 模板内联调用必须同步返回 */
        getSeelRole: (index: number) => {
            const seel = props.seels[index];
            return seel?.config.persona ?? "UNKNOWN PROTOCOL";
        },
        /** @同步豁免: 模板内联调用必须同步返回 */
        getDecisionClass: (decision: string | undefined) => ({
            "text-green": decision === "通过",
            "text-red": decision === "否决",
            "text-yellow": decision === "复议",
        }),
    };
}
