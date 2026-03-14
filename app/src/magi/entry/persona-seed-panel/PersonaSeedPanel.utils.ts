import { fetchSyncPost } from "../../../util/network/fetch";
import { ipipNeo120QuestionBank } from "../../data/ipip-neo-120";
import { buildIpipPersonaProfileFromRawAnswers } from "../../data/ipip-neo-120-scoring";
import type {
    IpipNeo120RawAnswer,
    IpipNeo120SubmissionPayload,
    IpipPersonaProfile,
    IpipSubjectProfile,
    IpipPersonaSeedDescriptions,
} from "../../data/questionnaire.types";
import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { PersonaConvergenceSuggestion } from "../../data/convergence/persona-seed-convergence.types";
import { persistActiveSeedProfilePath } from "../../prompts/personaRuntimePromptBuilder";
import { isIpipPersonaProfile } from "../../prompts/personaRuntimePromptBuilder.guard";

const DESCRIPTION_FIELD_LABELS: Readonly<Record<keyof IpipPersonaSeedDescriptions, string>> = {
    professionalDescription: "职业描述",
    lifeDescription: "生活描述",
    instinctNeedsDescription: "本能需求描述",
    integratedDescription: "综合描述",
};
const IPIP_SCHEMA_VERSION = "IPIP-NEO-120-v1";

/** @同步豁免: UI构建 — Vue computed 同步求值路径使用的纯字符串拼接 */
/**
 * 作用：生成 localStorage 草稿存储 key。
 * 意图：统一草稿 key 格式，避免多处硬编码。
 * 调用时机：saveDraft / loadDraft 时调用。
 */
export const getDraftKey = (id: string): string => `magi_questionnaire_draft_${id || "zhi"}`;

/** @同步豁免: UI构建 — Vue computed 同步求值路径中的数组查找 */
/**
 * 作用：在已有答案中查找指定题号的分值。
 * 意图：供建议预览和冲突检测使用。
 * 调用时机：viewSuggestion / viewingSuggestionSummary computed 求值时调用。
 */
export const findAnswerScore = (
    answersArray: ReadonlyArray<{ q: number; score: LikertScore }>,
    q: number,
): LikertScore | null => {
    for (const answer of answersArray) {
        // 题号匹配时返回对应分值
        if (answer.q === q) {
            return answer.score;
        }
    }
    return null;
};

/** @同步豁免: UI构建 — Vue computed 和事件处理器同步路径中的数组查找 */
/**
 * 作用：在建议列表中按 id 查找单条建议。
 * 意图：供接受/拒绝/查看建议时定位目标。
 * 调用时机：acceptSuggestion / rejectSuggestion / viewSuggestion 时调用。
 */
export const getSuggestionById = (
    suggestions: readonly PersonaConvergenceSuggestion[],
    id: string,
): PersonaConvergenceSuggestion | null => {
    for (const suggestion of suggestions) {
        // id 匹配时返回该建议
        if (suggestion.id === id) {
            return suggestion;
        }
    }
    return null;
};

/** @同步豁免: UI构建 — 字段标签映射为同步查表 */
/**
 * 作用：把描述字段 key 转换为可读标签。
 * 意图：供状态提示和建议预览统一展示文案。
 * 调用时机：查看/应用描述建议时调用。
 */
export const getDescriptionFieldLabel = (field: keyof IpipPersonaSeedDescriptions): string => (
    DESCRIPTION_FIELD_LABELS[field]
);

/** @同步豁免: UI构建 — 生成建议前的同步前置校验 */
/**
 * 作用：检查四轨描述是否至少有一项非空。
 * 意图：生成问卷建议前的前置校验。
 * 调用时机：generateDescriptionToQuestionnaire 前调用。
 */
export const hasAnyDescriptionText = (descriptions: IpipPersonaSeedDescriptions): boolean => {
    // 职业描述非空即满足
    if (descriptions.professionalDescription.trim()) {
        return true;
    }
    // 生活描述非空即满足
    if (descriptions.lifeDescription.trim()) {
        return true;
    }
    // 本能需求描述非空即满足
    if (descriptions.instinctNeedsDescription.trim()) {
        return true;
    }
    // 整合自我描述非空即满足
    return Boolean(descriptions.integratedDescription.trim());
};

