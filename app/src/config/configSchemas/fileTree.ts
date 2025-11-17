import z from "zod"
import { fetchPost } from "../../ai/imports";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n";
import { uiDescriptionRegistry } from "./utils";
import { computed } from "vue";

export const schema = z.object({
    allowCreateDeeper: z.boolean().describe(
        uiDescriptionRegistry.registerItem({
            description: siyuanI18n.selectOpen,
            label: siyuanI18n.fileTree2,
            model:computed({
                get:()=>getSiyuanConfig().fileTree.alwaysSelectOpenedFile?true:false,
                set:(val:boolean)=>{
                    window.siyuan.config&&(window.siyuan.config.fileTree.alwaysSelectOpenedFile=val)
                }
            })
        })
    ),
    alwaysSelectOpenedFile: z.boolean(),
    closeTabsOnStart: z.boolean(),
    docCreateSavePath: z.string(),
    maxListCount: z.number(),
    maxOpenTabCount: z.number().min(1).max(32),
    openFilesUseCurrentTab: z.boolean(),
    refCreateSavePath: z.string(),
    refCreateSaveBox: z.string(),
    docCreateSaveBox: z.string(),
    removeDocWithoutConfirm: z.boolean(),
    sort: z.number(),
    useSingleLineSave: z.boolean(),
    largeFileWarningSize: z.number(),
    createDocAtTop: z.boolean()
}).describe(uiDescriptionRegistry.registerForm(
    {
        initData: async () => {
            getSiyuanConfig().fileTree
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