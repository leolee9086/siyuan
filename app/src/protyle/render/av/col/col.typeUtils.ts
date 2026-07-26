/** 将 DOM 属性值穷举收窄为属性视图列类型，未知值按既有默认语义归入 text。 */
/** @同步豁免: 类型守卫 */
export const toTAVCol = (value: string | null | undefined) => {
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
export const getColNameByType = (type: TAVCol) => {
    const languages = window.siyuan.languages;
    // 主键名称位于嵌套语言域；仅在 block 分支读取，避免其它列查询产生无关的嵌套代理访问。
    if (type === "block") {
        const attrView = languages["_attrView"];
        return attrView.key;
    }
    const nameMap: Record<Exclude<TAVCol, "block">, string> = {
        text: languages.text,
        number: languages.number,
        select: languages.select,
        date: languages.date,
        phone: languages.phone,
        email: languages.email,
        template: languages.template,
        mSelect: languages.multiSelect,
        relation: languages.relation,
        rollup: languages.rollup,
        updated: languages.updatedTime,
        created: languages.createdTime,
        url: languages.link,
        mAsset: languages.assets,
        checkbox: languages.checkbox,
        lineNumber: languages.lineNumber,
    };
    return nameMap[type];
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
export const getColIconByType = (type: TAVCol) => {
    const iconMap = {
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
    } satisfies Record<TAVCol, string>;
    return iconMap[type];
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
