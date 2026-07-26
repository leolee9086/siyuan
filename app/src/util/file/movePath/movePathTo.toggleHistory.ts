import {isStringArray} from "./model/movePathTo.guard";
import {setStorageVal} from "./imports";
import {Constants} from "./imports";
import {Menu} from "./imports";
import {hasClosestByClassName} from "./imports";
import {getSiyuanGlobalMenus} from "./imports";
import {getSiyuanStorage} from "./imports";
import {siyuanI18n} from "./imports";
import {escapeHtml} from "./imports";

/**
 * 创建切换移动路径历史记录菜单的处理函数
 */
export function 创建历史菜单切换器(
    inputElement: HTMLInputElement,
    inputEvent: (event?: InputEvent) => void
) {
    return () => {
        const storage = getSiyuanStorage();
        const movePath = storage[Constants.LOCAL_MOVE_PATH];
        const keys = movePath?.keys;
        // 如果没有历史记录，或者历史记录为空，或者只有一条且就是当前输入框的值，则不显示菜单
        if (!keys || !isStringArray(keys) || keys.length === 0 || (keys.length === 1 && keys[0] === inputElement.value)) {
            return;
        }
        const menu = new Menu(Constants.MENU_MOVE_PATH_HISTORY);
        // 如果菜单已经打开，则不重复打开
        if (menu.isOpen) {
            return;
        }
        menu.element.classList.add("b3-menu--list");
        填充历史菜单(menu, keys, inputElement, inputEvent);
        const rect = inputElement.getBoundingClientRect();
        menu.open({
            x: rect.left,
            y: rect.bottom
        });
    };
}

/**
 * 填充移动路径的历史记录菜单项
 *
 * - 作用：向菜单实例中添加“清空历史”选项以及具体的历史路径记录项
 * - 意图：将菜单内容的构建与菜单的显示逻辑解耦，保持主逻辑简洁
 * - 调用时机：在用户触发历史菜单显示（如点击下拉箭头）且存在历史记录时调用
 * - 问题/改进：当前通过直接修改 keys 数组和 storage 来管理状态
 */
function 填充历史菜单(
    menu: Menu,
    keys: string[],
    inputElement: HTMLInputElement,
    inputEvent: (event?: InputEvent) => void
) {
    menu.addItem({
        iconHTML: "",
        label: siyuanI18n.clearHistory,
        click: 清空历史记录
    });
    const separatorElement = menu.addSeparator(1);
    let current = true;
    for (const s of keys) {
        // 如果历史记录项与当前输入值相同或者是空字符串，则跳过不显示
        if (s === inputElement.value || !s) {
            continue;
        }
        const menuItem = menu.addItem({
            iconHTML: "",
            label: escapeHtml(s),
            action: "iconCloseRound",
            /**
             * 绑定菜单项交互事件
             *
             * - 作用：为菜单项 DOM 元素绑定点击事件监听器
             * - 意图：处理用户点击历史记录项（选择）或其后的移除按钮（删除）的行为
             * - 调用时机：当菜单项被 Menu 类创建并渲染到 DOM 后调用
             * - 问题/改进：目前直接在回调中处理业务逻辑，未来可进一步拆分为独立的事件处理函数以减少闭包
             */
            bind(element) {
                element.addEventListener("click", (itemEvent) => {
                    处理历史菜单项点击(itemEvent, element, keys, s, inputElement, inputEvent);
                });
            }
        });
        // 如果是第一项（最近的一项），添加 current 样式高亮显示
        if (current && menuItem) {
            menuItem.classList.add("b3-menu__item--current");
        }
        current = false;
    }
    // 如果没有添加任何项（所有项都被过滤了），则移除分隔线
    if (current && separatorElement) {
        separatorElement.remove();
    }
}

/**
 * 清空移动路径历史记录
 */
function 清空历史记录() {
    const storage = getSiyuanStorage();
    // 如果能获取到 storage 配置，则清空移动路径历史
    if (storage) {
        const movePath = storage[Constants.LOCAL_MOVE_PATH];
        movePath.keys = [];
        setStorageVal(Constants.LOCAL_MOVE_PATH, movePath);
    }
}

/**
 * 处理历史菜单项的点击事件
 */
function 处理历史菜单项点击(
    itemEvent: MouseEvent,
    element: HTMLElement,
    keys: string[],
    s: string,
    inputElement: HTMLInputElement,
    inputEvent: (event?: InputEvent) => void
) {
    // 如果点击的不是功能按钮（如删除图标），则视为选中该历史记录，填入输入框
    if (!(itemEvent.target instanceof Element) || !hasClosestByClassName(itemEvent.target, "b3-menu__action")) {
        inputElement.value = element.textContent ?? "";
        inputEvent();
        getSiyuanGlobalMenus().menu.remove();
        itemEvent.preventDefault();
        itemEvent.stopPropagation();
        return;
    }

    const index = keys.indexOf(s);
    // 如果在历史记录列表中找到了该项，则将其删除
    if (index > -1) {
        keys.splice(index, 1);
    }
    const storage = getSiyuanStorage();
    // 更新 storage 中的历史记录
    if (storage) {
        const movePath = storage[Constants.LOCAL_MOVE_PATH];
        movePath.keys = keys;
        setStorageVal(Constants.LOCAL_MOVE_PATH, movePath);
    }
    itemEvent.preventDefault();
    itemEvent.stopPropagation();
    const isPrevSeparator = element.previousElementSibling?.classList.contains("b3-menu__separator");
    // 如果删除项的前面是分隔线，且后面没有其他项了（即删除了最后一项），则关闭菜单
    if (isPrevSeparator && !element.nextElementSibling) {
        getSiyuanGlobalMenus().menu.remove();
        return;
    }
    element.remove();
}
