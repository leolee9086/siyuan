/** 用途：移动编辑器能力签名；使用范围：插件 API 读取注册能力后的运行时校验；解耦评估：纯类型依赖。 */
import type { IMobileFileOpenPort } from "./openMobileFile.types";

/** 校验移动编辑器能力，中央注册表只负责保存不透明值。 */
export function isMobileFileOpenPort(value: unknown): value is IMobileFileOpenPort {
    if (!value || typeof value !== "object") {
        return false;
    }
    return typeof (value as Record<string, unknown>).open === "function";
}
