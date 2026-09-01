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
import { genTurnsInto, genTurnsIntoGroups, genTurnsIntoOne } from "./turnInto/items";
import { getNextBlockSibling } from "../wysiwyg/getBlock";
import {buildEmptyParagraphTurnIntoMenu} from "./buildGutterTurnIntoMenu";
import {buildMultipleHeadingTransformMenu} from "./multiHeadingTransform";

/**
 * 检查选中的元素是否包含列表项，以及是否连续
 */
export const 检查选中元素状态 = (selectsElement: Element[]): { isList: boolean; isContinue: boolean } => {
    let isList = false;
    for (const item of selectsElement) {
        if (item?.classList.contains("li")) {
            isList = true;
            break;
        }
    }
    // S-Forge: 与上游 18349 保持一致的分组成连续性判定（getNextBlockSibling）
    const groups: Element[][] = [];
    selectsElement.forEach((item) => {
        const currentGroup = groups[groups.length - 1];
        const previousElement = currentGroup?.[currentGroup.length - 1];
        if (previousElement && previousElement.parentElement === item.parentElement &&
            getNextBlockSibling(previousElement) === item) {
            currentGroup.push(item);
        } else {
            groups.push([item]);
        }
    });
    const isContinue = groups.length === 1;
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
const computeGroups = (elements: Element[]): Element[][] => {
    const groups: Element[][] = [];
    elements.forEach((item) => {
        const currentGroup = groups[groups.length - 1];
        const previousElement = currentGroup?.[currentGroup.length - 1];
        if (previousElement && previousElement.parentElement === item.parentElement &&
            getNextBlockSibling(previousElement) === item) {
            currentGroup.push(item);
        } else {
            groups.push([item]);
        }
    });
    return groups;
};

const 生成分组列表类菜单项 = (protyle: IProtyle, groups: Element[][]): IMenu[] => {
    const insertKeymap = 获取插入快捷键();
    return [
        genTurnsIntoGroups({ menuId: "list", icon: "iconList", label: siyuanI18n.list, protyle, accelerator: insertKeymap.list.custom, selectsElementGroups: groups, type: "Blocks2ULs" }),
        genTurnsIntoGroups({ menuId: "orderedList", icon: "iconOrderedList", label: siyuanI18n["ordered-list"], accelerator: insertKeymap["ordered-list"].custom, protyle, selectsElementGroups: groups, type: "Blocks2OLs" }),
        genTurnsIntoGroups({ menuId: "check", icon: "iconCheck", label: siyuanI18n.check, accelerator: insertKeymap.check.custom, protyle, selectsElementGroups: groups, type: "Blocks2TLs" }),
        genTurnsIntoGroups({ menuId: "quote", icon: "iconQuote", label: siyuanI18n.quote, accelerator: insertKeymap.quote.custom, protyle, selectsElementGroups: groups, type: "Blocks2Blockquote" }),
        genTurnsIntoGroups({ menuId: "callout", icon: "iconCallout", label: (siyuanI18n as any).callout ?? "Callout", protyle, selectsElementGroups: groups, type: "Blocks2Callout" }),
    ];
};

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

    const groups = computeGroups(selectsElement);
    const computedIsContinue = groups.length === 1;

    // 1. 上游 18349 语义：非连续选中亦可转换列表/引用/提示块（通过分组事务）
    const turnIntoSubmenu: IMenu[] = [];
    turnIntoSubmenu.push(...生成分组列表类菜单项(protyle, groups));
    turnIntoSubmenu.push(genTurnsInto({ menuId: "paragraph", icon: "iconParagraph", label: siyuanI18n.paragraph, accelerator: 获取标题快捷键().paragraph.custom, protyle, selectsElement, type: "Blocks2Ps", isContinue: computedIsContinue }));

    // 2. 添加标题转换菜单项 heading1-6 (对应原始622-687行)
    turnIntoSubmenu.push(...生成标题菜单项组(protyle, selectsElement, computedIsContinue));

    // 3. 非列表时添加列表转换菜单项 已由分组项覆盖，保留对 isList 语义的兼容（不再单独追加）
    // 4. 尾部引用提示块已由分组项覆盖
    turnIntoSubmenu.push(...buildEmptyParagraphTurnIntoMenu(protyle, selectsElement));

    // 5. 添加主"转换为"菜单 (对应原始734-740行)
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "turnInto",
        icon: "iconRefresh",
        label: siyuanI18n.turnInto,
        type: "submenu",
        submenu: turnIntoSubmenu
    }).element);

    const multipleHeadingSubmenu = buildMultipleHeadingTransformMenu(protyle, selectsElement);
    if (multipleHeadingSubmenu.length > 0) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "tWithSubtitle",
            icon: "iconRefresh",
            label: siyuanI18n.tWithSubtitle,
            type: "submenu",
            submenu: multipleHeadingSubmenu,
        }).element);
    }

    // 6. 添加合并超级块菜单 (对应原始741-768行) - 仍以分组连续性为准
    添加合并超级块菜单(protyle, selectsElement, computedIsContinue);
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
