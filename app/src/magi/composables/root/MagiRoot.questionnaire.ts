import { appendConsensusMessage } from "../useMagi.consensus";
import type { UseMagiReturn } from "../useMagi.types";
import { loadPromptInjectionsByProfilePath } from "../../prompts/personaRuntimePromptBuilder";
import type { PersonaSeedSavedEvent } from "../../entry/persona-seed-panel/PersonaSeedPanel.types";

/** @同步豁免: 纯数据归一化，无异步依赖 */
function normalizeSavedPaths(
    saved: PersonaSeedSavedEvent,
): { readonly source: "submission" | "import"; readonly samplePath: string; readonly profilePath: string | null } {
    if (typeof saved === "string") {
        return {
            source: "submission",
            samplePath: saved,
            profilePath: null,
        };
    }
    return {
        source: saved.source === "import" ? "import" : "submission",
        samplePath: saved.samplePath,
        profilePath: saved.profilePath?.trim() || null,
    };
}

async function appendSavedNotice(
    magiState: UseMagiReturn,
    savedPaths: { readonly source: "submission" | "import"; readonly samplePath: string; readonly profilePath: string | null },
): Promise<void> {
    if (savedPaths.source === "import") {
        const importedPath = savedPaths.profilePath ?? savedPaths.samplePath;
        await appendConsensusMessage(
            magiState.consensusMessages,
            "system",
            `人格档案已导入: ${importedPath}`,
        );
        return;
    }
    await appendConsensusMessage(
        magiState.consensusMessages,
        "system",
        `人格采样问卷已保存: ${savedPaths.samplePath}`,
    );
}

async function reloadPersonaFromProfilePath(
    magiState: UseMagiReturn,
    profilePath: string,
): Promise<void> {
    const promptInjections = await loadPromptInjectionsByProfilePath(profilePath);
    if (!promptInjections) {
        await appendConsensusMessage(
            magiState.consensusMessages,
            "error",
            `人格档案读取失败，继续使用当前配置: ${profilePath}`,
        );
        return;
    }
    await magiState.initializeMAGI({
        promptInjections,
        preserveConsensusMessages: true,
    });
    await appendConsensusMessage(
        magiState.consensusMessages,
        "system",
        `已加载人格档案并完成重建: ${profilePath}`,
    );
}

/** @同步豁免: UI构建 — setup 阶段需同步返回事件处理器 */
/** 创建问卷保存成功处理器 */
export function createQuestionnaireSavedHandler(
    magiState: { value: UseMagiReturn | null },
): (saved: PersonaSeedSavedEvent) => Promise<void> {
    return async (saved: PersonaSeedSavedEvent) => {
        const runtime = magiState.value;
        if (!runtime) {
            return;
        }
        const savedPaths = normalizeSavedPaths(saved);
        await appendSavedNotice(runtime, savedPaths);
        if (!savedPaths.profilePath) {
            await appendConsensusMessage(
                runtime.consensusMessages,
                "system",
                "未提供人格档案路径，已跳过人格重载。",
            );
            return;
        }
        try {
            await reloadPersonaFromProfilePath(runtime, savedPaths.profilePath);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await appendConsensusMessage(
                runtime.consensusMessages,
                "error",
                `人格重载失败，继续使用当前配置: ${message}`,
            );
        }
    };
}
