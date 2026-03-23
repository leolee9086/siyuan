import { fetchSyncPostRaw } from "../../../../util/network/fetch";
import type { LikertScore } from "../../../components/persona/CompositeRating.types";
import type { SubjectType } from "../../../data/convergence/persona-seed-panel.types";
import type { IpipPersonaSeedDescriptions } from "../../../data/questionnaire.types";
import {
    isActiveSeedPointer,
    isIpipPersonaProfile,
    isKernelErrorResponse,
} from "../../../prompts/personaRuntimePromptBuilder.guard";

const ACTIVE_SEED_POINTER_PATH = "/data/private/magi_active_persona_seed.json";

export type PersonaSeedConfigLoadState = "loading" | "missing" | "ready" | "partial" | "error";

export interface LoadedPersonaSeedPanelData {
    readonly state: PersonaSeedConfigLoadState;
    readonly message: string;
    readonly profilePath: string;
    readonly samplePath: string;
    readonly subjectId: string;
    readonly subjectName: string;
    readonly gender: string;
    readonly age: number | null;
    readonly subjectType: SubjectType;
    readonly organization: string;
    readonly role: string;
    readonly careerGoal: string;
    readonly descriptions: IpipPersonaSeedDescriptions;
    readonly answers: ReadonlyArray<{ q: number; score: LikertScore }>;
}

interface KernelJsonReadResult {
    readonly ok: boolean;
    readonly payload: unknown;
    readonly message: string;
}

interface ExtractedSubject {
    readonly subjectId: string;
    readonly subjectName: string;
    readonly gender: string;
    readonly age: number | null;
    readonly subjectType: SubjectType | null;
    readonly organization: string;
    readonly role: string;
    readonly careerGoal: string;
}

const EMPTY_DESCRIPTIONS: IpipPersonaSeedDescriptions = {
    professionalDescription: "",
    lifeDescription: "",
    instinctNeedsDescription: "",
    integratedDescription: "",
};

const EMPTY_LOAD_RESULT: LoadedPersonaSeedPanelData = {
    state: "missing",
    message: "当前工作空间没有生效中的主管AI人格配置。",
    profilePath: "",
    samplePath: "",
    subjectId: "",
    subjectName: "",
    gender: "",
    age: null,
    subjectType: "ai_agent",
    organization: "",
    role: "",
    careerGoal: "",
    descriptions: EMPTY_DESCRIPTIONS,
    answers: [],
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object") {
        return false;
    }
    return !Array.isArray(value);
}

function parseJsonText(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

function normalizeKernelPayload(raw: unknown): unknown {
    return typeof raw === "string" ? parseJsonText(raw) : raw;
}

function readOptionalString(record: Record<string, unknown>, key: string): string {
    const value = Reflect.get(record, key);
    return typeof value === "string" ? value.trim() : "";
}

function readOptionalInteger(record: Record<string, unknown>, key: string): number | null {
    const value = Reflect.get(record, key);
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    return Number.isInteger(value) ? value : Math.trunc(value);
}

function readOptionalSubjectType(record: Record<string, unknown>, key: string): SubjectType | null {
    const value = readOptionalString(record, key);
    if (value === "human" || value === "ai_agent") {
        return value;
    }
    return null;
}

function isLikertScore(value: unknown): value is LikertScore {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        return false;
    }
    if (value < 1) {
        return false;
    }
    return value <= 5;
}

function buildKernelReadError(path: string, raw: unknown): string {
    if (isKernelErrorResponse(raw)) {
        const message = isRecordObject(raw)
            ? readOptionalString(raw, "msg")
            : "";
        return message || `读取 ${path} 失败`;
    }
    return `读取 ${path} 失败`;
}

async function readKernelJsonFile(path: string): Promise<KernelJsonReadResult> {
    try {
        const raw = await fetchSyncPostRaw<unknown>("/api/file/getFile", { path });
        const normalized = normalizeKernelPayload(raw);
        if (isKernelErrorResponse(normalized) && normalized.code !== 0) {
            return {
                ok: false,
                payload: null,
                message: buildKernelReadError(path, normalized),
            };
        }
        return {
            ok: true,
            payload: normalized,
            message: "",
        };
    } catch (error) {
        return {
            ok: false,
            payload: null,
            message: error instanceof Error ? error.message : String(error),
        };
    }
}

