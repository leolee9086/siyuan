import { summaryPrompts } from "./personaPromptBuilder";
import type { IpipPersonaProfile } from "../data/questionnaire.types";
import type { MagiPromptSet } from "../core/wise/wise.types";
import { isIpipPersonaProfile, isKernelErrorResponse } from "./personaRuntimePromptBuilder.guard";

const RUNTIME_INPUT_PLACEHOLDER = "系统人格加载阶段（无用户输入）。";
const RUNTIME_TELEMETRY_PLACEHOLDER = "source=ipip_persona_seed;mode=runtime_prompt_injection";

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
