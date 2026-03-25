import { describe, expect, it } from "vitest";
import type { IpipPersonaProfile } from "../data/questionnaire.types";
import {
    ACTIVE_SEED_POINTER_SCHEMA,
    isActiveSeedPointer,
    isIpipPersonaProfile,
} from "./personaRuntimePromptBuilder.guard";

const FACET_DOMAIN_ORDER: readonly string[] = ["N", "E", "O", "A", "C"];
const FACET_NAME_MAP: Readonly<Record<string, readonly string[]>> = {
    N: ["Anxiety", "Anger", "Depression", "SelfConsciousness", "Immoderation", "Vulnerability"],
    E: ["Friendliness", "Gregariousness", "Assertiveness", "ActivityLevel", "ExcitementSeeking", "Cheerfulness"],
    O: ["Imagination", "ArtisticInterests", "Emotionality", "Adventurousness", "Intellect", "Liberalism"],
    A: ["Trust", "Morality", "Altruism", "Cooperation", "Modesty", "Sympathy"],
    C: ["SelfEfficacy", "Orderliness", "Dutifulness", "AchievementStriving", "SelfDiscipline", "Cautiousness"],
};

/**
 * 作用：构造覆盖 30 个标准 facet 的分值字典。
 * 意图：为完备性判定测试提供稳定的“合法基线”输入。
 * 调用时机：profile 样本构建前调用。
 */
function buildCompleteFacetScores(): Record<string, number> {
    const facets: Record<string, number> = {};
    for (const domain of FACET_DOMAIN_ORDER) {
        const names = FACET_NAME_MAP[domain];
        let facetNumber = 1;
        for (const name of names) {
            facets[`${domain}${facetNumber}_${name}`] = 0.5;
            facetNumber += 1;
        }
    }
    return facets;
}

/**
 * 作用：构造一份满足完整规则的 profile。
 * 意图：在各负例测试中复用同一基线，减少重复字面量。
 * 调用时机：每个 profile 判定测试执行前调用。
 */
function buildCompleteProfile(): IpipPersonaProfile {
    return {
        schemaVersion: "IPIP-NEO-120-v1",
        generatedAt: "2026-03-03T00:00:00.000Z",
        subject: {
            id: "zhi",
            name: "织",
            organization: "NERV",
            role: "Pilot",
            careerGoal: "Protect humanity",
            cognitiveStances: {
                profession: "Pilot",
                primarySocialRelation: "伙伴",
                selfName: "织",
            },
        },
        personaBase: {
            traits: {
                O: 0.6,
                C: 0.6,
                E: 0.4,
                A: 0.7,
                N: 0.3,
            },
            facets: buildCompleteFacetScores(),
        },
    };
}

/**
 * 作用：断言完整 profile 可通过守卫。
 * 意图：确认“完备输入”不会被误判为非法。
 * 调用时机：profile 守卫正向用例。
 */
function shouldAcceptCompleteProfile(): void {
    const profile = buildCompleteProfile();
    expect(isIpipPersonaProfile(profile)).toBe(true);
}

/**
 * 作用：断言 traits 缺项会被判定为不完备。
 * 意图：覆盖 OCEAN 五维完整性约束。
 * 调用时机：profile 守卫负向用例。
 */
function shouldRejectProfileWhenTraitMissing(): void {
    const profile = buildCompleteProfile();
    const invalidProfile = {
        ...profile,
        personaBase: {
            ...profile.personaBase,
            traits: {
                O: profile.personaBase.traits.O,
                E: profile.personaBase.traits.E,
                A: profile.personaBase.traits.A,
                N: profile.personaBase.traits.N,
            },
        },
    };
    expect(isIpipPersonaProfile(invalidProfile)).toBe(false);
}

/**
 * 作用：断言 traits 越界分值会被判定为不完备。
 * 意图：覆盖 0~1 归一化边界约束。
 * 调用时机：profile 守卫负向用例。
 */
function shouldRejectProfileWhenTraitOutOfRange(): void {
    const profile = buildCompleteProfile();
    const invalidProfile = {
        ...profile,
        personaBase: {
            ...profile.personaBase,
            traits: {
                ...profile.personaBase.traits,
                O: 1.2,
            },
        },
    };
    expect(isIpipPersonaProfile(invalidProfile)).toBe(false);
}

/**
 * 作用：断言 facets 缺项会被判定为不完备。
 * 意图：覆盖 30 facets 完整性约束。
 * 调用时机：profile 守卫负向用例。
 */
