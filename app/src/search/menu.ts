import { Dialog } from "../dialog";
import { isMobile, objEquals } from "../util/platform/functions";
import { MenuItem } from "../menus/Menu.Item";
import { Constants } from "../constants";
import { showMessage } from "../dialog/message";
import { fetchPost } from "../util/network/fetch";
import { escapeHtml } from "../util/DOM/escape";
import {setStorageVal} from "../util/storage/setStorageVal";
import { confirmDialog } from "../dialog/confirmDialog";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {isEncryptedBox} from "../util/file/notebook/store";
import {getDefaultSubType} from "./defaults/searchDefaults";

export const filterMenu = (config: Config.IUILayoutTabSearchConfig, cb: () => void) => {
    const filterDialog = new Dialog({
        title: siyuanI18n.searchType,
        content: `<div class="b3-dialog__content">
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconMath"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.math}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="mathBlock" type="checkbox"${config.types.mathBlock ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconTable"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.table}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="table" type="checkbox"${config.types.table ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconParagraph"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.paragraph}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="paragraph" type="checkbox"${config.types.paragraph ? " checked" : ""}>
    </label>
    <div class="fn__flex b3-label">
        <span style="margin:0 4px 0 -20px" class="b3-list-item__toggle b3-list-item__toggle--hl fn__pointer">
            <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
        </span>
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconHeadings"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.headings}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="heading" type="checkbox"${config.types.heading ? " checked" : ""}>
    </div>
    <div class="fn__none" style="padding-left: 20px">
        ${(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((h) => `
        <label class="fn__flex b3-label">
            <div class="fn__flex-1 fn__flex-center">
                ${siyuanI18n["heading" + h.charAt(1)]}
            </div>
            <span class="fn__space"></span>
            <input class="b3-switch fn__flex-center" data-subtype="${h}" type="checkbox"${config.subTypes?.[h] ? " checked" : ""}>
        </label>`).join("")}<div></div>
    </div>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconCode"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.code}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="codeBlock" type="checkbox"${config.types.codeBlock ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconHTML5"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            HTML
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="htmlBlock" type="checkbox"${config.types.htmlBlock ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconDatabase"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.database}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="databaseBlock" type="checkbox"${config.types.databaseBlock ? " checked" : ""}>
    </label>    
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconSQL"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.embedBlock}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="embedBlock" type="checkbox"${config.types.embedBlock ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconVideo"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.video}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="videoBlock" type="checkbox"${config.types.videoBlock ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconRecord"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.audio}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="audioBlock" type="checkbox"${config.types.audioBlock ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconGlobe"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            IFrame
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="iframeBlock" type="checkbox"${config.types.iframeBlock ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconBoth"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.widget}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="widgetBlock" type="checkbox"${config.types.widgetBlock ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconQuote"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.quote} <sup>[1]</sup>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="blockquote" type="checkbox"${config.types.blockquote ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconCallout"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.callout} <sup>[1]</sup>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="callout" type="checkbox"${config.types.callout ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconSuper"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.superBlock} <sup>[1]</sup>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="superBlock" type="checkbox"${config.types.superBlock ? " checked" : ""}>
    </label>
    <div class="fn__flex b3-label">
        <span style="margin:0 4px 0 -20px" class="b3-list-item__toggle b3-list-item__toggle--hl fn__pointer" data-toggle-subtype="list">
            <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
        </span>
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconList"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.list1} <sup>[1] [2]</sup>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="list" type="checkbox"${config.types.list ? " checked" : ""}>
    </div>
    <div class="fn__none" style="padding-left: 20px;">
        <label class="fn__flex b3-label">
            <div class="fn__flex-1 fn__flex-center">${siyuanI18n["ordered-list"]}</div>
            <span class="fn__space"></span>
            <input class="b3-switch fn__flex-center" data-subtype="o" type="checkbox"${config.subTypes?.o ? " checked" : ""}>
        </label>
        <label class="fn__flex b3-label">
            <div class="fn__flex-1 fn__flex-center">${siyuanI18n.unorderedList}</div>
            <span class="fn__space"></span>
            <input class="b3-switch fn__flex-center" data-subtype="u" type="checkbox"${config.subTypes?.u ? " checked" : ""}>
        </label>
        <label class="fn__flex b3-label">
            <div class="fn__flex-1 fn__flex-center">${siyuanI18n.check}</div>
            <span class="fn__space"></span>
            <input class="b3-switch fn__flex-center" data-subtype="t" type="checkbox"${config.subTypes?.t ? " checked" : ""}>
        </label>
        <div></div>
    </div>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconListItem"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.listItem} <sup>[1]</sup>
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="listItem" type="checkbox"${config.types.listItem ? " checked" : ""}>
    </label>
    <label class="fn__flex b3-label">
        <svg class="ft__on-surface svg fn__flex-center"><use xlink:href="#iconFile"></use></svg>
        <span class="fn__space"></span>
        <div class="fn__flex-1 fn__flex-center">
            ${siyuanI18n.doc}
        </div>
        <span class="fn__space"></span>
        <input class="b3-switch fn__flex-center" data-type="document" type="checkbox"${config.types.document ? " checked" : ""}>
    </label>
    <span class="fn__space"></span>
    <div class="fn__flex-1">
        <div class="b3-label__text">[1] ${siyuanI18n.containerBlockTip1}</div>
        <div class="b3-label__text">[2] ${siyuanI18n.searchSubTypeListTip}</div>
    </div>    
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "600px",
        height: "70vh",
    });
    filterDialog.element.setAttribute("data-key", Constants.DIALOG_SEARCHTYPE);
    filterDialog.element.querySelectorAll(".b3-list-item__toggle--hl").forEach((item: HTMLElement) => {
        item.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            item.parentElement.nextElementSibling.classList.toggle("fn__none");
            item.firstElementChild.classList.toggle("b3-list-item__arrow--open");
        });
    });
    // Keep parent and subtype toggles in sync.
    filterDialog.element.querySelectorAll("input[data-subtype]").forEach((item: HTMLInputElement) => {
        item.addEventListener("change", () => {
            if (!item.checked) {
                return;
            }
            ({
                h1: ["heading"], h2: ["heading"], h3: ["heading"],
                h4: ["heading"], h5: ["heading"], h6: ["heading"],
                o: ["list", "listItem"],
                u: ["list", "listItem"],
                t: ["list", "listItem"],
            })[item.getAttribute("data-subtype")].forEach((parentType) => {
                const parentElement = filterDialog.element.querySelector(`input[data-type="${parentType}"]`) as HTMLInputElement;
                if (parentElement && !parentElement.checked) {
                    parentElement.checked = true;
                }
            });
        });
    });
    const parentSubtypes: Record<string, string[]> = {
        heading: ["h1", "h2", "h3", "h4", "h5", "h6"],
        list: ["o", "u", "t"],
        listItem: ["o", "u", "t"],
    };
    Object.keys(parentSubtypes).forEach((key) => {
        const parentElement = filterDialog.element.querySelector(`input[data-type="${key}"]`) as HTMLInputElement;
        parentElement.addEventListener("change", () => {
            if (parentElement.checked) {
                return;
            }
            parentSubtypes[key].forEach((subtype) => {
                const subtypeBox = filterDialog.element.querySelector(`input[data-subtype="${subtype}"]`) as HTMLInputElement;
                if (subtypeBox && subtypeBox.checked) {
                    subtypeBox.checked = false;
                }
            });
        });
    });
    const btnsElement = filterDialog.element.querySelectorAll(".b3-button");
    btnsElement[0].addEventListener("click", () => {
        filterDialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => {
        if (!config.subTypes) {
            config.subTypes = getDefaultSubType();
        }
        filterDialog.element.querySelectorAll(".b3-switch").forEach((item: HTMLInputElement) => {
            const subtype = item.getAttribute("data-subtype");
            if (subtype) {
                config.subTypes[subtype as keyof Config.IUILayoutTabSearchConfigSubTypes] = item.checked;
            } else {
                config.types[item.getAttribute("data-type") as keyof (typeof config.types)] = item.checked;
            }
        });
        cb();
        window.siyuan.storage[Constants.LOCAL_SEARCHDATA] = Object.assign({}, config);
        setStorageVal(Constants.LOCAL_SEARCHDATA, window.siyuan.storage[Constants.LOCAL_SEARCHDATA]);
        filterDialog.destroy();
    });
};

export const replaceFilterMenu = (config: Config.IUILayoutTabSearchConfig) => {
    let html = "";
    Object.keys(Constants.SIYUAN_DEFAULT_REPLACETYPES).forEach((key: keyof Config.IUILayoutTabSearchConfigReplaceTypes) => {
        html += `<label class="fn__flex b3-label">
    <span class="fn__space"></span>
    <div class="fn__flex-1 fn__flex-center">
        ${siyuanI18n.replaceTypes[key]}
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" data-type="${key}" type="checkbox"${config.replaceTypes[key] ? " checked" : ""}>
</label>`;
    });
    const filterDialog = new Dialog({
        title: siyuanI18n.replaceType,
        content: `<div class="b3-dialog__content">${html}</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
        height: "70vh",
    });
    filterDialog.element.setAttribute("data-key", Constants.DIALOG_REPLACETYPE);
    const btnsElement = filterDialog.element.querySelectorAll(".b3-button");
    btnsElement[0].addEventListener("click", () => {
        filterDialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => {
        filterDialog.element.querySelectorAll(".b3-switch").forEach((item: HTMLInputElement) => {
            config.replaceTypes[item.getAttribute("data-type") as keyof (typeof config.replaceTypes)] = item.checked;
        });
        window.siyuan.storage[Constants.LOCAL_SEARCHDATA] = Object.assign({}, config);
        setStorageVal(Constants.LOCAL_SEARCHDATA, window.siyuan.storage[Constants.LOCAL_SEARCHDATA]);
        filterDialog.destroy();
    });
};

export const queryMenu = (config: Config.IUILayoutTabSearchConfig, cb: () => void) => {
    if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
        window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_SEARCH_METHOD) {
        window.siyuan.menus.menu.remove();
        return;
    }
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_SEARCH_METHOD);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: "iconExact",
        label: siyuanI18n.keyword,
        current: config.method === 0,
        click() {
            config.method = 0;
            cb();
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: "iconQuote",
        label: siyuanI18n.querySyntax,
        current: config.method === 1,
        click() {
            config.method = 1;
            cb();
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: "iconDatabase",
        label: "SQL",
        current: config.method === 2,
        click() {
            config.method = 2;
            cb();
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: "iconRegex",
        label: siyuanI18n.regex,
        current: config.method === 3,
        click() {
            config.method = 3;
            cb();
        }
    }).element);
    if (window.siyuan.config.ai.embedding.enabled) {
        window.siyuan.menus.menu.append(new MenuItem({
            icon: "iconSparkles",
            label: siyuanI18n.semanticSearch,
            current: config.method === 4,
            click() {
                config.method = 4;
                cb();
            }
        }).element);
    }
};


