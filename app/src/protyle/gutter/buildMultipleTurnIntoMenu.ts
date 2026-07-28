/**
 * 多选块转换菜单构建模块
 * 从 index.ts 的 renderMultipleMenu 方法拆分而来
 * 
 * 原始逻辑顺序:
 * 1. isContinue时: 列表+有序列表+待办+引用+提示块 -> 段落(Blocks2Ps)
 * 2. !isContinue时: 段落(Blocks2Ps)
 * 3. heading1-6
 * 4. !isList时: 列表+有序列表+待办
 * 5. 引用+提示块
 */
import { MenuItem } from "../../menus/Menu.Item";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { genTurnsInto, genTurnsIntoOne } from "./turnInto/items";

/**
 * 检查选中的元素是否包含列表项，以及是否连续
 */
export const 检查选中元素状态 = (selectsElement: Element[]): { isList: boolean; isContinue: boolean } => {
    let isList = false;
    let isContinue = false;
    const 元素数量 = selectsElement.length;

    for (let index = 0; index < 元素数量; index++) {
        const item = selectsElement[index];
        if (!item) {
continue;
}
        if (item.classList.contains("li")) {
            isList = true;
            break;
        }
        const 下一个选中元素 = selectsElement[index + 1];
        const 下一个兄弟元素 = item.nextElementSibling;
        const 是连续的 = 下一个兄弟元素 && 下一个选中元素 && 下一个兄弟元素 === 下一个选中元素;
        if (是连续的) {
            isContinue = true;
            continue;
        }
        // 非最后一个元素但不连续
        if (index !== 元素数量 - 1) {
            isContinue = false;
            break;
        }
    }

    return { isList, isContinue };
};

// ==================== 快捷键获取辅助函数 ====================

const 获取插入快捷键 = () => getSiyuanConfig().keymap.editor.insert;
const 获取标题快捷键 = () => getSiyuanConfig().keymap.editor.heading;
const 获取通用快捷键 = () => getSiyuanConfig().keymap.editor.general;

// ==================== 辅助菜单项生成函数 ====================

/**
 * 生成列表类菜单项（列表+有序列表+待办）
 */
const 生成列表类菜单项 = (protyle: IProtyle, selectsElement: Element[]): IMenu[] => {
    const insertKeymap = 获取插入快捷键();
    const listKeymap = insertKeymap.list;
    const orderedListKeymap = insertKeymap["ordered-list"];
    const checkKeymap = insertKeymap.check;

    return [
        genTurnsIntoOne({ menuId: "list", icon: "iconList", label: siyuanI18n.list, protyle, ...(listKeymap?.custom && { accelerator: listKeymap.custom }), selectsElement, type: "Blocks2ULs" }),
        genTurnsIntoOne({ menuId: "orderedList", icon: "iconOrderedList", label: siyuanI18n["ordered-list"], ...(orderedListKeymap?.custom && { accelerator: orderedListKeymap.custom }), protyle, selectsElement, type: "Blocks2OLs" }),
        genTurnsIntoOne({ menuId: "check", icon: "iconCheck", label: siyuanI18n.check, ...(checkKeymap?.custom && { accelerator: checkKeymap.custom }), protyle, selectsElement, type: "Blocks2TLs" })
    ];
};

/**
 * 生成引用类菜单项（引用+提示块）
 */
const 生成引用类菜单项 = (protyle: IProtyle, selectsElement: Element[]): IMenu[] => {
    const insertKeymap = 获取插入快捷键();
    const quoteKeymap = insertKeymap.quote;
    const i18nAny = siyuanI18n as unknown as Record<string, string>;

    return [
        genTurnsIntoOne({ menuId: "quote", icon: "iconQuote", label: siyuanI18n.quote, ...(quoteKeymap?.custom && { accelerator: quoteKeymap.custom }), protyle, selectsElement, type: "Blocks2Blockquote" }),
        genTurnsIntoOne({ menuId: "callout", icon: "iconCallout", label: i18nAny.callout ?? "Callout", protyle, selectsElement, type: "Blocks2Callout" })
    ];
};

/**
 * 生成段落菜单项（使用 Blocks2Ps）
 */
const 生成段落菜单项 = (protyle: IProtyle, selectsElement: Element[], isContinue: boolean): IMenu => {
    const headingKeymap = 获取标题快捷键();
    return genTurnsInto({ menuId: "paragraph", icon: "iconParagraph", label: siyuanI18n.paragraph, accelerator: headingKeymap.paragraph.custom, protyle, selectsElement, type: "Blocks2Ps", isContinue });
};

