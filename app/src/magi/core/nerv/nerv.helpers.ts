/**
 * @fileoverview NERV系统辅助函数
 * @description 提供人格特质操作、同步状态计算、结果合并等NERV内部逻辑
 */

import type {
    PersonaTraits,
    NERVGhost,
    NERVSyncStatus,
    NERVExecutionResult,
    NERVWorkflowResult,
} from "../core.types";

/** 人格特质变异幅度常量 */
const TRAIT_VARIATION = 0.15;

/** 同步率衰减基准（毫秒/小时） */
const SYNC_DECAY_MS_PER_HOUR = 3600000;

/**
 * 合并两个人格特质的数值（取平均值）
 * @description 遍历a的所有特质键，将a和b对应值取平均，用于balanced模式的人格融合
 * @param a - 第一个人格特质
 * @param b - 第二个人格特质
 * @returns 合并后的人格特质（深拷贝）
 */
/** @同步豁免: 性能考虑 - 纯内存数据结构的数值计算，无I/O操作，异步化会引入不必要的微任务开销 */
export function mergePersonaTraits(a: PersonaTraits, b: PersonaTraits): PersonaTraits {
    const merged: PersonaTraits = JSON.parse(JSON.stringify(a));
    for (const trait of Object.keys(merged.personalityTraits)) {
        const aVal = a.personalityTraits[trait] ?? 0;
        const bVal = b.personalityTraits[trait] ?? 0;
        merged.personalityTraits[trait] = (aVal + bVal) / 2;
    }
    return merged;
}

/**
 * 根据模式选择人格变体
 * @description emotional模式返回情感变体，logical返回逻辑变体，balanced返回两者融合
 * @param mode - 激活模式（emotional/logical/balanced）
 * @param emotional - 情感倾向变体
 * @param logical - 逻辑倾向变体
 */
/** @同步豁免: 性能考虑 - 纯条件分支选择，无I/O操作 */
export function selectPersonaVariant(
    mode: string,
    emotional: PersonaTraits,
    logical: PersonaTraits
): PersonaTraits {
    if (mode === "emotional") {
        return emotional;
    }
    if (mode === "logical") {
        return logical;
    }
    // balanced及其他模式：融合两个变体
    return mergePersonaTraits(emotional, logical);
}

/**
 * 人格分裂算法：从原始人格生成多个变体
 * @description 对每个特质施加正/负方向的随机扰动，递归生成更多变体（最大深度2）
 * @param original - 原始人格特质
 * @param depth - 当前递归深度（默认0）
 * @returns 人格变体数组
 */
/** @同步豁免: 性能考虑 - 递归纯计算函数，无I/O操作，异步化会导致递归调用产生大量Promise链 */
export function splitPersona(original: PersonaTraits, depth: number = 0): PersonaTraits[] {
    try {
        const variants: PersonaTraits[] = [];

        for (let i = 0; i < 2; i++) {
            const variant: PersonaTraits = JSON.parse(JSON.stringify(original));
            // 对每个特质施加方向性扰动
            for (const trait of Object.keys(variant.personalityTraits)) {
                const currentVal = variant.personalityTraits[trait] ?? 0;
                const direction = i === 0 ? 1 : -1;
                const delta = Math.random() * TRAIT_VARIATION * direction;
                variant.personalityTraits[trait] = Math.min(1, Math.max(0, currentVal + delta));
            }
            variants.push(variant);

            // 递归深度限制为2层
            if (depth < 2) {
                variants.push(...splitPersona(variant, depth + 1));
            }
        }

        return variants;
    } catch {
        return [original, original];
    }
}

/**
 * 计算人格的同步状态
 * @description 基于上次使用时间的衰减、Ghost置信度和人格特质的尽责性综合计算同步率，
 *   同步率>=80视为synced，否则desynced
 * @param ghost - NERV Ghost容器
 */
/** @同步豁免: 性能考虑 - 纯数值计算，无I/O操作 */
export function calculateSyncStatus(ghost: NERVGhost): NERVSyncStatus {
    const lastUsed = ghost.lastUsed ?? ghost.core.meta.created;
    const uptime = Date.now() - lastUsed;
    const baseSync = Math.max(0, 100 - (uptime / SYNC_DECAY_MS_PER_HOUR) * 10);

    const ghostStatus = ghost.core.getStatus();
    const confidenceFactor = ghostStatus.confidence * 20;
    const conscientiousness = ghost.core.Persona.personalityTraits["conscientiousness"] ?? 0;
    const personalityFactor = conscientiousness * 20;
    const totalSync = baseSync + personalityFactor + confidenceFactor;

    return {
        status: totalSync >= 80 ? "synced" : "desynced",
        ratio: Math.min(100, totalSync),
        confidence: ghostStatus.confidence,
        lastExecution: ghostStatus.lastExecution,
    };
}

/**
 * 计算单个项目的风险等级
 * @description 根据score阈值判定风险等级，并检查complexity/uncertainty/impact因子
 * @param item - 包含score和可选风险因子的数据项
 */
/** @同步豁免: 性能考虑 - 纯数值比较和数组过滤，无I/O操作 */
export function calculateRisk(
    item: Record<string, unknown>
): { level: string; factors: string[] } {
    const score = typeof item["score"] === "number" ? item["score"] : 0;
    const level = score < 5 ? "high" : score < 7 ? "medium" : "low";
    const factorNames = ["complexity", "uncertainty", "impact"];
    const factors = factorNames.filter((f) => {
        const val = item[f];
        return typeof val === "number" && val > 0.7;
    });
    return { level, factors };
}

/**
 * 合并多个人格的工作流执行结果
 * @description 生成摘要、按置信度加权合并建议、计算平均置信度
 * @param results - 各人格的执行结果列表
 */
/** @同步豁免: 性能考虑 - 纯内存数据聚合计算，无I/O操作 */
export function mergeWorkflowResults(
    results: Array<{ persona: string; result: NERVExecutionResult }>
): NERVWorkflowResult {
    const summary = results.map((r) => ({
        persona: r.persona,
        confidence: r.result.confidence ?? 0,
        timestamp: r.result.timestamp,
    }));

    const consensus: Record<string, { score: number; weight: number }> = {};
    for (const r of results) {
        const weight = r.result.confidence ?? 0.5;
        const recommendations = r.result.recommendations ?? {};
        for (const [key, value] of Object.entries(recommendations)) {
            const existing = consensus[key];
            // 已有条目时按权重加权合并score
            if (existing) {
                const totalWeight = existing.weight + weight;
                existing.score = (existing.score * existing.weight + value.score * weight) / totalWeight;
                existing.weight = totalWeight;
            }
            // 首次出现时直接记录
            if (!existing) {
                consensus[key] = { score: value.score, weight };
            }
        }
    }

    const totalConfidence = summary.reduce((acc, s) => acc + s.confidence, 0);
    return {
        summary,
        consensus,
        timestamp: Date.now(),
        averageConfidence: summary.length > 0 ? totalConfidence / summary.length : 0,
    };
}
