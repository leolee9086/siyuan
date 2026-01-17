/**
 * smartToolboxStatusButton.ts - 智能工具箱状态栏按钮注册
 * 
 * 通过 StatusBarRegistry 注册工具箱状态栏按钮。
 * 
 * @module sforge/panel/smartToolboxStatusButton
 */

import { 注册状态栏按钮 } from "../../registry/StatusBarRegistry";
import { 打开智能工具箱, 工具箱是否打开, 关闭智能工具箱 } from "./smartToolboxPanelDialog";

// ============ 公开 API ============

/**
 * @function 初始化工具箱状态栏按钮
 * @zh-CN
 * @作用: 向状态栏注册表注册工具箱按钮
 * @意图: 让用户可以通过状态栏按钮打开/关闭工具箱
 * @调用时机: S-Forge 初始化时
 * @已知问题: 无
 * @改进方向: 可以添加工具箱打开状态的视觉反馈
 */
export function 初始化工具箱状态栏按钮(): void {
    注册状态栏按钮({
        id: "SmartToolbox",
        icon: "iconPlugin",
        tooltip: "智能工具箱",
        onClick: 切换工具箱,
        position: "right",
        order: 50  // 在帮助按钮前
    });
}

/**
 * @function 切换工具箱
 * @zh-CN
 * @作用: 切换工具箱面板的显示/隐藏状态
 * @意图: 作为状态栏按钮的点击处理器
 * @调用时机: 用户点击状态栏按钮时
 * @已知问题: 无
 * @改进方向: 无
 */
export function 切换工具箱(): void {
    if (工具箱是否打开()) {
        关闭智能工具箱();
        return;
    }
    打开智能工具箱();
}

// ============ 英文别名（仅保留入口点使用的） ============

export const initSmartToolboxStatusButton = 初始化工具箱状态栏按钮;
