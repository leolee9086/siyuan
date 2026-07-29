/** 用途：校验 Tree 收到的块数据仍兼容官方载荷；使用范围：仅限 Tree 块列表渲染边界。 */
import type {IBlock} from "./imports";
/** 用途：收窄到 Tree 渲染器所需的完整块投影；使用范围：本守卫返回类型；边界：仅类型依赖。 */
import type {TreeBlockData} from "./imports";

/** 确认内核块包含 Tree 渲染器实际读取的字段，避免把类型断言当作数据契约。 */
export const isTreeBlockData = (block: IBlock | TreeBlockData): block is TreeBlockData => {
    const hasRenderFields = typeof block.id === "string" &&
        typeof block.type === "string" &&
        "subType" in block && typeof block.subType === "string" &&
        typeof block.content === "string" &&
        typeof block.refText === "string" &&
        typeof block.defID === "string" &&
        typeof block.defPath === "string" &&
        typeof block.depth === "number" &&
        "count" in block && typeof block.count === "number" &&
        "folded" in block && typeof block.folded === "boolean";
    // Kernel 会把没有 IAL 的普通块序列化为 null，该值仍是合法块载荷。
    if (!hasRenderFields || block.ial === null) {
        return hasRenderFields;
    }
    // 非空 IAL 必须保持字符串键值映射结构。
    if (typeof block.ial !== "object" || Array.isArray(block.ial)) {
        return false;
    }
    return Object.values(block.ial).every((value) => typeof value === "string");
};
