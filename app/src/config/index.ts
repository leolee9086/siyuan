import { popMenu } from "../mobile/menu";
import { editor } from "./editor";
import { about } from "./about";
import { appearance } from "./appearance";
import { image } from "./image";
import { initConfigSearch } from "./search";
import { fileTree } from "./fileTree";
import { exportConfig } from "./exportConfig";
import { account } from "./account";
import { repos } from "./repos";
import { keymap } from "./keymap";
import { bazaar } from "./bazzar/bazaar";
import { query } from "./query";
import { Dialog } from "../dialog";
import { ai } from "./ai/ai";
import { flashcard } from "./flashcard";
import { publish } from "./publish";
import { App } from "../index";
import { isHuawei, isInHarmony } from "../protyle/util/compatibility";
import { Constants } from "../constants";
import { focusByRange } from "../protyle/util/selection";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { INTERNAL_FILETREE_TAB_TYPE } from "./fileTree";
import fileTreeConfigPanel from "../components/panels/fileTreeConfig.panel.vue";
import { tabRegistry } from "../registry";
import { createApp } from "vue";
import type { Custom } from "../layout/dock/Custom";
import { isMobile } from "../platform";
import { createVueComponentLoader } from "../util/vue/mount";
import AIProfilesConfig from "./ai/AIProfilesConfig.vue";

export const genItemPanel = (type: string, containerElement: Element, app: App) => {
    switch (type) {
        case "filetree":
            containerElement.innerHTML = fileTree.genHTML();
            fileTree.bindEvent(containerElement as HTMLElement);
            break;
        case "AI":
            containerElement.innerHTML = ai.genHTML();
            ai.element = containerElement;
            ai.bindEvent();
            break;
        case "card":
            containerElement.innerHTML = flashcard.genHTML();
            flashcard.element = containerElement;
            flashcard.bindEvent();
            break;
        case "image":
            containerElement.innerHTML = image.genHTML();
            image.element = containerElement;
            image.bindEvent(app);
            break;
        case "export":
            containerElement.innerHTML = exportConfig.genHTML();
            exportConfig.element = containerElement;
            exportConfig.bindEvent();
            break;
        case "appearance":
            containerElement.innerHTML = appearance.genHTML();
            appearance.element = containerElement;
            appearance.bindEvent();
            break;
        case "keymap":
            containerElement.innerHTML = keymap.genHTML(app);
            keymap.element = containerElement;
            keymap.bindEvent(app);
            break;
        case "bazaar":
            bazaar.element = containerElement;
            containerElement.innerHTML = bazaar.genHTML();
            bazaar.bindEvent(app);
            break;
        case "account":
            containerElement.innerHTML = account.genHTML();
            account.element = containerElement;
            account.bindEvent(account.element);
            break;
        case "repos":
            containerElement.innerHTML = repos.genHTML();
            repos.element = containerElement;
            repos.bindEvent();
            break;
        case "about":
            containerElement.innerHTML = about.genHTML();
            about.element = containerElement;
            about.bindEvent();
            break;
        case "search":
            containerElement.innerHTML = query.genHTML();
            query.element = containerElement;
            query.bindEvent();
            break;
        case "publish":
            containerElement.innerHTML = publish.genHTML();
            publish.element = containerElement;
            publish.bindEvent();
            break;
        case "AIProfiles":
            containerElement.innerHTML = "";
            createVueComponentLoader(containerElement as HTMLElement, {
                components: { AIProfilesConfig },
                template: "<AIProfilesConfig />"
            });
            break;
        default:
            break;
    }
};

