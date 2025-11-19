import { z } from 'zod'
import { schema as editorConfigSchema } from './editor';
import { editorKeyMapSchema } from './keymap.editor';
import { generalKeymapSchema } from './keyMap.general';
import {schema as systemConfigSchema} from './system'
import { uiLayoutSchema } from './uiLayout';
import { schema as syncConfigSchema} from './sync';
import { schema as searchConfigSchema } from './search';
const configSchema = z.object({
    accessAuthCode: z.enum(["", "*******"]).optional().default(""),
    account: z.object({
        displayTitle: z.boolean(),
        displayVIP: z.boolean()
    }),
    ai: z.object({
        openAI: z.object({
            apiBaseURL: z.string(),
            apiKey: z.string(),
            apiMaxContexts: z.number(),
            apiMaxTokens: z.number(),
            apiModel: z.enum(["gpt-4", "gpt-4-32k", "gpt-3.5-turbo", "gpt-3.5-turbo-16k"]),
            apiProvider: z.enum(["OpenAI", "Azure"]),
            apiProxy: z.string(),
            apiTemperature: z.number(),
            apiTimeout: z.number(),
            apiUserAgent: z.string(),
            apiVersion: z.string()
        })
    }),
    api: z.object({
        token: z.string()
    }),
    appearance: z.object({
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
    }),
    bazaar: z.object({
        petalDisabled: z.boolean(),
        trust: z.boolean()
    }),
    cloudRegion: z.number(),
    editor: editorConfigSchema,
    export: z.object({
        addTitle: z.boolean(),
        blockEmbedMode: z.number(),
        blockRefMode: z.number(),
        blockRefTextLeft: z.string(),
        blockRefTextRight: z.string(),
        docxTemplate: z.string(),
        fileAnnotationRefMode: z.number(),
        imageWatermarkDesc: z.string(),
        imageWatermarkStr: z.string(),
        markdownYFM: z.boolean(),
        inlineMemo: z.boolean(),
        pandocBin: z.string(),
        paragraphBeginningSpace: z.boolean(),
        pdfFooter: z.string(),
        pdfWatermarkDesc: z.string(),
        pdfWatermarkStr: z.string(),
        tagCloseMarker: z.string(),
        tagOpenMarker: z.string()
    }),
    fileTree: z.object({
        allowCreateDeeper: z.boolean(),
        alwaysSelectOpenedFile: z.boolean(),
        closeTabsOnStart: z.boolean(),
        docCreateSavePath: z.string(),
        maxListCount: z.number(),
        maxOpenTabCount: z.number(),
        openFilesUseCurrentTab: z.boolean(),
        refCreateSavePath: z.string(),
        refCreateSaveBox: z.string(),
        docCreateSaveBox: z.string(),
        removeDocWithoutConfirm: z.boolean(),
        sort: z.number(),
        useSingleLineSave: z.boolean(),
        largeFileWarningSize: z.number(),
        createDocAtTop: z.boolean()
    }),
    flashcard: z.object({
        deck: z.boolean(),
        heading: z.boolean(),
        list: z.boolean(),
        mark: z.boolean(),
        maximumInterval: z.number(),
        newCardLimit: z.number(),
        requestRetention: z.number(),
        reviewCardLimit: z.number(),
        reviewMode: z.number(),
        superBlock: z.boolean(),
        weights: z.string()
    }),
    graph: z.object({
        global: z.object({
            d3: z.object({
                arrow: z.boolean(),
                centerStrength: z.number(),
                collideRadius: z.number(),
                collideStrength: z.number(),
                lineOpacity: z.number(),
                linkDistance: z.number(),
                linkWidth: z.number(),
                nodeSize: z.number()
            }),
            dailyNote: z.boolean(),
            minRefs: z.number(),
            type: z.object({
                blockquote: z.boolean(),
                code: z.boolean(),
                heading: z.boolean(),
                list: z.boolean(),
                listItem: z.boolean(),
                math: z.boolean(),
                paragraph: z.boolean(),
                super: z.boolean(),
                table: z.boolean(),
                tag: z.boolean()
            })
        }),
        local: z.object({
            d3: z.object({
                arrow: z.boolean(),
                centerStrength: z.number(),
                collideRadius: z.number(),
                collideStrength: z.number(),
                lineOpacity: z.number(),
                linkDistance: z.number(),
                linkWidth: z.number(),
                nodeSize: z.number()
            }),
            dailyNote: z.boolean(),
            type: z.object({
                blockquote: z.boolean(),
                code: z.boolean(),
                heading: z.boolean(),
                list: z.boolean(),
                listItem: z.boolean(),
                math: z.boolean(),
                paragraph: z.boolean(),
                super: z.boolean(),
                table: z.boolean(),
                tag: z.boolean()
            })
        }),
        maxBlocks: z.number()
    }),
    keymap: z.object({
        editor: editorKeyMapSchema,
        general: generalKeymapSchema,
        plugin: z.record(z.string(), z.record(z.string(), z.object({
            custom: z.string(),
            default: z.string()
        })))
    }),
    langs: z.array(z.object({
        label: z.string(),
        name: z.string()
    })),
    localIPs: z.array(z.string()),
    logLevel: z.enum(["off", "trace", "debug", "info", "warn", "error", "fatal"]),
    openHelp: z.boolean(),
    publish: z.object({
        enable: z.boolean(),
        auth: z.object({
            enable: z.boolean(),
            accounts: z.array(z.object({
                username: z.string(),
                password: z.string(),
                memo: z.string()
            }))
        }),
        port: z.number()
    }),
    readonly: z.boolean(),
    repo: z.object({
        key: z.string(),
        syncIndexTiming: z.number(),
        indexRetentionDays: z.number(),
        retentionIndexesDaily: z.number()
    }),
    search: searchConfigSchema,
    showChangelog: z.boolean(),
    snippet: z.object({
        enabledCSS: z.boolean(),
        enabledJS: z.boolean()
    }),
    stat: z.object({
        assetsSize: z.number(),
        blockCount: z.number(),
        cAssetsSize: z.number(),
        cBlockCount: z.number(),
        cDataSize: z.number(),
        cTreeCount: z.number(),
        dataSize: z.number(),
        treeCount: z.number()
    }),
    sync: syncConfigSchema,
    system: systemConfigSchema,
    tag: z.object({
        sort: z.number()
    }),
    uiLayout:uiLayoutSchema,
    userData: z.string(),
    /**
     * 用户界面语言
     * 与 appearance.lang 相同
     */
    lang: z.enum(["en_US", "ar_SA", "de_DE", "es_ES", "fr_FR", "he_IL", "it_IT", "ja_JP", "pl_PL", "pt_BR", "ru_RU", "zh_CN", "zh_CHT"])
}
)

const parseAsConfig = (rawConf: {}): Config.IConf => {
    const result = configSchema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
}
