/** 用途：校验外部菜单宿主的运行时结构；使用范围：菜单能力注册边界；解耦评估：Zod 是既有依赖，可提供稳定且可读的错误路径。 */
import {z} from "./imports";
/** 用途：固定校验成功后的菜单能力类型；使用范围：解析函数返回值；解耦评估：类型与运行时 schema 共同组成公开契约。 */
import type {IProtyleMenuPort} from "./menu.types";

/** 创建无共享可变状态的菜单 schema；该函数仅在宿主注册时调用一次。 */
const createProtyleMenuPortSchema = () => z.object({
    element: z.instanceof(HTMLElement),
    append: z.function(),
    remove: z.function(),
    popup: z.function(),
    fullscreen: z.function(),
    showSubMenu: z.function(),
    data: z.unknown().optional(),
    removeCB: z.union([z.function(), z.null()]).optional(),
}).loose();

/** 将 Zod issue 转换为适合外部宿主定位字段的单行错误。 */
const formatMenuPortIssues = (error: z.ZodError) => error.issues
    .map(issue => `${issue.path.join(".") || "menu"}: ${issue.message}`)
    .join("; ");

/**
 * 校验并返回菜单宿主能力。
 * 外部调用者会在注册阶段收到带字段路径的错误，而不是在编辑交互深处遇到缺失方法异常。
 */
export const parseProtyleMenuPort = (candidate: unknown): IProtyleMenuPort => {
    const result = createProtyleMenuPortSchema().safeParse(candidate);
    if (!result.success) {
        throw new Error(`Invalid Protyle menu host: ${formatMenuPortIssues(result.error)}`);
    }
    // 返回原宿主对象而不是 Zod 克隆，确保 data/removeCB 等菜单会话状态仍写入宿主自身。
    return candidate as IProtyleMenuPort;
};
