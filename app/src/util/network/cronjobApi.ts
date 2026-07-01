/**
 * cronjobApi.ts - CronJob 定时任务 API 封装
 *
 * 封装与后端 /api/cronjob/* 端点的通信
 */

/**
 * 用途：调用后端API的统一fetch封装
 * 使用范围：本模块所有API调用，用于与后端/api/cronjob/*端点通信
 * 解耦评估：是否可依赖注入？不适合。作为网络层基础设施，依赖注入会增加不必要的复杂度且无实际收益
 */
import { fetchSyncPost } from "./fetch";
/**
 * 用途：任务运行时信息类型定义
 * 使用范围：列出所有任务、获取任务详情等函数的返回值类型
 * 解耦评估：是否可依赖注入？不适用。类型导入仅编译时依赖，无运行时耦合
 */
import { 任务运行时信息 } from "./types";
/**
 * 用途：任务执行日志类型定义
 * 使用范围：获取日志函数的返回值类型
 * 解耦评估：是否可依赖注入？不适用。类型导入仅编译时依赖，无运行时耦合
 */
import { 执行日志 } from "./types";
/**
 * 用途：文档编译结果类型定义
 * 使用范围：编译文档函数的返回值类型
 * 解耦评估：是否可依赖注入？不适用。类型导入仅编译时依赖，无运行时耦合
 */
import { 编译结果 } from "./types";

// 重新导出类型供外部使用
export type { 任务运行时信息, 执行日志, 编译结果, 任务状态类型 } from "./types.ts";

// ============== API 方法 ==============

/**
 * 列出所有已注册的定时任务
 * @returns 任务列表
 */
export const 列出所有任务 = async ()=> {
    const res = await fetchSyncPost("/api/cronjob/list");
    return res.data?.tasks ?? [];
};

/**
 * 获取指定任务的详细信息
 * @param docId - 任务所属文档ID
 * @returns 任务信息，不存在时返回 null
 */
export const 获取任务详情 = async (docId: string)=> {
    const res = await fetchSyncPost("/api/cronjob/get", { docId });
    return res.data ?? null;
};

/**
 * 注册文档为扩展
 * @param docId - 文档ID
 * @param extLang - 扩展语言 (如 "go")
 * @param extType - 扩展类型 (如 "cronjob")
 * @returns 是否成功
 */
export const 注册扩展 = async (docId: string, extLang: string, extType: string)=> {
    const res = await fetchSyncPost("/api/cronjob/register", { docId, extLang, extType });
    return res.code === 0;
};

/**
 * 注销扩展
 * @param docId - 文档ID
 * @returns 是否成功
 */
export const 注销扩展 = async (docId: string)=> {
    const res = await fetchSyncPost("/api/cronjob/unregister", { docId });
    return res.code === 0;
};

/**
 * 启用任务 (编译并启动)
 * @param docId - 任务所属文档ID
 * @returns 是否成功
 */
export const 启用任务 = async (docId: string)=> {
    const res = await fetchSyncPost("/api/cronjob/enable", { docId });
    return res.code === 0;
};

/**
 * 禁用任务 (停止运行)
 * @param docId - 任务所属文档ID
 * @returns 是否成功
 */
export const 禁用任务 = async (docId: string) => {
    const res = await fetchSyncPost("/api/cronjob/disable", { docId });
    return res.code === 0;
};

/**
 * 立即执行任务 (不等待调度)
 * @param docId - 任务所属文档ID
 * @returns 是否成功
 */
export const 立即执行 = async (docId: string)=> {
    const res = await fetchSyncPost("/api/cronjob/run", { docId });
    return res.code === 0;
};

/**
 * 编译文档
 * @param docId - 文档ID
 * @param extLang - 可选，扩展语言，默认 "go"
 * @returns 编译结果，失败时返回 null
 */
export const 编译文档 = async (docId: string, extLang?: string) => {
    const res = await fetchSyncPost("/api/cronjob/compile", { docId, extLang });
    if (res.code !== 0) {
        return null;
    }
    return res.data;
};

/**
 * 获取任务执行日志
 * @param docId - 任务所属文档ID
 * @param count - 可选，返回日志条数，默认 20
 * @returns 日志列表
 */
export const 获取日志 = async (docId: string, count?: number) => {
    const res = await fetchSyncPost("/api/cronjob/logs", { docId, count });
    return res.data?.logs ?? [];
};
