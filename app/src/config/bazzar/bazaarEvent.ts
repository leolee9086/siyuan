import { fetchPost } from "../../util/network/fetch";
import { Constants } from "../../constants";
import { getFrontend } from "../../util/platform/functions";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { setStorageVal } from "../../protyle/util/compatibility";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import type { AppFacade } from "../../app/AppFacade.types";
import { handleBazaarClick } from "./bazaarEventAction";
import { getDownloadedSortStorageKey, reorderDownloadedCards, sortDownloadedPackages } from "./bazaarRender";
import { IBazaar, IBazaarDataObj } from "./types";

export const bindBazaarEvent = (bazaar: IBazaar<AppFacade>, app: AppFacade) => {
    if (!getSiyuanConfig().bazaar.trust) {
        bindTrustEvent(bazaar, app);
        return;
    }
    bazaar._genMyHTML("plugins", app);
    (bazaar.element?.firstElementChild as HTMLElement)?.addEventListener("click", (event: MouseEvent) => {
        handleBazaarClick(event, bazaar, app);
    });

    bindSearchInputEvent(bazaar, app);
    bindSelectChangeEvent(bazaar);
    bindKeywordClickEvent(bazaar);
    bindLocalPackageInstallEvent(bazaar, app);
};

const bindTrustEvent = (bazaar: IBazaar<AppFacade>, app: AppFacade) => {
    bazaar.element?.querySelector("button")?.addEventListener("click", () => {
        handleTrustBtnClick(bazaar, app);
    });
};

const handleTrustBtnClick = (bazaar: IBazaar<AppFacade>, app: AppFacade) => {
    fetchPost("/api/setting/setBazaar", {
        trust: true,
        petalDisabled: getSiyuanConfig().bazaar.petalDisabled
    }, () => {
        getSiyuanConfig().bazaar.trust = true;
        if (bazaar.element) {
            bazaar.element.innerHTML = bazaar.genHTML();
        }
        bazaar.bindEvent(app);
    });
};

const bindSearchInputEvent = (bazaar: IBazaar<AppFacade>, app: AppFacade) => {
    const inputElements = bazaar.element?.querySelectorAll(".config-bazaar__panel .b3-form__icon > .b3-text-field");
    if (!inputElements) {
        return;
    }
    for (const item of inputElements) {
        const inputElement = item as HTMLInputElement;
        inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.isComposing) {
                return;
            }
            if (event.key === "Enter") {
                handleSearchEnter(bazaar, inputElement, event, app);
            }
        });
    }
};

const handleSearchEnter = (bazaar: IBazaar<AppFacade>, inputElement: HTMLInputElement, event: KeyboardEvent, app: AppFacade) => {
    const keyword = inputElement.value.trim();
    const panel = hasClosestByClassName(inputElement, "config-bazaar__panel") as HTMLElement;
    const type = panel ? panel.getAttribute("data-type") : "";

    if (type) {
        handleBazaarSearch(type, bazaar, keyword, app, inputElement);
    }
    event.preventDefault();
};

const handleBazaarSearch = (type: string, bazaar: IBazaar<AppFacade>, keyword: string, app: AppFacade, inputElement: HTMLInputElement) => {
    const strategies: Record<string, () => void> = {
        template: () => {
            fetchPost("/api/bazaar/getBazaarTemplate", { keyword }, response => {
                bazaar._onBazaar(response, "templates");
                bazaar._data.templates = response.data.packages;
            });
        },
        icon: () => {
            fetchPost("/api/bazaar/getBazaarIcon", { keyword }, response => {
                bazaar._onBazaar(response, "icons");
                bazaar._data.icons = response.data.packages;
            });
        },
        widget: () => {
            fetchPost("/api/bazaar/getBazaarWidget", { keyword }, response => {
                bazaar._onBazaar(response, "widgets");
                bazaar._data.widgets = response.data.packages;
            });
        },
        theme: () => {
            fetchPost("/api/bazaar/getBazaarTheme", { keyword }, response => {
                bazaar._onBazaar(response, "themes");
                bazaar._data.themes = response.data.packages;
            });
        },
        plugin: () => {
            fetchPost("/api/bazaar/getBazaarPlugin", {
                frontend: getFrontend(),
                keyword
            }, response => {
                bazaar._onBazaar(response, "plugins");
                bazaar._data.plugins = response.data.packages;
            });
        },
        downloaded: () => {
            const btn = inputElement.parentElement?.parentElement?.querySelector(".b3-button:not(.b3-button--outline)");
            if (btn) {
                const bazaarType = btn.getAttribute("data-type")!.replace("my", "").toLowerCase() + "s" as TBazaarType;
                bazaar._genMyHTML(bazaarType, app);
            }
        }
    };
    if (strategies[type]) {
        strategies[type]();
    }
};

