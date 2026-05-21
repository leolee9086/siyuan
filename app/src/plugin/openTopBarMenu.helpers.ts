/**
 * @导入用途: 应用实例类型，用于打开设置对话框
 * @使用范围: addManageMenuItem 函数
 * @解耦评估: 通过参数传递，已解耦
 */
import type {App} from "./imports";

/**
 * @导入用途: 菜单类，用于操作菜单项
 * @使用范围: 所有辅助函数的参数类型
 * @解耦评估: 通过参数传递，已解耦
 */
import {Menu} from "./Menu";

/**
 * @导入用途: 华为设备检测，用于判断是否显示管理入口
 * @使用范围: addManageMenuItem 函数
 * @解耦评估: 工具函数，通过 imports 转发
 */
import {isHuawei, setTabPosition} from "./imports";

/**
 * @导入用途: 存储值设置，用于保存固定/取消固定状态
 * @使用范围: createPinUnpinSubmenu 函数
 * @解耦评估: 工具函数，通过 imports 转发
 */
import {setStorageVal} from "./imports";

/**
 * @导入用途: 打开设置对话框，用于管理菜单项点击
 * @使用范围: addManageMenuItem 函数
 * @解耦评估: 通过 imports 转发
 */
import {openSetting} from "./imports";

/**
 * @导入用途: 全局常量，用于存储键名
 * @使用范围: createPinUnpinSubmenu 函数
 * @解耦评估: 常量依赖，通过 imports 转发
 */
import {Constants} from "./imports";

/**
 * @导入用途: 获取思源菜单实例，用于清理分隔符
 * @使用范围: handleEmptyPlugin 函数
 * @解耦评估: 通过 imports 转发
 */
import {getSiyuanMenus} from "./imports";

/**
 * @导入用途: 获取思源存储数据，用于读取固定状态
 * @使用范围: createPinUnpinSubmenu 函数
 * @解耦评估: 通过 imports 转发
 */
import {getSiyuanStorage} from "./imports";

/**
 * 添加插件管理菜单项
 *
 * 作用：在桌面端添加插件管理入口
 * 意图：提供快速访问插件市场的入口
 */
/** @同步豁免: UI构建 */
export const addManageMenuItem = (menu: Menu, app: App, languages: Record<string, string>, config: {readonly: boolean}) => {
    menu.addItem({
        id: "manage",
        icon: "iconSettings",
        label: languages.manage || "",
        ignore: isHuawei() || config.readonly,
        /** @同步豁免: UI构建 */
        click() {
            const settingDialog = openSetting(app);
            const bazaarTab = settingDialog?.element.querySelector('.config__side [data-name="bazaar"]');
            bazaarTab?.dispatchEvent(new CustomEvent("click"));
        }
    });
    menu.addSeparator({id: "separator_1", ignore: isHuawei() || config.readonly});
};

/**
 * 创建固定/取消固定子菜单项
 *
 * 作用：生成控制顶部栏图标显示/隐藏的菜单项
 * 意图：允许用户自定义顶部栏图标的可见性
 */
/** @同步豁免: UI构建 */
export const createPinUnpinSubmenu = (item: Element, hasUnpin: boolean, languages: Record<string, string>) => {
    return {
        id: hasUnpin ? "pin" : "unpin",
        icon: hasUnpin ? "iconPin" : "iconUnpin",
        label: hasUnpin ? languages.pin : languages.unpin,
        /** @同步豁免: UI构建 */
        click() {
            const currentStorage = getSiyuanStorage();
            if (!currentStorage) {
                return;
            }
            const unpinStorage = currentStorage[Constants.LOCAL_PLUGINTOPUNPIN];
            if (!unpinStorage) {
                return;
            }
            
            // 根据当前状态切换固定状态
            if (!hasUnpin) {
                unpinStorage.push(item.id);
                currentStorage[Constants.LOCAL_PLUGINTOPUNPIN] = Array.from(new Set(unpinStorage));
                item.classList.add("fn__none");
                setStorageVal(Constants.LOCAL_PLUGINTOPUNPIN, currentStorage[Constants.LOCAL_PLUGINTOPUNPIN]);
                setTabPosition(true);
                return;
            }
            
            const index = unpinStorage.indexOf(item.id);
            // 找到元素在取消固定列表中的位置，从列表中移除
            if (index > -1) {
                unpinStorage.splice(index, 1);
            }
            item.classList.remove("fn__none");
            setStorageVal(Constants.LOCAL_PLUGINTOPUNPIN, currentStorage[Constants.LOCAL_PLUGINTOPUNPIN]);
            setTabPosition(true);
        }
    };
};

/**
 * 提取菜单项图标
 *
 * 作用：从 DOM 元素中提取图标信息
 * 意图：支持 SVG use 引用和内联 SVG 两种图标形式
 */
