import {siyuanI18n} from "../../../../util/siyuanEnvironments/i18n.getI18n.environment";

/** 将 DOM 属性值穷举收窄为属性视图列类型，未知值按既有默认语义归入 text。 */
/** @同步豁免: 类型守卫 */
export const toTAVCol = (value: string | null | undefined): TAVCol => {
    // 只接受协议声明的完整列类型集合，DOM 中的缺失值或未知值使用既有 text 默认值。
    if (value === "text" || value === "block" || value === "number" || value === "select" ||
        value === "mSelect" || value === "relation" || value === "rollup" || value === "date" ||
        value === "updated" || value === "created" || value === "url" || value === "mAsset" ||
        value === "email" || value === "phone" || value === "template" || value === "checkbox" ||
        value === "lineNumber") {
        return value;
    }
    return "text";
};

/**
 * 根据列类型获取本地化的列类型显示名称
 *
 * 作用：将 TAVCol 类型标识转换为用户可读的本地化名称
 * 意图：为数据视图的列类型提供统一的名称解析入口，集中管理类型→名称映射
 * 调用时机：列编辑面板标题、类型切换菜单项、表头右键菜单等 UI 构建场景
 *
 * @param type - 数据视图列的类型标识
 * @returns 对应的本地化显示名称
 */
/** @同步豁免: UI构建 — 纯映射函数，用于同步构建 HTML 字符串，无异步数据源 */
export const getColNameByType = (type: TAVCol): string => {
    const attrView = siyuanI18n["_attrView"];
    const nameMap: Record<TAVCol, string> = {
        text: siyuanI18n.text,
        number: siyuanI18n.number,
        select: siyuanI18n.select,
        date: siyuanI18n.date,
        phone: siyuanI18n.phone,
        email: siyuanI18n.email,
        template: siyuanI18n.template,
        mSelect: siyuanI18n.multiSelect,
        relation: siyuanI18n.relation,
        rollup: siyuanI18n.rollup,
        updated: siyuanI18n.updatedTime,
        created: siyuanI18n.createdTime,
        url: siyuanI18n.link,
        mAsset: siyuanI18n.assets,
        checkbox: siyuanI18n.checkbox,
        block: attrView.key,
        lineNumber: siyuanI18n.lineNumber,
    };
    return nameMap[type];
};

/**
 * 列类型到图标名称的静态映射表
 *
 * 作用：将数据视图列的内部类型标识转换为对应的 SVG 图标名
 * 意图：集中管理类型→图标映射，保持图标选择的一致性
 * 调用时机：被 getColIconByType 引用
 */
const colIconMap: Record<TAVCol, string> = {
    text: "iconAlignLeft",
    block: "iconKey",
    number: "iconNumber",
    select: "iconListItem",
    mSelect: "iconList",
    relation: "iconOpen",
    rollup: "iconSearch",
    date: "iconCalendar",
    updated: "iconClock",
    created: "iconClock",
    url: "iconLink",
    mAsset: "iconImage",
    email: "iconEmail",
    phone: "iconPhone",
    template: "iconMath",
    checkbox: "iconCheck",
    lineNumber: "iconOrderedList",
};

/**
 * 根据列类型获取对应的 SVG 图标名称
 *
 * 作用：将 TAVCol 类型标识转换为 SVG sprite 中的图标 ID
 * 意图：为数据视图的列类型提供统一的图标解析入口
 * 调用时机：列编辑面板图标、类型切换菜单项图标、表头右键菜单图标等 UI 构建场景
 *
 * @param type - 数据视图列的类型标识
 * @returns 对应的 SVG 图标名称（如 "iconAlignLeft"）
 */
/** @同步豁免: UI构建 — 纯静态映射查表，用于同步构建 HTML 字符串，无异步数据源 */
export const getColIconByType = (type: TAVCol): string => {
    return colIconMap[type];
};

/**
 * 根据列类型生成默认的列数据对象。
 *
 * 作用：创建一个包含所有必要字段的 IAVColumn 对象，字段值为默认值
 * 意图：集中管理列数据的默认值生成，避免各处重复构造
 * 调用时机：添加新列、复制列等需要创建列数据的场景
 *
 * @param type - 列类型
 * @param id - 列 ID
 * @param name - 列名称
 * @returns 包含默认值的 IAVColumn 对象
 */
/** @同步豁免: UI构建 — 纯数据构造函数，无异步数据源 */
export const genColDataByType = (type: TAVCol, id: string, name: string) => {
    const colData: IAVColumn = {
        hidden: false,
        icon: "",
        id,
        name,
        desc: "",
        numberFormat: "",
        pin: false,
        template: "",
        type,
        width: "",
        wrap: false,
        calc: {}
    };
    return colData;
};
