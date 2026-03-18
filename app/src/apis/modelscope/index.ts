/**
 * 魔搭社区 (ModelScope) API 模块入口
 */

// 导出类型
export type {
    生成参数,
    任务响应,
    任务状态响应,
    API错误,
    思源代理响应,
    提交生成任务参数,
    获取任务状态参数,
    轮询任务参数,
    获取图片参数,
    // 英文别名
    GenerationParams,
    TaskResponse,
    TaskStatusResponse,
    ApiError,
    SiyuanProxyData,
    SubmitGenerationTaskParams,
    GetTaskStatusParams,
    PollTaskParams,
    FetchImageParams
} from "./types";

// 导出常量
export {
    魔搭API基础URL,
    请求头,
    内容类型JSON,
    任务类型图片生成,
    默认模型,
    端点,
    默认参数,
    思源代理端点
} from "./constants";

// 导出 API 函数
export {
    提交生成任务,
    获取任务状态,
    轮询任务直到完成,
    获取图片,
    提取图片URL
} from "./client";
