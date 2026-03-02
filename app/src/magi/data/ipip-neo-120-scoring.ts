import type { IpipNeo120Domain, IpipNeo120Facet, IpipNeo120Item, ScoringAccumulation } from "./ipip-neo-120.types";
import type {
    IpipNeo120RawAnswer,
    IpipPersonaProfile,
    IpipSubjectProfile,
    PersonaBase,
} from "./questionnaire.types";

const DOMAIN_ORDER: readonly IpipNeo120Domain[] = ["N", "E", "O", "A", "C"];
const FACET_ORDER: readonly IpipNeo120Facet[] = [1, 2, 3, 4, 5, 6];

const FACET_NAME_MAP: Readonly<Record<IpipNeo120Domain, Readonly<Record<IpipNeo120Facet, string>>>> = {
    N: { 1: "Anxiety", 2: "Anger", 3: "Depression", 4: "SelfConsciousness", 5: "Immoderation", 6: "Vulnerability" },
    E: { 1: "Friendliness", 2: "Gregariousness", 3: "Assertiveness", 4: "ActivityLevel", 5: "ExcitementSeeking", 6: "Cheerfulness" },
    O: { 1: "Imagination", 2: "ArtisticInterests", 3: "Emotionality", 4: "Adventurousness", 5: "Intellect", 6: "Liberalism" },
    A: { 1: "Trust", 2: "Morality", 3: "Altruism", 4: "Cooperation", 5: "Modesty", 6: "Sympathy" },
    C: { 1: "SelfEfficacy", 2: "Orderliness", 3: "Dutifulness", 4: "AchievementStriving", 5: "SelfDiscipline", 6: "Cautiousness" },
};

const FACET_ITEM_COUNT = 4;
const DOMAIN_ITEM_COUNT = 24;

/**
 * 作用：初始化五维度数值累加器，所有 domain 归零。
 * 意图：避免重复手写初始化对象，保持统计结构统一。
 * 调用时机：计分函数启动时创建 sum/count 容器。
 * 问题/改进：若后续支持多量表，可抽象为泛型工厂。
 */
const createDomainAccumulator = (): Record<IpipNeo120Domain, number> => ({
    N: 0, E: 0, O: 0, A: 0, C: 0,
});

/**
 * 作用：根据 domain 和 facet 编号查找子维度英文名称。
 * 意图：将 FACET_NAME_MAP 的二级下标访问封装为单步调用，避免链式下标违反 lint 规则。
 * 调用时机：构建 facet 键名时调用。
 * 问题/改进：当前为静态映射，后续可改为从配置加载。
 */
const getFacetName = (domain: IpipNeo120Domain, facet: IpipNeo120Facet): string => {
    const domainFacets = FACET_NAME_MAP[domain];
    return domainFacets[facet];
};

/**
 * 作用：拼接标准 facet 键名，格式为 `${domain}${facet}_${EnglishName}`。
 * 意图：统一 facet 键名生成逻辑，与 personaPromptBuilder 中的键名格式对齐。
 * 调用时机：计分累加和结果输出时调用。
 * 问题/改进：键名格式为约定，后续可引入常量枚举强约束。
 */
const buildFacetKey = (domain: IpipNeo120Domain, facet: IpipNeo120Facet): string => {
    return `${domain}${facet}_${getFacetName(domain, facet)}`;
};

/**
 * 作用：将 1~5 的原始均值归一化到 0..1 区间。
 * 意图：统一输出量纲，公式为 `(mean - 1) / 4`，与设计文档对齐。
 * 调用时机：domain/facet 均值计算完成后调用。
 * 问题/改进：当前为线性映射，后续如需百分位转换可替换此函数。
 */
const toNormalizedScore = (scoreOnOneToFive: number): number => {
    return (scoreOnOneToFive - 1) / 4;
};

