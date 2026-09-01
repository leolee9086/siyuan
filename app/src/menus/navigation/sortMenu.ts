/** 用途：读取排序标签；使用范围：文件树排序菜单；解耦评估：经本域网关直达国际化环境。 */
import {siyuanI18n} from "./imports";

/**
 * 作用：根据固定排序模式构造一个菜单条目。
 * 意图：集中保证选中图标、checked 状态和回调值始终使用同一个模式编号。
 * 调用时机：sortMenu 同步组装文件树排序菜单时调用。
 */
const createSortItem = (
    options: {
        id: string,
        mode: number | null,
        sortMode: number | null,
        label: string,
        clickEvent: (sort: number | null) => void,
    },
) => {
    const selected = options.sortMode === options.mode;
    return {
        id: options.id,
        ...(selected ? {icon: "iconSelect"} : {}),
        checked: selected,
        iconHTML: "",
        label: options.label,
        /** 用户选择该项时提交条目绑定的稳定排序模式。 */
        click: () => options.clickEvent(options.mode),
    };
};

/**
 * 作用：构建笔记本列表或单笔记本文件树的完整排序子菜单。
 * 意图：让所有宿主共享排序项顺序、模式编号、选中态和文案映射的唯一实现。
 * 调用时机：桌面/移动文件树显示排序菜单时同步调用。
 * @同步豁免: UI构建
 */
export const sortMenu = (type: "notebooks" | "notebook" | "document", sortMode: number | null,
                         clickEvent: (sort: number | null) => void) => {
    // @内联数组 完整排序菜单依赖固定顺序和分隔符位置，应在同一构建点审计。
    const menu: IMenu[] = [
        createSortItem({id: "fileNameASC", mode: 0, sortMode, label: siyuanI18n.fileNameASC, clickEvent}),
        createSortItem({id: "fileNameDESC", mode: 1, sortMode, label: siyuanI18n.fileNameDESC, clickEvent}),
        createSortItem({id: "fileNameNatASC", mode: 4, sortMode, label: siyuanI18n.fileNameNatASC, clickEvent}),
        createSortItem({id: "fileNameNatDESC", mode: 5, sortMode, label: siyuanI18n.fileNameNatDESC, clickEvent}),
        {id: "separator_1", type: "separator"},
        createSortItem({id: "createdASC", mode: 9, sortMode, label: siyuanI18n.createdASC, clickEvent}),
        createSortItem({id: "createdDESC", mode: 10, sortMode, label: siyuanI18n.createdDESC, clickEvent}),
        createSortItem({id: "modifiedASC", mode: 2, sortMode, label: siyuanI18n.modifiedASC, clickEvent}),
        createSortItem({id: "modifiedDESC", mode: 3, sortMode, label: siyuanI18n.modifiedDESC, clickEvent}),
        {id: "separator_2", type: "separator"},
        createSortItem({id: "refCountASC", mode: 7, sortMode, label: siyuanI18n.refCountASC, clickEvent}),
        createSortItem({id: "refCountDESC", mode: 8, sortMode, label: siyuanI18n.refCountDESC, clickEvent}),
        {id: "separator_3", type: "separator"},
        createSortItem({id: "docSizeASC", mode: 11, sortMode, label: siyuanI18n.docSizeASC, clickEvent}),
        createSortItem({id: "docSizeDESC", mode: 12, sortMode, label: siyuanI18n.docSizeDESC, clickEvent}),
        {id: "separator_4", type: "separator"},
        createSortItem({id: "subDocCountASC", mode: 13, sortMode, label: siyuanI18n.subDocCountASC, clickEvent}),
        createSortItem({id: "subDocCountDESC", mode: 14, sortMode, label: siyuanI18n.subDocCountDESC, clickEvent}),
        {id: "separator_5", type: "separator"},
        createSortItem({id: "customSort", mode: 6, sortMode, label: siyuanI18n.customSort, clickEvent}),
    ];
    // 单笔记本菜单额外支持继承全局文件树排序方式。
    if (type === "notebook") {
        menu.push(createSortItem({id: "sortByFiletree", mode: 15, sortMode, label: siyuanI18n.sortByFiletree, clickEvent}));
    } else if (type === "document") {
        // 文档菜单允许取消子文档排序继承（sortByParent 提交 null 模式）。
        menu.push(createSortItem({id: "sortByParent", mode: null, sortMode, label: siyuanI18n.sortByParent, clickEvent}));
    }
    return menu;
};