export const openSetting = (app: App) => {
    registerFileTreeTab();
    if (isMobile) {
        popMenu();
        return;
    }
    const exitDialog = window.siyuan.dialogs.find((item) => {
        if (item.element.querySelector(".config__tab-container")) {
            item.destroy();
            return true;
        }
    });
    if (exitDialog) {
        return exitDialog;
    }
    let range: Range;
    if (getSelection().rangeCount > 0) {
        range = getSelection().getRangeAt(0);
    }
    const dialog = new Dialog({
        content: `<div class="fn__flex-1 fn__flex config__panel" style="overflow: hidden;position: relative">
    <div class="config__side">
        <div class="config__tab-title resize__move">
            <svg class="b3-list-item__graphic"><use xlink:href="#iconSettings"></use></svg>
            <span class="b3-list-item__text">${siyuanI18n.config}</span>
        </div>
        <div class="b3-form__icon"><svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg><input placeholder="${siyuanI18n.search}" class="b3-text-field fn__block b3-form__icon-input"></div>
        <ul class="b3-list b3-list--background">
            <li data-name="editor" class="b3-list-item--focus b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconEdit"></use></svg><span class="b3-list-item__text">${siyuanI18n.editor}</span></li>
            <li data-name="filetree" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconFiles"></use></svg><span class="b3-list-item__text">${siyuanI18n.fileTree}</span></li>
            <li data-name="card" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconRiffCard"></use></svg><span class="b3-list-item__text">${siyuanI18n.riffCard}</span></li>
            <li data-name="AI" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconSparkles"></use></svg><span class="b3-list-item__text">AI</span></li>
            <li data-name="AIProfiles" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconSparkles"></use></svg><span class="b3-list-item__text">AI Profiles</span></li>
            <li data-name="image" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconImage"></use></svg><span class="b3-list-item__text">${siyuanI18n.assets}</span></li>
            <li data-name="export" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconUpload"></use></svg><span class="b3-list-item__text">${siyuanI18n.export}</span></li>
            <li data-name="appearance" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconTheme"></use></svg><span class="b3-list-item__text">${siyuanI18n.appearance}</span></li>
            <li data-name="bazaar" class="b3-list-item${isHuawei() || isInHarmony() ? " fn__none" : ""}"><svg class="b3-list-item__graphic"><use xlink:href="#iconBazaar"></use></svg><span class="b3-list-item__text">${siyuanI18n.bazaar}</span></li>
            <li data-name="search" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconSearch"></use></svg><span class="b3-list-item__text">${siyuanI18n.search}</span></li>
            <li data-name="keymap" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconKeymap"></use></svg><span class="b3-list-item__text">${siyuanI18n.keymap}</span></li>
            <li data-name="account" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconAccount"></use></svg><span class="b3-list-item__text">${siyuanI18n.account}</span></li>
            <li data-name="repos" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconCloud"></use></svg><span class="b3-list-item__text">${siyuanI18n.cloud}</span></li>
            <li data-name="publish" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconPublish"></use></svg><span class="b3-list-item__text">${siyuanI18n.publish}</span></li>
            <li data-name="about" class="b3-list-item"><svg class="b3-list-item__graphic"><use xlink:href="#iconInfo"></use></svg><span class="b3-list-item__text">${siyuanI18n.about}</span></li>
        </ul>
    </div>
    <div class="config__tab-wrap">
        <div class="fn__hr--b resize__move"></div>
        <div class="config__tab-container" data-name="editor">${editor.genHTML()}</div>
        <div class="config__tab-container fn__none" data-name="filetree"></div>
        <div class="config__tab-container fn__none" data-name="card"></div>
        <div class="config__tab-container fn__none" data-name="AI"></div>
        <div class="config__tab-container fn__none" data-name="AIProfiles"></div>
        <div class="config__tab-container config__tab-container--top fn__none" data-name="image"></div>
        <div class="config__tab-container fn__none" data-name="export"></div>
        <div class="config__tab-container fn__none" data-name="appearance"></div>
        <div class="config__tab-container config__tab-container--top fn__none" data-name="bazaar"></div>
        <div class="config__tab-container fn__none" data-name="search"></div>
        <div class="config__tab-container fn__none" style="overflow: scroll" data-name="keymap"></div>
        <div class="config__tab-container config__tab-container--full fn__none" data-name="account"></div>
        <div class="config__tab-container fn__none" data-name="repos"></div>
        <div class="config__tab-container fn__none" data-name="publish"></div>
        <div class="config__tab-container fn__none" data-name="about"></div>
        <div class="fn__hr--b"></div>
  </div>
</div>`,
        width: "90vw",
        height: "90vh",
        destroyCallback() {
            if (range) {
                focusByRange(range);
            }
        },
        transparent: true,
        disableScrimClose: true,
        scrimPointerEvents: true,
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_SETTING);

    initConfigSearch(dialog.element, app);
    (dialog.element.querySelector(".b3-dialog__container") as HTMLElement).style.maxWidth = "1280px";
    dialog.element.querySelectorAll(".config__side .b3-list-item").forEach(item => {
        item.addEventListener("click", () => {
            const type = item.getAttribute("data-name");
            const containerElement = dialog.element.querySelector(`.config__tab-container[data-name="${type}"]`);
            dialog.element.querySelectorAll(".config__tab-container").forEach((container) => {
                container.classList.add("fn__none");
            });
            dialog.element.querySelector(".config__side .b3-list-item.b3-list-item--focus").classList.remove("b3-list-item--focus");
            item.classList.add("b3-list-item--focus");
            containerElement.classList.remove("fn__none");
            if (containerElement.innerHTML === "" || type === "repos" || type === "bazaar") {
                genItemPanel(type, containerElement, app);
            }
        });
    });
    editor.element = dialog.element.querySelector('.config__tab-container[data-name="editor"]');
    editor.bindEvent();
    return dialog;
};

/**
 * 延迟注册 Tab 类型。
 * 不能在模块顶层直接调用 tabRegistry.register()——由于 config 模块与 plugin/registry 等模块之间存在
 * 循环依赖，模块初始化时 tabRegistry 可能尚未完成初始化（TDZ），导致 ReferenceError。
 * 延迟到 openSetting 首次调用时执行，此时所有模块已完成初始化。
 * INTERNAL_FILETREE_TAB_TYPE 仅在 openSetting → fileTree.bindEvent 路径中使用，延迟注册不会影响功能。
 */
let _fileTreeTabRegistered = false;
const registerFileTreeTab = () => {
    if (_fileTreeTabRegistered || isMobile) {
        return;
    }
    _fileTreeTabRegistered = true;
    tabRegistry.register({
        type: INTERNAL_FILETREE_TAB_TYPE,
        init: (model: Custom) => {
            const tab = model.tab;
            const app = createApp(fileTreeConfigPanel);
            if (tab) {
                app.mount(tab.panelElement);
            }
        }
    });
};
