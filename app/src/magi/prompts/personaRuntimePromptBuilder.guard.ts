/** 用途：IpipPersonaProfile 人格档案类型。使用范围：人格运行时提示词构建器。解耦评估：类型导入，不涉及运行时耦合。 */
import type { IpipPersonaProfile } from "../data/questionnaire.types";

/** 导出 ACTIVE_SEED_POINTER_SCHEMA：活跃种子指针的 schema 标识常量。 */
export const ACTIVE_SEED_POINTER_SCHEMA = "MAGI-ACTIVE-PERSONA-SEED-v1";
const PROFILE_SCHEMA_VERSION = "IPIP-NEO-120-v1";
const REQUIRED_TRAIT_KEYS: readonly (keyof IpipPersonaProfile["personaBase"]["traits"])[] = ["O", "C", "E", "A", "N"];
const FACET_DOMAIN_ORDER: readonly string[] = ["N", "E", "O", "A", "C"];
const FACET_NAME_MAP: Readonly<Record<string, readonly string[]>> = {
    N: ["Anxiety", "Anger", "Depression", "SelfConsciousness", "Immoderation", "Vulnerability"],
    E: ["Friendliness", "Gregariousness", "Assertiveness", "ActivityLevel", "ExcitementSeeking", "Cheerfulness"],
    O: ["Imagination", "ArtisticInterests", "Emotionality", "Adventurousness", "Intellect", "Liberalism"],
    A: ["Trust", "Morality", "Altruism", "Cooperation", "Modesty", "Sympathy"],
    C: ["SelfEfficacy", "Orderliness", "Dutifulness", "AchievementStriving", "SelfDiscipline", "Cautiousness"],
};

/** @同步豁免: 纯对象形态判断，无异步依赖 */
/**
 * 作用：判断值是否为可索引的普通对象。
 * 意图：复用在 profile/pointer 各字段解析前的安全检查。
 * 调用时机：所有守卫函数的第一步。
 */
function isRecordObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object") {
        return false;
    }
    return !Array.isArray(value);
}

/** @同步豁免: 纯字符串校验，无异步依赖 */
/**
 * 作用：判断值是否为非空白字符串。
 * 意图：避免空字符串被误判为可用字段。
 * 调用时机：subject/pointer 等文本字段校验时调用。
 */
function isNonEmptyText(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    return value.trim().length > 0;
}

/** @同步豁免: 纯日期可解析校验，无异步依赖 */
/**
 * 作用：判断字符串是否可被 `Date.parse` 解析。
 * 意图：保证 `generatedAt/updatedAt` 字段具备最小时间语义。
 * 调用时机：profile 与 pointer 时间字段校验时调用。
 */
function isParsableDateText(value: unknown): value is string {
    if (!isNonEmptyText(value)) {
        return false;
    }
    return Number.isFinite(Date.parse(value));
}

/** @同步豁免: 纯数值边界校验，无异步依赖 */
/**
 * 作用：判断是否为 0~1 区间的有限数值。
 * 意图：确保 traits/facets 均符合 IPIP 归一化分值约束。
 * 调用时机：人格分值字段校验时调用。
 */
function isNormalizedScore(value: unknown): value is number {
    if (typeof value !== "number") {
        return false;
    }
    if (!Number.isFinite(value)) {
        return false;
    }
    if (value < 0) {
        return false;
    }
    return value <= 1;
}

/** @同步豁免: 纯循环构造常量，无异步依赖 */
/**
 * 作用：构建 30 个标准 Facet 键名列表。
 * 意图：统一“完备 facets”判定基线，避免散落硬编码。
 * 调用时机：模块初始化时执行一次。
 */
function buildRequiredFacetKeys(): readonly string[] {
    const keys: string[] = [];
    for (const domain of FACET_DOMAIN_ORDER) {
        const facetNames = FACET_NAME_MAP[domain];
        let facetNumber = 1;
        for (const facetName of facetNames) {
            keys.push(`${domain}${facetNumber}_${facetName}`);
            facetNumber += 1;
        }
    }
    return keys;
}

const REQUIRED_FACET_KEYS = buildRequiredFacetKeys();

/** @同步豁免: 纯结构遍历校验，无异步依赖 */
/**
 * 作用：校验 traits 是否包含 OCEAN 五维且分值合法。
 * 意图：落实“5 traits 完备 + 0~1 边界”判定。
 * 调用时机：`isIpipPersonaProfile` 过程中调用。
 */
function hasCompleteTraitScores(value: unknown): value is IpipPersonaProfile["personaBase"]["traits"] {
    if (!isRecordObject(value)) {
        return false;
    }
    for (const traitKey of REQUIRED_TRAIT_KEYS) {
        if (!isNormalizedScore(value[traitKey])) {
            return false;
        }
    }
    return true;
}

