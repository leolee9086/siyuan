import type {
    ExtremeFacetItem,
    FiveLayerPrompt,
    IpipPersonaProfile,
    MagiPerspective,
    SideLabelDescriptor,
    SummaryPromptGenerator,
    SummaryPromptInput,
} from "../data/questionnaire.types";

const EXTREME_HIGH_THRESHOLD = 0.75;
const EXTREME_LOW_THRESHOLD = 0.25;

const perspectiveGuideMap: Readonly<Record<MagiPerspective, string>> = {
    melchior: "从职业能力、逻辑可行性、技术风险的角度展开分析，不输出情绪化判断。",
    balthazar: "从用户情绪、互动协调性、长期关系健康度的角度展开分析，强调关系质量。",
    casper: "从直觉、本能好恶、安全底线的角度展开分析，优先识别风险与边界。",
    trinity: "以统合视角综合三者洞察，给出全域一致的自我理解。",
};

const perspectiveNarrativeLeadMap: Readonly<Record<MagiPerspective, string>> = {
    melchior: "职业和责任侧面",
    balthazar: "关系和情感侧面",
    casper: "偏好和本能侧面",
    trinity: "完整自我",
};

const sideLabelNameMap: Readonly<Record<MagiPerspective, string>> = {
    melchior: "职业和责任侧面",
    balthazar: "关系和情感侧面",
    casper: "偏好和本能侧面",
    trinity: "完整自我",
};

const perspectiveFileSuffixMap: Readonly<Record<MagiPerspective, string>> = {
    melchior: "professional",
    balthazar: "relational",
    casper: "instinctive",
    trinity: "whole",
};

const perspectiveOrder: readonly MagiPerspective[] = ["trinity", "melchior", "balthazar", "casper"];

/**
 * 作用：将 facets 字典转成稳定排序的键值对序列。
 * 意图：保证极值过滤结果顺序可预测，便于测试与一致性比较。
 * 调用时机：在极值过滤逻辑开始迭代前调用。
 * 问题/改进：当前按英文键排序；若未来 key 规范变化，需同步更新比较策略。
 */
const normalizeFacetEntries = (facets: Readonly<Record<string, number>>): ReadonlyArray<[string, number]> =>
    Object.entries(facets).sort(([left], [right]) => left.localeCompare(right, "en-US"));

/**
 * 作用：格式化视角文件描述符单项。
 * 意图：复用文件名后缀映射，避免 map 回调中出现复杂分支。
 * 调用时机：生成侧面标签数组时由 buildSideLabelDescriptors 调用。
 * 问题/改进：后缀命名当前与设计文档绑定，若命名规范变更需统一更新映射常量。
 */
const createSideLabelDescriptor = (subjectId: string, perspective: MagiPerspective): SideLabelDescriptor => ({
    perspective,
    label: sideLabelNameMap[perspective],
    fileName: `${subjectId}_as_${perspectiveFileSuffixMap[perspective]}.md`,
});

/**
 * 极值过滤：仅保留显著高分与低分子维度。
 * @同步豁免: 性能考虑 - 该函数仅做纯内存计算，保持同步可减少大量 Prompt 组装时的调度开销。
 */
export function filterExtremeFacets(
    facets: Readonly<Record<string, number>>,
    highThreshold = EXTREME_HIGH_THRESHOLD,
    lowThreshold = EXTREME_LOW_THRESHOLD,
): readonly ExtremeFacetItem[] {
    const result: ExtremeFacetItem[] = [];

    for (const [key, score] of normalizeFacetEntries(facets)) {
        // 高于上阈值表示该 Facet 在人格上具有显著高强度，应注入 Prompt 作为“尖锐特征”。
        if (score > highThreshold) {
            result.push({ key, score, polarity: "high" });
            continue;
        }

        // 低于下阈值表示该 Facet 在人格上具有显著低强度，同样属于差异化关键信息。
        if (score < lowThreshold) {
            result.push({ key, score, polarity: "low" });
        }
    }

    return result;
}

/**
 * 构建四视角完全共享的“客观简历”层。
 * @同步豁免: 性能考虑 - 仅拼接字符串，不依赖异步 I/O，保持同步可保证比较逻辑的确定性。
 */
export function buildSharedResume(
    profile: IpipPersonaProfile,
    extremeFacets: readonly ExtremeFacetItem[] = filterExtremeFacets(profile.personaBase.facets),
): string {
    const { subject, personaBase, schemaVersion, generatedAt } = profile;

    const traitsLines =
        `- O 开放性: ${personaBase.traits.O.toFixed(3)} (${Math.round(personaBase.traits.O * 100)}%)\n`
        + `- C 尽责性: ${personaBase.traits.C.toFixed(3)} (${Math.round(personaBase.traits.C * 100)}%)\n`
        + `- E 外向性: ${personaBase.traits.E.toFixed(3)} (${Math.round(personaBase.traits.E * 100)}%)\n`
        + `- A 宜人性: ${personaBase.traits.A.toFixed(3)} (${Math.round(personaBase.traits.A * 100)}%)\n`
        + `- N 神经质: ${personaBase.traits.N.toFixed(3)} (${Math.round(personaBase.traits.N * 100)}%)`;

    const extremeFacetLines = extremeFacets.length > 0
        ? extremeFacets
            .map((item) => `- ${item.key}: ${item.score.toFixed(3)} (${item.polarity === "high" ? "极高" : "极低"})`)
            .join("\n")
        : "- 无显著极值子维度";

    return `【客观简历】
schema_version: ${schemaVersion}
生成时间: ${generatedAt}
主体ID: ${subject.id}
姓名: ${subject.name}
年龄: ${subject.age ?? "未知"}
性别: ${subject.gender ?? "未知"}
所属组织: ${subject.organization ?? "未知"}
职责: ${subject.role ?? "未知"}

【大五主维度】
${traitsLines}

【显著极值 Facets】
${extremeFacetLines}`;
}