/**
 * 作用：统计题库中反向计分题的数量。
 * 意图：用于运行时自检，确保题库 plus/minus 分布未被意外修改。
 * 调用时机：`validateIpipNeo120ScoringInvariant` 中调用。
 * 问题/改进：O(n) 遍历，题库固定 120 题，性能无忧。
 */
const countMinusItems = (items: readonly IpipNeo120Item[]): number => {
    let minusCount = 0;
    for (const item of items) {
        // 仅统计反向计分题，正向题跳过。
        if (item.keyed === "minus") {
            minusCount += 1;
        }
    }
    return minusCount;
};

/**
 * 作用：断言题库满足 IPIP-NEO-120 的 120 题 / 5×24 / 5×6×4 结构约束。
 * 意图：在计分前拦截非法题库，避免产出无意义的 PersonaBase。
 * 调用时机：`scoreIpipNeo120PersonaBase` 入口处调用。
 * 问题/改进：当前为 O(domains × facets × items) 三重循环，题库固定 120 题可接受。
 */
const assertQuestionBankShape = (items: readonly IpipNeo120Item[]): void => {
    if (items.length !== 120) {
        throw new Error(`IPIP-NEO-120 题库长度非法，期望 120，实际 ${items.length}`);
    }
    for (const domain of DOMAIN_ORDER) {
        let domainCount = 0;
        for (const facet of FACET_ORDER) {
            let facetCount = 0;
            for (const item of items) {
                // 当前题目同时匹配目标 domain 和 facet 时计入统计。
                if (item.domain === domain && item.facet === facet) {
                    facetCount += 1;
                    domainCount += 1;
                }
            }
            if (facetCount !== FACET_ITEM_COUNT) {
                throw new Error(`Facet ${domain}${facet} 题量非法，期望 4，实际 ${facetCount}`);
            }
        }
        if (domainCount !== DOMAIN_ITEM_COUNT) {
            throw new Error(`Domain ${domain} 题量非法，期望 24，实际 ${domainCount}`);
        }
    }
};

/**
 * 作用：构建题号到题目元数据的索引映射。
 * 意图：将 O(n) 查找降为 O(1)，同时检测题号重复。
 * 调用时机：`scoreIpipNeo120PersonaBase` 校验通过后立即调用。
 * 问题/改进：Map 在 120 条规模下无性能瓶颈。
 */
const buildItemIndex = (items: readonly IpipNeo120Item[]): Map<number, IpipNeo120Item> => {
    const index = new Map<number, IpipNeo120Item>();
    for (const item of items) {
        if (index.has(item.q)) {
            throw new Error(`题库题号重复 q=${item.q}`);
        }
        index.set(item.q, item);
    }
    return index;
};

/**
 * 作用：遍历答案，按 domain/facet 累加方向性得分。
 * 意图：将累加逻辑从主函数中拆出，降低主函数行数并提升可测试性。
 * 调用时机：`scoreIpipNeo120PersonaBase` 中校验通过后调用。
 * 问题/改进：当前为单次遍历 O(n)，性能最优。
 */
const accumulateRawScores = (
    answers: readonly IpipNeo120RawAnswer[],
    itemsByQuestion: ReadonlyMap<number, IpipNeo120Item>,
): ScoringAccumulation => {
    const domainSum = createDomainAccumulator();
    const domainCount = createDomainAccumulator();
    const facetSum: Record<string, number> = {};
    const facetCount: Record<string, number> = {};

    for (const answer of answers) {
        const item = itemsByQuestion.get(answer.q);
        if (!item) {
            throw new Error(`题号 q=${answer.q} 无法在题库中定位`);
        }
        // plus 正向直接取分，minus 反向按 6 - score 转换。
        const directionalScore = item.keyed === "plus" ? answer.score : 6 - answer.score;
        const facetKey = buildFacetKey(item.domain, item.facet);

        domainSum[item.domain] += directionalScore;
        domainCount[item.domain] += 1;
        facetSum[facetKey] = (facetSum[facetKey] ?? 0) + directionalScore;
        facetCount[facetKey] = (facetCount[facetKey] ?? 0) + 1;
    }

    return { domainSum, domainCount, facetSum, facetCount };
};

