/**
 * showRender 模块 HTML 模板生成
 */
import { isMobile } from "../../../util/platform/functions";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type { 渲染面板配置 } from "./showRender.types";

/**
 * 生成渲染面板 HTML
 */
export function 生成渲染面板HTML(配置: 渲染面板配置): string {
    const {
        标题,
        占位符,
        是否固定,
        是否禁用,
        类型列表,
        渲染元素宽度,
        是否拖拽中,
        刷新按钮激活
    } = 配置;

    const 包含嵌入块 = 类型列表.includes("NodeBlockQueryEmbed");
    const 拖拽属性 = 是否拖拽中 ? 'data-drag="true"' : "";
    const 刷新按钮类 = 刷新按钮激活 ? " block__icon--active" : "";
    const 隐藏类 = 是否禁用 ? " fn__none" : "";
    const 固定图标 = 是否固定 ? "Unpin" : "Pin";
    const 固定标签 = 是否固定 ? siyuanI18n.unpin : siyuanI18n.pin;

    // 计算文本框宽度
    const 文本框宽度样式 = isMobile()
        ? ""
        : `width:${Math.max(480, 渲染元素宽度 * 0.7)}px`;

    return `<div ${拖拽属性}><div class="block__icons block__icons--menu fn__flex" style="border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0;">
    <span class="fn__flex-1 resize__move" style="line-height: 24px;">
        ${标题}
    </span>
    <span class="fn__space"></span>
    <button data-type="refresh" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw${刷新按钮类}${包含嵌入块 ? " fn__none" : ""}" aria-label="${siyuanI18n.refresh}"><svg><use xlink:href="#iconRefresh"></use></svg></button>
    <span class="fn__space"></span>
    <button data-type="before" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw${隐藏类}" aria-label="${siyuanI18n.insertBefore}"><svg><use xlink:href="#iconBefore"></use></svg></button>
    <span class="fn__space${隐藏类}"></span>
    <button data-type="after" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw${隐藏类}" aria-label="${siyuanI18n.insertAfter}"><svg><use xlink:href="#iconAfter"></use></svg></button>
    <span class="fn__space${隐藏类}"></span>
    <button data-type="export" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.export} ${siyuanI18n.image}"><svg><use xlink:href="#iconImage"></use></svg></button>
    <span class="fn__space"></span>
    <button data-type="pin" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw" aria-label="${固定标签}"><svg><use xlink:href="#icon${固定图标}"></use></svg></button>
    <span class="fn__space"></span>
    <button data-type="close" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.close}"><svg><use xlink:href="#iconClose"></use></svg></button>
</div>
<textarea ${是否禁用 ? " readonly" : ""} spellcheck="false" class="b3-text-field b3-text-field--text fn__block" placeholder="${占位符}" style="${文本框宽度样式};max-height:calc(80vh - 44px);min-height: 48px;min-width: 268px;border-radius: 0 0 var(--b3-border-radius-b) var(--b3-border-radius-b);font-family: var(--b3-font-family-code);"></textarea></div>`;
}
