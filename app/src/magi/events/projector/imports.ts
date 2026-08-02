/**
 * 投影器模块导入网关。
 *
 * 子模块只通过本文件访问上层事件、视图和工具类型，避免职责模块反向穿透目录边界。
 */

/** 取消订阅契约。 */
export type { EventUnsubscribe } from "../../../util/lib/events/eventEmitter.types";
/** 共识消息事件。 */
export type { MagiConsensusEmittedEvent } from "../magiEventBus.types";
/** 上下文裁剪事件。 */
export type { MagiContextHistoryTrimmedEvent } from "../magiEventBus.types";
/** 审慎信号事件。 */
export type { MagiDeliberationSignalRaisedEvent } from "../magiEventBus.types";
/** 原始事件公共字段。 */
export type { MagiEventBase } from "../magiEventBus.types";
/** 事件总线端口。 */
export type { MagiEventBus } from "../magiEventBus.types";
/** LLM 请求事件。 */
export type { MagiLLMRequestSentEvent } from "../magiEventBus.types";
/** 轮次失败事件。 */
export type { MagiRoundFailedEvent } from "../magiEventBus.types";
/** 轮次开始事件。 */
export type { MagiRoundStartedEvent } from "../magiEventBus.types";
/** 全局运行态事件。 */
export type { MagiRuntimeStatusUpdatedEvent } from "../magiEventBus.types";
/** 回复增量事件。 */
export type { MagiSeelReplyChunkEvent } from "../magiEventBus.types";
/** 回复完成事件。 */
export type { MagiSeelReplyCompletedEvent } from "../magiEventBus.types";
/** 回复失败事件。 */
export type { MagiSeelReplyFailedEvent } from "../magiEventBus.types";
/** 回复开始事件。 */
export type { MagiSeelReplyStartedEvent } from "../magiEventBus.types";
/** 工具生命周期事件。 */
export type { MagiSeelToolActivityUpdatedEvent } from "../magiEventBus.types";
/** 投票更新事件。 */
export type { MagiSeelVoteUpdatedEvent } from "../magiEventBus.types";
/** 主导统合事件。 */
export type { MagiSynthesisCompletedEvent } from "../magiEventBus.types";
/** 工具检测事件。 */
export type { MagiToolCallDetectedEvent } from "../magiEventBus.types";
/** 投影运行态。 */
export type { MagiProjectorRuntimeState } from "../magiProjector.types";
/** 投影目标。 */
export type { MagiProjectorTarget } from "../magiProjector.types";
/** 贤者响应式容器。 */
export type { WrappedSeel } from "../../composables/useMagi.types";
/** 消息存储契约。 */
export type { MagiMessage } from "../../utils/messageFactory.types";
