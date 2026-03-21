// ============================================================================
// AI 配置与类型 - 用于标准LLM适配器的请求响应类型和配置获取
// ============================================================================

/**
 * 用途：聊天请求参数类型，定义发送给LLM的请求结构
 * 使用范围：在magiStandardLLMAdapter中用于类型标注聊天请求
 * 解耦评估：类型定义无法解耦，必须直接导入以保证类型安全
 */
import type { ChatRequestParams } from "../../ai/types";
/**
 * 用途：聊天响应数据类型，定义LLM返回的响应结构
 * 使用范围：在magiStandardLLMAdapter中用于类型标注聊天响应
 * 解耦评估：类型定义无法解耦，必须直接导入以保证类型安全
 */
import type { ChatResponseData } from "../../ai/types";
/**
 * 用途：获取思源AI配置，用于读取API基础URL等配置信息
 * 使用范围：在构建后端请求时需要获取apiBaseURL配置
 * 解耦评估：可通过依赖注入解耦，但当前实现为全局配置读取，重构成本较高
 */
import { getAIConfigFromSiyuan } from "../../ai/utils/utils.config";

// ============================================================================
// 思源环境配置 - 用于读取思源笔记的全局配置
// ============================================================================

/**
 * 用途：获取思源配置，用于读取MAGI目标标签等配置
 * 使用范围：在构建运行时身份标识时需要读取magi.target配置
 * 解耦评估：可通过依赖注入解耦，但当前实现为全局配置读取，重构成本较高
 */
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

// ============================================================================
// MAGI 身份认证 - 用于管理MAGI的身份会话和认证令牌
// ============================================================================

/**
 * 用途：获取活跃的MAGI装甲令牌，用于后端请求认证
 * 使用范围：在向后端转发请求时需要获取认证令牌
 * 解耦评估：可通过依赖注入解耦，但当前实现为全局会话管理，重构成本较高
 */
import { getActiveMagiArmorToken } from "../service/magiIdentitySession";
import { getActiveMagiArmorSession } from "../service/magiIdentitySession";
/**
 * 用途：MAGI身份认证事件常量，用于触发身份认证流程
 * 使用范围：当缺少认证令牌时触发此事件通知用户登录
 * 解耦评估：事件常量无法解耦，必须保持一致性
 */
import { MAGI_IDENTITY_REQUIRED_EVENT } from "../service/magiIdentitySession";
import type { MagiArmorSession } from "../service/magiIdentitySession";

// ============================================================================
// MAGI 核心运行时 - Avatar运行时和核心类型定义
// ============================================================================

/**
 * 用途：创建Avatar运行时，用于MAGI共识链路的核心运行时
 * 使用范围：在创建标准LLM适配器时可能需要创建Avatar运行时实例
 * 解耦评估：核心依赖，无法解耦，是MAGI架构的基础组件
 */
import { createAvatarRuntime } from "../core/nerv/avatarRuntime/avatar.runtime";
/**
 * 用途：Avatar运行时类型定义
 * 使用范围：用于类型标注Avatar运行时实例
 * 解耦评估：类型定义无法解耦
 */
import type { AvatarRuntime } from "../core/nerv/avatarRuntime/avatar.runtime.types";
/**
 * 用途：回复选项类型定义
 * 使用范围：用于定义MAGI回复时的选项参数
 * 解耦评估：类型定义无法解耦
 */
import type { ReplyOptions } from "../core/core.types";

// ============================================================================
// MAGI Composables - 可组合函数和类型定义
// ============================================================================

/**
 * 用途：连接状态类型定义
 * 使用范围：用于标注MAGI连接状态
 * 解耦评估：类型定义无法解耦
 */
import type { ConnectionStatus } from "../composables/useMagi.types";
/**
 * 用途：源模拟上下文类型定义
 * 使用范围：用于解析和处理来自外部源的请求上下文
 * 解耦评估：类型定义无法解耦
 */
import type { SourceSimulationContext } from "../composables/useMagi.types";
/**
 * 用途：封装的Seel类型定义
 * 使用范围：用于MAGI的Seel管理
 * 解耦评估：类型定义无法解耦
 */
