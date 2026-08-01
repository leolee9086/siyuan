/** 用途：约束菜单条目领域类型；使用范围：Tiptap 外部建议回调值校验。 */
import type {BlockHit} from "./types";

/** 验证 Tiptap 未约束的 Mention 选择值具备完整块建议字段。 */
export const isBlockHit = (value: unknown): value is BlockHit => {
    if (!value || typeof value !== "object") {
        return false;
    }
    return "id" in value && typeof value.id === "string" &&
        "label" in value && typeof value.label === "string" &&
        "icon" in value && typeof value.icon === "string" &&
        "hPath" in value && typeof value.hPath === "string";
};
