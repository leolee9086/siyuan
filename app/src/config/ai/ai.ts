import { fetchPost } from "../../util/fetch";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isMobile } from "../../platform";
// @ts-ignore
import ModelScopeConfig from "./ModelScopeConfig.vue";
import { createVueComponentLoader } from "../../util/vue/mount";

// 生成移动端HTML的独立函数
function genMobileHTML() {
    return /*html*/`<div class="b3-label">
    ${siyuanI18n.apiProvider}
    <div class="b3-label__text">
        ${siyuanI18n.apiProviderTip}
    </div>
    <div class="b3-label__text fn__flex config__item">
        <select id="apiProvider" class="b3-select">
            <option value="OpenAI" ${getSiyuanConfig().ai.openAI.apiProvider === "OpenAI" ? "selected" : ""}>OpenAI</option>
            <option value="Azure" ${getSiyuanConfig().ai.openAI.apiProvider === "Azure" ? "selected" : ""}>Azure</option>
            <option value="Claude" ${getSiyuanConfig().ai.openAI.apiProvider === "Claude" ? "selected" : ""}>Claude</option>
        </select>
    </div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiTimeout}
    <div class="fn__hr"></div>
    <div class="fn__flex">
        <input class="b3-text-field fn__flex-1" type="number" step="1" min="5" max="600" id="apiTimeout" value="${getSiyuanConfig().ai.openAI.apiTimeout}"/>
        <span class="fn__space"></span>
        <span class="ft__on-surface fn__flex-center">s</span>
    </div>
    <div class="b3-label__text">${siyuanI18n.apiTimeoutTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiMaxTokens}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__flex-center fn__block" type="number" step="1" min="0" id="apiMaxTokens" value="${getSiyuanConfig().ai.openAI.apiMaxTokens}"/>
    <div class="b3-label__text">${siyuanI18n.apiMaxTokensTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiTemperature}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__flex-center fn__block" type="number" step="0.1" min="0" max="2" id="apiTemperature" value="${getSiyuanConfig().ai.openAI.apiTemperature}"/>
    <div class="b3-label__text">${siyuanI18n.apiTemperatureTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiMaxContexts}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__flex-center fn__block" type="number" step="1" min="1" max="64" id="apiMaxContexts" value="${getSiyuanConfig().ai.openAI.apiMaxContexts}"/>
    <div class="b3-label__text">${siyuanI18n.apiMaxContextsTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiModel}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="apiModel" value="${getSiyuanConfig().ai.openAI.apiModel}"/>
    <div class="b3-label__text">${siyuanI18n.apiModelTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiKey}
    <div class="fn__hr"></div>
    <div class="b3-form__icona fn__block">
        <input id="apiKey" type="password" class="b3-text-field b3-form__icona-input" value="${getSiyuanConfig().ai.openAI.apiKey}">
        <svg class="b3-form__icona-icon" data-action="togglePassword"><use xlink:href="#iconEye"></use></svg>
    </div>
    <div class="b3-label__text">${siyuanI18n.apiKeyTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiProxy}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="apiProxy" value="${getSiyuanConfig().ai.openAI.apiProxy}"/>
    <div class="b3-label__text">${siyuanI18n.apiProxyTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiBaseURL}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="apiBaseURL" value="${getSiyuanConfig().ai.openAI.apiBaseURL}"/>
    <div class="b3-label__text">${siyuanI18n.apiBaseURLTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.apiVersion}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="apiVersion" value="${getSiyuanConfig().ai.openAI.apiVersion}"/>
    <div class="b3-label__text">${siyuanI18n.apiVersionTip}</div>
</div>
<div class="b3-label">
    User-Agent
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="apiUserAgent" value="${getSiyuanConfig().ai.openAI.apiUserAgent}"/>
    <div class="b3-label__text">${siyuanI18n.apiUserAgentTip}</div>
</div>`;
}

