import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSyncPostRaw } from "../../src/util/network/fetch";
import { ACTIVE_SEED_POINTER_SCHEMA } from "../../src/magi/prompts/personaRuntimePromptBuilder.guard";
import {
    deriveSamplePathFromProfilePath,
    loadActivePersonaSeedPanelData,
} from "../../src/magi/entry/persona-seed-panel/handlers/PersonaSeedPanel.loader";

vi.mock("../../src/util/network/fetch", () => ({
    fetchSyncPostRaw: vi.fn(),
}));

const mockedFetchSyncPostRaw = vi.mocked(fetchSyncPostRaw);

const FACET_DOMAIN_ORDER: readonly string[] = ["N", "E", "O", "A", "C"];
const FACET_NAME_MAP: Readonly<Record<string, readonly string[]>> = {
    N: ["Anxiety", "Anger", "Depression", "SelfConsciousness", "Immoderation", "Vulnerability"],
    E: ["Friendliness", "Gregariousness", "Assertiveness", "ActivityLevel", "ExcitementSeeking", "Cheerfulness"],
    O: ["Imagination", "ArtisticInterests", "Emotionality", "Adventurousness", "Intellect", "Liberalism"],
    A: ["Trust", "Morality", "Altruism", "Cooperation", "Modesty", "Sympathy"],
    C: ["SelfEfficacy", "Orderliness", "Dutifulness", "AchievementStriving", "SelfDiscipline", "Cautiousness"],
};

function buildCompleteFacets(): Record<string, number> {
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

function buildCompleteProfile() {
    return {
        schemaVersion: "IPIP-NEO-120-v1",
        generatedAt: "2026-03-03T00:00:00.000Z",
        subject: {
            id: "supervisor",
            name: "Supervisor",
            gender: "synthetic",
            age: 7,
            organization: "NERV",
            role: "Commander",
            careerGoal: "Maintain order",
        },
        personaBase: {
            traits: {
                O: 0.6,
                C: 0.6,
                E: 0.4,
                A: 0.7,
                N: 0.3,
            },
            facets: buildCompleteFacets(),
        },
    };
}

function buildSamplePayload() {
    return {
        schema_version: "IPIP-NEO-120-v1",
        date: "2026-03-03",
        subject: {
            id: "supervisor",
            name: "Supervisor",
            gender: "synthetic",
            age: 7,
            type: "ai_agent",
            organization: "NERV",
            role: "Commander",
            careerGoal: "Maintain order",
        },
        descriptions: {
            professionalDescription: "以结构化决策维持任务稳定。",
            lifeDescription: "在关系中保持克制与长期信任。",
            instinctNeedsDescription: "需要边界清晰、风险可控。",
            integratedDescription: "以稳定秩序为首要人格目标。",
        },
        answers: [
            { q: 1, score: 5 },
            { q: 2, score: 3 },
        ],
    };
}

beforeEach(() => {
    mockedFetchSyncPostRaw.mockReset();
});

describe("PersonaSeedPanel.loader", () => {
    it("应从 active seed 精确加载当前主管AI配置", async () => {
        mockedFetchSyncPostRaw
            .mockResolvedValueOnce({
                schemaVersion: ACTIVE_SEED_POINTER_SCHEMA,
                activeProfilePath: "/data/private/supervisor_persona_profile_3.json",
                updatedAt: "2026-03-03T00:00:00.000Z",
            })
            .mockResolvedValueOnce(buildCompleteProfile())
            .mockResolvedValueOnce(buildSamplePayload());

        const loaded = await loadActivePersonaSeedPanelData();

        expect(loaded.state).toBe("ready");
        expect(loaded.profilePath).toBe("/data/private/supervisor_persona_profile_3.json");
        expect(loaded.samplePath).toBe("/data/private/supervisor_ipip120_sample_3.json");
        expect(loaded.subjectId).toBe("supervisor");
        expect(loaded.subjectName).toBe("Supervisor");
        expect(loaded.subjectType).toBe("ai_agent");
        expect(loaded.descriptions.professionalDescription).toContain("结构化决策");
        expect(loaded.answers).toEqual([
            { q: 1, score: 5 },
            { q: 2, score: 3 },
        ]);
    });

    it("应在只有 profile 时忠实显示已有字段而不伪造样本数据", async () => {
        mockedFetchSyncPostRaw
            .mockResolvedValueOnce({
                schemaVersion: ACTIVE_SEED_POINTER_SCHEMA,
                activeProfilePath: "/data/private/supervisor_persona_profile_9.json",
                updatedAt: "2026-03-03T00:00:00.000Z",
            })
            .mockResolvedValueOnce({
                schemaVersion: "IPIP-NEO-120-v1",
                generatedAt: "2026-03-03T00:00:00.000Z",
                subject: {
                    id: "supervisor",
                    name: "Supervisor",
                    role: "Commander",
                },
            })
            .mockResolvedValueOnce({
                code: -404,
                msg: "Not Found",
            });

        const loaded = await loadActivePersonaSeedPanelData();

        expect(loaded.state).toBe("partial");
        expect(loaded.subjectId).toBe("supervisor");
        expect(loaded.subjectName).toBe("Supervisor");
        expect(loaded.role).toBe("Commander");
        expect(loaded.descriptions).toEqual({
            professionalDescription: "",
            lifeDescription: "",
            instinctNeedsDescription: "",
            integratedDescription: "",
        });
        expect(loaded.answers).toEqual([]);
        expect(loaded.message).toContain("人格档案结构不完整");
        expect(loaded.message).toContain("问卷样本");
    });

    it("应拒绝非法 active seed 指针而不是回退到默认值", async () => {
        mockedFetchSyncPostRaw.mockResolvedValueOnce({
            schemaVersion: ACTIVE_SEED_POINTER_SCHEMA,
            activeProfilePath: "   ",
            updatedAt: "2026-03-03T00:00:00.000Z",
        });

        const loaded = await loadActivePersonaSeedPanelData();

        expect(loaded.state).toBe("error");
        expect(loaded.subjectId).toBe("");
        expect(loaded.subjectName).toBe("");
        expect(loaded.message).toContain("指针格式非法");
    });

    it("应只接受精确可配对的 profile 文件名", () => {
        expect(deriveSamplePathFromProfilePath("/data/private/zhi_persona_profile_4.json"))
            .toBe("/data/private/zhi_ipip120_sample_4.json");
        expect(deriveSamplePathFromProfilePath("/data/private/zhi_persona_profile_import_xxx.json"))
            .toBe("");
    });
});
