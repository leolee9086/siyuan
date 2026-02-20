import {
    isMac,
    updateHotkeyAfterTip,
} from "../util/compatibility";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { buildGutterMultipleMenu } from "./buildGutterMultipleMenu";
import { buildGutterMenu } from "./buildGutterMenu";
import { renderGutter } from "./renderGutter";
import { bindEvent, isMatchNode } from "./bindEvent";

/**
 * 思源笔记编辑器的侧边栏（Gutter）管理类
 *
 * Gutter 是位于编辑器左侧的区域，包含块操作按钮、折叠按钮等元素。
 * 它提供了对文档块的各种操作入口，如拖拽、右键菜单、折叠/展开等。
 *
 * 主要功能：
 * 1. 显示块操作按钮和图标
 * 2. 处理块的拖拽操作
 * 3. 提供右键菜单功能
 * 4. 处理块的折叠/展开
 * 5. 显示快捷键提示信息
 */
export class Gutter {
    /**
     * Gutter 的 DOM 元素，包含所有块操作按钮
     */
    public element: HTMLElement;

    /**
     * Gutter 的提示文本，包含快捷键信息
     * 根据操作系统和配置动态生成
     */
    private gutterTip: string;

    /**
     * 创建 Gutter 实例
     *
     * @param protyle 编辑器实例，包含编辑器的所有配置和状态
     */
    constructor(protyle: IProtyle) {
        // 初始化提示文本，替换默认快捷键为用户自定义快捷键
        this.gutterTip = siyuanI18n.gutterTip.replace("⌥→", updateHotkeyAfterTip(getSiyuanConfig().keymap.general.enter.custom, "/"))
            .replace("⌘↑", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.collapse.custom, "/"))
            .replace("⌥⌘A", updateHotkeyAfterTip(getSiyuanConfig().keymap.editor.general.attr.custom, "/"));

        // 如果不是 Mac 系统，将 Mac 风格的快捷键符号转换为 Windows/Linux 风格
        if (!isMac()) {
            this.gutterTip = this.gutterTip.replace(/⌘/g, "Ctrl+").replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌃/g, "Ctrl+");
        }

        // 如果是反向链接模式，修改提示文本
        if (protyle.options.backlinkData) {
            this.gutterTip = this.gutterTip.replace(siyuanI18n.enter, siyuanI18n.openBy);
        }

        // 创建 Gutter 的 DOM 元素
        this.element = document.createElement("div");
        this.element.className = "protyle-gutters";

        // 绑定事件处理器
        bindEvent(protyle, this.element);
    }

    /**
     * 检查指定元素是否与当前 Gutter 匹配
     *
     * 此方法用于确定一个元素是否应该显示在当前 Gutter 位置，
     * 主要用于处理滚动和位置更新时的匹配逻辑。
     *
     * @param item 需要检查的 DOM 元素
     * @returns 如果元素匹配当前 Gutter 位置则返回 true，否则返回 false
     */
    public isMatchNode(item: Element) {
        return isMatchNode(item, this.element);
    }

    /**
     * 渲染多选块的右键菜单
     *
     * 当用户选择了多个块并右键点击时，此方法会构建并显示适用于多选场景的菜单。
     * 菜单包含批量操作选项，如批量转换、批量复制等。
     *
     * @param protyle 编辑器实例
     * @param selectsElement 被选中的元素数组
     * @returns 构建的菜单对象
     */

    public renderMultipleMenu(protyle: IProtyle, selectsElement: Element[]) {
        return buildGutterMultipleMenu({ protyle, selectsElement });
    }

    /**
     * 渲染单个块的右键菜单
     *
     * 当用户右键点击单个块的 Gutter 按钮时，此方法会构建并显示适用于单个块的菜单。
     * 菜单包含块的各种操作选项，如转换类型、复制、编辑等。
     *
     * @param protyle 编辑器实例
     * @param buttonElement 被点击的按钮元素
     * @returns 构建的菜单对象
     */

    // S-forge: 开始 - 代码重构：将菜单构建逻辑拆分到独立模块以提高可维护性
    public renderMenu(protyle: IProtyle, buttonElement: Element) {
        return buildGutterMenu({ protyle, buttonElement });
    }
    // S-forge: 结束

    /**
     * 渲染 Gutter 内容
     *
     * 这是 Gutter 的核心渲染方法，负责根据当前元素和目标位置渲染 Gutter 的内容。
     * 它会生成适当的按钮、图标和提示信息，并设置正确的位置。
     *
     * @param protyle 编辑器实例
     * @param element 需要渲染 Gutter 的目标元素
     * @param target 可选的目标子元素，用于精确定位
     */
    public render(protyle: IProtyle, element: Element, target?: Element) {
        renderGutter(protyle, element, {
            target,
            gutterElement: this.element,
            gutterTip: this.gutterTip
        });
    }
}
