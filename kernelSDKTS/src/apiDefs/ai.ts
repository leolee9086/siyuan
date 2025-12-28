/**
 * AI 相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

export const aiApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/ai/chatGPT',
        en: 'chatGPT',
        zh_cn: '与 ChatGPT 对话',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        description: '与 ChatGPT 进行简单对话。',
        zodRequestSchema: z.object({
            msg: z.string().describe('发送给 ChatGPT 的消息内容'),
        }),
        zodResponseSchema: 创建响应Schema(z.string().describe('ChatGPT 的回复内容')),
    },
    {
        method: 'POST',
        endpoint: '/api/ai/chatGPTWithAction',
        en: 'chatGPTWithAction',
        zh_cn: '调用 ChatGPT 执行动作',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        description: '调用 ChatGPT 对指定的块ID列表执行特定动作。',
        zodRequestSchema: z.object({
            ids: z.array(z.string()).describe('要操作的块 ID 列表'),
            action: z.string().describe('要执行的动作指令'),
        }),
        zodResponseSchema: 创建响应Schema(z.string().describe('ChatGPT 执行动作后的返回结果')),
    },
] as const satisfies readonly Api定义[];

export type AiApiDefs = typeof aiApiDefs;
