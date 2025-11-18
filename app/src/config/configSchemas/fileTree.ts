import z from "zod"
import { fetchPost } from "../../ai/imports";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n";
import { uiDescriptionRegistry } from "./utils";
import { computed } from "vue";

export const schema = z.object({
    allowCreateDeeper: z.boolean().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree19,
            label: siyuanI18n.fileTree18,
            model: computed({
                get: () => getSiyuanConfig().fileTree.allowCreateDeeper,
                set: (val: boolean) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.allowCreateDeeper = val)
                }
            })
        })
    ),
    alwaysSelectOpenedFile: z.boolean().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree2,
            label: siyuanI18n.selectOpen,
            model: computed({
                get: () => getSiyuanConfig().fileTree.alwaysSelectOpenedFile,
                set: (val: boolean) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.alwaysSelectOpenedFile = val)
                }
            })
        })
    ),
    closeTabsOnStart: z.boolean().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree10,
            label: siyuanI18n.fileTree9,
            model: computed({
                get: () => getSiyuanConfig().fileTree.closeTabsOnStart,
                set: (val: boolean) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.closeTabsOnStart = val)
                }
            })
        })
    ),
    docCreateSavePath: z.string().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree13,
            label: siyuanI18n.fileTree12,
            model: computed({
                get: () => getSiyuanConfig().fileTree.docCreateSavePath,
                set: (val: string) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.docCreateSavePath = val)
                }
            })
        })
    ),
    maxListCount: z.number().min(1).max(10240).describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree17,
            label: siyuanI18n.fileTree16,
            model: computed({
                get: () => getSiyuanConfig().fileTree.maxListCount,
                set: (val: number) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.maxListCount = val)
                }
            })
        })
    ),
    maxOpenTabCount: z.number().min(1).max(32).describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.tabLimit1,
            label: siyuanI18n.tabLimit,
            model: computed({
                get: () => getSiyuanConfig().fileTree.maxOpenTabCount,
                set: (val: number) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.maxOpenTabCount = val)
                }
            })
        })
    ),
    openFilesUseCurrentTab: z.boolean().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree8,
            label: siyuanI18n.fileTree7,
            model: computed({
                get: () => getSiyuanConfig().fileTree.openFilesUseCurrentTab,
                set: (val: boolean) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.openFilesUseCurrentTab = val)
                }
            })
        })
    ),
    refCreateSavePath: z.string().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree6,
            label: siyuanI18n.fileTree5,
            model: computed({
                get: () => getSiyuanConfig().fileTree.refCreateSavePath,
                set: (val: string) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.refCreateSavePath = val)
                }
            })
        })
    ),
    refCreateSaveBox: z.string().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree6,
            label: siyuanI18n.fileTree5,
            model: computed({
                get: () => getSiyuanConfig().fileTree.refCreateSaveBox,
                set: (val: string) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.refCreateSaveBox = val)
                }
            })
        })
    ),
    docCreateSaveBox: z.string().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree13,
            label: siyuanI18n.fileTree12,
            model: computed({
                get: () => getSiyuanConfig().fileTree.docCreateSaveBox,
                set: (val: string) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.docCreateSaveBox = val)
                }
            })
        })
    ),
    removeDocWithoutConfirm: z.boolean().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree4,
            label: siyuanI18n.fileTree3,
            model: computed({
                get: () => getSiyuanConfig().fileTree.removeDocWithoutConfirm,
                set: (val: boolean) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.removeDocWithoutConfirm = val)
                }
            })
        })
    ),
    sort: z.number().min(0).max(256).describe(
        uiDescriptionRegistry.registerItem({
            description: "文档排序方式",
            label: "排序",
            model: computed({
                get: () => getSiyuanConfig().fileTree.sort,
                set: (val: number) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.sort = val)
                }
            })
        })
    ),
    useSingleLineSave: z.boolean().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree21,
            label: siyuanI18n.fileTree20,
            model: computed({
                get: () => getSiyuanConfig().fileTree.useSingleLineSave,
                set: (val: boolean) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.useSingleLineSave = val)
                }
            })
        })
    ),
    largeFileWarningSize: z.number().min(2).max(10240).describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree23,
            label: siyuanI18n.fileTree22,
            model: computed({
                get: () => getSiyuanConfig().fileTree.largeFileWarningSize,
                set: (val: number) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.largeFileWarningSize = val)
                }
            })
        })
    ),
    createDocAtTop: z.boolean().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.fileTree25,
            label: siyuanI18n.fileTree24,
            model: computed({
                get: () => getSiyuanConfig().fileTree.createDocAtTop,
                set: (val: boolean) => {
                    window.siyuan.config && (window.siyuan.config.fileTree.createDocAtTop = val)
                }
            })
        })
    )
}).describe(uiDescriptionRegistry.registerForm(
    {
        initData: async () => {
            return getSiyuanConfig().fileTree;
        },
        onchange: async (data: z.infer<typeof schema>) => {
            fetchPost("/api/setting/setFiletree", data)
        }
    }
))

const parseAsConfig = (rawConf: {}): Config.IConf["fileTree"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
}