// 生成桌面端HTML的独立函数
function genDesktopHTML() {
    return /*html*/`<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.apiProvider}
        <div class="b3-label__text">${siyuanI18n.apiProviderTip}</div>
    </div>
    <span class="fn__space"></span>
    <select id="apiProvider" class="b3-select fn__flex-center fn__size200">
        <option value="OpenAI" ${getSiyuanConfig().ai.openAI.apiProvider === "OpenAI" ? "selected" : ""}>OpenAI</option>
        <option value="Azure" ${getSiyuanConfig().ai.openAI.apiProvider === "Azure" ? "selected" : ""}>Azure</option>
        <option value="Claude" ${getSiyuanConfig().ai.openAI.apiProvider === "Claude" ? "selected" : ""}>Claude</option>
    </select>
</div>
<div class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.apiTimeout}
        <div class="b3-label__text">${siyuanI18n.apiTimeoutTip}</div>
    </div>
    <span class="fn__space"></span>
    <div class="fn__size200 fn__flex-center fn__flex">
        <input class="b3-text-field fn__flex-1" type="number" step="1" min="5" max="600" id="apiTimeout" value="${getSiyuanConfig().ai.openAI.apiTimeout}"/>
        <span class="fn__space"></span>
        <span class="ft__on-surface fn__flex-center">s</span>
    </div>
</div>
<div class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.apiMaxTokens}
        <div class="b3-label__text">${siyuanI18n.apiMaxTokensTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" type="number" step="1" min="0" id="apiMaxTokens" value="${getSiyuanConfig().ai.openAI.apiMaxTokens}"/>
</div>
<div class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.apiTemperature}
        <div class="b3-label__text">${siyuanI18n.apiTemperatureTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" type="number" step="0.1" min="0" max="2" id="apiTemperature" value="${getSiyuanConfig().ai.openAI.apiTemperature}"/>
</div>
<div class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.apiMaxContexts}
        <div class="b3-label__text">${siyuanI18n.apiMaxContextsTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" type="number" step="1" min="1" max="64" id="apiMaxContexts" value="${getSiyuanConfig().ai.openAI.apiMaxContexts}"/>
</div>
<div class="fn__flex b3-label">
    <div class="fn__block">
        ${siyuanI18n.apiModel}
        <div class="b3-label__text">${siyuanI18n.apiModelTip}</div>
        <div class="fn__hr"></div>
        <input class="b3-text-field fn__block" id="apiModel" value="${getSiyuanConfig().ai.openAI.apiModel}"/>
    </div>
</div>
<div class="fn__flex b3-label">
    <div class="fn__block">
        ${siyuanI18n.apiKey}
        <div class="b3-label__text">${siyuanI18n.apiKeyTip}</div>
        <div class="fn__hr"></div>
        <div class="b3-form__icona fn__block">
            <input id="apiKey" type="password" class="b3-text-field b3-form__icona-input" value="${getSiyuanConfig().ai.openAI.apiKey}">
            <svg class="b3-form__icona-icon" data-action="togglePassword"><use xlink:href="#iconEye"></use></svg>
        </div>
    </div>
</div>
<div class="fn__flex b3-label">
    <div class="fn__block">
        ${siyuanI18n.apiProxy}
        <div class="b3-label__text">${siyuanI18n.apiProxyTip}</div>
        <span class="fn__hr"></span>
        <input class="b3-text-field fn__block" id="apiProxy" value="${getSiyuanConfig().ai.openAI.apiProxy}"/>
    </div>
</div>
<div class="fn__flex b3-label">
    <div class="fn__block">
        ${siyuanI18n.apiBaseURL}
        <div class="b3-label__text">${siyuanI18n.apiBaseURLTip}</div>
        <span class="fn__hr"></span>
        <input class="b3-text-field fn__block" id="apiBaseURL" value="${getSiyuanConfig().ai.openAI.apiBaseURL}"/>
    </div>
</div>
<div class="fn__flex b3-label">
    <div class="fn__block">
        ${siyuanI18n.apiVersion}
        <div class="b3-label__text">${siyuanI18n.apiVersionTip}</div>
        <span class="fn__hr"></span>
        <input class="b3-text-field fn__block" id="apiVersion" value="${getSiyuanConfig().ai.openAI.apiVersion}"/>
    </div>
</div>
<div class="fn__flex b3-label">
    <div class="fn__block">
        User-Agent
        <div class="b3-label__text">${siyuanI18n.apiUserAgentTip}</div>
        <span class="fn__hr"></span>
        <input class="b3-text-field fn__block" id="apiUserAgent" value="${getSiyuanConfig().ai.openAI.apiUserAgent}"/>
    </div>
</div>`;
}