// ==================== 连续选中时的初始菜单项 ====================

/**
 * 生成连续选中时的初始菜单项（列表+引用+提示块+段落）
 * 对应原始代码 533-588 行
 */
const 生成连续选中初始菜单项 = (protyle: IProtyle, selectsElement: Element[], isContinue: boolean): IMenu[] => {
    return [
        ...生成列表类菜单项(protyle, selectsElement),
        ...生成引用类菜单项(protyle, selectsElement),
        生成段落菜单项(protyle, selectsElement, isContinue)
    ];
};

// ==================== 非连续选中时的初始菜单项 ====================

/**
 * 生成非连续选中时的初始菜单项（仅段落）
 * 对应原始代码 610-620 行
 */
const 生成非连续选中初始菜单项 = (protyle: IProtyle, selectsElement: Element[], isContinue: boolean): IMenu[] => {
    const headingKeymap = 获取标题快捷键();
    return [
        genTurnsInto({
            menuId: "paragraph",
            icon: "iconParagraph",
            label: siyuanI18n.paragraph,
            accelerator: headingKeymap.paragraph.custom,
            protyle,
            selectsElement,
            type: "Blocks2Ps",
            isContinue
        })
    ];
};

// ==================== 标题菜单项 ====================

/**
 * 生成标题级别转换菜单项 (heading1-6)
 * 对应原始代码 622-687 行
 */
/**
 * 生成单个标题级别菜单项
 */
const 生成单个标题菜单项 = (
    level: 1 | 2 | 3 | 4 | 5 | 6,
    headingKeymap: ReturnType<typeof 获取标题快捷键>,
    i18nAny: Record<string, string>,
    protyle: IProtyle,
    selectsElement: Element[],
    isContinue: boolean
): IMenu => {
    const headingKey = `heading${level}`;
    const keymap = headingKeymap[headingKey as keyof typeof headingKeymap];
    const accelerator = keymap?.custom;

    return genTurnsInto({
        menuId: headingKey,
        icon: `iconH${level}`,
        label: i18nAny[headingKey] ?? `Heading ${level}`,
        ...(accelerator && { accelerator }),
        protyle,
        selectsElement,
        level,
        type: "Blocks2Hs",
        isContinue
    });
};

/**
 * 生成标题级别转换菜单项 (heading1-6)
 * 对应原始代码 622-687 行
 */
const 生成标题菜单项组 = (protyle: IProtyle, selectsElement: Element[], isContinue: boolean): IMenu[] => {
    const headingKeymap = 获取标题快捷键();
    const headingLevels = [1, 2, 3, 4, 5, 6] as const;
    const i18nAny = siyuanI18n as unknown as Record<string, string>;

    return headingLevels.map(level =>
        生成单个标题菜单项(level, headingKeymap, i18nAny, protyle, selectsElement, isContinue)
    );
};

// ==================== 非列表时的列表菜单项 ====================

/**
 * 生成列表转换菜单项（非列表时添加）
 * 对应原始代码 688-715 行
 */
const 生成列表转换菜单项组 = (protyle: IProtyle, selectsElement: Element[]): IMenu[] => {
    const insertKeymap = 获取插入快捷键();
    const listKeymap = insertKeymap.list;
    const orderedListKeymap = insertKeymap["ordered-list"];
    const checkKeymap = insertKeymap.check;

    return [
        genTurnsIntoOne({
            menuId: "list",
            icon: "iconList",
            label: siyuanI18n.list,
            ...(listKeymap?.custom && { accelerator: listKeymap.custom }),
            protyle,
            selectsElement,
            type: "Blocks2ULs"
        }),
        genTurnsIntoOne({
            menuId: "orderedList",
            icon: "iconOrderedList",
            label: siyuanI18n["ordered-list"],
            ...(orderedListKeymap?.custom && { accelerator: orderedListKeymap.custom }),
            protyle,
            selectsElement,
            type: "Blocks2OLs"
        }),
        genTurnsIntoOne({
            menuId: "check",
            icon: "iconCheck",
            label: siyuanI18n.check,
            ...(checkKeymap?.custom && { accelerator: checkKeymap.custom }),
            protyle,
            selectsElement,
            type: "Blocks2TLs"
        })
    ];
};

// ==================== 尾部引用菜单项 ====================

/**
 * 生成引用和提示块菜单项（结尾处）
 * 对应原始代码 717-733 行
 */
