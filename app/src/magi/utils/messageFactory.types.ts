/**
 * MAGI消息工厂与流处理类型定义
 *
 * 为消息创建和流式消息处理提供类型约束。
 */

// [TASK] T2.2 迁移composables和工具函数 - messageFactory.types

/**
 * MAGI聊天消息
 *
 * 用途：表示MAGI系统中的一条聊天消息（用户/AI/系统/投票/错误等）
 * 使用场景：消息列表渲染、流式消息更新、消息历史管理
 * 关联类型：由 createMessage 工厂函数创建，StreamCallbacks 中传递
 */
export interface MagiMessage {
    /** 消息唯一标识 */
    id: string;
    /** 消息类型 */
    type: string;
    /** 消息内容 */
    content: string;
    /** 消息状态 */
    status: string;
    /** 时间戳（毫秒） */
    timestamp: number;
    /** 附加元数据 */
    meta?: Record<string, unknown>;
}

/**
 * 流式消息处理回调集合
 *
 * 用途：在流式响应的不同阶段触发对应的UI更新
 * 使用场景：processSagesResponses / handleTrinitySummary 中处理SSE流
 * 关联类型：与 MagiMessage 配合，回调参数为消息对象
 */
export interface StreamCallbacks {
    /** 流开始时触发（创建初始消息） */
    onStart?: (message: MagiMessage) => void;
    /** 收到数据块时触发（更新消息内容） */
    onChunk?: (message: MagiMessage) => void;
    /** 流正常完成时触发 */
    onComplete?: (message: MagiMessage) => void;
    /** 流出错时触发 */
    onError?: (error: Error) => void;
}

/**
 * 流式消息处理结果
 *
 * 用途：封装流处理完成后的最终内容和成功状态
 * 使用场景：processSagesResponses 根据 success 决定是否将响应纳入投票
 */
export interface StreamResult {
    /** 累积的完整内容 */
    content: string;
    /** 是否成功完成 */
    success: boolean;
    /** 本轮流式响应是否观测到工具调用 */
    hasToolCalls?: boolean;
    /** 本轮观测到的工具名称（去重） */
    toolCallNames?: string[];
    /** speak(channel=internal) 的内部消息 */
    internalToolMessages?: string[];
    /** 观测到的工具参数（按工具名聚合） */
    toolArgumentsByName?: Record<string, string[]>;
}



/**
 * 投票结果
 *
 * 用途：表示单个贤者对所有响应的评分结果
 * 使用场景：processVoting 收集各贤者投票，传入 生成共识聊天回复
 */
export interface VoteResult {
    /** Melchior（理性维度）投票 */
    melchior: "批准" | "否决";
    /** Balthazar（感性维度）投票 */
    balthazar: "批准" | "否决";
    /** Casper（本能维度）投票 */
    casper: "批准" | "否决";
    /** 是否通过（>= 2/3 批准） */
    passed: boolean;
    /** 当前反刍轮次 */
    round: number;
}
