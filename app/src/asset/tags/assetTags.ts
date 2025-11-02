import { z } from "zod";
import { Workspace } from "../../data/kernelAPI/defaultWorkspace";
import { localKernel } from "../../ai/imports";
const localWorkerSpace = new Workspace(localKernel)
/**
 * 标签接口定义
 */
export interface ITag {
    /** 标签名称 */
    label: string;
    /** 关联的资产文件列表 */
    assets?: string[];
}

/**
 * 使用 zod 定义的标签验证模式
 */
export const tagSchema = z.object({
    label: z.string(),
    assets: z.array(z.string()).optional()
});

/**
 * 标签类型推断
 */
export type TagType = z.infer<typeof tagSchema>;

/**
 * 从标签中移除文件
 * @param fileNames - 要移除的文件名数组
 * @param tagLabel - 目标标签的名称
 * @param tags - 标签数组
 * @returns 更新后的标签数组，如果未找到指定标签则返回原数组
 */
export async function removeFilesFromTag(
    fileNames: string[],
    tagLabel: string,
    tags: ITag[]
): Promise<ITag[] | undefined> {
    try {
        if (tags) {
            const tag = tags.find(item => item.label === tagLabel);
            if (tag && tag.assets) {
                // 从资产列表中移除指定文件名
                tag.assets = tag.assets.filter(asset => !fileNames.includes(asset));
                return tags;
            }
        }
    } catch (error) {
        console.error("Error removing files from tag:", error);
    }
}

/**
 * 创建新标签
 * @param label - 标签名称
 * @param assets - 可选的初始资产文件列表
 * @returns 新创建的标签对象
 */
export function createTag(label: string, assets?: string[]): ITag {
    return {
        label,
        assets: assets || []
    };
}

/**
 * 根据标签名称查找标签
 * @param label - 要查找的标签名称
 * @param tags - 标签数组
 * @returns 找到的标签对象，如果未找到则返回 undefined
 */
export function findTagByLabel(label: string, tags: ITag[]): ITag | undefined {
    return tags.find(item => item.label === label);
}

/**
 * 获取标签的所有资产文件
 * @param tag - 标签对象
 * @returns 资产文件名数组，如果标签没有资产则返回空数组
 */
export function getTagAssets(tag: ITag): string[] {
    return tag.assets || [];
}

/**
 * 验证标签对象是否符合规范
 * @param tag - 要验证的标签对象
 * @returns 验证结果，包含是否有效和错误信息
 */
export function validateTag(tag: unknown): { isValid: boolean; error?: string } {
    try {
        const parsedTag = tagSchema.parse(tag);
        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            error: error instanceof Error ? error.message : "Unknown validation error"
        };
    }
}

/**
 * 将文件添加到指定标签中
 * @param fileNames - 要添加的文件名数组
 * @param tagLabel - 目标标签的名称
 * @param tags - 标签数组
 * @returns 更新后的标签数组，如果未找到指定标签则返回原数组
 */
export async function addFilesToTag(
    fileNames: string[],
    tagLabel: string,
    tags: ITag[]
): Promise<ITag[] | undefined> {
    try {
        if (tags) {
            const tag = tags.find(item => item.label === tagLabel);
            if (tag) {
                if (!tag.assets) {
                    tag.assets = [];
                }
                // 添加文件名到资产列表中
                tag.assets = Array.from(new Set([...tag.assets, ...fileNames]));
                return tags
            }
        }
    } catch (error) {
        console.error("Error adding files to tag:", error);
    }
}
const loadAssetsTags = async ():Promise<TagType[]> => {
    let data:TagType[] = [];
    if (await localWorkerSpace.exists(`/data/storage/tags/assets.json`)) {
        let raw = await localWorkerSpace.readFile(`/data/storage/tags/assets.json`)
        if(typeof raw === 'string'){
            data =JSON.parse(raw)
        }
    } else {
        await localWorkerSpace.writeFile(`/data/storage/tags/assets.json`, JSON.stringify([]));
    }
    return data;
}