function extractSubjectFromProfile(raw: unknown): ExtractedSubject {
    if (!isRecordObject(raw)) {
        return {
            subjectId: "",
            subjectName: "",
            gender: "",
            age: null,
            subjectType: null,
            organization: "",
            role: "",
            careerGoal: "",
        };
    }
    const subject = Reflect.get(raw, "subject");
    if (!isRecordObject(subject)) {
        return {
            subjectId: "",
            subjectName: "",
            gender: "",
            age: null,
            subjectType: null,
            organization: "",
            role: "",
            careerGoal: "",
        };
    }
    return {
        subjectId: readOptionalString(subject, "id"),
        subjectName: readOptionalString(subject, "name"),
        gender: readOptionalString(subject, "gender"),
        age: readOptionalInteger(subject, "age"),
        subjectType: readOptionalSubjectType(subject, "type"),
        organization: readOptionalString(subject, "organization"),
        role: readOptionalString(subject, "role"),
        careerGoal: readOptionalString(subject, "careerGoal"),
    };
}

function extractDescriptionsFromSample(raw: unknown): IpipPersonaSeedDescriptions {
    if (!isRecordObject(raw)) {
        return EMPTY_DESCRIPTIONS;
    }
    const descriptions = Reflect.get(raw, "descriptions");
    if (!isRecordObject(descriptions)) {
        return EMPTY_DESCRIPTIONS;
    }
    return {
        professionalDescription: readOptionalString(descriptions, "professionalDescription"),
        lifeDescription: readOptionalString(descriptions, "lifeDescription"),
        instinctNeedsDescription: readOptionalString(descriptions, "instinctNeedsDescription"),
        integratedDescription: readOptionalString(descriptions, "integratedDescription"),
    };
}

function extractSubjectFromSample(raw: unknown): ExtractedSubject {
    if (!isRecordObject(raw)) {
        return {
            subjectId: "",
            subjectName: "",
            gender: "",
            age: null,
            subjectType: null,
            organization: "",
            role: "",
            careerGoal: "",
        };
    }
    const subject = Reflect.get(raw, "subject");
    if (!isRecordObject(subject)) {
        return {
            subjectId: "",
            subjectName: "",
            gender: "",
            age: null,
            subjectType: null,
            organization: "",
            role: "",
            careerGoal: "",
        };
    }
    return {
        subjectId: readOptionalString(subject, "id"),
        subjectName: readOptionalString(subject, "name"),
        gender: readOptionalString(subject, "gender"),
        age: readOptionalInteger(subject, "age"),
        subjectType: readOptionalSubjectType(subject, "type"),
        organization: readOptionalString(subject, "organization"),
        role: readOptionalString(subject, "role"),
        careerGoal: readOptionalString(subject, "careerGoal"),
    };
}

function extractAnswersFromSample(raw: unknown): {
    readonly answers: ReadonlyArray<{ q: number; score: LikertScore }>;
    readonly issue: string;
} {
    if (!isRecordObject(raw)) {
        return { answers: [], issue: "配对问卷样本不是有效对象，问卷结果未显示。" };
    }
    const answers = Reflect.get(raw, "answers");
    if (!Array.isArray(answers)) {
        return { answers: [], issue: "配对问卷样本缺少 answers，问卷结果保持空白。" };
    }

    const normalizedAnswers: Array<{ q: number; score: LikertScore }> = [];
    for (const item of answers) {
        if (!isRecordObject(item)) {
            return { answers: [], issue: "配对问卷样本 answers 结构非法，问卷结果未显示。" };
        }
        const q = Reflect.get(item, "q");
        const score = Reflect.get(item, "score");
        if (typeof q !== "number" || !Number.isInteger(q) || !isLikertScore(score)) {
            return { answers: [], issue: "配对问卷样本 answers 结构非法，问卷结果未显示。" };
        }
        normalizedAnswers.push({ q, score });
    }
    return { answers: normalizedAnswers, issue: "" };
}

export function deriveSamplePathFromProfilePath(profilePath: string): string {
    const normalized = profilePath.trim().replace(/\\/g, "/");
    if (!normalized.endsWith(".json")) {
        return "";
    }
    const fileName = normalized.split("/").pop() ?? "";
    const baseName = fileName.slice(0, -".json".length);
    const marker = "_persona_profile_";
    const separatorIndex = baseName.lastIndexOf(marker);
    if (separatorIndex <= 0) {
        return "";
    }
    const subjectId = baseName.slice(0, separatorIndex).trim();
    const indexText = baseName.slice(separatorIndex + marker.length).trim();
    if (!subjectId || !/^[1-9]\d*$/.test(indexText)) {
        return "";
    }
    return `/data/private/${subjectId}_ipip120_sample_${indexText}.json`;
}

