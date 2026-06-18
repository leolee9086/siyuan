/** 用途：应用常量，搜索类型列表。使用范围：filterTypesHTML 生成类型过滤 HTML。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "./imports";

/**
 * 生成类型标签 HTML
 * @作用 为搜索类型过滤器生成单个类型标签的开关 HTML
 * @调用时机 构建搜索过滤面板时
 * @同步豁免: UI构建 — 生成静态 HTML 模板，无异步依赖
 */
const generateTypeLabel = (type: string, isChecked: boolean) => {
    return `<label class="fn__flex b3-label">
        <div class="fn__flex-1 fn__flex-center">
            ${type}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="${type}" type="checkbox" ${isChecked ? " checked" : ""}>
    </label>`;
};

/**
 * 生成搜索类型过滤 HTML
 * @作用 根据当前配置生成所有搜索类型的开关列表
 * @调用时机 搜索面板初始化时
 * @同步豁免: UI构建 — 生成静态 HTML 模板，无异步依赖
 */
export const filterTypesHTML = (types: IObject) => {
    let html = "";
    const sortedTypes = [...Constants.SIYUAN_ASSETS_SEARCH].sort((a: string, b: string) => {
        return a.localeCompare(b);
    });
    
    for (const type of sortedTypes) {
        html += generateTypeLabel(type, !!types[type]);
    }
    
    return html;
};
