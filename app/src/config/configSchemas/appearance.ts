import z from "zod"

export const schema = z.object({
    closeButtonBehavior: z.number(),
    codeBlockThemeDark: z.string(),
    codeBlockThemeLight: z.string(),
    darkThemes: z.array(z.string()),
    hideStatusBar: z.boolean(),
    icon: z.string(),
    icons: z.array(z.string()),
    iconVer: z.string(),
    lang: z.enum(["en_US", "ar_SA", "de_DE", "es_ES", "fr_FR", "he_IL", "it_IT", "ja_JP", "pl_PL", "pt_BR", "ru_RU", "zh_CN", "zh_CHT"]),
    lightThemes: z.array(z.string()),
    mode: z.number(),
    modeOS: z.boolean(),
    themeDark: z.string(),
    themeJS: z.boolean(),
    themeLight: z.string(),
    themeVer: z.string(),
    statusBar: z.object({
        msgTaskDatabaseIndexCommitDisabled: z.boolean(),
        msgTaskHistoryDatabaseIndexCommitDisabled: z.boolean(),
        msgTaskAssetDatabaseIndexCommitDisabled: z.boolean(),
        msgTaskHistoryGenerateFileDisabled: z.boolean()
    })
})

const parseAsConfig = (rawConf: {}): Config.IConf["appearance"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
}