function mergeSubjects(primary: ExtractedSubject, secondary: ExtractedSubject): ExtractedSubject {
    return {
        subjectId: primary.subjectId || secondary.subjectId,
        subjectName: primary.subjectName || secondary.subjectName,
        gender: primary.gender || secondary.gender,
        age: primary.age ?? secondary.age,
        subjectType: primary.subjectType ?? secondary.subjectType,
        organization: primary.organization || secondary.organization,
        role: primary.role || secondary.role,
        careerGoal: primary.careerGoal || secondary.careerGoal,
    };
}

function buildReadyMessage(): string {
    return "已加载当前主管AI配置。";
}

function buildPartialMessage(issues: readonly string[]): string {
    if (issues.length === 0) {
        return buildReadyMessage();
    }
    return `已读取当前主管AI配置，但${issues.join("；")}`;
}

export async function loadActivePersonaSeedPanelData(): Promise<LoadedPersonaSeedPanelData> {
    const pointerRead = await readKernelJsonFile(ACTIVE_SEED_POINTER_PATH);
    if (!pointerRead.ok) {
        if (pointerRead.message.toLowerCase().includes("not found")) {
            return EMPTY_LOAD_RESULT;
        }
        return {
            ...EMPTY_LOAD_RESULT,
            state: "error",
            message: `读取当前主管AI配置指针失败: ${pointerRead.message}`,
        };
    }
    if (!isActiveSeedPointer(pointerRead.payload)) {
        return {
            ...EMPTY_LOAD_RESULT,
            state: "error",
            message: "当前主管AI配置指针格式非法，界面未做任何回退填充。",
        };
    }

    const profilePath = pointerRead.payload.activeProfilePath.trim();
    const profileRead = await readKernelJsonFile(profilePath);
    if (!profileRead.ok) {
        return {
            ...EMPTY_LOAD_RESULT,
            state: "error",
            message: `读取当前主管AI人格档案失败: ${profileRead.message}`,
            profilePath,
        };
    }

    const profileSubject = extractSubjectFromProfile(profileRead.payload);
    const issues: string[] = [];
    if (!isIpipPersonaProfile(profileRead.payload)) {
        issues.push("人格档案结构不完整，仅展示文件中实际存在的字段");
    }

    const samplePath = deriveSamplePathFromProfilePath(profilePath);
    let loadedSamplePath = "";
    let sampleSubject: ExtractedSubject = {
        subjectId: "",
        subjectName: "",
        gender: "",
        age: null,
        subjectType: null,
        organization: "",
        role: "",
        careerGoal: "",
    };
    let descriptions = EMPTY_DESCRIPTIONS;
    let answers: ReadonlyArray<{ q: number; score: LikertScore }> = [];

    if (!samplePath) {
        issues.push("人格档案文件名无法精确匹配问卷样本，因此描述与问卷保持空白");
    } else {
        const sampleRead = await readKernelJsonFile(samplePath);
        if (!sampleRead.ok) {
            issues.push(`未能读取精确配对的问卷样本（${sampleRead.message}），描述与问卷保持空白`);
        } else {
            loadedSamplePath = samplePath;
            sampleSubject = extractSubjectFromSample(sampleRead.payload);
            descriptions = extractDescriptionsFromSample(sampleRead.payload);
            const answerExtraction = extractAnswersFromSample(sampleRead.payload);
            answers = answerExtraction.answers;
            if (answerExtraction.issue) {
                issues.push(answerExtraction.issue);
            }
        }
    }

    const mergedSubject = mergeSubjects(sampleSubject, profileSubject);
    return {
        state: issues.length === 0 ? "ready" : "partial",
        message: issues.length === 0 ? buildReadyMessage() : buildPartialMessage(issues),
        profilePath,
        samplePath: loadedSamplePath,
        subjectId: mergedSubject.subjectId,
        subjectName: mergedSubject.subjectName,
        gender: mergedSubject.gender,
        age: mergedSubject.age,
        subjectType: mergedSubject.subjectType ?? "ai_agent",
        organization: mergedSubject.organization,
        role: mergedSubject.role,
        careerGoal: mergedSubject.careerGoal,
        descriptions,
        answers,
    };
}
