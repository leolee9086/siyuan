/** 用途：图片尺寸兼容处理；使用范围：高度输入和滑杆拖动时同步容器；解耦评估：兼容逻辑由基础层封装。 */
import { img3115 } from "./imports";
/** 用途：国际化文案；使用范围：高度菜单默认值与 placeholder；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";
/** 用途：创建高度预设菜单项；使用范围：height 子菜单预设比例；解耦评估：预设逻辑独立模块。 */
import { genImageHeightMenu } from "./protyle.genImageHeightMenu";
/** 用途：共享事务提交流程；使用范围：高度输入/滑杆提交时；解耦评估：共同逻辑集中复用。 */
import { 提交尺寸事务并关闭菜单 } from "./protyle.imgMenu.size.common";
/** 用途：宽高菜单上下文类型；使用范围：记录高度滑杆输入框引用；解耦评估：类型定义移至 *.types.ts。 */
import type { 图片尺寸菜单上下文 } from "./protyle.imgMenu.size.types";

const 高度预设值列表 = ["25%", "33%", "50%", "67%", "75%", "100%"];

/**
 * 作用：处理高度输入变化。
 * 意图：同步输入框与滑杆状态，并实时预览高度效果。
 * 调用时机：高度输入框触发 input 事件时。
 * 问题/改进：后续可加入上下限校验与单位切换。
 */
const 处理高度输入变化 = (
    context: 图片尺寸菜单上下文,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement,
    inputElement: HTMLInputElement
): void => {
    const slider = context.rangeElement;
    const sliderContainer = slider?.parentElement;
    // 滑杆存在时重置为像素输入模式。
    if (slider) {
        slider.value = "0";
    }
    // 滑杆容器存在时同步 aria-label 展示当前输入值。
    if (sliderContainer) {
        const label = inputElement.value ? inputElement.value + "px" : siyuanI18n.default;
        sliderContainer.setAttribute("aria-label", label);
    }
    imgElement.style.height = inputElement.value ? inputElement.value + "px" : "";
    img3115(assetElement);
    const imageContainer = imgElement.parentElement;
    // 图片容器存在时清理宽度样式，保持高度模式优先。
    if (imageContainer) {
        imageContainer.style.width = "";
    }
};

/**
 * 作用：处理高度输入失焦。
 * 意图：仅在值变化时提交事务，减少无效历史记录。
 * 调用时机：高度输入框触发 blur 事件时。
 * 问题/改进：后续可支持 Enter 提交提升可控性。
 */
const 处理高度输入失焦 = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    id: string,
    html: string,
    imgElement: HTMLImageElement,
    inputElement: HTMLInputElement
): void => {
    const currentHeight = imgElement.style.height.replace("px", "");
    // 输入值未变化时跳过事务提交。
    if (inputElement.value === currentHeight) {
        return;
    }
    提交尺寸事务并关闭菜单(protyle, nodeElement, id, html);
};

/**
 * 作用：绑定高度输入菜单项。
 * 意图：集中处理 input 查询与事件绑定。
 * 调用时机：高度输入菜单项 bind 阶段。
 * 问题/改进：后续可使用 data-type 选择器提高稳定性。
 */
const 绑定高度输入菜单项 = (
    context: 图片尺寸菜单上下文,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement,
    nodeElement: HTMLElement,
    protyle: IProtyle,
    id: string,
    html: string,
    element: HTMLElement
): void => {
    const inputElement = element.querySelector("input");
    // 输入框不存在时不绑定事件，避免空节点错误。
    if (!(inputElement instanceof HTMLInputElement)) {
        return;
    }
    inputElement.addEventListener("input", 处理高度输入变化.bind(null, context, assetElement, imgElement, inputElement));
    inputElement.addEventListener("blur", 处理高度输入失焦.bind(null, protyle, nodeElement, id, html, imgElement, inputElement));
};

/**
 * 作用：创建高度输入菜单项。
 * 意图：封装输入模板与绑定逻辑，减少主流程代码量。
 * 调用时机：构建 height 子菜单时。
 * 问题/改进：模板字符串较长，后续可改组件化渲染。
 */
const 创建高度输入菜单项 = (
    context: 图片尺寸菜单上下文,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement,
    nodeElement: HTMLElement,
    protyle: IProtyle,
    id: string,
    html: string
): IMenu => {
    const heightValue = imgElement.style.height.endsWith("px")
        ? parseInt(imgElement.style.height, 10)
        : "";
    return {
        id: "heightInput",
        iconHTML: "",
        type: "readonly",
        label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${heightValue}" type="number" style="margin: 4px 8px 4px 0" placeholder="${siyuanI18n.height}"><span class="fn__flex-center">px</span></div>`,
        bind: 绑定高度输入菜单项.bind(null, context, assetElement, imgElement, nodeElement, protyle, id, html)
    };
};

