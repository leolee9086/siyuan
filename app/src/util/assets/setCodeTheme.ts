/** 用途：应用常量定义。使用范围：setCodeTheme 使用 CDN 和主题列表。解耦评估：直接依赖纯常量模块。 */
import { Constants } from "../../constants";
/** 用途：添加样式到文档。使用范围：setCodeTheme 动态加载 CSS。解耦评估：直接依赖纯 DOM 工具。 */
import { addStyle } from "../../protyle/util/addStyle";
/** 用途：安全读取思源配置。使用范围：setCodeTheme 读取代码主题配置。解耦评估：直接依赖环境访问层。 */
import { getSiyuanConfig } from "../siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：HTMLLinkElement 类型守卫。使用范围：setCodeTheme DOM 类型检查。解耦评估：同目录守卫文件，直接同层导入。 */
import { isHTMLLinkElement } from "./setCodeTheme.guard";

/**
 * 设置代码块主题样式
 *
 * 作用：根据当前外观模式（亮色/暗色）动态加载对应的代码高亮主题CSS
 *
 * 意图：为了让代码块的语法高亮主题能够跟随系统外观模式自动切换，
 * 提供更好的视觉一致性和用户体验
 *
 * 调用时机：
 * - 应用初始化时（assets.ts中的loadAssets）
 * - 代码高亮渲染时（highlightRender.ts）
 * - 外观模式切换时
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 必须立即查询和操作DOM元素以确保主题样式在渲染前就位，
 * 避免出现样式闪烁。CSS加载本身是异步的，但DOM操作必须同步完成。
 *
 * @param cdn CDN地址，默认使用Constants.PROTYLE_CDN
 */
export const setCodeTheme = (cdn = Constants.PROTYLE_CDN) => {
    const protyleHljsStyleElement = document.getElementById("protyleHljsStyle");
    const config = getSiyuanConfig();
    const isLightMode = config.appearance.mode === 0;
    
    // 根据当前外观模式选择对应的主题配置
    let css = (isLightMode ? config.appearance.codeBlockThemeLight : config.appearance.codeBlockThemeDark) || "default";
    
    // 亮色模式下，如果配置的主题不在支持列表中，回退到default主题
    if (isLightMode && !Constants.SIYUAN_CONFIG_APPEARANCE_LIGHT_CODE.includes(css)) {
        css = "default";
    }
    
    // 暗色模式下，如果配置的主题不在支持列表中，回退到github-dark主题
    if (!isLightMode && !Constants.SIYUAN_CONFIG_APPEARANCE_DARK_CODE.includes(css)) {
        css = "github-dark";
    }
    
    const href = `${cdn}/js/highlight.js/styles/${css}.min.css?v=11.11.1`;
    
    // 如果样式元素不存在，直接添加
    if (!protyleHljsStyleElement) {
        addStyle(href, "protyleHljsStyle");
        return;
    }
    
    // 使用类型守卫确保元素是HTMLLinkElement
    if (!isHTMLLinkElement(protyleHljsStyleElement)) {
        return;
    }
    
    // 如果href已经是目标值，无需更新
    if (protyleHljsStyleElement.href.includes(href)) {
        return;
    }
    
    // 移除旧样式并添加新样式
    protyleHljsStyleElement.remove();
    addStyle(href, "protyleHljsStyle");
};
