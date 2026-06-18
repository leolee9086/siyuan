/** 用途：Workspace 类，提供文件系统操作能力。使用范围：tags 模块加载和持久化标签数据。解耦评估：通过 imports.ts 转发。 */
import { Workspace } from "./imports";
/** 用途：内核 SDK 客户端实例。使用范围：tags 模块创建 Workspace 实例。解耦评估：通过 imports.ts 转发。 */
import { kernelClient } from "./imports";
/** 用途：标签类型定义和类型守卫。使用范围：assetTags 模块类型验证。解耦评估：本地类型定义，仅在此处使用。 */
import { ITag } from "./assetTags.types";
/** 用途：标签 schema 和类型推断。使用范围：assetTags 模块数据验证。解耦评估：本地类型定义。 */
import { tagSchema } from "./assetTags.types";
/** 用途：标签类型。使用范围：assetTags 模块返回类型。解耦评估：本地类型定义。 */
import { TagType } from "./assetTags.types";
/** 用途：类型守卫函数，验证对象是否为有效标签。使用范围：assetTags 模块数据验证。解耦评估：本地类型定义。 */
import { isValidTag } from "./assetTags.types";

const localWorkerSpace = new Workspace(kernelClient);

/** 导出标签类型定义，供外部模块使用 */
export { ITag, tagSchema, TagType };

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
) {
    try {
        const tag = tags?.find(item => item.label === tagLabel);
        // 只有当标签包含资产列表时才执行移除操作
        if (tag?.assets) {
            // 从资产列表中移除指定文件名
            tag.assets = tag.assets.filter(asset => !fileNames.includes(asset));
            return tags;
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
 * @同步豁免: 类型守卫 — 纯对象构造器，无异步依赖
 */
export function createTag(label: string, assets?: string[]) {
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
 * @同步豁免: 类型守卫 — 纯数组查找，无异步依赖
 */
// @柯里化
export const findTagByLabel = (label: string, tags: ITag[]) => tags.find(item => item.label === label);

/**
 * 获取标签的所有资产文件
 * @param tag - 标签对象
 * @returns 资产文件名数组，如果标签没有资产则返回空数组
 * @同步豁免: 类型守卫 — 纯属性读取，无异步依赖
 */
export function getTagAssets(tag: ITag) {
    return tag.assets || [];
}

/**
 * 验证标签对象是否符合规范
 * @param tag - 要验证的标签对象
 * @returns 验证结果，包含是否有效和错误信息
 * @同步豁免: 类型守卫 — 纯 schema 验证，无异步依赖
 */
export function validateTag(tag: unknown) {
    try {
        tagSchema.parse(tag);
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
) {
    try {
        const tag = tags?.find(item => item.label === tagLabel);
        if (tag) {
            // 确保 assets 数组存在，然后添加文件名（去重）
            tag.assets ??= [];
            tag.assets = Array.from(new Set([...tag.assets, ...fileNames]));
            return tags;
        }
    } catch (error) {
        console.error("Error adding files to tag:", error);
    }
}
/**
 * 从本地存储加载素材标签数据
 * 
 * @作用 从 /data/storage/tags/assets.json 文件中读取并解析素材标签列表。
 * 如果文件不存在，会自动创建空文件并返回空数组。
 * 
 * @意图 提供统一的标签数据加载入口，确保标签存储文件的存在性，
 * 避免文件不存在时的读取错误。通过自动创建空文件的方式实现优雅降级。
 * 
 * @调用时机 在需要获取全量标签数据时调用，通常用于：
 * - 标签管理模块初始化时加载现有标签
 * - 标签选择器/过滤器需要展示所有可用标签时
 * - 其他需要访问完整标签列表的场景
 * 
 * @问题/改进
 * - 当前为私有函数未导出，如需在其他模块使用需要导出
 * - 建议添加缓存机制避免频繁文件 I/O
 * 
 * @returns 标签数组，如果文件不存在、损坏或验证失败则返回空数组
 */
const loadAssetsTags = async () => {
    try {
        // 检查文件是否存在，不存在则创建空文件
        if (!(await localWorkerSpace.exists("/data/storage/tags/assets.json"))) {
            await localWorkerSpace.writeFile("/data/storage/tags/assets.json", JSON.stringify([]));
            return [];
        }

        // 读取文件内容
        const raw = await localWorkerSpace.readFile("/data/storage/tags/assets.json");
        // readFile 可能返回非字符串类型（如 Buffer），此时按空数据处理
        if (typeof raw !== "string") {
            console.warn("标签文件内容格式异常，返回空数组");
            return [];
        }

        // 解析 JSON，捕获可能的解析错误
        let parsedData: unknown;
        try {
            parsedData = JSON.parse(raw);
        } catch (parseError) {
            console.error("标签文件 JSON 解析失败，文件可能已损坏:", parseError);
            // 备份损坏的文件
            const backupPath = `/data/storage/tags/assets.json.corrupted.${Date.now()}`;
            await localWorkerSpace.writeFile(backupPath, raw);
            console.log(`已将损坏的文件备份至: ${backupPath}`);
            // 重置为空数组
            await localWorkerSpace.writeFile("/data/storage/tags/assets.json", JSON.stringify([]));
            return [];
        }

        // 类型守卫：确保是数组
        if (!Array.isArray(parsedData)) {
            console.error("标签文件内容不是数组，返回空数组");
            return [];
        }

        // 验证每个标签项的结构
        const validatedTags: TagType[] = [];
        for (const item of parsedData) {
            // 使用类型守卫验证并收窄类型
            if (!isValidTag(item)) {
                console.warn("发现无效的标签项，已跳过:", item);
                continue;
            }
            // 此时 item 的类型已被收窄为 ITag，可以安全使用
            validatedTags.push(item);
        }

        return validatedTags;
    } catch (error) {
        console.error("加载标签数据时发生未预期的错误:", error);
        return [];
    }
};