/** @同步豁免: 纯结构遍历校验，无异步依赖 */
/**
 * 作用：校验 facets 是否覆盖 30 个标准键且分值合法。
 * 意图：落实“30 facets 完备 + 0~1 边界”判定。
 * 调用时机：`isIpipPersonaProfile` 过程中调用。
 */
function hasCompleteFacetScores(value: unknown): value is IpipPersonaProfile["personaBase"]["facets"] {
    if (!isRecordObject(value)) {
        return false;
    }
    if (Object.keys(value).length < REQUIRED_FACET_KEYS.length) {
        return false;
    }
    for (const facetKey of REQUIRED_FACET_KEYS) {
        if (!isNormalizedScore(value[facetKey])) {
            return false;
        }
    }
    return true;
}

/** @同步豁免: 纯结构校验，无异步依赖 */
/**
 * 作用：校验 subject 的核心身份字段。
 * 意图：确保 profile 至少包含可识别主体 ID 与名称。
 * 调用时机：`isIpipPersonaProfile` 过程中调用。
 */
function hasCompleteSubject(value: unknown): value is IpipPersonaProfile["subject"] {
    if (!isRecordObject(value)) {
        return false;
    }
    if (!isNonEmptyText(value.id)) {
        return false;
    }
    if (!isNonEmptyText(value.name)) {
        return false;
    }
    return hasCompleteSubjectCognitiveStances(value.cognitiveStances);
}

/** @同步豁免: 纯结构校验，无异步依赖 */
function hasCompleteSubjectCognitiveStances(value: unknown): boolean {
    if (!isRecordObject(value)) {
        return false;
    }
    if (!isNonEmptyText(value.profession)) {
        return false;
    }
    if (!isNonEmptyText(value.primarySocialRelation)) {
        return false;
    }
    return isNonEmptyText(value.selfName);
}

/** @同步豁免: 纯结构校验，无异步依赖 */
/**
 * 作用：校验 personaBase 对象的完整性。
 * 意图：统一 traits/facets 的入口判定，减少主守卫复杂度。
 * 调用时机：`isIpipPersonaProfile` 过程中调用。
 */
function hasCompletePersonaBase(value: unknown): value is IpipPersonaProfile["personaBase"] {
    if (!isRecordObject(value)) {
        return false;
    }
    if (!hasCompleteTraitScores(value.traits)) {
        return false;
    }
    return hasCompleteFacetScores(value.facets);
}

/**
 * 工作空间级 active seed 指针结构。
 *
 * 用途：标识当前工作空间“唯一生效人格档案”路径及更新时间。
 * 使用场景：启动阶段读取 active seed 文件并决定是否注入运行时人格提示词。
 * 关联类型：由 `resolveActiveSeedProfilePath` 消费；`loadPromptInjectionsByProfilePath` 使用其路径字段。
 * 问题/改进：当前仅保存路径级指针，后续可扩展 profile hash 与完整性快照。
 */
export interface ActiveSeedPointer {
    readonly schemaVersion: string;
    readonly activeProfilePath: string;
    readonly updatedAt: string;
}

/** @同步豁免: 类型守卫 - 需要同步返回布尔结果以驱动上层分支判断 */
/**
 * 作用：判断是否为内核错误响应结构。
 * 意图：识别 `/api/file/getFile` 的错误载荷并提前降级。
 * 调用时机：解析 profile 文件原始响应时调用。
 */
export function isKernelErrorResponse(payload: unknown): payload is { code: number } {
    if (!isRecordObject(payload)) {
        return false;
    }
    return typeof payload.code === "number";
}

/** @同步豁免: 类型守卫 - 需要同步返回布尔结果以驱动上层分支判断 */
/**
 * 作用：校验对象是否满足“可运行”的 `IpipPersonaProfile` 完备结构。
 * 意图：防止非法文件内容进入提示词生成链路。
 * 调用时机：读取 profile 文件后调用。
 */
export function isIpipPersonaProfile(value: unknown): value is IpipPersonaProfile {
    if (!isRecordObject(value)) {
        return false;
    }
    if (value.schemaVersion !== PROFILE_SCHEMA_VERSION) {
        return false;
    }
    if (!hasCompleteSubject(value.subject)) {
        return false;
    }
    if (!hasCompletePersonaBase(value.personaBase)) {
        return false;
    }
    return isParsableDateText(value.generatedAt);
}

/** @同步豁免: 类型守卫 - 启动阶段需同步判定 active seed 指针结构合法性 */
/**
 * 作用：校验对象是否满足可用 ActiveSeedPointer 结构。
 * 意图：防止非法 active seed 文件内容进入启动注入链路。
 * 调用时机：读取工作空间 active seed 指针后调用。
 */
export function isActiveSeedPointer(value: unknown): value is ActiveSeedPointer {
    if (!isRecordObject(value)) {
        return false;
    }
    if (value.schemaVersion !== ACTIVE_SEED_POINTER_SCHEMA) {
        return false;
    }
    if (!isNonEmptyText(value.activeProfilePath)) {
        return false;
    }
    return isParsableDateText(value.updatedAt);
}
