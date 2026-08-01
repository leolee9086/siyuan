import type {SessionEntry} from "./imports";
import type {UserEntry} from "./imports";

/** 收窄用户消息条目，供编辑和历史导航逻辑读取正文。 */
export function isUserEntry(value: SessionEntry): value is UserEntry {
    return value.type === "user";
}
