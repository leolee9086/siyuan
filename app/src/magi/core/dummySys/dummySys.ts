/**
 * @fileoverview DummySys人格工厂
 * @description 创建Ghost人格实例，提供人格特质、执行能力和状态查询。
 *   替代原始基于EventEmitter的Ghost类，使用工厂函数+闭包模式。
 */

import type { NERVGhost, PersonaTraits, NERVExecutionResult } from "../core.types";
import { asRecord, extractStringArray } from "../configLoader.guard";

/** 默认人格特质 */
const DEFAULT_TRAITS: Record<string, number> = {
    openness: 0.7,
    conscientiousness: 0.8,
    extraversion: 0.6,
    agreeableness: 0.9,
    neuroticism: 0.3,
};

/** 默认技能集 */
const DEFAULT_SKILLS: Record<string, number> = {
    communication: 0.8,
    problemSolving: 0.7,
    technicalKnowledge: 0.9,
};

/** 默认价值观 */
const DEFAULT_VALUES: Record<string, number> = {
    honesty: 0.9,
    responsibility: 0.8,
};

/**
 * 将Record的键值对格式化为 "- key: value" 列表
 * @description 用于生成角色扮演提示词中的特质/技能/价值观列表
 * @param entries - 键值对Record
 */
function formatEntries(entries: Record<string, unknown>): string {
    return Object.entries(entries)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join("\n");
}

/**
 * 生成角色扮演系统提示词
 * @description 将人格特质、技能和价值观组装为LLM可理解的系统提示词
 * @param persona - 人格数据（含name/role/personalityTraits等）
 * @param goal - 角色目标描述
 */
function masquerade(persona: Record<string, unknown>, goal: string): string {
    const name = typeof persona["name"] === "string" ? persona["name"] : "Unknown";
    const role = typeof persona["role"] === "string" ? persona["role"] : "assistant";
    const traits = asRecord(persona["personalityTraits"]) ?? {};
    const skills = asRecord(persona["skills"]) ?? {};
    const values = asRecord(persona["values"]) ?? {};

    return `You are ${name}, a ${role}.
Your goal is to ${goal}.
Personality traits:
${formatEntries(traits)}

Skills and interests:
${formatEntries(skills)}

Core values:
${formatEntries(values)}

You are interacting with user.`;
}

/**
 * 对人格特质施加情感/逻辑方向的偏移
 * @description 情感方向增加neuroticism和extraversion，逻辑方向减少，值限制在0-1范围
 * @param traits - 原始特质Record（深拷贝后操作）
 * @param direction - 偏移方向（1=情感，-1=逻辑）
 */
function applyTraitOffset(
    traits: Record<string, number>,
    direction: number
): Record<string, number> {
    const result = { ...traits };
    const neuroticism = result["neuroticism"] ?? 0.3;
    const extraversion = result["extraversion"] ?? 0.6;
    result["neuroticism"] = Math.min(1, Math.max(0, neuroticism + 0.2 * direction));
    result["extraversion"] = Math.min(1, Math.max(0, extraversion + 0.2 * direction));
    return result;
}

/**
 * 构建单次执行结果
 * @description 生成带随机置信度和权重的执行结果
 * @param name - 人格名称（用于recommendations键）
 */
function buildExecutionResult(name: string): NERVExecutionResult {
    return {
        confidence: Math.random() * 0.5 + 0.5,
        recommendations: {
            [name]: {
                score: Math.random() * 10,
                weight: 1,
            },
        },
        timestamp: Date.now(),
    };
}

/**
 * 创建Ghost人格实例（DummySys工厂核心）
 * @description 组装人格特质、生成启动提示词、提供execute和getStatus能力。
 *   返回符合NERVGhost.core接口的对象。
 * @param name - 人格名称
 * @param personaOverrides - 人格特质覆盖（与默认值合并）
 */
export async function createGhost(
    name: string,
    personaOverrides: Record<string, unknown> = {}
): Promise<NERVGhost["core"]> {
    const traitOverrides = asRecord(personaOverrides["personalityTraits"]) ?? {};
    const personalityTraits: Record<string, number> = { ...DEFAULT_TRAITS };
    // 将覆盖值中的数字类型特质合并到默认特质
    for (const [key, val] of Object.entries(traitOverrides)) {
        if (typeof val === "number") {
            personalityTraits[key] = val;
        }
    }

    // 生成情感/逻辑两个特质变体（用于splitPersona）
    const emotionalTraits = applyTraitOffset(personalityTraits, 1);
    const logicalTraits = applyTraitOffset(personalityTraits, -1);

    // 闭包状态：执行统计
    let confidence = 0;
    let lastExecution = 0;

    const Persona: PersonaTraits = {
        personalityTraits,
        /** 人格分裂：返回情感和逻辑两个变体 */
        splitPersona: () => [
            { personalityTraits: emotionalTraits },
            { personalityTraits: logicalTraits },
        ],
    };

    const meta = {
        created: Date.now(),
        version: "2.0",
        dependencies: extractStringArray(personaOverrides["dependencies"]),
    };

    return {
        Persona,
        meta,

        /** 执行任务并更新统计信息 */
        execute: async (_task: unknown, _context: unknown): Promise<NERVExecutionResult> => {
            const result = buildExecutionResult(name);
            confidence = result.confidence ?? 0;
            lastExecution = Date.now();
            return result;
        },

        /** 获取当前Ghost状态 */
        getStatus: () => ({ confidence, lastExecution }),
    };
}
