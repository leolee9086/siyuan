import { summaryPrompts } from "./personaPromptBuilder";
import type { IpipPersonaProfile } from "../data/questionnaire.types";
import type { MagiPromptSet } from "../core/wise/wise.types";
import {
    ACTIVE_SEED_POINTER_SCHEMA,
    isActiveSeedPointer,
    isIpipPersonaProfile,
    isKernelErrorResponse,
} from "./personaRuntimePromptBuilder.guard";

const RUNTIME_INPUT_PLACEHOLDER = "系统人格加载阶段（无用户输入）。";
const RUNTIME_TELEMETRY_PLACEHOLDER = "source=ipip_persona_seed;mode=runtime_prompt_injection";
const ACTIVE_SEED_POINTER_PATH = "/data/private/magi_active_persona_seed.json";

/** @同步豁免: 纯对象字面量构造，无异步依赖 */
/**
 * 作用：构建运行时人格提示词的统一输入。
 * 意图：在无实际用户输入时复用五层 Prompt 生成器。
 * 调用时机：生成四贤者提示词前调用。
 */
function buildRuntimePromptInput(profile: IpipPersonaProfile): {
    readonly profile: IpipPersonaProfile;
    readonly currentInput: string;
    readonly telemetry: string;
} {
    return {
        profile,
        currentInput: RUNTIME_INPUT_PLACEHOLDER,
        telemetry: RUNTIME_TELEMETRY_PLACEHOLDER,
    };
}

/**
 * 作用：由 IPIP 人格档案构建四贤者运行时注入提示词。
 * 意图：统一 “问卷结果 -> 运行时人格提示词” 映射入口。
 * 调用时机：问卷保存后，MagiRoot 触发人格重载前调用。
 */
export async function buildRuntimePromptInjections(
    profile: IpipPersonaProfile,
): Promise<MagiPromptSet> {
    const input = buildRuntimePromptInput(profile);
    const melchior = await summaryPrompts.melchior(input);
    const balthazar = await summaryPrompts.balthazar(input);
    const casper = await summaryPrompts.casper(input);
    const trinity = await summaryPrompts.trinity(input);
    return { melchior, balthazar, casper, trinity };
}

/** @同步豁免: 纯字符串解析，无异步依赖 */
/**
 * 作用：尝试将字符串内容解析为 JSON。
 * 意图：兼容 `/api/file/getFile` 可能返回字符串内容的场景。
 * 调用时机：读取 profile 文件后调用。
 */
function parseJsonText(text: string): unknown | null {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * 作用：按路径读取人格档案并构建四贤者注入提示词。
 * 意图：封装 profile 读取、解析、校验与提示词构建流程。
 * 调用时机：问卷保存后触发人格重载前调用。
 */
export async function loadPromptInjectionsByProfilePath(
    profilePath: string,
): Promise<MagiPromptSet | null> {
    const { fetchSyncPostRaw } = await import("../../util/network/fetch");
    const raw = await fetchSyncPostRaw<unknown>("/api/file/getFile", { path: profilePath });
    // 内核错误响应直接降级
    if (isKernelErrorResponse(raw) && raw.code !== 0) {
        return null;
    }
    const normalized = typeof raw === "string" ? parseJsonText(raw) : raw;
    // 解析失败或结构非法时降级
    if (!isIpipPersonaProfile(normalized)) {
        return null;
    }
    return buildRuntimePromptInjections(normalized);
}

/** @同步豁免: 性能考虑 - 仅做字符串裁剪与对象构造，无异步依赖 */
function buildActiveSeedPointer(profilePath: string): {
    readonly schemaVersion: string;
    readonly activeProfilePath: string;
    readonly updatedAt: string;
} {
    return {
        schemaVersion: ACTIVE_SEED_POINTER_SCHEMA,
        activeProfilePath: profilePath.trim(),
        updatedAt: new Date().toISOString(),
    };
}

/** @同步豁免: 性能考虑 - 仅 FormData 构造，无异步依赖 */
function buildWriteFileFormData(filePath: string, payload: unknown): FormData {
    const fileName = filePath.split("/").pop() || "payload.json";
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const file = new File([blob], fileName, { lastModified: Date.now() });
    const formData = new FormData();
    formData.append("path", filePath);
    formData.append("isDir", "false");
    formData.append("modTime", Date.now().toString());
    formData.append("file", file);
    return formData;
}

/** 将 profile 路径固化为工作空间级“当前生效人格种子指针”。 */
export async function persistActiveSeedProfilePath(profilePath: string): Promise<void> {
    const normalizedPath = profilePath.trim();
    if (!normalizedPath) {
        return;
    }
    const { fetchSyncPost } = await import("../../util/network/fetch");
    const ensureDirFormData = new FormData();
    ensureDirFormData.append("path", "/data/private");
    ensureDirFormData.append("isDir", "true");
    ensureDirFormData.append("modTime", Date.now().toString());
    ensureDirFormData.append("file", "");
    await fetchSyncPost("/api/file/putFile", ensureDirFormData);
    await fetchSyncPost("/api/file/putFile", buildWriteFileFormData(
        ACTIVE_SEED_POINTER_PATH,
        buildActiveSeedPointer(normalizedPath),
    ));
}

/** 读取工作空间级“当前生效人格种子指针”中的 profile 路径。 */
export async function resolveActiveSeedProfilePath(): Promise<string | null> {
    const { fetchSyncPostRaw } = await import("../../util/network/fetch");
    const raw = await fetchSyncPostRaw<unknown>("/api/file/getFile", { path: ACTIVE_SEED_POINTER_PATH });
    if (isKernelErrorResponse(raw) && raw.code !== 0) {
        return null;
    }
    const normalized = typeof raw === "string" ? parseJsonText(raw) : raw;
    if (!isActiveSeedPointer(normalized)) {
        return null;
    }
    const profilePath = normalized.activeProfilePath.trim();
    return profilePath || null;
}

/**
 * 启动阶段解析工作空间 active seed，并尝试构建运行时提示词注入。
 * 返回 null 代表当前工作空间没有可用的 active seed。
 */
export async function resolveStartupPromptInjectionsByActiveSeed(): Promise<{
    readonly profilePath: string;
    readonly promptInjections: MagiPromptSet;
} | null> {
    const profilePath = await resolveActiveSeedProfilePath();
    if (!profilePath) {
        return null;
    }
    const promptInjections = await loadPromptInjectionsByProfilePath(profilePath);
    if (!promptInjections) {
        return null;
    }
    return { profilePath, promptInjections };
}