/** @同步豁免: UI构建 — 提示态计算为同步文本校验 */
/**
 * 作用：检查三侧描述是否都已填写。
 * 意图：约束 Trinity 建议生成前置条件之一。
 * 调用时机：问卷->Trinity 建议按钮可用性判断时调用。
 */
export const hasAllSideDescriptions = (descriptions: IpipPersonaSeedDescriptions): boolean => {
    if (!descriptions.professionalDescription.trim()) {
        return false;
    }
    if (!descriptions.lifeDescription.trim()) {
        return false;
    }
    return Boolean(descriptions.instinctNeedsDescription.trim());
};

/** @同步豁免: UI构建 — 进度阈值判断为纯数值比较 */
/**
 * 作用：判断问卷进度是否超过三分之一。
 * 意图：限制 Trinity 建议只在有效问卷覆盖度下触发。
 * 调用时机：Trinity 建议门槛校验时调用。
 */
export const isQuestionnaireProgressAboveOneThird = (
    answerCount: number,
    totalQuestionCount: number,
): boolean => {
    if (totalQuestionCount <= 0) {
        return false;
    }
    return answerCount > totalQuestionCount / 3;
};

/** @同步豁免: UI构建 — 门槛组合判断为同步布尔运算 */
/**
 * 作用：判断是否允许生成 Trinity（综合描述）建议。
 * 意图：统一复用“子侧全填 + 问卷超过三分之一”门槛。
 * 调用时机：按钮可用性和生成前置校验时调用。
 */
export const canGenerateTrinityDescriptionSuggestion = (
    descriptions: IpipPersonaSeedDescriptions,
    answerCount: number,
    totalQuestionCount: number,
): boolean => (
    hasAllSideDescriptions(descriptions)
    && isQuestionnaireProgressAboveOneThird(answerCount, totalQuestionCount)
);

/** @同步豁免: UI构建 — 提交前同步校验必填字段完整性 */
/**
 * 作用：收集提交前未填写的必填字段名称列表。
 * 意图：提交问卷前校验完整性，给出缺失字段提示。
 * 调用时机：onSubmitIpip 提交前调用。
 */
export const collectMissingFields = (
    gender: string,
    organization: string,
    role: string,
    careerGoal: string,
    descriptions: IpipPersonaSeedDescriptions,
): string[] => {
    const missing: string[] = [];
    // 性别字段为空时加入缺失列表
    if (!gender.trim()) {
        missing.push("Gender");
    }
    // 组织字段为空时加入缺失列表
    if (!organization.trim()) {
        missing.push("Organization");
    }
    // 角色字段为空时加入缺失列表
    if (!role.trim()) {
        missing.push("Role");
    }
    // 职业目标字段为空时加入缺失列表
    if (!careerGoal.trim()) {
        missing.push("Career Goal");
    }
    // 职业描述为空时加入缺失列表
    if (!descriptions.professionalDescription.trim()) {
        missing.push("Professional Description");
    }
    // 生活描述为空时加入缺失列表
    if (!descriptions.lifeDescription.trim()) {
        missing.push("Life Description");
    }
    // 本能需求描述为空时加入缺失列表
    if (!descriptions.instinctNeedsDescription.trim()) {
        missing.push("Instinct Needs Description");
    }
    // 整合自我描述为空时加入缺失列表
    if (!descriptions.integratedDescription.trim()) {
        missing.push("Integrated Self Description");
    }
    return missing;
};

/** @同步豁免: 性能考虑 — 纯对象字段映射，无 I/O 开销 */
/**
 * 作用：从提交载荷中提取被试档案信息。
 * 意图：将提交载荷转换为人格档案所需的被试结构。
 * 调用时机：saveSubmissionPayload 构建档案时调用。
 */
export const toProfileSubject = (payload: IpipNeo120SubmissionPayload): IpipSubjectProfile => ({
    id: payload.subject.id,
    name: payload.subject.name,
    age: payload.subject.age,
    gender: payload.subject.gender?.trim() || undefined,
    organization: payload.subject.organization,
    role: payload.subject.role,
    careerGoal: payload.subject.careerGoal,
});

