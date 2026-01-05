import { z } from "zod";

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
 * 类型守卫：验证对象是否为有效的 ITag
 * @param value - 要验证的对象
 * @returns 如果是有效的 ITag 返回 true，并收窄类型
 */
export function isValidTag(value: unknown): value is ITag {
    try {
        tagSchema.parse(value);
        return true;
    } catch {
        return false;
    }
}
