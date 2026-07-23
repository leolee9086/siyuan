/**
 * showRender 模块 HTML 模板生成
 */
/** 用途：生成本地化按钮标签。使用范围：仅源码面板同步 HTML 模板。解耦评估：环境访问器已隔离全局语言对象，继续直接使用可避免重复传递整份文案上下文。 */
import {siyuanI18n} from "./imports";
/** 用途：约束源码面板模板输入。使用范围：仅本模板函数。解耦评估：同目录纯类型依赖，不产生运行时耦合。 */
import type { 渲染面板配置 } from "./showRender.types";

/**
 * 生成渲染面板 HTML
 */
/** @同步豁免: UI构建 */
export function 生成渲染面板HTML(配置: 渲染面板配置) {
    const {
        标题,
        占位符,
        是否禁用,
        类型列表
    } = 配置;

    const 包含嵌入块 = 类型列表.includes("NodeBlockQueryEmbed");
    const 隐藏类 = 是否禁用 ? " fn__none" : "";

    return `<div class="fn__flex-column"><div class="block__icons block__icons--menu fn__flex" style="border-radius: var(--b3-border-radius-b) var(--b3-border-radius-b) 0 0;">
    <span class="fn__flex-1 resize__move" style="line-height: 24px;">
        ${标题}
    </span>
    <span class="fn__space"></span>
    <button data-type="refresh" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw block__icon--active${包含嵌入块 ? " fn__none" : ""}" aria-label="${siyuanI18n.refresh}"><svg><use xlink:href="#iconRefresh"></use></svg></button>
    <span class="fn__space"></span>
    <button data-type="before" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw${隐藏类}" aria-label="${siyuanI18n.insertBefore}"><svg><use xlink:href="#iconBefore"></use></svg></button>
    <span class="fn__space${隐藏类}"></span>
    <button data-type="after" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw${隐藏类}" aria-label="${siyuanI18n.insertAfter}"><svg><use xlink:href="#iconAfter"></use></svg></button>
    <span class="fn__space${隐藏类}"></span>
    <button data-type="export" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.export} ${siyuanI18n.image}"><svg><use xlink:href="#iconImage"></use></svg></button>
    <span class="fn__space"></span>
    <button data-type="pin" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.pin}"><svg><use xlink:href="#iconPin"></use></svg></button>
    <span class="fn__space"></span>
    <button data-type="close" class="block__icon block__icon--show b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.close}"><svg><use xlink:href="#iconClose"></use></svg></button>
</div>
<div class="protyle-util__scroll"><div class="fn__flex"><div class="protyle-linenumber__rows"></div><textarea ${是否禁用 ? " readonly" : ""} spellcheck="false" class="b3-text-field b3-text-field--text fn__flex-1" placeholder="${占位符}" style="overflow:hidden;resize:none;font-family: var(--b3-font-family-code);"></textarea></div></div></div>
<div class="resize__rd"></div><div class="resize__ld"></div><div class="resize__lt"></div><div class="resize__rt"></div><div class="resize__r"></div><div class="resize__d"></div><div class="resize__t"></div><div class="resize__l"></div>`;
}
