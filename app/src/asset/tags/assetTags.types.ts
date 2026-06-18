/** 用途：zod 验证库，定义标签结构 schema。使用范围：tags 模块类型定义。解耦评估：通过 imports.ts 转发。 */
import { z } from "./imports";

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
 * @显式返回类型原因: 类型守卫，TypeScript 无法推断类型谓词
 * @同步豁免: 类型守卫
 */
export function isValidTag(value: unknown): value is ITag {
    try {
        tagSchema.parse(value);
        return true;
    } catch {
        return false;
    }
}