/**
 * 作用：确保 /data/private 目录存在。
 * 意图：问卷保存前的目录初始化，避免写入失败。
 * 调用时机：saveSubmissionPayload 保存前调用。
 */
export const ensurePrivateDir = async (): Promise<void> => {
    const formData = new FormData();
    formData.append("path", "/data/private");
    formData.append("isDir", "true");
    formData.append("modTime", Date.now().toString());
    formData.append("file", "");
    await fetchSyncPost("/api/file/putFile", formData);
};

/**
 * 作用：扫描已有样本文件，返回下一个可用的样本序号。
 * 意图：保证样本文件名递增不冲突。
 * 调用时机：saveSubmissionPayload 确定文件名时调用。
 */
export const resolveNextSampleIndex = async (id: string): Promise<number> => {
    const response = await fetchSyncPost("/api/file/readDir", { path: "/data/private" });
    const files = Array.isArray(response.data) ? response.data : [];
    const pattern = new RegExp(`^${id}_ipip120_sample_(\\d+)\\.json$`);
    let maxIndex = 0;
    for (const file of files) {
        // 跳过无效条目
        if (!file || typeof file.name !== "string") {
            continue;
        }
        const matched = file.name.match(pattern);
        // 跳过不匹配的文件名
        if (!matched || !matched[1]) {
            continue;
        }
        const currentIndex = Number.parseInt(matched[1], 10);
        // 仅当解析出有效数字且大于当前最大值时更新
        if (Number.isFinite(currentIndex) && currentIndex > maxIndex) {
            maxIndex = currentIndex;
        }
    }
    return maxIndex + 1;
};

/**
 * 作用：将 JSON 数据写入思源笔记文件系统。
 * 意图：统一文件写入逻辑，避免重复构造 FormData。
 * 调用时机：保存问卷样本和人格档案时调用。
 */
export const writeJsonFile = async (filePath: string, payload: unknown): Promise<void> => {
    const fileName = filePath.split("/").pop() || "payload.json";
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const file = new File([blob], fileName, { lastModified: Date.now() });
    const formData = new FormData();
    formData.append("path", filePath);
    formData.append("isDir", "false");
    formData.append("modTime", Date.now().toString());
    formData.append("file", file);
    await fetchSyncPost("/api/file/putFile", formData);
};

/**
 * 作用：保存问卷提交载荷和生成的人格档案到文件系统。
 * 意图：将原始答案和计算后的人格档案分别持久化。
 * 调用时机：用户点击提交问卷按钮时调用。
 */
export const saveSubmissionPayload = async (
    payload: IpipNeo120SubmissionPayload,
): Promise<{ samplePath: string; profilePath: string }> => {
    await ensurePrivateDir();
    const safeId = payload.subject.id || "zhi";
    const nextIndex = await resolveNextSampleIndex(safeId);
    const samplePath = `/data/private/${safeId}_ipip120_sample_${nextIndex}.json`;
    const profilePath = `/data/private/${safeId}_persona_profile_${nextIndex}.json`;
    const profile = buildIpipPersonaProfileFromRawAnswers({
        subject: toProfileSubject(payload),
        answers: payload.answers,
        items: ipipNeo120QuestionBank,
    });
    await writeJsonFile(samplePath, payload);
    await writeJsonFile(profilePath, profile);
    await persistActiveSeedProfilePath(profilePath);
    return { samplePath, profilePath };
};

/** @同步豁免: 纯字符串处理，无异步依赖 */
function sanitizeSubjectId(raw: string): string {
    const normalized = raw.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
    const compacted = normalized.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    return compacted || "zhi";
}

/** @同步豁免: 纯文件名处理，无异步依赖 */
function resolveImportFileSuffix(fileName: string): string {
    const dotIndex = fileName.lastIndexOf(".");
    const stem = dotIndex >= 0 ? fileName.substring(0, dotIndex) : fileName;
    const normalized = stem.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
    const compacted = normalized.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    return compacted || "import";
}

/** @同步豁免: 纯字符串 JSON 解析，无异步依赖 */
function parseJsonText(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        throw new Error("导入失败：文件不是有效的 JSON。");
    }
}

/** @同步豁免: 纯对象结构判断，无异步依赖 */
function isRecordObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object") {
        return false;
    }
    return !Array.isArray(value);
}