function shouldRejectProfileWhenFacetMissing(): void {
    const profile = buildCompleteProfile();
    const invalidFacets = { ...profile.personaBase.facets };
    delete invalidFacets.N1_Anxiety;
    const invalidProfile = {
        ...profile,
        personaBase: {
            ...profile.personaBase,
            facets: invalidFacets,
        },
    };
    expect(isIpipPersonaProfile(invalidProfile)).toBe(false);
}

/**
 * 作用：断言非法时间戳会被判定为不完备。
 * 意图：覆盖 `generatedAt` 时间语义约束。
 * 调用时机：profile 守卫负向用例。
 */
function shouldRejectProfileWhenGeneratedAtInvalid(): void {
    const profile = buildCompleteProfile();
    const invalidProfile = {
        ...profile,
        generatedAt: "not-a-date",
    };
    expect(isIpipPersonaProfile(invalidProfile)).toBe(false);
}

function shouldRejectProfileWhenCognitiveStancesMissing(): void {
    const profile = buildCompleteProfile();
    const invalidProfile = {
        ...profile,
        subject: {
            ...profile.subject,
            cognitiveStances: {
                profession: "Pilot",
                primarySocialRelation: "",
                selfName: "织",
            },
        },
    };
    expect(isIpipPersonaProfile(invalidProfile)).toBe(false);
}

/**
 * 作用：断言 active seed 指针合法样本可通过守卫。
 * 意图：验证指针结构与关键字段约束生效。
 * 调用时机：pointer 守卫正向用例。
 */
function shouldAcceptValidActiveSeedPointer(): void {
    const pointer = {
        schemaVersion: ACTIVE_SEED_POINTER_SCHEMA,
        activeProfilePath: "/data/private/zhi_persona_profile_1.json",
        updatedAt: "2026-03-03T00:00:00.000Z",
    };
    expect(isActiveSeedPointer(pointer)).toBe(true);
}

/**
 * 作用：断言空路径指针会被判定为非法。
 * 意图：阻断“结构存在但无有效路径”的脏指针。
 * 调用时机：pointer 守卫负向用例。
 */
function shouldRejectPointerWhenPathEmpty(): void {
    const pointer = {
        schemaVersion: ACTIVE_SEED_POINTER_SCHEMA,
        activeProfilePath: "   ",
        updatedAt: "2026-03-03T00:00:00.000Z",
    };
    expect(isActiveSeedPointer(pointer)).toBe(false);
}

/**
 * 作用：断言非法更新时间会被判定为非法。
 * 意图：避免不可解析时间戳进入启动判定链路。
 * 调用时机：pointer 守卫负向用例。
 */
function shouldRejectPointerWhenUpdatedAtInvalid(): void {
    const pointer = {
        schemaVersion: ACTIVE_SEED_POINTER_SCHEMA,
        activeProfilePath: "/data/private/zhi_persona_profile_1.json",
        updatedAt: "invalid-date",
    };
    expect(isActiveSeedPointer(pointer)).toBe(false);
}

/**
 * 作用：注册 persona runtime guard 测试集合。
 * 意图：集中验证 profile 与 active seed pointer 的完备性判定。
 * 调用时机：测试文件加载时由 describe 调用。
 */
function runPersonaRuntimeGuardSuite(): void {
    it("应接受完整 profile", shouldAcceptCompleteProfile);
    it("应拒绝缺失 trait 的 profile", shouldRejectProfileWhenTraitMissing);
    it("应拒绝越界 trait 的 profile", shouldRejectProfileWhenTraitOutOfRange);
    it("应拒绝缺失 facet 的 profile", shouldRejectProfileWhenFacetMissing);
    it("应拒绝非法 generatedAt 的 profile", shouldRejectProfileWhenGeneratedAtInvalid);
    it("应拒绝缺失主导立场字段的 profile", shouldRejectProfileWhenCognitiveStancesMissing);
    it("应接受合法 active seed 指针", shouldAcceptValidActiveSeedPointer);
    it("应拒绝空路径 active seed 指针", shouldRejectPointerWhenPathEmpty);
    it("应拒绝非法 updatedAt 的 active seed 指针", shouldRejectPointerWhenUpdatedAtInvalid);
}

describe("personaRuntimePromptBuilder.guard", runPersonaRuntimeGuardSuite);
