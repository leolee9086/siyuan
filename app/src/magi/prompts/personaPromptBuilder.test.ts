import { describe, expect, it } from "vitest";
import {
    buildFiveLayerPrompt,
    buildSideLabelDescriptors,
    filterExtremeFacets,
    serializeFiveLayerPrompt,
    validateSharedResumeConsistency,
} from "./personaPromptBuilder";
import type { ExtremeFacetItem, IpipPersonaProfile, MagiPerspective, SideLabelDescriptor } from "../data/questionnaire.types";

const baseProfile: IpipPersonaProfile = {
    schemaVersion: "IPIP-NEO-120-v1",
    generatedAt: "2026-03-02",
    subject: {
        id: "zhi",
        name: "织",
        age: 15,
        gender: "女",
        organization: "NERV",
        role: "驾驶员",
    },
    personaBase: {
        traits: {
            O: 0.82,
            C: 0.63,
            E: 0.47,
            A: 0.71,
            N: 0.29,
        },
        facets: {
            N1_Anxiety: 0.21,
            N2_Anger: 0.44,
            O1_Imagination: 0.91,
            C6_Cautiousness: 0.52,
            A3_Altruism: 0.79,
            E2_Gregariousness: 0.18,
        },
    },
};

const perspectives: readonly MagiPerspective[] = ["trinity", "melchior", "balthazar", "casper"];

const expectedExtremeFacets: readonly ExtremeFacetItem[] = [
    { key: "A3_Altruism", score: 0.79, polarity: "high" },
    { key: "E2_Gregariousness", score: 0.18, polarity: "low" },
    { key: "N1_Anxiety", score: 0.21, polarity: "low" },
    { key: "O1_Imagination", score: 0.91, polarity: "high" },
];

const expectedSideLabels: readonly SideLabelDescriptor[] = [
    { perspective: "trinity", label: "完整自我", fileName: "zhi_as_whole.md" },
    { perspective: "melchior", label: "职业和责任侧面", fileName: "zhi_as_professional.md" },
    { perspective: "balthazar", label: "关系和情感侧面", fileName: "zhi_as_relational.md" },
    { perspective: "casper", label: "偏好和本能侧面", fileName: "zhi_as_instinctive.md" },
];

/**
 * 作用：验证极值过滤仅输出高于/低于阈值的 facet。
 * 意图：确保 Phase 3 的极值过滤策略严格按设计文档执行。
 * 调用时机：在 personaPromptBuilder 测试套件的首个用例中执行。
 * 问题/改进：后续可补充边界值（等于 0.75 / 0.25）场景。
 */
function shouldFilterExtremeFacetsByThreshold(): void {
    const result = filterExtremeFacets(baseProfile.personaBase.facets);
    expect(result).toEqual(expectedExtremeFacets);
}

/**
 * 作用：验证四视角共享简历层逐字一致。
 * 意图：保证统一五层 Prompt 的第 1 层不存在视角污染。
 * 调用时机：一致性测试用例执行时调用。
 * 问题/改进：后续可增加随机化 profile 样本批量验证。
 */
function shouldKeepSharedResumeIdenticalAcrossPerspectives(): void {
    const consistency = validateSharedResumeConsistency(baseProfile);
    expect(consistency.isConsistent).toBe(true);
    expect(consistency.mismatchPerspectives).toHaveLength(0);

    const baseline = buildFiveLayerPrompt(baseProfile, "trinity", "用户输入", "ρ=0.92").sharedResume;
    for (const perspective of perspectives) {
        const sharedResume = buildFiveLayerPrompt(baseProfile, perspective, "用户输入", "ρ=0.92").sharedResume;
        expect(sharedResume).toBe(baseline);
    }
}

/**
 * 作用：验证四视角 Prompt 仅在视角层（第2/3层）发生差异。
 * 意图：防止遥测层、输入层与共享简历层被误改。
 * 调用时机：序列化输出对比测试中执行。
 * 问题/改进：可进一步增加对每层文本 hash 的断言。
 */
function shouldOnlyDifferOnPerspectiveLayers(): void {
    const trinityPrompt = buildFiveLayerPrompt(baseProfile, "trinity", "请给出建议", "ρ=0.91");
    const melchiorPrompt = buildFiveLayerPrompt(baseProfile, "melchior", "请给出建议", "ρ=0.91");

    expect(trinityPrompt.sharedResume).toBe(melchiorPrompt.sharedResume);
    expect(trinityPrompt.telemetry).toBe(melchiorPrompt.telemetry);
    expect(trinityPrompt.currentInput).toBe(melchiorPrompt.currentInput);
    expect(trinityPrompt.perspectiveNarrative).not.toBe(melchiorPrompt.perspectiveNarrative);
    expect(trinityPrompt.perspectiveGuide).not.toBe(melchiorPrompt.perspectiveGuide);

    const trinitySerialized = serializeFiveLayerPrompt(trinityPrompt);
    const melchiorSerialized = serializeFiveLayerPrompt(melchiorPrompt);
    expect(trinitySerialized).not.toBe(melchiorSerialized);
}

/**
 * 作用：验证侧面标签输出文件名已切换到新规范。
 * 意图：落实 Phase 3 的侧面标签迁移要求。
 * 调用时机：侧面标签测试用例中执行。
 * 问题/改进：可补充不同 subjectId 字符格式的兼容测试。
 */
function shouldOutputNewSideLabelFileNamingConvention(): void {
    const labels = buildSideLabelDescriptors(baseProfile.subject.id);
    expect(labels).toEqual(expectedSideLabels);
}

/**
 * 作用：注册 personaPromptBuilder 的全部用例。
 * 意图：通过命名函数替代超长内联回调，满足 lint 约束并提升可读性。
 * 调用时机：传入 describe 时立即调用。
 * 问题/改进：若后续用例增加，可拆分为按能力分组的子 suite。
 */
function runPersonaPromptBuilderSuite(): void {
    it("应按阈值提取极值 facets", shouldFilterExtremeFacetsByThreshold);
    it("四视角共享简历必须完全一致", shouldKeepSharedResumeIdenticalAcrossPerspectives);
    it("各视角仅在视角层与引导层存在差异", shouldOnlyDifferOnPerspectiveLayers);
    it("应输出新侧面标签文件名规范", shouldOutputNewSideLabelFileNamingConvention);
}

describe("personaPromptBuilder", runPersonaPromptBuilderSuite);
