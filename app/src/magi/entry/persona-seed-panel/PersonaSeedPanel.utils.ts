import { fetchSyncPost } from "../../../util/network/fetch";
import { ipipNeo120QuestionBank } from "../../data/ipip-neo-120";
import { buildIpipPersonaProfileFromRawAnswers } from "../../data/ipip-neo-120-scoring";
import type {
    IpipNeo120SubmissionPayload,
    IpipSubjectProfile,
    IpipPersonaSeedDescriptions,
} from "../../data/questionnaire.types";
import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { PersonaConvergenceSuggestion } from "../../data/convergence/persona-seed-convergence.types";

const DESCRIPTION_FIELD_LABELS: Readonly<Record<keyof IpipPersonaSeedDescriptions, string>> = {
    professionalDescription: "职业描述",
    lifeDescription: "生活描述",
    instinctNeedsDescription: "本能需求描述",
    integratedDescription: "综合描述",
};

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

/** @同步豁免: UI构建 — 提交前同步校验必填字段完整性 */
/**
 * 作用：收集提交前未填写的必填字段名称列表。
 * 意图：提交问卷前校验完整性，给出缺失字段提示。
 * 调用时机：onSubmitIpip 提交前调用。
 */
export const collectMissingFields = (
    organization: string,
    role: string,
    careerGoal: string,
    descriptions: IpipPersonaSeedDescriptions,
): string[] => {
    const missing: string[] = [];
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
    return { samplePath, profilePath };
};
