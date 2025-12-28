/**
 * 网络代理相关 API 定义
 * 处理 HTTP 转发代理请求
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

// 代理响应 Schema
const 代理响应Schema = z.object({
    url: z.string().describe('请求的目标 URL'),
    status: z.number().int().describe('目标服务器返回的 HTTP 状态码，例如 200'),
    contentType: z.string().describe('目标服务器返回的 Content-Type 头'),
    body: z.string().describe('目标服务器返回的响应体内容，编码方式由 bodyEncoding 指定'),
    bodyEncoding: z.enum(['text', 'base64', 'base64-std', 'base64-url', 'base32', 'base32-std', 'base32-hex', 'hex']).describe('响应体的编码方式'),
    headers: z.record(z.array(z.string())).describe("目标服务器返回的 HTTP 响应头，键为头域名，值为字符串数组"),
    elapsed: z.number().int().describe('请求耗时 (毫秒)'),
});

export const networkApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/network/forwardProxy',
        en: 'forwardProxy',
        zh_cn: '转发HTTP代理请求',
        description: '作为代理，将客户端构造的HTTP(S)请求转发到指定的目标URL，并返回目标服务器的响应。支持多种请求体编码方式。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            url: z.string().describe('必需。要请求的目标 URL，必须是合法的 HTTP 或 HTTPS 地址。'),
            method: z.string().optional().describe('可选。HTTP 请求方法，如 GET, POST, PUT, DELETE 等。默认为 POST。'),
            timeout: z.number().int().positive().optional().describe('可选。请求超时时间，单位毫秒。默认为 7000ms。'),
            headers: z.array(z.record(z.string(), z.any())).optional().describe("可选。HTTP 请求头数组，每个元素是一个包含单个键值对的对象。"),
            contentType: z.string().optional().describe("可选。请求体的 Content-Type。默认为 'application/json'。"),
            payload: z.any().optional().describe('可选。HTTP 请求体内容。其格式和编码由 payloadEncoding 决定。'),
            payloadEncoding: z.enum(['json', 'text', 'base64', 'base64-std', 'base64-url', 'base32', 'base32-std', 'base32-hex', 'hex']).optional()
                .describe("可选。payload 字段的编码方式。默认为 'json'。"),
            responseEncoding: z.enum(['text', 'base64', 'base64-std', 'base64-url', 'base32', 'base32-std', 'base32-hex', 'hex']).optional()
                .describe("可选。响应体的编码方式。默认为 'text'。"),
        }),
        zodResponseSchema: 创建响应Schema(代理响应Schema.nullable()),
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type NetworkApiDefs = typeof networkApiDefs;