/**
 * 基于 IPIP 输出生成四视角第一人称自述层。
 * @同步豁免: 性能考虑 - 纯模板字符串拼接，且需与共享简历同步构造，避免额外异步链路。
 */
export function buildPerspectiveNarrative(profile: IpipPersonaProfile, perspective: MagiPerspective): string {
    const lead = perspectiveNarrativeLeadMap[perspective];
    const { subject, personaBase } = profile;

    return `【视角自述：${lead}】
我是${subject.name}，以下是我在“${lead}”上的稳定倾向。
我当前的大五轮廓是：O=${Math.round(personaBase.traits.O * 100)}%，C=${Math.round(personaBase.traits.C * 100)}%，E=${Math.round(personaBase.traits.E * 100)}%，A=${Math.round(personaBase.traits.A * 100)}%，N=${Math.round(personaBase.traits.N * 100)}%。
我会在后续表达中保持该视角的一致性，不与其他视角混用。`;
}

/**
 * 输出侧面标签（文件名规范已迁移）。
 * @同步豁免: 生命周期 - 标签生成用于即时构建导出文件名，要求在同一调用栈内稳定完成。
 */
export function buildSideLabelDescriptors(subjectId: string): readonly SideLabelDescriptor[] {
    const descriptors: SideLabelDescriptor[] = [];

    for (const perspective of perspectiveOrder) {
        descriptors.push(createSideLabelDescriptor(subjectId, perspective));
    }

    return descriptors;
}

/**
 * 组装统一五层 Prompt（四视角仅第2/3层变化）。
 * @同步豁免: 性能考虑 - 聚合流程需要高频调用且无异步依赖，保持同步实现更高效。
 */
export function buildFiveLayerPrompt(
    profile: IpipPersonaProfile,
    perspective: MagiPerspective,
    currentInput: string,
    telemetry: string,
): FiveLayerPrompt {
    const sharedResume = buildSharedResume(profile);

    return {
        sharedResume,
        perspectiveNarrative: buildPerspectiveNarrative(profile, perspective),
        perspectiveGuide: `【视角引导】${perspectiveGuideMap[perspective]}`,
        telemetry: `【遥测注入】${telemetry}`,
        currentInput: `【当前输入】${currentInput}`,
    };
}

/**
 * 将五层结构序列化为最终 Prompt 文本。
 * @同步豁免: 性能考虑 - 纯字符串合并，保持同步可避免额外 Promise 包装开销。
 */
export function serializeFiveLayerPrompt(prompt: FiveLayerPrompt): string {
    return `${prompt.sharedResume}

${prompt.perspectiveNarrative}

${prompt.perspectiveGuide}
${prompt.telemetry}
${prompt.currentInput}`;
}

/**
 * 作用：为指定视角创建总结 Prompt 生成器。
 * 意图：将四视角生成逻辑收敛到同一工厂，减少重复实现并确保层级一致。
 * 调用时机：模块初始化时创建 summaryPrompts 的四个视角函数。
 * 问题/改进：当前 telemetry/currentInput 为字符串，后续可升级为结构化上下文字段。
 */
const createPerspectiveSummaryPromptGenerator = (
    perspective: MagiPerspective,
): SummaryPromptGenerator<SummaryPromptInput> => async (input) => {
    const layeredPrompt = buildFiveLayerPrompt(
        input.profile,
        perspective,
        input.currentInput,
        input.telemetry,
    );
    return serializeFiveLayerPrompt(layeredPrompt);
};

export const summaryPrompts = {
    trinity: createPerspectiveSummaryPromptGenerator("trinity"),
    melchior: createPerspectiveSummaryPromptGenerator("melchior"),
    balthazar: createPerspectiveSummaryPromptGenerator("balthazar"),
    casper: createPerspectiveSummaryPromptGenerator("casper"),
} as const;

/**
 * 一致性校验：四个视角的共享简历必须逐字相同。
 * @同步豁免: 类型守卫 - 该校验属于纯比较逻辑，需同步返回以便测试与断言直接使用。
 */
export function validateSharedResumeConsistency(profile: IpipPersonaProfile): {
    readonly isConsistent: boolean;
    readonly baseline: string;
    readonly mismatchPerspectives: readonly MagiPerspective[];
} {
    const baseline = buildFiveLayerPrompt(profile, "trinity", "", "").sharedResume;
    const mismatchPerspectives = perspectiveOrder.filter((perspective) => {
        const sharedResume = buildFiveLayerPrompt(profile, perspective, "", "").sharedResume;
        return sharedResume !== baseline;
    });

    return {
        isConsistent: mismatchPerspectives.length === 0,
        baseline,
        mismatchPerspectives,
    };
}
