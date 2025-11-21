import z from "zod"
import { fetchPost } from "../../ai/imports";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n";
import { computed } from "vue";
// 通用的计算属性构建器

const buildComputed = <K extends keyof Config.IConf["fileTree"]>(key: K) => {
    return computed({
        get: () => getSiyuanConfig().fileTree[key],
        set: (val: Config.IConf["fileTree"][K]) => {
            getSiyuanConfig().fileTree[key] = val;
        }
    })
}
export const schema = z.object({
    // "允许创建深度大于 7 层的子文档"
    // 某些系统路径深度太深会出现问题
    allowCreateDeeper: z.boolean().meta({
        description: siyuanI18n.fileTree19,
        label: siyuanI18n.fileTree18,
        model: buildComputed("allowCreateDeeper")
    }),
    // "始终定位打开的文档"
    alwaysSelectOpenedFile: z.boolean().meta({
        description: siyuanI18n.fileTree2,
        label: siyuanI18n.selectOpen,
        model: buildComputed("alwaysSelectOpenedFile")
    }),
    // "启动时关闭所有页签"
    closeTabsOnStart: z.boolean().meta({
        description: siyuanI18n.fileTree10,
        label: siyuanI18n.fileTree9,
        model: buildComputed("closeTabsOnStart")
    }),
    // "新建文档存放位置"
    docCreateSavePath: z.string().meta({
        description: siyuanI18n.fileTree13,
        label: siyuanI18n.fileTree12,
        model: buildComputed("docCreateSavePath")
    }),
    // "最大列出数量"
    maxListCount: z.number().min(1).max(10240).meta({
        description: siyuanI18n.fileTree17,
        label: siyuanI18n.fileTree16,
        model: buildComputed("maxListCount")
    }),
    // "页签打开最大数量"
    maxOpenTabCount: z.number().min(1).max(32).meta({
        description: siyuanI18n.tabLimit1,
        label: siyuanI18n.tabLimit,
        model: buildComputed("maxOpenTabCount")
    }),
    // "在当前页签中打开"
    openFilesUseCurrentTab: z.boolean().meta({
        description: siyuanI18n.fileTree8,
        label: siyuanI18n.fileTree7,
        model: buildComputed("openFilesUseCurrentTab")
    }),
    // "块引新建文档存放位置"
    refCreateSavePath: z.string().meta({
        description: siyuanI18n.fileTree6,
        label: siyuanI18n.fileTree5,
        model: buildComputed("refCreateSavePath")
    }),
    // "块引新建文档存放笔记本"
    refCreateSaveBox: z.string().meta({
        description: siyuanI18n.fileTree6,
        label: siyuanI18n.fileTree5,
        model: buildComputed("refCreateSaveBox")
    }),
    // "新建文档存放笔记本"
    docCreateSaveBox: z.string().meta({
        description: siyuanI18n.fileTree13,
        label: siyuanI18n.fileTree12,
        model: buildComputed("docCreateSaveBox")
    }),
    // "删除文档时不需要确认"
    removeDocWithoutConfirm: z.boolean().meta({
        description: siyuanI18n.fileTree4,
        label: siyuanI18n.fileTree3,
        model: buildComputed("removeDocWithoutConfirm")
    }),
    // "超大文件提醒"
    largeFileWarningSize: z.number().min(2).max(10240).meta({
        description: siyuanI18n.fileTree23,
        label: siyuanI18n.fileTree22,
        model: buildComputed("largeFileWarningSize")
    }),
    // "新建子文档放置在顶部"
    createDocAtTop: z.boolean().meta({
        description: siyuanI18n.fileTree25,
        label: siyuanI18n.fileTree24,
        model: buildComputed("createDocAtTop")
    }),
    useSingleLineSave: z.boolean().meta({
        description: siyuanI18n.fileTree21,
        label: siyuanI18n.fileTree20,
        model: buildComputed("useSingleLineSave")
    }),
    // "排序"
    sort: z.number().meta({
        description: siyuanI18n.sort,
        label: siyuanI18n.sort,
        options: [
            { value: 0, label: siyuanI18n.fileNameASC },
            { value: 1, label: siyuanI18n.fileNameDESC },
            { value: 4, label: siyuanI18n.fileNameNatASC },
            { value: 5, label: siyuanI18n.fileNameNatDESC },
            { value: 9, label: siyuanI18n.createdASC },
            { value: 10, label: siyuanI18n.createdDESC },
            { value: 2, label: siyuanI18n.modifiedASC },
            { value: 3, label: siyuanI18n.modifiedDESC },
            { value: 7, label: siyuanI18n.refCountASC },
            { value: 8, label: siyuanI18n.refCountDESC },
            { value: 11, label: siyuanI18n.docSizeASC },
            { value: 12, label: siyuanI18n.docSizeDESC },
            { value: 13, label: siyuanI18n.subDocCountASC },
            { value: 14, label: siyuanI18n.subDocCountDESC },
            { value: 6, label: siyuanI18n.customSort },
        ],
        model: buildComputed("sort")
    })
}).meta(
    {
        initData: async () => {
            return getSiyuanConfig().fileTree;
        },
        onchange: async (data: z.infer<typeof schema>) => {
            fetchPost("/api/setting/setFiletree", data)
        }
    }
)

const parseAsConfig = (rawConf: {}): Config.IConf["fileTree"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
}