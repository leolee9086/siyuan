/** 文件浏览领域内建 Dock 的稳定声明；布局层只消费这里的类型、位置和外观。 */
export interface FileBrowserDockDefinition {
    type: "sforge-file-browser" | "sforge-file-properties";
    icon: "iconFolder" | "iconInfo";
    title: string;
    position: "Left";
    column: 0 | 1;
    size: {width: number; height: number};
    show: false;
    hotkey: string;
    hotkeyLangId: string;
}

export const FILE_BROWSER_DOCK_TYPE = "sforge-file-browser";
export const FILE_PROPERTIES_DOCK_TYPE = "sforge-file-properties";

export const FILE_BROWSER_DOCK_DEFINITIONS = [
    {
        type: FILE_BROWSER_DOCK_TYPE,
        icon: "iconFolder",
        title: "文件浏览器",
        position: "Left",
        column: 0,
        size: {width: 320, height: 0},
        show: false,
        hotkey: "",
        hotkeyLangId: "",
    },
    {
        type: FILE_PROPERTIES_DOCK_TYPE,
        icon: "iconInfo",
        title: "文件属性",
        position: "Left",
        column: 1,
        size: {width: 320, height: 0},
        show: false,
        hotkey: "",
        hotkeyLangId: "",
    },
] as const satisfies readonly FileBrowserDockDefinition[];

export const FILE_BROWSER_DOCK_TYPES = FILE_BROWSER_DOCK_DEFINITIONS.map(definition => definition.type);

/** 为默认布局创建独立对象，避免布局恢复时改写共享声明。 */
export function createFileBrowserDockLayoutItem(definition: FileBrowserDockDefinition) {
    return {
        type: definition.type,
        size: {...definition.size},
        show: definition.show,
        icon: definition.icon,
        title: definition.title,
        hotkey: definition.hotkey,
        hotkeyLangId: definition.hotkeyLangId,
    };
}
