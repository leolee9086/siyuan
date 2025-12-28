/**
 * 网络代理相关 API 定义
 * 处理 HTTP 转发代理请求
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

// Cookie Schema
const CookieSchema = z.object({
    Name: z.string(),
    Value: z.string(),
    Path: z.string().optional(),
    Domain: z.string().optional(),
    Expires: z.string().optional(),
    RawExpires: z.string().optional(),
    MaxAge: z.number().int().optional(),
    Secure: z.boolean().optional(),
    HttpOnly: z.boolean().optional(),
    SameSite: z.union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
    ]).optional().describe('SameSite policy: 0 (None), 1 (Lax), 2 (Strict), 3 (default)'),
    Raw: z.string().optional(),
    Unparsed: z.array(z.string()).optional(),
});

// 代理响应 Schema
const 代理响应Schema = z.object({
    status: z.string().describe("目标服务器返回的 HTTP 状态文本，例如 '200 OK'"),
    statusCode: z.number().int().describe('目标服务器返回的 HTTP 状态码，例如 200'),
    proto: z.string().describe("目标服务器响应的 HTTP 协议版本，例如 'HTTP/1.1'"),
    headers: z.record(z.array(z.string())).describe("目标服务器返回的 HTTP 响应头，键为头域名，值为字符串数组。例如 {'Content-Type': ['application/json']}"),
    cookies: z.array(CookieSchema).optional().describe('目标服务器返回的 Cookies 数组'),
    body: z.string().describe('目标服务器返回的响应体内容，经过 Base64 编码'),
    url: z.string().describe('实际请求的最终 URL (可能经过重定向)'),
    length: z.number().int().describe('目标服务器返回的响应体原始长度 (解码前)'),
    isText: z.boolean().describe('指示目标服务器返回的响应体是否为文本类型'),
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
            headers: z.array(z.record(z.string(), z.any())).optional().describe("可选。HTTP 请求头数组，每个元素是一个包含单个键值对的对象，例如 [{'User-Agent': 'Siyuan-Proxy'}, {'Authorization': 'Bearer token'}]。"),
            contentType: z.string().optional().describe("可选。请求体的 Content-Type。默认为 'application/json'。"),
            payload: z.any().optional().describe('可选。HTTP 请求体内容。其格式和编码由 payloadEncoding 决定。'),
            payloadEncoding: z.enum(['json', 'text', 'base64', 'base64-std', 'base64-url', 'base32', 'base32-std', 'base32-hex', 'hex']).optional()
                .describe("可选。payload 字段的编码方式。'json' 和 'text' 表示直接使用 payload 值 (json 会被序列化)；其他选项表示 payload 是对应编码的字符串，代理服务器会先解码再发送。默认为 'json'。"),
        }),
        zodResponseSchema: 创建响应Schema(代理响应Schema.nullable()),
    },
] as const satisfies readonly Api定义[];

export type NetworkApiDefs = typeof networkApiDefs;