const 生成尾部引用提示块菜单项组 = (protyle: IProtyle, selectsElement: Element[]): IMenu[] => {
    const insertKeymap = 获取插入快捷键();
    const quoteKeymap = insertKeymap.quote;

    return [
        genTurnsIntoOne({
            menuId: "quote",
            icon: "iconQuote",
            label: siyuanI18n.quote,
            ...(quoteKeymap?.custom && { accelerator: quoteKeymap.custom }),
            protyle,
            selectsElement,
            type: "Blocks2Blockquote"
        }),
        genTurnsIntoOne({
            menuId: "callout",
            icon: "iconCallout",
            label: (siyuanI18n as unknown as Record<string, string>).callout ?? "Callout",
            protyle,
            selectsElement,
            type: "Blocks2Callout"
        })
    ];
};

// ==================== 合并超级块子菜单 ====================

/**
 * 构建合并超级块子菜单
 * 对应原始代码 748-766 行
 */
const 构建合并超级块子菜单 = (protyle: IProtyle, selectsElement: Element[]): IMenu[] => {
    const generalKeymap = 获取通用快捷键();

    return [
        genTurnsIntoOne({
            menuId: "hLayout",
            label: siyuanI18n.hLayout,
            accelerator: generalKeymap.hLayout.custom,
            icon: "iconSplitLR",
            protyle,
            selectsElement,
            type: "BlocksMergeSuperBlock",
            level: "col"
        }),
        genTurnsIntoOne({
            menuId: "vLayout",
            label: siyuanI18n.vLayout,
            accelerator: generalKeymap.vLayout.custom,
            icon: "iconSplitTB",
            protyle,
            selectsElement,
            type: "BlocksMergeSuperBlock",
            level: "row"
        })
    ];
};

// ==================== 主函数 ====================

/**
 * 构建"转换为"菜单
 * 对应原始代码 531-768 行
 */
export const 构建转换菜单 = (
    protyle: IProtyle,
    selectsElement: Element[],
    isList: boolean,
    isContinue: boolean
): void => {
    // 卫语句：列表项或禁用状态不显示转换菜单 (对应原始531行)
    if (isList || protyle.disabled) {
        return;
    }

    // 1. 根据是否连续选中构建初始子菜单 (对应原始533-620行)
    const turnIntoSubmenu: IMenu[] = isContinue
        ? 生成连续选中初始菜单项(protyle, selectsElement, isContinue)
        : 生成非连续选中初始菜单项(protyle, selectsElement, isContinue);

    // 2. 添加标题转换菜单项 heading1-6 (对应原始622-687行)
    turnIntoSubmenu.push(...生成标题菜单项组(protyle, selectsElement, isContinue));

    // 3. 非列表时添加列表转换菜单项 (对应原始688-715行)
    if (!isList) {
        turnIntoSubmenu.push(...生成列表转换菜单项组(protyle, selectsElement));
    }

    // 4. 添加尾部引用和提示块菜单项 (对应原始717-733行)
    turnIntoSubmenu.push(...生成尾部引用提示块菜单项组(protyle, selectsElement));

    // 5. 添加主"转换为"菜单 (对应原始734-740行)
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "turnInto",
        icon: "iconRefresh",
        label: siyuanI18n.turnInto,
        type: "submenu",
        submenu: turnIntoSubmenu
    }).element);

    // 6. 添加合并超级块菜单 (对应原始741-768行)
    添加合并超级块菜单(protyle, selectsElement, isContinue);
};

/**
 * 添加合并超级块菜单
 * 对应原始代码 741-768 行
 */
const 添加合并超级块菜单 = (
    protyle: IProtyle,
    selectsElement: Element[],
    isContinue: boolean
): void => {
    // 卫语句：非连续选中不显示合并菜单
    if (!isContinue) {
        return;
    }

    const 第一个元素 = selectsElement[0];
    if (!第一个元素) {
        return;
    }

    const 父元素 = 第一个元素.parentElement;
    const 是超级块子元素 = 父元素?.classList.contains("sb") ?? false;
    const 父元素子数量 = 父元素?.childElementCount ?? 0;
    const 是全部子元素 = selectsElement.length + 1 === 父元素子数量;

    // 卫语句：已经是超级块的全部子元素时不显示合并菜单 (对应原始741-742行的条件)
    if (是超级块子元素 && 是全部子元素) {
        return;
    }

    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "mergeSuperBlock",
        icon: "iconSuper",
        label: siyuanI18n.merge + " " + siyuanI18n.superBlock,
        type: "submenu",
        submenu: 构建合并超级块子菜单(protyle, selectsElement)
    }).element);
};
