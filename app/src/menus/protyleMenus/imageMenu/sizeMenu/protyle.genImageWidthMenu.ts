/** 用途：更新时间字符串；使用范围：宽度调整后写入 updated；解耦评估：第三方依赖由 imports.ts 转发隔离。 */
import { dayjs } from "./imports";
/** 用途：图片尺寸兼容处理；使用范围：宽度调整后同步容器尺寸；解耦评估：兼容逻辑由基础层统一维护。 */
import { img3115 } from "./imports";
/** 用途：聚焦块节点；使用范围：菜单动作完成后恢复编辑焦点；解耦评估：选区能力由工具层封装。 */
import { focusBlock } from "./imports";
/** 用途：提交编辑事务；使用范围：宽度调整后的持久化更新；解耦评估：事务入口统一。 */
import { updateTransaction } from "./imports";
/** 用途：读取国际化文案；使用范围：默认尺寸分支判断；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";

/**
 * 作用：执行图片宽度菜单项对应的具体更新动作。
 * 意图：将 click 逻辑命名化，避免在菜单配置中放入匿名函数。
 * 调用时机：宽度菜单项点击时。
 * 问题/改进：当前仍使用固定 `- 8px` 补偿，后续可配置化处理。
 */
/** @显式返回类型原因: 回调工厂需要保证返回 () => void 类型的闭包，供菜单 click 属性同步调用，显式类型可防止闭包返回 undefined 导致菜单点击无响应。 */
const 创建宽度调整回调 = (
    label: string,
    imgElement: HTMLElement,
    protyle: IProtyle,
    id: string,
    nodeElement: HTMLElement,
    html: string
): (() => void) => {
    return () => {
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        const imageContainer = imgElement.parentElement;
        if (!imageContainer) {
            return;
        }
        img3115(imageContainer.parentElement);
        imageContainer.style.width = label === siyuanI18n.default ? "" : `calc(${label} - 8px)`;
        imgElement.style.height = "";
        updateTransaction(protyle, id, nodeElement.outerHTML, html);
        focusBlock(nodeElement);
    };
};

/**
 * 作用：创建单个“按比例宽度”菜单项配置。
 * 意图：供 width 子菜单构建过程复用，减少重复的菜单项装配代码。
 * 调用时机：构建 width 子菜单列表时。
 * 问题/改进：目前依赖字符串标签解析，后续可改成结构化配置。
 */
/** @同步豁免: UI构建 */
export const genImageWidthMenu = (
    label: string,
    imgElement: HTMLElement,
    protyle: IProtyle,
    id: string,
    nodeElement: HTMLElement,
    html: string
) => {
    return {
        id: label === siyuanI18n.default ? "default" : "width_" + label,
        iconHTML: "",
        label,
        click: 创建宽度调整回调(label, imgElement, protyle, id, nodeElement, html)
    };
};
