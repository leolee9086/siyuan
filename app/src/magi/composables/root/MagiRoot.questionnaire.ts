import { appendConsensusMessage } from "../useMagi.consensus";
import type { UseMagiReturn } from "../useMagi.types";
import { loadPromptInjectionsByProfilePath } from "../../prompts/personaRuntimePromptBuilder";
import type { PersonaSeedSavedEvent } from "../../entry/persona-seed-panel/PersonaSeedPanel.types";

/** @同步豁免: 纯数据归一化，无异步依赖 */
function normalizeSavedPaths(
    saved: PersonaSeedSavedEvent,
): { readonly samplePath: string; readonly profilePath: string | null } {
    if (typeof saved === "string") {
        return {
            samplePath: saved,
            profilePath: null,
        };
    }
    return {
        samplePath: saved.samplePath,
        profilePath: saved.profilePath?.trim() || null,
    };
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
/** 创建问卷保存成功处理器 */
export function createQuestionnaireSavedHandler(
    magiState: { value: UseMagiReturn | null },
): (saved: PersonaSeedSavedEvent) => Promise<void> {
    return async (saved: PersonaSeedSavedEvent) => {
        if (!magiState.value) {
            return;
        }
        const savedPaths = normalizeSavedPaths(saved);
        await appendConsensusMessage(
            magiState.value.consensusMessages,
            "system",
            `人格采样问卷已保存: ${savedPaths.samplePath}`,
        );
        if (!savedPaths.profilePath) {
            await appendConsensusMessage(
                magiState.value.consensusMessages,
                "system",
                "未提供人格档案路径，已跳过人格重载。",
            );
            return;
        }
        try {
            const promptInjections = await loadPromptInjectionsByProfilePath(savedPaths.profilePath);
            if (!promptInjections) {
                await appendConsensusMessage(
                    magiState.value.consensusMessages,
                    "error",
                    `人格档案读取失败，继续使用当前配置: ${savedPaths.profilePath}`,
                );
                return;
            }
            await magiState.value.initializeMAGI({
                promptInjections,
                preserveConsensusMessages: true,
            });
            await appendConsensusMessage(
                magiState.value.consensusMessages,
                "system",
                `已加载人格档案并完成重建: ${savedPaths.profilePath}`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await appendConsensusMessage(
                magiState.value.consensusMessages,
                "error",
                `人格重载失败，继续使用当前配置: ${message}`,
            );
        }
    };
}
