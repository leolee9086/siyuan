import { z } from 'zod'
import { schema as editorConfigSchema } from './editor';
import { editorKeyMapSchema } from './keymap.editor';
import { generalKeymapSchema } from './keyMap.general';
import { uiLayoutSchema } from './uiLayout';
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
    search: z.object({
        alias: z.boolean(),
        audioBlock: z.boolean(),
        backlinkMentionAlias: z.boolean(),
        backlinkMentionAnchor: z.boolean(),
        backlinkMentionDoc: z.boolean(),
        backlinkMentionKeywordsLimit: z.number(),
        backlinkMentionName: z.boolean(),
        blockquote: z.boolean(),
        caseSensitive: z.boolean(),
        codeBlock: z.boolean(),
        databaseBlock: z.boolean(),
        document: z.boolean(),
        embedBlock: z.boolean(),
        heading: z.boolean(),
        htmlBlock: z.boolean(),
        iframeBlock: z.boolean(),
        ial: z.boolean(),
        indexAssetPath: z.boolean(),
        limit: z.number(),
        list: z.boolean(),
        listItem: z.boolean(),
        mathBlock: z.boolean(),
        memo: z.boolean(),
        name: z.boolean(),
        paragraph: z.boolean(),
        superBlock: z.boolean(),
        table: z.boolean(),
        videoBlock: z.boolean(),
        virtualRefAlias: z.boolean(),
        virtualRefAnchor: z.boolean(),
        virtualRefDoc: z.boolean(),
        virtualRefName: z.boolean(),
        widgetBlock: z.boolean()
    }),
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
    sync: z.object({
        cloudName: z.string(),
        enabled: z.boolean(),
        generateConflictDoc: z.boolean(),
        mode: z.number(),
        interval: z.number(),
        perception: z.boolean(),
        provider: z.number(),
        s3: z.object({
            accessKey: z.string(),
            bucket: z.string(),
            endpoint: z.string(),
            pathStyle: z.boolean(),
            region: z.string(),
            secretKey: z.string(),
            skipTlsVerify: z.boolean(),
            timeout: z.number(),
            concurrentReqs: z.number()
        }),
        stat: z.string(),
        synced: z.number(),
        webdav: z.object({
            endpoint: z.string(),
            password: z.string(),
            skipTlsVerify: z.boolean(),
            timeout: z.number(),
            concurrentReqs: z.number(),
            username: z.string()
        }),
        local: z.object({
            endpoint: z.string(),
            timeout: z.number(),
            concurrentReqs: z.number()
        })
    }),
    system: z.object({
        appDir: z.string(),
        autoLaunch2: z.number(),
        confDir: z.string(),
        container: z.enum(["docker", "android", "ios", "harmony", "std"]),
        dataDir: z.string(),
        downloadInstallPkg: z.boolean(),
        homeDir: z.string(),
        id: z.string(),
        isInsider: z.boolean(),
        isMicrosoftStore: z.boolean(),
        kernelVersion: z.string(),
        lockScreenMode: z.number(),
        name: z.string(),
        networkProxy: z.object({
            host: z.string(),
            port: z.string(),
            scheme: z.enum(["", "http", "https", "socks5"])
        }),
        networkServe: z.boolean(),
        os: z.enum(["android", "darwin", "ios", "linux", "windows"]),
        osPlatform: z.string(),
        workspaceDir: z.string(),
        disabledFeatures: z.array(z.string())
    }),
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