/** @同步豁免: UI构建 */
export const extractMenuIcon = (item: Element, menuOption: Record<string, unknown>) => {
    const useElement = item.querySelector("use");
    const href = useElement?.getAttribute("xlink:href");
    
    // 优先使用 use 元素引用的图标
    if (href) {
        menuOption.icon = href.replace("#", "");
        return;
    }
    
    // 使用内联 SVG 作为图标
    const svgElement = item.querySelector("svg");
    if (!svgElement) {
        return;
    }
    
    const clonedNode = svgElement.cloneNode(true);
    // 确保克隆节点是 HTMLElement 类型才能访问 classList
    if (!(clonedNode instanceof HTMLElement)) {
        return;
    }
    clonedNode.classList.add("b3-menu__icon");
    menuOption.iconHTML = clonedNode.outerHTML;
};

/**
 * 处理无插件情况
 *
 * 作用：在没有插件时显示空状态或清理分隔符
 * 意图：提供友好的空状态提示
 */
/** @同步豁免: UI构建 */
export const handleEmptyPlugin = (menu: Menu, target: Element | undefined, languages: Record<string, string>) => {
    if (target) {
        const menus = getSiyuanMenus();
        const separator = menus?.menu?.element?.querySelector(".b3-menu__separator");
        separator?.remove();
        return;
    }
    
    menu.addItem({
        id: "emptyContent",
        iconHTML: "",
        type: "readonly",
        label: languages.emptyContent || "",
    });
};

/**
 * 在目标位置打开菜单
 *
 * 作用：计算并在合适位置显示菜单
 * 意图：确保菜单显示在正确的位置，处理元素宽度为 0 的特殊情况
 */
/** @同步豁免: UI构建 */
export const openMenuAtTarget = (menu: Menu, target: Element) => {
    let rect = target.getBoundingClientRect();
    
    // 元素宽度为 0 时使用更多按钮位置
    const moreButton = rect.width === 0 ? document.querySelector("#barMore") : null;
    if (moreButton) {
        rect = moreButton.getBoundingClientRect();
    }
    
    menu.open({x: rect.right, y: rect.bottom, isLeft: true});
};

/**
 * 创建插件图标子菜单
 *
 * 作用：为插件图标创建包含固定/配置/执行的子菜单
 * 意图：集中处理子菜单项的创建逻辑
 */
/** @同步豁免: UI构建 */
/** @内联回调 */
const createPluginIconSubmenu = (
    item: Element,
    plugin: {openSetting: () => void},
    target: Element | undefined,
    languages: Record<string, string>,
    storage: Record<string, string[]>,
    hasSetting: boolean
) => {
    const unpinList = storage[Constants.LOCAL_PLUGINTOPUNPIN];
    const hasUnpin = !!(unpinList && unpinList.includes(item.id));
    const submenu = [createPinUnpinSubmenu(item, hasUnpin, languages)];
    
    if (hasSetting) {
        submenu.push({
            id: "config",
            icon: "iconSettings",
            label: languages.config,
            /** @同步豁免: UI构建 */
            click() {
                plugin.openSetting();
            },
        });
    }
    
    const itemLabel = target ? item.getAttribute("aria-label") : item.textContent?.trim();
    if (!target) {
        submenu.push({
            id: "play",
            icon: "iconPlay",
            label: itemLabel || "",
            /** @同步豁免: UI构建 */
            click() {
                item.dispatchEvent(new CustomEvent("click"));
                return true;
            },
        });
    }
    
    return {submenu, itemLabel};
};

/**
 * 处理单个插件的顶部栏图标
 *
 * 作用：为插件的每个顶部栏图标创建菜单项
 * 意图：集中处理插件图标的菜单生成逻辑
 */
/** @同步豁免: UI构建 */
/** @内联回调 */
export const processPluginTopBarIcons = (
    plugin: {topBarIcons: Element[]; name: string; displayName: string; openSetting: () => void},
    menu: Menu,
    target: Element | undefined,
    languages: Record<string, string>,
    storage: Record<string, string[]>,
    hasSetting: boolean
): boolean => {
    let hasTopBar = false;
    
    for (let i = 0; i < plugin.topBarIcons.length; i++) {
        const item = plugin.topBarIcons[i];
        if (!item) {
            continue;
        }
        
        // 检查元素是否仍在文档中
        if (!document.contains(item)) {
            plugin.topBarIcons.splice(i, 1);
            i--;
            continue;
        }
        
        const {submenu, itemLabel} = createPluginIconSubmenu(item, plugin, target, languages, storage, hasSetting);
        
        const menuOption: Record<string, unknown> = {
            id: item.id,
            icon: "iconInfo",
            label: itemLabel || "",
            click: target ? () => {
                item.dispatchEvent(new CustomEvent("click"));
            } : undefined,
            type: "submenu",
            submenu
        };
        
        extractMenuIcon(item, menuOption);
        menu.addItem(menuOption);
        hasTopBar = true;
    }
    
    return hasTopBar;
};