export const ai = {
    element: undefined as Element,
    genHTML: () => {
        let responsiveHTML = "";
        if (isMobile) {
            responsiveHTML = genMobileHTML();
        } else {
            responsiveHTML = genDesktopHTML();
        }
        return `<div class="fn__flex-column" style="height: 100%">
<div class="layout-tab-bar fn__flex">
    <div data-type="openai" class="item item--full item--focus"><span class="fn__flex-1"></span><span class="item__text">OpenAI</span><span class="fn__flex-1"></span></div>
    <div data-type="modelscope" class="item item--full"><span class="fn__flex-1"></span><span class="item__text">ModelScope</span><span class="fn__flex-1"></span></div>
</div>
<div class="fn__flex-1">
    <div data-type="openai" class="ai-config-tab">
        ${responsiveHTML}
    </div>
    <div data-type="modelscope" class="ai-config-tab fn__none" style="height:100%"></div>
</div>
</div>`;
    },
    bindEvent: () => {
        ai.bindTabEvent();
        ai.bindPasswordEvent();
        ai.bindInputEvent();
    },
    bindTabEvent: () => {
        const tabs = ai.element.querySelectorAll(".layout-tab-bar .item");
        for (const tab of tabs) {
            // @内联回调
            tab.addEventListener("click", () => {
                const type = tab.getAttribute("data-type");
                for (const item of tabs) {
                    item.classList.remove("item--focus");
                }
                tab.classList.add("item--focus");
                const configTabs = ai.element.querySelectorAll(".ai-config-tab");
                for (const item of configTabs) {
                    item.classList.add("fn__none");
                }
                const panel = ai.element.querySelector(`.ai-config-tab[data-type="${type}"]`);
                if (panel) {
                    panel.classList.remove("fn__none");
                    if (type === "modelscope") {
                        if (panel.innerHTML === "") { // Only mount once
                            createVueComponentLoader(panel as HTMLElement, {
                                components: { ModelScopeConfig },
                                template: "<ModelScopeConfig />"
                            });
                        }
                    }
                }
            });
        }
    },
    bindPasswordEvent: () => {
        const togglePassword = ai.element.querySelector('.b3-form__icona-icon[data-action="togglePassword"]');
        if (togglePassword) {
            // @内联回调
            togglePassword.addEventListener("click", () => {
                if (!togglePassword.firstElementChild || !togglePassword.previousElementSibling) {
                    return;
                }
                const isEye = togglePassword.firstElementChild.getAttribute("xlink:href") === "#iconEye";
                togglePassword.firstElementChild.setAttribute("xlink:href", isEye ? "#iconEyeoff" : "#iconEye");
                togglePassword.previousElementSibling.setAttribute("type", isEye ? "text" : "password");
            });
        }
    },
    bindInputEvent: () => {
        const inputs = ai.element.querySelectorAll("input, select");
        for (const item of inputs) {
            if (item.closest('.ai-config-tab[data-type="openai"]')) { // Only bind OpenAI events
                // @内联回调
                item.addEventListener("change", () => {
                    // @内联回调
                    fetchPost("/api/setting/setAI", {
                        openAI: {
                            apiUserAgent: (ai.element.querySelector("#apiUserAgent") as HTMLInputElement)?.value,
                            apiBaseURL: (ai.element.querySelector("#apiBaseURL") as HTMLInputElement)?.value,
                            apiVersion: (ai.element.querySelector("#apiVersion") as HTMLInputElement)?.value,
                            apiKey: (ai.element.querySelector("#apiKey") as HTMLInputElement)?.value,
                            apiModel: (ai.element.querySelector("#apiModel") as HTMLSelectElement)?.value,
                            apiMaxTokens: parseInt((ai.element.querySelector("#apiMaxTokens") as HTMLInputElement)?.value || "0"),
                            apiTemperature: parseFloat((ai.element.querySelector("#apiTemperature") as HTMLInputElement)?.value || "0"),
                            apiMaxContexts: parseInt((ai.element.querySelector("#apiMaxContexts") as HTMLInputElement)?.value || "0"),
                            apiProxy: (ai.element.querySelector("#apiProxy") as HTMLInputElement)?.value,
                            apiTimeout: parseInt((ai.element.querySelector("#apiTimeout") as HTMLInputElement)?.value || "0"),
                            apiProvider: (ai.element.querySelector("#apiProvider") as HTMLSelectElement)?.value,
                        }
                    }, response => {
                        getSiyuanConfig().ai = response.data;
                    });
                });
            }
        }
    }
};
