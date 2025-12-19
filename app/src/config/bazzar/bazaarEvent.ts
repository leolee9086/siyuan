import { fetchPost } from "../../util/fetch";
import { Constants } from "../../constants";
import { getFrontend } from "../../util/functions";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setStorageVal } from "../../protyle/util/compatibility";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { App } from "../../index";
import { handleBazaarClick } from "./bazaarEventAction";

export const bindBazaarEvent = (bazaar: any, app: App) => {
    if (!getSiyuanConfig().bazaar.trust) {
        bazaar.element.querySelector("button")?.addEventListener("click", () => {
            fetchPost("/api/setting/setBazaar", {
                trust: true,
                petalDisabled: getSiyuanConfig().bazaar.petalDisabled
            }, () => {
                getSiyuanConfig().bazaar.trust = true;
                bazaar.element.innerHTML = bazaar.genHTML();
                bazaar.bindEvent(app);
            });
        });
        return;
    }
    bazaar._genMyHTML("plugins", app);
    bazaar.element.firstElementChild?.addEventListener("click", (event: MouseEvent) => {
        handleBazaarClick(event, bazaar, app);
    });

    bazaar.element.querySelectorAll(".config-bazaar__panel .b3-form__icon > .b3-text-field").forEach((inputElement: HTMLInputElement) => {
        inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.isComposing) {
                return;
            }
            if (event.key === "Enter") {
                const keyword = inputElement.value.trim();
                const panel = hasClosestByClassName(inputElement, "config-bazaar__panel") as HTMLElement;
                const type = panel ? panel.getAttribute("data-type") : "";

                if (type === "template") {
                    fetchPost("/api/bazaar/getBazaarTemplate", { keyword }, response => {
                        bazaar._onBazaar(response, "templates");
                        bazaar._data.templates = response.data.packages;
                    });
                } else if (type === "icon") {
                    fetchPost("/api/bazaar/getBazaarIcon", { keyword }, response => {
                        bazaar._onBazaar(response, "icons");
                        bazaar._data.icons = response.data.packages;
                    });
                } else if (type === "widget") {
                    fetchPost("/api/bazaar/getBazaarWidget", { keyword }, response => {
                        bazaar._onBazaar(response, "widgets");
                        bazaar._data.widgets = response.data.packages;
                    });
                } else if (type === "theme") {
                    fetchPost("/api/bazaar/getBazaarTheme", { keyword }, response => {
                        bazaar._onBazaar(response, "themes");
                        bazaar._data.themes = response.data.packages;
                    });
                } else if (type === "plugin") {
                    fetchPost("/api/bazaar/getBazaarPlugin", {
                        frontend: getFrontend(),
                        keyword
                    }, response => {
                        bazaar._onBazaar(response, "plugins");
                        bazaar._data.plugins = response.data.packages;
                    });
                } else if (type === "downloaded") {
                    const btn = inputElement.parentElement?.parentElement?.querySelector(".b3-button:not(.b3-button--outline)");
                    if (btn) {
                        const bazaarType = btn.getAttribute("data-type")!.replace("my", "").toLowerCase() + "s" as TBazaarType;
                        bazaar._genMyHTML(bazaarType, app);
                    }
                }
                event.preventDefault();
                return;
            }
        });
    });

    bazaar.element.querySelectorAll(".b3-select").forEach((selectElement: HTMLSelectElement) => {
        selectElement.addEventListener("change", (event) => {
            const target = event.target as HTMLElement;
            if (selectElement.id === "bazaarSelect") {
                // theme select
                bazaar.element.querySelectorAll("#configBazaarTheme .b3-card").forEach((item: HTMLElement) => {
                    const objStr = item.getAttribute("data-obj");
                    if (objStr) {
                        const dataObj = JSON.parse(objStr);
                        if (selectElement.value === "0") {
                            if (dataObj.themeMode.indexOf("light") > -1) {
                                item.classList.remove("fn__none");
                            } else {
                                item.classList.add("fn__none");
                            }
                        } else if (selectElement.value === "1") {
                            if (dataObj.themeMode.indexOf("dark") > -1) {
                                item.classList.remove("fn__none");
                            } else {
                                item.classList.add("fn__none");
                            }
                        } else {
                            item.classList.remove("fn__none");
                        }
                    }
                });
                const counter = target.parentElement?.querySelector(".counter");
                if (counter) {
                    counter.textContent = bazaar.element.querySelectorAll("#configBazaarTheme .b3-card:not(.fn__none)").length.toString();
                }
            } else {
                // sort
                if (!window.siyuan || !window.siyuan.storage) return;
                const localSort = window.siyuan.storage[Constants.LOCAL_BAZAAR];
                const panelElement = selectElement.parentElement?.parentElement;
                if (!panelElement) return;

                let html = "";
                const cardElements = Array.from(panelElement.querySelectorAll(".b3-card"));
                if (selectElement.value === "0") { // 更新时间降序
                    cardElements.sort((a, b) => {
                        const aObj = JSON.parse(a.getAttribute("data-obj") || "{}");
                        const bObj = JSON.parse(b.getAttribute("data-obj") || "{}");
                        return bObj.updated < aObj.updated ? -1 : 1;
                    }).forEach((item) => {
                        html += item.outerHTML;
                    });
                } else if (selectElement.value === "1") { // 更新时间升序
                    cardElements.sort((a, b) => {
                        const aObj = JSON.parse(a.getAttribute("data-obj") || "{}");
                        const bObj = JSON.parse(b.getAttribute("data-obj") || "{}");
                        return bObj.updated < aObj.updated ? 1 : -1;
                    }).forEach((item) => {
                        html += item.outerHTML;
                    });
                } else if (selectElement.value === "2") { // 下载次数降序
                    cardElements.sort((a, b) => {
                        const aObj = JSON.parse(a.getAttribute("data-obj") || "{}");
                        const bObj = JSON.parse(b.getAttribute("data-obj") || "{}");
                        return bObj.downloads < aObj.downloads ? -1 : 1;
                    }).forEach((item) => {
                        html += item.outerHTML;
                    });
                } else if (selectElement.value === "3") { // 下载次数升序
                    cardElements.sort((a, b) => {
                        const aObj = JSON.parse(a.getAttribute("data-obj") || "{}");
                        const bObj = JSON.parse(b.getAttribute("data-obj") || "{}");
                        return bObj.downloads < aObj.downloads ? 1 : -1;
                    }).forEach((item) => {
                        html += item.outerHTML;
                    });
                }
                const dataType = panelElement.getAttribute("data-type");
                if (dataType) {
                    localSort[dataType] = selectElement.value;
                    setStorageVal(Constants.LOCAL_BAZAAR, window.siyuan.storage[Constants.LOCAL_BAZAAR]);
                }

                if (cardElements.length > 1) {
                    html += '<div class="fn__flex-1" style="margin-left: 15px;min-width: 342px;"></div><div class="fn__flex-1" style="margin-left: 15px;min-width: 342px;"></div>';
                }
                const cardsContainer = panelElement.querySelector(".b3-cards");
                if (cardsContainer) {
                    cardsContainer.innerHTML = html;
                }
            }
        });
    });

    // 使用事件委托处理关键词点击事件
    bazaar.element.addEventListener("click", (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.classList.contains("b3-chip") && target.hasAttribute("data-keyword")) {
            const keyword = target.getAttribute("data-keyword");
            const bazaarType = target.getAttribute("data-type") as TBazaarType;

            // 切换关键词选中状态
            if (bazaarType && keyword) {
                const selectedKeywords = bazaar._data.selectedKeywords[bazaarType];
                const index = selectedKeywords.indexOf(keyword);

                if (index === -1) {
                    // 添加关键词
                    selectedKeywords.push(keyword);
                    target.classList.add("b3-chip--primary");
                } else {
                    // 移除关键词
                    selectedKeywords.splice(index, 1);
                    target.classList.remove("b3-chip--primary");
                }

                // 应用过滤
                bazaar._renderFilteredPackages(bazaarType);
            }
        }
    });
};