const saveCriterionData = (config: Config.IUILayoutTabSearchConfig,
    criteriaData: Config.IUILayoutTabSearchConfig[],
    element: Element,
    value: string,
    saveDialog: Dialog) => {
    config.removed = false;
    const criterion = config;
    criterion.name = value;
    criteriaData.push(Object.assign({}, criterion));
    window.siyuan.storage[Constants.LOCAL_SEARCHDATA] = Object.assign({}, config);
    setStorageVal(Constants.LOCAL_SEARCHDATA, window.siyuan.storage[Constants.LOCAL_SEARCHDATA]);
    fetchPost("/api/storage/setCriterion", { criterion }, () => {
        saveDialog.destroy();
        const criteriaElement = element.querySelector("#criteria").firstElementChild;
        criteriaElement.classList.remove("fn__none");
        criteriaElement.querySelector(".b3-chip--current")?.classList.remove("b3-chip--current");
        criteriaElement.insertAdjacentHTML("beforeend", `<div data-type="set-criteria" class="b3-chip b3-chip--current b3-chip--middle b3-chip--pointer">${criterion.name}<svg class="b3-chip__close" data-type="remove-criteria"><use xlink:href="#iconClose"></use></svg></div>`);
    });
};

/** 判断搜索配置是否涉及加密笔记本内容，此类条件包含敏感信息，不应持久化保存。 */
const isSensitiveSearchConfig = (config?: Config.IUILayoutTabSearchConfig) => {
    if (!config) {
        return false;
    }
    if (config.sensitive) {
        return true;
    }
    return config.idPath?.some((item) => isEncryptedBox(item.split("/")[0])) || false;
};

