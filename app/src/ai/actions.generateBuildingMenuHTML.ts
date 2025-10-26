/**
 * 生成AI菜单的完整HTML模板
 * @param customHTML 自定义菜单项的HTML
 * @returns 菜单的完整HTML字符串
 */
export const generateBuildingMenuHTML = (customHTML: string): string => {
    const clearContext = "Clear context";
    return `<div class="fn__flex-column b3-menu__filter">
    <input class="b3-text-field fn__flex-shrink" placeholder="${window.siyuan.languages.ai}"/>
    <div class="fn__hr"></div>
    <div class="b3-list fn__flex-1 b3-list--background">
       <div class="b3-list-item b3-list-item--narrow b3-list-item--focus" data-action="Continue writing">
            ${window.siyuan.languages.aiContinueWrite}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiExtractSummary}">
            ${window.siyuan.languages.aiExtractSummary}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiBrainStorm}">
            ${window.siyuan.languages.aiBrainStorm}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiFixGrammarSpell}">
            ${window.siyuan.languages.aiFixGrammarSpell}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${clearContext}">
            ${window.siyuan.languages.clearContext}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-type="custom">
            ${window.siyuan.languages.aiCustomAction}
        </div>
        ${customHTML}
    </div>
</div>`;
};