/**
 * 作用：处理高度滑杆输入变化。
 * 意图：拖动时实时预览高度并刷新 aria-label。
 * 调用时机：高度滑杆触发 input 事件时。
 * 问题/改进：后续可加入拖动节流提升性能。
 */
const 处理高度滑杆输入 = (
    assetElement: HTMLElement,
    imgElement: HTMLImageElement,
    rangeElement: HTMLInputElement
): void => {
    img3115(assetElement);
    const imageContainer = imgElement.parentElement;
    // 图片容器存在时清理宽度样式，保持高度模式优先。
    if (imageContainer) {
        imageContainer.style.width = "";
    }
    imgElement.style.height = rangeElement.value + "vh";
    const rangeContainer = rangeElement.parentElement;
    // 滑杆容器存在时更新 aria-label 百分比文案。
    if (rangeContainer) {
        rangeContainer.setAttribute("aria-label", `${rangeElement.value}%`);
    }
};

/**
 * 作用：绑定高度滑杆菜单项。
 * 意图：集中处理滑杆查询、上下文同步和事件绑定。
 * 调用时机：高度滑杆菜单项 bind 阶段。
 * 问题/改进：后续可补充键盘快捷调整支持。
 */
const 绑定高度滑杆菜单项 = (
    context: 图片尺寸菜单上下文,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement,
    nodeElement: HTMLElement,
    protyle: IProtyle,
    id: string,
    html: string,
    element: HTMLElement
): void => {
    const rangeElement = element.querySelector("input");
    // 滑杆输入框不存在时不绑定事件。
    if (!(rangeElement instanceof HTMLInputElement)) {
        return;
    }
    context.rangeElement = rangeElement;
    rangeElement.addEventListener("input", 处理高度滑杆输入.bind(null, assetElement, imgElement, rangeElement));
    rangeElement.addEventListener("change", 提交尺寸事务并关闭菜单.bind(null, protyle, nodeElement, id, html));
};

/**
 * 作用：创建高度滑杆菜单项。
 * 意图：封装滑杆模板、初值和绑定逻辑。
 * 调用时机：构建 height 子菜单时。
 * 问题/改进：后续可加入步进值配置。
 */
const 创建高度滑杆菜单项 = (
    context: 图片尺寸菜单上下文,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement,
    nodeElement: HTMLElement,
    protyle: IProtyle,
    id: string,
    html: string
): IMenu => {
    const label = imgElement.style.height
        ? imgElement.style.height.replace("vh", "%")
        : siyuanI18n.default;
    const sliderValue = imgElement.style.height.endsWith("vh")
        ? parseInt(imgElement.style.height, 10)
        : 0;
    return {
        id: "heightDrag",
        iconHTML: "",
        type: "readonly",
        label: `<div style="margin: 4px 0;" aria-label="${label}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${sliderValue}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
        bind: 绑定高度滑杆菜单项.bind(null, context, assetElement, imgElement, nodeElement, protyle, id, html)
    };
};

/**
 * 作用：构建 height 子菜单列表。
 * 意图：按输入项、预设项、滑杆项的顺序组织菜单结构。
 * 调用时机：`genHeightItem` 中创建 submenu 时。
 * 问题/改进：预设值列表当前固定，后续可按配置扩展。
 */
/** @同步豁免: UI构建 */
export const 构建高度子菜单 = (
    context: 图片尺寸菜单上下文,
    protyle: IProtyle,
    nodeElement: HTMLElement,
    imgElement: HTMLImageElement,
    assetElement: HTMLElement,
    id: string,
    html: string
): IMenu[] => {
    const submenu: IMenu[] = [];
    submenu.push(创建高度输入菜单项(context, assetElement, imgElement, nodeElement, protyle, id, html));
    for (const preset of 高度预设值列表) {
        submenu.push(genImageHeightMenu(preset, imgElement, protyle, id, nodeElement, html));
    }
    submenu.push({ id: "separator_1", type: "separator" });
    submenu.push(创建高度滑杆菜单项(context, assetElement, imgElement, nodeElement, protyle, id, html));
    submenu.push({ id: "separator_2", type: "separator" });
    submenu.push(genImageHeightMenu(siyuanI18n.default, imgElement, protyle, id, nodeElement, html));
    return submenu;
};
