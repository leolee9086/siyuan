/**
 * API 定义通用类型
 * 
 * 这个文件包含所有 API 定义共用的类型，
 * 比如标准响应格式、常见参数类型等。
 */
import { z } from 'zod';

/**
 * 思源内核 API 的标准响应格式
 */
export const 标准响应Schema = z.object({
    /** 状态码，0 表示成功 */
    code: z.number(),
    /** 消息 */
    msg: z.string(),
    /** 响应数据 */
    data: z.unknown().nullable(),
});

export type 标准响应 = z.infer<typeof 标准响应Schema>;

/**
 * 带类型参数的标准响应
 */
export function 创建响应Schema<T extends z.ZodType>(dataSchema: T) {
    return z.object({
        code: z.number(),
        msg: z.string(),
        data: dataSchema,
    });
}

/** 创建响应Schema的英文别名 */
export const createResponseSchema = 创建响应Schema;

/**
 * 常用的 ID 类型
 */
export const BlockId = z.string().describe('块 ID');
export const NotebookId = z.string().describe('笔记本 ID');
export const DocumentId = z.string().describe('文档 ID');

/**
 * 空请求 Schema (用于不需要参数的 API)
 */
export const 空请求Schema = z.object({}).optional();
export const EmptyRequestSchema = 空请求Schema;
