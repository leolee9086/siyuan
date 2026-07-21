// ============================================================================
// AI 请求与配置
// ============================================================================

/**
 * 用途：聊天请求参数类型，定义发送给 MAGI 后端的标准请求结构。
 * 使用范围：adapter/helpers/backend 三个模块共享请求入参类型。
 * 解耦评估：类型定义无法解耦，必须保持与 AI 层契约一致。
 */
import type { ChatRequestParams } from "../../ai/types";
/**
 * 用途：聊天响应数据类型，定义 MAGI 后端返回的 OpenAI-compatible 结构。
 * 使用范围：adapter/helpers/backend 三个模块共享响应类型。
 * 解耦评估：类型定义无法解耦，必须保持与 AI 层契约一致。
 */
import type { ChatResponseData } from "../../ai/types";
/**
 * 用途：读取思源 AI 配置，用于推导 MAGI 后端请求目标地址。
 * 使用范围：仅 backend 模块在发送请求前读取 apiBaseURL。
 * 解耦评估：可通过依赖注入解耦，但当前适配器创建链路尚未引入配置注入层，直接读取全局配置更符合现状。
 */
import { getAIConfigFromSiyuan } from "../../ai/utils/utils.config";

// ============================================================================
// 思源环境配置
// ============================================================================

/**
 * 用途：读取思源运行时配置中的 MAGI 目标标识。
 * 使用范围：backend 模块构建主界面 interface label 时读取 `magi.target`。
 * 解耦评估：可通过依赖注入解耦，但当前仅在运行时身份构建时单点使用，保留直接读取可减少样板代码。
 */
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

// ============================================================================
// MAGI 身份会话
// ============================================================================

/**
 * 用途：获取当前活跃的 MAGI armor token。
 * 使用范围：backend 模块向 MAGI 后端发请求前附加 Bearer 认证。
 * 解耦评估：可通过参数注入解耦，但前端当前仍以全局身份会话作为唯一来源，直接依赖更贴合现行链路。
 */
import { getActiveMagiArmorToken } from "../service/magiIdentitySession";
/**
 * 用途：获取当前活跃的 MAGI armor 会话详情。
 * 使用范围：backend 模块构建主聊天 `user` 身份镜像时读取 identityId。
 * 解耦评估：可通过参数注入解耦，但主聊天目前始终绑定全局登录态，保留直接读取可避免额外同步状态。
 */
import { getActiveMagiArmorSession } from "../service/magiIdentitySession";
/**
 * 用途：身份认证事件常量，用于在缺少 armor token 时提示用户切换到身份面板。
 * 使用范围：adapter 主实现触发 UI 级身份补全流程。
 * 解耦评估：事件名本身无法解耦，必须由发送方与监听方共享同一常量。
 */
import { MAGI_IDENTITY_REQUIRED_EVENT } from "../service/magiIdentitySession";
/**
 * 用途：MAGI armor 会话类型定义。
 * 使用范围：backend 模块在构建主聊天身份镜像时读取会话字段。
 * 解耦评估：类型定义无法解耦。
 */
import type { MagiArmorSession } from "../service/magiIdentitySession";

// ============================================================================
// MAGI 前端状态类型
// ============================================================================

/**
 * 用途：连接状态类型定义。
 * 使用范围：adapter 与 factory 共享后端连接状态引用类型。
 * 解耦评估：类型定义无法解耦。
 */
import type { ConnectionStatus } from "../composables/useMagi.types";
/**
 * 用途：来源模拟上下文类型定义。
 * 使用范围：helpers 模块解析 `<magi_request_source>` system message 时使用。
 * 解耦评估：类型定义无法解耦。
 */
import type { SourceSimulationContext } from "../composables/useMagi.types";

// ============================================================================
// 标准适配器契约
// ============================================================================

/**
 * 用途：标准 LLM 适配器接口定义。
 * 使用范围：factory 与主 adapter 共享返回值契约。
 * 解耦评估：类型定义无法解耦。
 */
import type { StandardLLMAdapter } from "../types/llmAdapter.types";
/**
 * 用途：标准 LLM 流式回调接口定义。
 * 使用范围：主 adapter 的 streamChatCompletion 参数类型。
 * 解耦评估：类型定义无法解耦。
 */
import type { StandardLLMStreamCallbacks } from "../types/llmAdapter.types";
/**
 * 用途：标准 LLM 流式 chunk 类型定义。
 * 使用范围：helpers 模块构建 OpenAI-compatible chunk 时使用。
 * 解耦评估：类型定义无法解耦。
 */
import type { StandardLLMStreamChunk } from "../types/llmAdapter.types";
/**
 * 用途：导入共享 SSE data 流解析器。
 * 使用范围：backend adapter 消费 MAGI OpenAI 流。
 * 解耦评估：通用协议实现应集中复用，不在 MAGI 内复制。
 */
import { consumeSSEDataStream } from "../../util/network/sse/consumeSSEDataStream";

// ============================================================================
// 导出
// ============================================================================

/** 导出聊天请求参数类型。 */
export type { ChatRequestParams };
/** 导出聊天响应数据类型。 */
export type { ChatResponseData };
/** 导出思源 AI 配置读取函数。 */
export { getAIConfigFromSiyuan };

/** 导出思源运行时配置读取函数。 */
export { getSiyuanConfig };

/** 导出活跃 armor token 读取函数。 */
export { getActiveMagiArmorToken };
/** 导出活跃 armor 会话读取函数。 */
export { getActiveMagiArmorSession };
/** 导出缺少身份时使用的事件常量。 */
export { MAGI_IDENTITY_REQUIRED_EVENT };
/** 导出 armor 会话类型。 */
export type { MagiArmorSession };

/** 导出连接状态类型。 */
export type { ConnectionStatus };
/** 导出来源模拟上下文类型。 */
export type { SourceSimulationContext };

/** 导出标准适配器接口。 */
export type { StandardLLMAdapter };
/** 导出标准流式回调接口。 */
export type { StandardLLMStreamCallbacks };
/** 导出标准流式 chunk 类型。 */
export type { StandardLLMStreamChunk };
/** 导出共享 SSE data 流解析器。 */
export { consumeSSEDataStream };
