/**
 * 用途：获取可编辑字段集合。
 * 使用范围：批量字段编辑菜单构建时遍历字段。
 * 解耦评估：字段可编辑性判定属 AV 领域规则，继续通过 batchEdit 网关复用最稳妥。
 */
import {getEditableAVFields} from "./imports";
/**
 * 用途：打开字段编辑器。
 * 使用范围：各类字段菜单点击后打开对应编辑面板。
 * 解耦评估：编辑器打开依赖 AV 上下文，集中在 batchEdit 中维护比在菜单层手写更稳妥。
 */
import {openAVFieldEditor} from "./imports";
/**
 * 用途：更新字段值。
 * 使用范围：checkbox 子菜单直接提交值变更。
 * 解耦评估：值更新需组合事务与 DOM，继续通过 batchEdit 复用最稳妥。
 */
import {updateAVFieldValue} from "./imports";
/**
 * 用途：按类型获取列图标。
 * 使用范围：菜单项图标回退时使用。
 * 解耦评估：列图标映射属列类型工具，继续通过 col.typeUtils 复用最稳妥。
 */
import {getColIconByType} from "./imports";
/**
 * 用途：按类型获取列名。
 * 使用范围：字段名缺失时的回退标签。
 * 解耦评估：列名映射与图标同属类型工具，集中复用更易跟随类型演进。
 */
import {getColNameByType} from "./imports";
/**
 * 用途：渲染 emoji 图标。
 * 使用范围：字段图标为 emoji 时渲染。
 * 解耦评估：emoji 渲染为通用 UI 能力，继续通过 emoji 网关复用最稳妥。
 */
import {unicode2Emoji} from "./imports";
/**
 * 用途：转义 HTML。
 * 使用范围：字段名渲染到菜单 label 时防止注入。
 * 解耦评估：转义为通用 DOM 安全能力，继续复用最稳妥。
 */
import {escapeHtml} from "./imports";
/**
 * 用途：读取国际化文案。
 * 使用范围：菜单 label 如 checked/unchecked/addAttr 等。
 * 解耦评估：文案通过 i18n 环境统一提供，继续复用最稳妥。
 */
import {siyuanI18n} from "./imports";
/**
 * 作用：为 checkbox 字段构造“选中/未选中”子菜单。
 * 意图：复用同一套 updateAVFieldValue 调用，仅通过 checked 取值区分，避免在主流程重复拼接 submenu。
 * 调用时机：字段类型为 checkbox 时由 buildFieldMenuItem 调用。
 * 问题/改进：当前直接依赖 siyuanI18n 文案，后续可抽离为字段类型到文案的映射表。
 */
const buildCheckboxSubmenu = (protyle: IProtyle, blockElement: HTMLElement, field: IAVColumn) => {
    return [{
        iconHTML: "",
        label: siyuanI18n.checked,
        /**
         * 作用：提交 checkbox 选中态
         * 意图：复用 updateAVFieldValue 以 checked:true 更新字段
         * 调用时机：用户点击“已选中”子菜单时
         */
        click(element: HTMLElement) {
            void updateAVFieldValue({
                protyle,
                blockElement,
                field,
                anchorElement: element,
                value: {checked: true},
            });
        },
    }, {
        iconHTML: "",
        label: siyuanI18n.unchecked,
        /**
         * 作用：提交 checkbox 未选中态
         * 意图：复用 updateAVFieldValue 以 checked:false 更新字段
         * 调用时机：用户点击“未选中”子菜单时
         */
        click(element: HTMLElement) {
            void updateAVFieldValue({
                protyle,
                blockElement,
                field,
                anchorElement: element,
                value: {checked: false},
            });
        },
    }];
};

/**
 * 作用：为多值类字段（mSelect/mAsset/relation）构造“添加/移除/替换”子菜单。
 * 意图：将三种模式的 openAVFieldEditor 调用收敛到同一映射，避免在主流程重复展开。
 * 调用时机：字段类型命中多值集合时由 buildFieldMenuItem 调用。
 * 问题/改进：当前通过 as const 固定 label/mode 元组，后续若模式增多可改为配置驱动。
 */
const buildMultiValueSubmenu = (protyle: IProtyle, blockElement: HTMLElement, field: IAVColumn) => {
    const modes = [
        [siyuanI18n.addAttr, "add"],
        [siyuanI18n.remove, "remove"],
        [siyuanI18n.replace, "replace"],
    ] as const;
    const submenu: IMenu[] = [];
    for (const [label, mode] of modes) {
        submenu.push({
            iconHTML: "",
            label,
            /**
             * 作用：打开多值字段的对应模式编辑器
             * 意图：将 add/remove/replace 三种模式收敛到同一入口
             * 调用时机：用户点击“添加/移除/替换”子菜单时
             */
            click(element: HTMLElement) {
                openAVFieldEditor({protyle, blockElement, field, anchorElement: element, mode});
                return true;
            },
        });
    }
    return submenu;
};

/**
 * 作用：为单个可编辑字段构造对应的 IMenu 配置。
 * 意图：将 checkbox / 多值 / 单值三种分支收敛到单一入口，主流程只需遍历字段。
 * 调用时机：getAVEditFieldMenuItems 遍历 getEditableAVFields 时逐字段调用。
 * 问题/改进：当前仍在 item 上直接挂 click/submenu，后续若菜单协议变化可改为工厂返回完整 IMenu。
 * @显式返回类型原因: 需固定返回 IMenu 以保证工厂输出可直接推入菜单数组，避免调用方重复收窄
 */
const buildFieldMenuItem = (protyle: IProtyle, blockElement: HTMLElement, field: IAVColumn): IMenu => {
    const item: IMenu = {
        iconHTML: field.icon ? unicode2Emoji(field.icon, "b3-menu__icon", true) :
            `<svg class="b3-menu__icon"><use xlink:href="#${getColIconByType(field.type)}"></use></svg>`,
        label: escapeHtml(field.name || getColNameByType(field.type)),
    };
    // checkbox 类型需提供选中/未选中子菜单，直接返回避免继续走多值分支
    if (field.type === "checkbox") {
        item.type = "submenu";
        item.submenu = buildCheckboxSubmenu(protyle, blockElement, field);
        return item;
    }
    // 多值类型（mSelect/mAsset/relation）需提供添加/移除/替换子菜单
    if (["mSelect", "mAsset", "relation"].includes(field.type)) {
        item.type = "submenu";
        item.submenu = buildMultiValueSubmenu(protyle, blockElement, field);
        return item;
    }
    /**
     * 作用：打开单值字段编辑器
     * 意图：为普通字段提供直接编辑入口，复用 openAVFieldEditor
     * 调用时机：用户点击单值字段菜单项时
     */
    item.click = (element) => {
        openAVFieldEditor({protyle, blockElement, field, anchorElement: element});
        return true;
    };
    return item;
};

/**
 * 构建选择工具栏与右键菜单共用的批量字段编辑菜单。
 * @显式返回类型原因: 需固定返回 IMenu[] 供调用方直接消费，避免推断为联合数组
 * @同步豁免: UI构建
 */
export const getAVEditFieldMenuItems = (protyle: IProtyle, blockElement: HTMLElement): IMenu[] => {
    const fields = getEditableAVFields(blockElement);
    const menuItems: IMenu[] = [];
    for (const field of fields) {
        menuItems.push(buildFieldMenuItem(protyle, blockElement, field));
    }
    return menuItems;
};