/** @同步豁免: 纯字符串判断，无异步依赖 */
function isStringValue(value: unknown): value is string {
    return typeof value === "string";
}

/** @同步豁免: 纯分值边界判断，无异步依赖 */
function isLikertScore(value: unknown): value is IpipNeo120RawAnswer["score"] {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        return false;
    }
    if (value < 1) {
        return false;
    }
    return value <= 5;
}

/** @同步豁免: 纯结构校验，无异步依赖 */
function hasSubmissionSubject(value: unknown): value is IpipNeo120SubmissionPayload["subject"] {
    if (!isRecordObject(value)) {
        return false;
    }
    if (!isStringValue(value.id)) {
        return false;
    }
    if (!isStringValue(value.name)) {
        return false;
    }
    if (value.type !== "human" && value.type !== "ai_agent") {
        return false;
    }
    if (!isStringValue(value.organization)) {
        return false;
    }
    if (!isStringValue(value.role)) {
        return false;
    }
    if (!isStringValue(value.careerGoal)) {
        return false;
    }
    if (value.gender !== undefined && !isStringValue(value.gender)) {
        return false;
    }
    if (value.age !== undefined) {
        if (typeof value.age !== "number" || !Number.isFinite(value.age) || !Number.isInteger(value.age)) {
            return false;
        }
    }
    return true;
}

/** @同步豁免: 纯结构校验，无异步依赖 */
function hasSubmissionDescriptions(value: unknown): value is IpipPersonaSeedDescriptions {
    if (!isRecordObject(value)) {
        return false;
    }
    if (!isStringValue(value.professionalDescription)) {
        return false;
    }
    if (!isStringValue(value.lifeDescription)) {
        return false;
    }
    if (!isStringValue(value.instinctNeedsDescription)) {
        return false;
    }
    return isStringValue(value.integratedDescription);
}

/** @同步豁免: 纯数组结构校验，无异步依赖 */
function hasSubmissionAnswers(value: unknown): value is readonly IpipNeo120RawAnswer[] {
    if (!Array.isArray(value)) {
        return false;
    }
    for (const answer of value) {
        if (!isRecordObject(answer)) {
            return false;
        }
        if (typeof answer.q !== "number" || !Number.isInteger(answer.q)) {
            return false;
        }
        if (!isStringValue(answer.text)) {
            return false;
        }
        if (!isLikertScore(answer.score)) {
            return false;
        }
    }
    return true;
}

/** @同步豁免: 类型守卫需同步返回结果，无异步依赖 */
function isIpipNeo120SubmissionArchive(value: unknown): value is IpipNeo120SubmissionPayload {
    if (!isRecordObject(value)) {
        return false;
    }
    if (value.schema_version !== IPIP_SCHEMA_VERSION) {
        return false;
    }
    if (!hasSubmissionSubject(value.subject)) {
        return false;
    }
    if (!isStringValue(value.date)) {
        return false;
    }
    if (!hasSubmissionDescriptions(value.descriptions)) {
        return false;
    }
    return hasSubmissionAnswers(value.answers);
}

export interface ImportedPersonaProfileResult {
    readonly source: "profile" | "submission";
    readonly samplePath: string;
    readonly profilePath: string;
    readonly subjectId: string;
    readonly subjectName: string;
    readonly gender: string;
    readonly age: number;
    readonly organization: string;
    readonly role: string;
    readonly careerGoal: string;
    readonly descriptions: IpipPersonaSeedDescriptions | null;
    readonly answers: ReadonlyArray<{ q: number; score: LikertScore }> | null;
}

/** @同步豁免: 纯路径拼接，无异步依赖 */
function resolveImportedPaths(
    subjectId: string,
    fileName: string,
): { samplePath: string; profilePath: string } {
    const importSuffix = resolveImportFileSuffix(fileName);
    const timestamp = Date.now();
    return {
        samplePath: `/data/private/${subjectId}_ipip120_sample_import_${importSuffix}_${timestamp}.json`,
        profilePath: `/data/private/${subjectId}_persona_profile_import_${importSuffix}_${timestamp}.json`,
    };
}

