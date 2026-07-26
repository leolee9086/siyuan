/** 用途：完整 Dock 领域根。使用范围：持久化 Dock DOM 状态；解耦评估：序列化只读取聚合根公开状态，不加载具体 Dock class 或恢复构造流程。 */
import type {DockDomain} from "../dock.types";

/** 从一个 Dock 分区提取标签、尺寸、可见性和快捷键配置。 */
const extractSubDockItems = (dock: DockDomain, index: number) => {
    const data: Config.IUILayoutDockTab[] = [];
    const section = dock.elements[index];
    const items = section?.querySelectorAll(".dock__item") ?? [];
    for (const item of items) {
        const type = item.getAttribute("data-type");
        if (!type) {
            continue;
        }
        const height = item.getAttribute("data-height");
        const width = item.getAttribute("data-width");
        data.push({
            type,
            size: {
                height: height ? parseInt(height, 10) : 0,
                width: width ? parseInt(width, 10) : 0,
            },
            title: item.getAttribute("data-title") || "",
            show: item.classList.contains("dock__item--active"),
            icon: (() => {
                const useElement = item.querySelector("use");
                return (useElement?.getAttribute("xlink:href") || "").substring(1);
            })(),
            hotkey: item.getAttribute("data-hotkey") || "",
            hotkeyLangId: item.getAttribute("data-hotkeylangid") || "",
        });
    }
    return data;
};

/** 将 Dock 当前 DOM 状态序列化为布局配置。 @同步豁免: 需要绝对同步的DOM访问 */
export const dockToJSON = (dock: DockDomain) => {
    const upper = extractSubDockItems(dock, 0);
    const lower = extractSubDockItems(dock, 1);
    const data: Config.IUILayoutDockTab[][] = [];
    // 下区存在时仍保留空的上区数组，维持布局配置的固定分区索引。
    if (upper.length > 0 || lower.length > 0) {
        data.push(upper);
    }
    // 仅有实际下区条目时写入第二个分区，避免产生无意义的尾部空数组。
    if (lower.length > 0) {
        data.push(lower);
    }
    return {pin: dock.pin, data};
};
