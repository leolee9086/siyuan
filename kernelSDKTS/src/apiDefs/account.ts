/**
 * 账户相关 API 定义
 */
import { z } from 'zod';
import type { Api定义 } from '../client/types';
import { 创建响应Schema } from './types';

/** 标准响应 (data 为 null) */
const 标准空响应 = 创建响应Schema(z.null());

export const accountApiDefs = [
    {
        method: 'POST',
        endpoint: '/api/account/checkActivationcode',
        en: 'checkActivationcode',
        zh_cn: '检查激活码',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        description: '检查用户输入的激活码是否有效。',
        zodRequestSchema: z.object({
            data: z.string().describe('要检查的激活码'),
        }),
        zodResponseSchema: 标准空响应,
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/account/deactivate',
        en: 'deactivateUser',
        zh_cn: '注销账号',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        description: '注销当前用户账号。',
        zodRequestSchema: z.object({}),
        zodResponseSchema: 标准空响应,
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/account/login',
        en: 'login',
        zh_cn: '登录账号',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        description: '用户登录，需要提供用户名、密码、验证码和云端区域。',
        zodRequestSchema: z.object({
            userName: z.string().describe('用户名'),
            userPassword: z.string().describe('用户密码'),
            captcha: z.string().describe('验证码'),
            cloudRegion: z.number().describe('云端区域代码，例如 0 表示中国区'),
        }),
        zodResponseSchema: 创建响应Schema(z.any().nullable().describe('登录成功时可能包含用户信息')),
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/account/startFreeTrial',
        en: 'startFreeTrial',
        zh_cn: '开始免费试用',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        description: '为当前用户开启免费试用。',
        zodRequestSchema: z.object({}),
        zodResponseSchema: 标准空响应,
        lastVerified: '2025-12-28',
    },
    {
        method: 'POST',
        endpoint: '/api/account/useActivationcode',
        en: 'useActivationcode',
        zh_cn: '使用激活码',
        needAuth: true,
        needAdminRole: true,
        unavailableIfReadonly: true,
        description: '使用激活码激活账户。',
        zodRequestSchema: z.object({
            data: z.string().describe('要使用的激活码'),
        }),
        zodResponseSchema: 标准空响应,
        lastVerified: '2025-12-28',
    },
] as const satisfies readonly Api定义[];

export type AccountApiDefs = typeof accountApiDefs;