const bindSelectChangeEvent = (bazaar: IBazaar<AppFacade>) => {
    const selectElements = bazaar.element?.querySelectorAll(".b3-select");
    if (!selectElements) {
        return;
    }
    for (const item of selectElements) {
        const selectElement = item as HTMLSelectElement;
        selectElement.addEventListener("change", (event: Event) => {
            handleSelectChange(bazaar, selectElement, event);
        });
    }
};

const handleSelectChange = (bazaar: IBazaar<AppFacade>, selectElement: HTMLSelectElement, event: Event) => {
    const target = event.target as HTMLElement;
    if (selectElement.getAttribute("data-type") === "downloaded-sort") {
        handleDownloadedSortChange(bazaar, selectElement);
        return;
    }
    if (selectElement.id === "bazaarSelect") {
        handleThemeSelect(bazaar, selectElement, target);
        return;
    }
    handleSortSelect(bazaar, selectElement);
};

const handleDownloadedSortChange = (bazaar: IBazaar<AppFacade>, selectElement: HTMLSelectElement) => {
    if (!window.siyuan || !window.siyuan.storage) {
        return;
    }
    const bazaarType = getDownloadedCurrentPackageType(bazaar);
    const storageKey = getDownloadedSortStorageKey(bazaarType);
    window.siyuan.storage[Constants.LOCAL_BAZAAR][storageKey] = selectElement.value;
    setStorageVal(Constants.LOCAL_BAZAAR, window.siyuan.storage[Constants.LOCAL_BAZAAR]);
    if (bazaar.element) {
        reorderDownloadedCards(bazaar.element, sortDownloadedPackages(bazaar._data.downloadedDefault, selectElement.value));
    }
};

const handleThemeSelect = (bazaar: IBazaar<AppFacade>, selectElement: HTMLSelectElement, target: HTMLElement) => {
    // theme select
    const cards = bazaar.element?.querySelectorAll("#configBazaarTheme .b3-card");
    if (!cards) {
        return;
    }
    for (const cardNode of cards) {
        const item = cardNode as HTMLElement;
        const objStr = item.getAttribute("data-obj");
        if (objStr) {
            const dataObj = JSON.parse(objStr) as IBazaarDataObj;
            const themeMode = dataObj.themeMode || "";
            if (selectElement.value === "0") {
                if (themeMode.indexOf("light") > -1) {
                    item.classList.remove("fn__none");
                } else {
                    item.classList.add("fn__none");
                }
            } else if (selectElement.value === "1") {
                if (themeMode.indexOf("dark") > -1) {
                    item.classList.remove("fn__none");
                } else {
                    item.classList.add("fn__none");
                }
            } else {
                item.classList.remove("fn__none");
            }
        }
    }
    const counter = target.parentElement?.querySelector(".counter");
    if (counter) {
        counter.textContent = bazaar.element?.querySelectorAll("#configBazaarTheme .b3-card:not(.fn__none)").length.toString() || "0";
    }
};

const getBazaarObj = (element: HTMLElement) => {
    return JSON.parse(element.getAttribute("data-obj") || "{}") as IBazaarDataObj;
};