/**
 * 作用：校验累加结果中每个 domain 和 facet 的答案数量是否符合预期。
 * 意图：在归一化之前拦截数据异常，避免产出无意义的 PersonaBase。
 * 调用时机：`computePersonaBase` 入口处调用。
 * 问题/改进：当前为 O(domains × facets) 遍历，30 次迭代可忽略。
 */
const assertAccumulationCounts = (acc: ScoringAccumulation): void => {
    for (const domain of DOMAIN_ORDER) {
        if (acc.domainCount[domain] !== DOMAIN_ITEM_COUNT) {
            throw new Error(`Domain ${domain} 答案数量非法，期望 24，实际 ${acc.domainCount[domain]}`);
        }
    }
    for (const domain of DOMAIN_ORDER) {
        for (const facet of FACET_ORDER) {
            const facetKey = buildFacetKey(domain, facet);
            const count = acc.facetCount[facetKey] ?? 0;
            if (count !== FACET_ITEM_COUNT) {
                throw new Error(`Facet ${domain}${facet} 答案数量非法，期望 4，实际 ${count}`);
            }
        }
    }
};

/**
 * 作用：将累加结果转换为归一化的 PersonaBase（5 traits + 30 facets）。
 * 意图：将归一化计算从主函数中拆出，保持单一职责。
 * 调用时机：`scoreIpipNeo120PersonaBase` 累加完成后调用。
 * 问题/改进：traits 直接以字面量构造，避免 as 断言。
 */
const computePersonaBase = (acc: ScoringAccumulation): PersonaBase => {
    assertAccumulationCounts(acc);

    const traits: PersonaBase["traits"] = {
        O: toNormalizedScore(acc.domainSum.O / DOMAIN_ITEM_COUNT),
        C: toNormalizedScore(acc.domainSum.C / DOMAIN_ITEM_COUNT),
        E: toNormalizedScore(acc.domainSum.E / DOMAIN_ITEM_COUNT),
        A: toNormalizedScore(acc.domainSum.A / DOMAIN_ITEM_COUNT),
        N: toNormalizedScore(acc.domainSum.N / DOMAIN_ITEM_COUNT),
    };

    const facets: Record<string, number> = {};
    for (const domain of DOMAIN_ORDER) {
        for (const facet of FACET_ORDER) {
            const facetKey = buildFacetKey(domain, facet);
            facets[facetKey] = toNormalizedScore((acc.facetSum[facetKey] ?? 0) / FACET_ITEM_COUNT);
        }
    }

    return { traits, facets };
};

/**
 * 作用：断言答案集合与题库一一对应，无遗漏、无重复、无越界。
 * 意图：在累加计分前拦截不完整或异常的答案数据。
 * 调用时机：`scoreIpipNeo120PersonaBase` 中构建索引后调用。
 * 问题/改进：当前为 O(n) 遍历 + Set 去重，性能充裕。
 */
const assertAnswersCoverage = (
    answers: readonly IpipNeo120RawAnswer[],
    itemsByQuestion: ReadonlyMap<number, IpipNeo120Item>,
): void => {
    if (answers.length !== itemsByQuestion.size) {
        throw new Error(`答案长度非法，期望 ${itemsByQuestion.size}，实际 ${answers.length}`);
    }
    const seen = new Set<number>();
    for (const answer of answers) {
        if (!itemsByQuestion.has(answer.q)) {
            throw new Error(`答案包含未知题号 q=${answer.q}`);
        }
        if (seen.has(answer.q)) {
            throw new Error(`答案包含重复题号 q=${answer.q}`);
        }
        seen.add(answer.q);
    }
};

