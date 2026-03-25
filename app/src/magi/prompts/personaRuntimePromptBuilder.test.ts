import { describe, expect, it } from "vitest";
import { buildRuntimePromptInjections } from "./personaRuntimePromptBuilder";
import type { IpipPersonaProfile } from "../data/questionnaire.types";

const runtimeProfile: IpipPersonaProfile = {
    schemaVersion: "IPIP-NEO-120-v1",
    generatedAt: "2026-03-03",
    subject: {
        id: "zhi",
        name: "织",
        organization: "NERV",
        role: "驾驶员",
        careerGoal: "构建稳定可控的人机协作流程",
        cognitiveStances: {
            profession: "驾驶员",
            primarySocialRelation: "伙伴",
            selfName: "织",
        },
    },
    personaBase: {
        traits: {
            O: 0.74,
            C: 0.61,
            E: 0.39,
            A: 0.66,
            N: 0.41,
        },
        facets: {
            O1_Imagination: 0.82,
            C6_Cautiousness: 0.58,
            E2_Gregariousness: 0.21,
            A3_Altruism: 0.73,
            N1_Anxiety: 0.37,
        },
    },
};

/**
 * 作用：断言运行时人格提示词构建结果完整且可用。
 * 意图：防止接线阶段出现空提示词或字段缺失导致注入失败。
 * 调用时机：runtime prompt builder 测试执行时调用。
 */
async function shouldBuildAllRuntimePromptInjections(): Promise<void> {
    const injections = await buildRuntimePromptInjections(runtimeProfile);
    expect(injections.melchior).toContain("【客观简历】");
    expect(injections.balthazar).toContain("【视角引导】");
    expect(injections.casper).toContain("主体ID: zhi");
    expect(injections.trinity).toContain("完整自我");
}

describe("personaRuntimePromptBuilder", () => {
    it("应基于 profile 生成四贤者运行时注入提示词", shouldBuildAllRuntimePromptInjections);
});
