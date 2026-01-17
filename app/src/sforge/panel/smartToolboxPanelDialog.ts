/**
 * SmartToolboxPanel.ts - 智能工具箱面板
 * 
 * 使用 Dialog 模块创建工具箱面板的入口文件。
 * 提供全局单例模式的对话框管理。
 * 
 * @module sforge/panel/SmartToolboxPanel
 */

import { Dialog } from "../../dialog";
import { isMobile } from "../../util/functions";
import { createVueDialog } from "../../util/dialog/createVueDialog";
import SmartToolboxPanelVue from "./SmartToolboxPanel.vue";

// ============ 全局状态 ============

/** 对话框单例实例 */
let 对话框实例: Dialog | null = null;

// ============ 内部函数 ============

/** @简洁函数 关闭对话框并清理实例引用 */
const 销毁对话框 = (): void => {
    对话框实例 = null;
};

// ============ 公开 API ============

/**
 * @function 打开智能工具箱
 * @zh-CN
 * @作用: 打开智能工具箱面板对话框
 * @意图: 提供全局入口，让用户浏览和使用已注册的工具
 * @调用时机: 用户点击菜单或按下快捷键时
 * @已知问题: 无
 * @改进方向: 后续可添加上下文感知，根据当前选区预筛选工具
 */
export function 打开智能工具箱(): void {
    // 如果已存在实例，聚焦到它
    if (对话框实例) {
        const inputElement = 对话框实例.element.querySelector("input");
        inputElement?.focus();
        return;
    }

    对话框实例 = createVueDialog({
        dataKey: "dialog-smart-toolbox",
        /** @简洁函数 createVueDialog API 要求的配置工厂函数，返回 Vue 组件挂载配置 */
        vueConfigFactory: () => ({
            components: {
                SmartToolboxPanelVue
            },
            data: {},
            eventHandlers: {},
            template: "<SmartToolboxPanelVue />"
        }),
        dialogOptions: {
            title: "智能工具箱",
            width: isMobile() ? "95vw" : "400px",
            height: isMobile() ? "70vh" : "500px",
            transparent: true,  // 透明遮罩
            scrimPointerEvents: true,  // 允许遮罩层鼠标事件穿透
            disableScrimClose: true,  // 禁用点击遮罩关闭（因为遮罩穿透了）
            closeButtonPosition: "inside",
            destroyCallback: 销毁对话框
        }
    });
}

/**
 * @function 关闭智能工具箱
 * @zh-CN
 * @作用: 关闭智能工具箱面板对话框
 * @意图: 提供编程接口关闭面板
 * @调用时机: 需要代码控制关闭时
 * @已知问题: 无
 * @改进方向: 无
 */
export function 关闭智能工具箱(): void {
    if (!对话框实例) {
        return;
    }
    对话框实例.destroy();
    对话框实例 = null;
}

/**
 * @function 工具箱是否打开
 * @zh-CN
 * @作用: 检查工具箱面板是否已打开
 * @意图: 用于判断当前状态
 * @调用时机: 需要检查状态时
 * @已知问题: 无
 * @改进方向: 无
 */
export function 工具箱是否打开(): boolean {
    return 对话框实例 !== null;
}

// ============ 英文别名（仅保留入口点使用的） ============

export const openSmartToolbox = 打开智能工具箱;