import type { WrappedSeel } from "../composables/useMagi.types";
/**
 * 用途：追加共识消息函数
 * 使用范围：在MAGI共识流程中追加消息到共识链
 * 解耦评估：核心共识逻辑，无法解耦
 */
import { appendConsensusMessage } from "../composables/useMagi.consensus";
/**
 * 用途：发送用户消息并进行共识
 * 使用范围：在处理用户输入时触发共识流程
 * 解耦评估：核心共识逻辑，无法解耦
 */
import { sendUserMessageWithConsensus } from "../composables/useMagi.consensus";
/**
 * 用途：共识请求上下文类型定义
 * 使用范围：用于构建和传递共识请求的上下文信息
 * 解耦评估：类型定义无法解耦
 */
import type { ConsensusRequestContext } from "../composables/useMagi.consensus";

// ============================================================================
// MAGI 事件系统 - 事件总线类型定义
// ============================================================================

/**
 * 用途：MAGI事件总线类型定义
 * 使用范围：用于事件驱动的MAGI组件通信
 * 解耦评估：类型定义无法解耦
 */
import type { MagiEventBus } from "../events/magiEventBus.types";

// ============================================================================
// LLM 适配器接口 - 标准LLM适配器的类型定义
// ============================================================================

/**
 * 用途：标准LLM适配器接口定义
 * 使用范围：定义标准LLM适配器的契约接口
 * 解耦评估：类型定义无法解耦
 */
import type { StandardLLMAdapter } from "../types/llmAdapter.types";
/**
 * 用途：标准LLM流式回调接口定义
 * 使用范围：定义流式响应的回调函数接口
 * 解耦评估：类型定义无法解耦
 */
import type { StandardLLMStreamCallbacks } from "../types/llmAdapter.types";
/**
 * 用途：标准LLM流式数据块类型定义
 * 使用范围：定义流式响应的数据块结构
 * 解耦评估：类型定义无法解耦
 */
import type { StandardLLMStreamChunk } from "../types/llmAdapter.types";

// ============================================================================
// MAGI 消息工厂 - 消息类型定义
// ============================================================================

/**
 * 用途：MAGI消息类型定义
 * 使用范围：定义MAGI消息的结构
 * 解耦评估：类型定义无法解耦
 */
import type { MagiMessage } from "../utils/messageFactory.types";

// ============================================================================
// 导出 - 按业务领域分组导出
// ============================================================================

// 导出聊天请求参数类型
export type { ChatRequestParams };
// 导出聊天响应数据类型
export type { ChatResponseData };
// 导出AI配置获取函数
export { getAIConfigFromSiyuan };

// 导出思源配置获取函数
export { getSiyuanConfig };

// 导出MAGI装甲令牌获取函数
export { getActiveMagiArmorToken };
export { getActiveMagiArmorSession };
// 导出MAGI身份认证事件常量
export { MAGI_IDENTITY_REQUIRED_EVENT };
export type { MagiArmorSession };

// 导出Avatar运行时创建函数
export { createAvatarRuntime };
// 导出Avatar运行时类型
export type { AvatarRuntime };
// 导出回复选项类型
export type { ReplyOptions };

// 导出连接状态类型
export type { ConnectionStatus };
// 导出源模拟上下文类型
export type { SourceSimulationContext };
// 导出封装的Seel类型
export type { WrappedSeel };
// 导出共识请求上下文类型
export type { ConsensusRequestContext };
// 导出追加共识消息函数
export { appendConsensusMessage };
// 导出发送用户消息并进行共识函数
export { sendUserMessageWithConsensus };

// 导出MAGI事件总线类型
export type { MagiEventBus };

// 导出标准LLM适配器接口
export type { StandardLLMAdapter };
// 导出标准LLM流式回调接口
export type { StandardLLMStreamCallbacks };
// 导出标准LLM流式数据块类型
export type { StandardLLMStreamChunk };

// 导出MAGI消息类型
export type { MagiMessage };
