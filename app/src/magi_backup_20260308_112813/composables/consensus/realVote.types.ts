/**
 * MAGI真实投票辅助类型
 *
 * 用途：定义审慎投票分支中模型裁决所需的数据结构。
 * 使用场景：`magiConsensus.realVote.ts` 与 `magiConsensus.ts` 之间共享输入输出约束。
 * 关联类型：与 `WrappedSeel`、`VoteResult` 配合使用。
 * 问题/改进：当前为最小字段集，后续可扩展置信度与证据字段。
 */

/**
 * 二元投票决策
 *
 * 用途：约束评审侧面的最终投票值。
 * 使用场景：真实投票 API 解析后返回值、投票汇总阶段字段写入。
 * 关联类型：`VoteResult` 的各侧面字段取值与该类型一致。
 */
export type 二元决策 = "批准" | "否决";

/**
 * 审议上下文
 *
 * 用途：提供真实投票时必需的背景材料。
 * 使用场景：Balthazar/Casper 发起复核请求前拼装上下文输入。
 * 关联类型：由 `resolveVoteResult` 构造并传入 `获取真实投票决策`。
 */
export interface 审议上下文 {
    userMessage: string;
    melchiorConclusion: string;
}