/** @同步豁免: 性能考虑 — 纯 CPU 计算，无 I/O，异步化无收益且增加调用方复杂度。 */
/**
 * 作用：将 IPIP-NEO-120 原始答案转换为标准 PersonaBase（5 traits + 30 facets）。
 * 意图：实现"原始答案 -> 归一化人格基底"的核心计分链路。
 * 调用时机：问卷提交后、档案构建前调用。
 * 问题/改进：当前为前端可复核计分，权威长期档案仍由后端兜底。
 */
export const scoreIpipNeo120PersonaBase = (
    answers: readonly IpipNeo120RawAnswer[],
    items: readonly IpipNeo120Item[],
): PersonaBase => {
    assertQuestionBankShape(items);
    const itemsByQuestion = buildItemIndex(items);
    assertAnswersCoverage(answers, itemsByQuestion);
    const acc = accumulateRawScores(answers, itemsByQuestion);
    return computePersonaBase(acc);
};

/** @同步豁免: 性能考虑 — 纯对象组装，无 I/O。 */
/**
 * 作用：构造统一的 IPIP 人格档案对象。
 * 意图：封装 `IpipPersonaProfile` 的字面量构造，统一 schemaVersion 和 generatedAt 默认值。
 * 调用时机：计分完成后或从已有 PersonaBase 构建档案时调用。
 * 问题/改进：generatedAt 默认取当前时间，调用方可覆盖。
 */
export const buildIpipPersonaProfile = (params: {
    readonly subject: IpipSubjectProfile;
    readonly personaBase: PersonaBase;
    readonly generatedAt?: string;
}): IpipPersonaProfile => {
    return {
        schemaVersion: "IPIP-NEO-120-v1",
        subject: params.subject,
        personaBase: params.personaBase,
        generatedAt: params.generatedAt ?? new Date().toISOString(),
    };
};

/** @同步豁免: 性能考虑 — 组合两个同步纯函数，无 I/O。 */
/**
 * 作用：便捷入口，直接从原始答案构造人格档案。
 * 意图：减少调用方手动编排 score + build 两步的样板代码。
 * 调用时机：问卷提交后一步到位生成档案时调用。
 * 问题/改进：内部委托 scoreIpipNeo120PersonaBase + buildIpipPersonaProfile。
 */
export const buildIpipPersonaProfileFromRawAnswers = (params: {
    readonly subject: IpipSubjectProfile;
    readonly answers: readonly IpipNeo120RawAnswer[];
    readonly items: readonly IpipNeo120Item[];
    readonly generatedAt?: string;
}): IpipPersonaProfile => {
    const personaBase = scoreIpipNeo120PersonaBase(params.answers, params.items);
    const generatedAt = params.generatedAt ?? new Date().toISOString();
    return buildIpipPersonaProfile({ subject: params.subject, personaBase, generatedAt });
};

export const ipipNeo120ScoringStats = {
    FACET_ITEM_COUNT,
    DOMAIN_ITEM_COUNT,
    EXPECTED_MINUS_ITEMS: 55,
} as const;

/** @同步豁免: 性能考虑 — 纯 CPU 校验，无 I/O。 */
/**
 * 作用：运行时快速自检，确保题库反向题数量未被错误修改。
 * 意图：作为题库完整性的轻量级守卫，与 validateIpipNeo120Distribution 互补。
 * 调用时机：模块初始化或计分前可选调用。
 * 问题/改进：当前仅校验 minus 总数，后续可扩展为 per-domain 校验。
 */
export const validateIpipNeo120ScoringInvariant = (items: readonly IpipNeo120Item[]): void => {
    const minusCount = countMinusItems(items);
    if (minusCount !== ipipNeo120ScoringStats.EXPECTED_MINUS_ITEMS) {
        throw new Error(
            `IPIP-NEO-120 反向题数量非法，期望 ${ipipNeo120ScoringStats.EXPECTED_MINUS_ITEMS}，实际 ${minusCount}`,
        );
    }
};
