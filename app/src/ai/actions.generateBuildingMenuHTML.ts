import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";

/**
 * 生成AI菜单的完整HTML模板
 * @param customHTML 自定义菜单项的HTML
 * @returns 菜单的完整HTML字符串
 */
export const generateBuildingMenuHTML = (customHTML: string): string => {
    const clearContext = "Clear context";
    return `<div class="fn__flex-column b3-menu__filter">
    <input class="b3-text-field fn__flex-shrink" placeholder="${siyuanI18n.ai}"/>
    <div class="fn__hr"></div>
    <div class="b3-list fn__flex-1 b3-list--background">
       <div class="b3-list-item b3-list-item--narrow b3-list-item--focus" data-action="Continue writing">
            ${siyuanI18n.aiContinueWrite}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${siyuanI18n.aiExtractSummary}">
            ${siyuanI18n.aiExtractSummary}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${siyuanI18n.aiBrainStorm}">
            ${siyuanI18n.aiBrainStorm}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${siyuanI18n.aiFixGrammarSpell}">
            ${siyuanI18n.aiFixGrammarSpell}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${clearContext}">
            ${siyuanI18n.clearContext}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-type="recentDocs">
            ${siyuanI18n.recentDocs}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-type="custom">
            ${siyuanI18n.aiCustomAction}
        </div>
        ${customHTML}
    </div>
</div>`;
};