export const saveCriterion = (config: Config.IUILayoutTabSearchConfig,
    criteriaData: Config.IUILayoutTabSearchConfig[],
    element: Element) => {
    if (isSensitiveSearchConfig(config)) {
        return;
    }
    const saveDialog = new Dialog({
        title: siyuanI18n.saveCriterion,
        content: `<div class="b3-dialog__content">
        <input class="b3-text-field fn__block" placeholder="${siyuanI18n.memo}">
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    saveDialog.element.setAttribute("data-key", Constants.DIALOG_SAVECRITERION);
    const btnsElement = saveDialog.element.querySelectorAll(".b3-button");
    saveDialog.bindInput(saveDialog.element.querySelector("input"), () => {
        btnsElement[1].dispatchEvent(new CustomEvent("click"));
    });
    btnsElement[0].addEventListener("click", () => {
        saveDialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => {
        const inputElement = saveDialog.element.querySelector("input");
        const value = inputElement.value.trim();
        if (!value) {
            showMessage(siyuanI18n["_kernel"]["142"]);
            return;
        }
        if (isMobile()) {
            config.k = (document.querySelector("#toolbarSearch") as HTMLInputElement).value;
            config.r = (element.querySelector("#toolbarReplace") as HTMLInputElement).value;
        } else {
            config.k = (element.querySelector("#searchInput") as HTMLInputElement).value;
            config.r = (element.querySelector("#replaceInput") as HTMLInputElement).value;
        }
        const criteriaElement = element.querySelector("#criteria").firstElementChild;
        let hasSameName = "";
        let hasSameConfig = "";
        criteriaData.forEach(item => {
            if (item.name === value) {
                hasSameName = item.name;
            }
            if (configIsSame(item, config)) {
                hasSameConfig = item.name;
            }
        });
        inputElement.blur();
        if (hasSameName && !hasSameConfig) {
            confirmDialog(siyuanI18n.confirm, siyuanI18n.searchOverwrite, () => {
                Array.from(criteriaElement.children).forEach(item => {
                    if (item.textContent === value) {
                        item.remove();
                    }
                });
                criteriaData.find((item, index) => {
                    if (item.name === value) {
                        criteriaData.splice(index, 1);
                        return true;
                    }
                });
                saveCriterionData(config, criteriaData, element, value, saveDialog);
            });
        } else if (hasSameName && hasSameConfig) {
            if (hasSameName === hasSameConfig) {
                saveDialog.destroy();
            } else {
                const removeName = hasSameName === value ? hasSameConfig : hasSameName;
                confirmDialog(siyuanI18n.confirm, siyuanI18n.searchRemoveName.replace("${x}", removeName).replace("${y}", value), () => {
                    Array.from(criteriaElement.children).forEach(item => {
                        if (item.textContent === hasSameConfig || item.textContent === hasSameName) {
                            item.remove();
                        }
                    });
                    criteriaData.find((item, index) => {
                        if (item.name === removeName || item.name === hasSameName) {
                            fetchPost("/api/storage/removeCriterion", { name: removeName });
                            criteriaData.splice(index, 1);
                            return true;
                        }
                    });
                    saveCriterionData(config, criteriaData, element, value, saveDialog);
                });
            }
        } else if (!hasSameName && hasSameConfig) {
            confirmDialog(siyuanI18n.confirm, siyuanI18n.searchUpdateName.replace("${x}", hasSameConfig).replace("${y}", value), () => {
                Array.from(criteriaElement.children).forEach(item => {
                    if (item.textContent === hasSameConfig) {
                        item.remove();
                    }
                });
                criteriaData.find((item, index) => {
                    if (item.name === hasSameConfig) {
                        fetchPost("/api/storage/removeCriterion", { name: hasSameConfig });
                        criteriaData.splice(index, 1);
                        return true;
                    }
                });
                saveCriterionData(config, criteriaData, element, value, saveDialog);
            });
        } else {
            saveCriterionData(config, criteriaData, element, value, saveDialog);
        }
    });
};

export const moreMenu = async (config: Config.IUILayoutTabSearchConfig,
    criteriaData: Config.IUILayoutTabSearchConfig[],
    element: Element,
    extensions: {
        onChange: () => void;
        removeCriterion: () => void;
        appendLeadingItems?: () => void;
        appendLayoutItems?: () => void;
    }) => {
    if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
        window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_SEARCH_MORE) {
        window.siyuan.menus.menu.remove();
        return;
    }
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_SEARCH_MORE);
    extensions.appendLeadingItems?.();
    if (isMobile()) {
        window.siyuan.menus.menu.append(new MenuItem({
            iconHTML: "",
            label: siyuanI18n.searchType,
            click() {
                filterMenu(config, () => {
                    extensions.onChange();
                });
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            iconHTML: "",
            label: siyuanI18n.replaceType,
            click() {
                replaceFilterMenu(config);
            }
        }).element);
        const searchMethodSubmenu = [{
            icon: "iconExact",
            label: siyuanI18n.keyword,
            current: config.method === 0,
            click() {
                config.method = 0;
                config.page = 1;
                extensions.onChange();
            }
        }, {
            icon: "iconQuote",
            label: siyuanI18n.querySyntax,
            current: config.method === 1,
            click() {
                config.method = 1;
                config.page = 1;
                extensions.onChange();
            }
        }, {
            icon: "iconDatabase",
            label: "SQL",
            current: config.method === 2,
            click() {
                config.method = 2;
                config.page = 1;
                extensions.onChange();
            }
        }, {
            icon: "iconRegex",
            label: siyuanI18n.regex,
            current: config.method === 3,
            click() {
                config.method = 3;
                config.page = 1;
                extensions.onChange();
            }
        }];
        if (window.siyuan.config.ai.embedding.enabled) {
            searchMethodSubmenu.push({
                icon: "iconSparkles",
                label: siyuanI18n.semanticSearch,
                current: config.method === 4,
                click() {
                    config.method = 4;
                    config.page = 1;
                    extensions.onChange();
                }
            });
        }
        window.siyuan.menus.menu.append(new MenuItem({
            iconHTML: "",
            label: siyuanI18n.searchMethod,
            type: "submenu",
            submenu: searchMethodSubmenu
        }).element);
    }
    const sortMenu = [{
        iconHTML: "",
        label: siyuanI18n.type,
        current: config.sort === 0,
        click() {
            config.sort = 0;
            extensions.onChange();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.createdASC,
        current: config.sort === 1,
        click() {
            config.sort = 1;
            extensions.onChange();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.createdDESC,
        current: config.sort === 2,
        click() {
            config.sort = 2;
            extensions.onChange();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.modifiedASC,
        current: config.sort === 3,
        click() {
            config.sort = 3;
            extensions.onChange();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.modifiedDESC,
        current: config.sort === 4,
        click() {
            config.sort = 4;
            extensions.onChange();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.sortByRankAsc,
        current: config.sort === 6,
        click() {
            config.sort = 6;
            extensions.onChange();
        }
    }, {
        iconHTML: "",
        label: siyuanI18n.sortByRankDesc,
        current: config.sort === 7,
        click() {
            config.sort = 7;
            extensions.onChange();
        }
    }];
    if (config.group === 1) {
        sortMenu.push({
            iconHTML: "",
            label: siyuanI18n.sortByContent,
            current: config.sort === 5,
            click() {
                config.sort = 5;
                extensions.onChange();
            }
        });
    }
    window.siyuan.menus.menu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.sort,
        type: "submenu",
        submenu: sortMenu,
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.group,
        type: "submenu",
        submenu: [{
            iconHTML: "",
            label: siyuanI18n.noGroupBy,
            current: config.group === 0,
            click() {
                if (isMobile()) {
                    element.querySelector('[data-type="expand"]').classList.add("fn__none");
                    element.querySelector('[data-type="contract"]').classList.add("fn__none");
                } else {
                    element.querySelector("#searchCollapse").parentElement.classList.add("fn__none");
                }
                config.group = 0;
                if (config.sort === 5) {
                    config.sort = 0;
                }
                extensions.onChange();
            }
        }, {
            iconHTML: "",
            label: siyuanI18n.groupByDoc,
            current: config.group === 1,
            click() {
                if (isMobile()) {
                    element.querySelector('[data-type="expand"]').classList.remove("fn__none");
                    element.querySelector('[data-type="contract"]').classList.remove("fn__none");
                } else {
                    element.querySelector("#searchCollapse").parentElement.classList.remove("fn__none");
                }
                config.group = 1;
                extensions.onChange();
            }
        }]
    }).element);
    extensions.appendLayoutItems?.();
    window.siyuan.menus.menu.append(new MenuItem({ type: "separator" }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        label: siyuanI18n.saveCriterion,
        iconHTML: "",
        click() {
            saveCriterion(config, criteriaData, element);
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        iconHTML: "",
        label: siyuanI18n.removeCriterion,
        click() {
            extensions.removeCriterion();
        }
    }).element);
};

const configIsSame = (config: Config.IUILayoutTabSearchConfig, config2: Config.IUILayoutTabSearchConfig) => {
    if (config2.group === config.group && config2.hPath === config.hPath && config2.hasReplace === config.hasReplace &&
        config2.k === config.k && config2.method === config.method && config2.r === config.r &&
        config2.sort === config.sort && objEquals(config2.types, config.types) &&
        objEquals({...getDefaultSubType(), ...config2.subTypes},
            {...getDefaultSubType(), ...config.subTypes}) && objEquals(config2.replaceTypes, config.replaceTypes) &&
        objEquals(config2.idPath, config.idPath)) {
        return true;
    }
    return false;
};

export const initCriteriaMenu = (element: HTMLElement, data: Config.IUILayoutTabSearchConfig[], config: Config.IUILayoutTabSearchConfig) => {
    fetchPost("/api/storage/getCriteria", {}, (response) => {
        let html = "";
        response.data.forEach((item: Config.IUILayoutTabSearchConfig) => {
            data.push(item);
            let isSame = false;
            if (configIsSame(item, config)) {
                isSame = true;
            }
            html += `<div data-type="set-criteria" class="${isSame ? "b3-chip--current " : ""}b3-chip b3-chip--middle b3-chip--pointer">${escapeHtml(item.name)}<svg class="b3-chip__close" data-type="remove-criteria"><use xlink:href="#iconClose"></use></svg></div>`;
        });
        // 移动端仅渲染条件筛选标签列表，不显示保存/删除按钮
        if (isMobile()) {
            element.innerHTML = `<div class="b3-chips${html ? "" : " fn__none"}">
    ${html}
</div>`;
        }
        // 桌面端额外渲染保存条件和删除条件按钮
        if (!isMobile()) {
            element.innerHTML = `<div class="b3-chips${html ? "" : " fn__none"}">
    ${html}
</div>
<span class="fn__flex-1"></span>
<button data-type="saveCriterion" class="b3-button b3-button--small b3-button--outline fn__flex-center">${siyuanI18n.saveCriterion}</button>
<span class="fn__space"></span>
<button data-type="removeCriterion" aria-label="${siyuanI18n.useCriterion}" class="ariaLabel b3-button b3-button--small b3-button--outline fn__flex-center fn__flex-shrink" data-position="9south">${siyuanI18n.removeCriterion}</button>
<span class="fn__space"></span>`;
        }
    });
};

export const getKeysByLiElement = (element: HTMLElement) => {
    const keys: string[] = [];
    element.querySelectorAll(".b3-list-item__text mark").forEach(item => {
        keys.push(item.textContent);
    });
    if (keys.length === 0) {
        element.querySelectorAll(".b3-list-item__meta mark").forEach(item => {
            keys.push(item.textContent);
        });
    }
    return [...new Set(keys)];
};

export const getKeyByLiElement = (element: HTMLElement) => {
    return getKeysByLiElement(element).join(" ");
};