const handleSortSelect = (bazaar: IBazaar<AppFacade>, selectElement: HTMLSelectElement) => {
    // sort
    if (!window.siyuan || !window.siyuan.storage) {
        return;
    }
    const localSort = window.siyuan.storage[Constants.LOCAL_BAZAAR];
    const panelElement = selectElement.parentElement?.parentElement;
    if (!panelElement) {
        return;
    }

    let html = "";
    const cardElements = Array.from(panelElement.querySelectorAll(".b3-card") as NodeListOf<HTMLElement>);

    const sortStrategies: Record<string, (a: HTMLElement, b: HTMLElement) => number> = {
        "0": (a, b) => { // 更新时间降序
            return (getBazaarObj(b).updated || "") < (getBazaarObj(a).updated || "") ? -1 : 1;
        },
        "1": (a, b) => { // 更新时间升序
            return (getBazaarObj(b).updated || "") < (getBazaarObj(a).updated || "") ? 1 : -1;
        },
        "2": (a, b) => { // 下载次数降序
            return (getBazaarObj(b).downloads || 0) < (getBazaarObj(a).downloads || 0) ? -1 : 1;
        },
        "3": (a, b) => { // 下载次数升序
            return (getBazaarObj(b).downloads || 0) < (getBazaarObj(a).downloads || 0) ? 1 : -1;
        }
    };

    if (sortStrategies[selectElement.value]) {
        cardElements.sort(sortStrategies[selectElement.value]);
    }

    for (const item of cardElements) {
        html += item.outerHTML;
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
};

const handleKeywordClick = (bazaar: IBazaar<AppFacade>, event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("b3-chip") || !target.hasAttribute("data-keyword")) {
        return;
    }

    const keyword = target.getAttribute("data-keyword");
    const bazaarType = target.getAttribute("data-type") as TBazaarType;

    // 切换关键词选中状态
    if (!bazaarType || !keyword) {
        return;
    }

    const selectedKeywords = bazaar._data.selectedKeywords[bazaarType];
    const index = selectedKeywords.indexOf(keyword);

    if (index === -1) {
        // 添加关键词
        selectedKeywords.push(keyword);
        target.classList.add("b3-chip--primary");
        bazaar._renderFilteredPackages(bazaarType);
        return;
    }

    // 移除关键词
    selectedKeywords.splice(index, 1);
    target.classList.remove("b3-chip--primary");

    // 应用过滤
    bazaar._renderFilteredPackages(bazaarType);
};

const bindKeywordClickEvent = (bazaar: IBazaar<AppFacade>) => {
    // 使用事件委托处理关键词点击事件
    bazaar.element?.addEventListener("click", (event: MouseEvent) => {
        handleKeywordClick(bazaar, event);
    });
};

const getDownloadedCurrentPackageType = (bazaar: IBazaar<AppFacade>): TBazaarType => {
    const activeBtn = bazaar.element?.querySelector('.config-bazaar__panel[data-type="downloaded"] .config-bazaar__title .b3-button:not(.b3-button--outline)') as HTMLElement;
    const currentType = activeBtn?.getAttribute("data-type");
    switch (currentType) {
        case "myTheme":
            return "themes";
        case "myIcon":
            return "icons";
        case "myTemplate":
            return "templates";
        case "myWidget":
            return "widgets";
        default:
            return "plugins";
    }
};

const bindLocalPackageInstallEvent = (bazaar: IBazaar<AppFacade>, app: AppFacade) => {
    const installBtn = bazaar.element?.querySelector('[data-type="install-local-package"]') as HTMLButtonElement;
    const fileInput = bazaar.element?.querySelector("#bazaarLocalPackageInput") as HTMLInputElement;
    if (!installBtn || !fileInput) {
        return;
    }

    installBtn.addEventListener("click", () => {
        fileInput.value = "";
        fileInput.click();
    });

    fileInput.addEventListener("change", () => {
        if (!fileInput.files || !fileInput.files[0]) {
            return;
        }

        const currentPackageType = getDownloadedCurrentPackageType(bazaar);
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        formData.append("themeMode", String(getSiyuanConfig().appearance.mode || 0));
        formData.append("frontend", getFrontend());

        const keywordInput = bazaar.element?.querySelector(".config-bazaar__panel:not(.fn__none) .b3-form__icon-input") as HTMLInputElement;
        if (keywordInput?.value) {
            formData.append("keyword", keywordInput.value);
        }

        fetchPost("/api/s-forge/bazaar/installPackageLocal", formData, (response) => {
            if (response.code !== 0) {
                return;
            }

            const packageType = (response.data?.packageType || currentPackageType) as TBazaarType;
            if (response.data?.appearance) {
                window.siyuan.config.appearance = response.data.appearance;
            }
            bazaar._onBazaar(response, packageType);
            bazaar._genMyHTML(packageType, app);
        });
    });
};