/**
 * 作用：导入人格档案文件并写入工作空间私有目录。
 * 意图：兼容外部 profile JSON，直接切换 active seed。
 * 调用时机：importPersonaProfileArchive 识别为 profile 文件后调用。
 */
async function importPersonaProfileFile(
    file: File,
    profile: IpipPersonaProfile,
): Promise<ImportedPersonaProfileResult> {
    const subjectId = sanitizeSubjectId(profile.subject.id);
    const { profilePath } = resolveImportedPaths(subjectId, file.name);
    await ensurePrivateDir();
    await writeJsonFile(profilePath, profile);
    await persistActiveSeedProfilePath(profilePath);
    return {
        source: "profile",
        samplePath: profilePath,
        profilePath,
        subjectId,
        subjectName: profile.subject.name.trim(),
        gender: (profile.subject.gender || "").trim(),
        age: Number.isInteger(profile.subject.age) ? profile.subject.age : 0,
        organization: (profile.subject.organization || "").trim(),
        role: (profile.subject.role || "").trim(),
        careerGoal: (profile.subject.careerGoal || "").trim(),
        descriptions: null,
        answers: null,
    };
}

/**
 * 作用：导入问卷样本文件并生成人格档案后写入工作空间私有目录。
 * 意图：支持直接导入 `*_ipip120_sample_*.json` 历史样本。
 * 调用时机：importPersonaProfileArchive 识别为 submission 文件后调用。
 */
async function importSubmissionArchiveFile(
    file: File,
    submission: IpipNeo120SubmissionPayload,
): Promise<ImportedPersonaProfileResult> {
    const subjectId = sanitizeSubjectId(submission.subject.id);
    const paths = resolveImportedPaths(subjectId, file.name);
    let profile: IpipPersonaProfile;
    try {
        profile = buildIpipPersonaProfileFromRawAnswers({
            subject: {
                id: submission.subject.id,
                name: submission.subject.name,
                age: Number.isInteger(submission.subject.age) ? submission.subject.age : undefined,
                gender: submission.subject.gender?.trim() || undefined,
                organization: submission.subject.organization,
                role: submission.subject.role,
                careerGoal: submission.subject.careerGoal,
            },
            answers: submission.answers,
            items: ipipNeo120QuestionBank,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`导入失败：问卷样本无法生成人格档案（${message}）。`);
    }
    await ensurePrivateDir();
    await writeJsonFile(paths.samplePath, submission);
    await writeJsonFile(paths.profilePath, profile);
    await persistActiveSeedProfilePath(paths.profilePath);
    return {
        source: "submission",
        samplePath: paths.samplePath,
        profilePath: paths.profilePath,
        subjectId,
        subjectName: submission.subject.name.trim(),
        gender: (submission.subject.gender || "").trim(),
        age: Number.isInteger(submission.subject.age) ? submission.subject.age : 0,
        organization: submission.subject.organization.trim(),
        role: submission.subject.role.trim(),
        careerGoal: submission.subject.careerGoal.trim(),
        descriptions: {
            professionalDescription: submission.descriptions.professionalDescription,
            lifeDescription: submission.descriptions.lifeDescription,
            instinctNeedsDescription: submission.descriptions.instinctNeedsDescription,
            integratedDescription: submission.descriptions.integratedDescription,
        },
        answers: submission.answers.map((answer) => ({
            q: answer.q,
            score: answer.score,
        })),
    };
}

/**
 * 作用：导入外部人格档案（IPIP persona profile）并写入工作空间私有目录。
 * 意图：支持用户直接加载已存在的人格档案，而无需重新填写问卷。
 * 调用时机：PersonaSeedPanel 点击“导入人格档案”后调用。
 */
export const importPersonaProfileArchive = async (
    file: File,
): Promise<ImportedPersonaProfileResult> => {
    const rawText = await file.text();
    const parsed = parseJsonText(rawText);
    if (!isIpipPersonaProfile(parsed)) {
        if (isIpipNeo120SubmissionArchive(parsed)) {
            return importSubmissionArchiveFile(file, parsed);
        }
        throw new Error("导入失败：仅支持 IPIP-NEO-120 人格档案或问卷样本 JSON。");
    }
    return importPersonaProfileFile(file, parsed);
};
