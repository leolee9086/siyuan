/** 用途：平台检测标志。使用范围：card 模块根据平台调整 UI 交互。解耦评估：通过 imports.ts 转发。 */
import { isMobile } from "./imports";

/**
 * 更新卡片操作按钮可见性
 * @作用 根据设备方向和移动端环境切换卡片操作按钮的显示状态
 * @意图 在移动端竖屏时隐藏操作图标，横屏时显示，优化空间利用
 * @调用时机 卡片渲染或窗口方向变化时调用
 * @同步豁免: UI构建 — 直接操作 DOM 切换 class
 */
export const updateCardHV = () => {
    // 非移动端不处理，直接返回
    if (!isMobile) {
        return;
    }
    // 移动端竖屏时隐藏操作图标，横屏时显示
    const win = document.defaultView;
    const isPortrait = win ? win.matchMedia("(orientation:portrait)").matches : false;
    const iconElements = document.querySelectorAll(".card__action .card__icon");
    for (const item of iconElements) {
        item.classList.toggle("fn__none", isPortrait);
    }
};
