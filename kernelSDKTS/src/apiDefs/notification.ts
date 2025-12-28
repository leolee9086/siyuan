/**
 * 通知相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/** 消息推送响应 */
const 消息响应Schema = 创建响应Schema(
    z.object({
        id: z.string().describe('推送的消息的唯一标识符'),
    }).nullable()
);

export const notificationApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/notification/pushErrMsg',
        en: 'pushErrMsg',
        zh_cn: '推送错误消息',
        description: '向前端推送一条错误类型的消息通知。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            msg: z.string().describe('必需。要推送的错误消息内容'),
            timeout: z.number().int().positive().optional().describe('可选。消息显示持续时间，单位毫秒。默认 7000ms'),
        }),
        zodResponseSchema: 消息响应Schema,
    },
    {
        method: 'POST',
        endpoint: '/api/notification/pushMsg',
        en: 'pushMsg',
        zh_cn: '推送普通消息',
        description: '向前端推送一条普通类型的消息通知。',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: false,
        zodRequestSchema: z.object({
            msg: z.string().min(1).describe('必需。要推送的普通消息内容（不能为空）'),
            timeout: z.number().int().positive().optional().describe('可选。消息显示持续时间，单位毫秒。默认 7000ms'),
        }),
        zodResponseSchema: 消息响应Schema,
    },
] as const satisfies readonly Api定义[];

export type NotificationApiDefs = typeof notificationApiDefs;
