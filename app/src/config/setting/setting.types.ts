/** 设置领域公开的完整页签标识；具体注册表必须与此集合保持一致。 */
export type SettingTabId =
    | "editor"
    | "file"
    | "appearance"
    | "bazaar"
    | "flashcard"
    | "ai"
    | "AIProfiles"
    | "secretsVariables"
    | "assets"
    | "export"
    | "search"
    | "keymap"
    | "sync"
    | "access"
    | "app"
    | "about";

/** 设置搜索结果中因运行环境不可用而展示的条目说明。 */
export interface SettingSearchUnavailableItem {
    title: string;
    reason: string;
}
