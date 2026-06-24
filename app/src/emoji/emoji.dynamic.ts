import * as dayjs from "dayjs";
import {Dialog} from "../dialog";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

export const parseDynamicState = (dynamicURL: string, dynamicImgElement?: HTMLElement): IObject => {
    const dynamicCurrentObj: IObject = {
        color: "#d23f31",
        lang: "",
        date: dayjs().format("YYYY-MM-DD"),
        weekdayType: "1",
        type: "1",
        content: "SiYuan",
    };
    if (dynamicImgElement && dynamicImgElement.getAttribute("src").startsWith(dynamicURL)) {
        const dynamicCurrentUrl = new URLSearchParams(dynamicImgElement.getAttribute("src").replace(dynamicURL, ""));
        dynamicCurrentObj.color = dynamicCurrentUrl.get("color") || "#d23f31";
        if (!dynamicCurrentObj.color.startsWith("#")) {
            dynamicCurrentObj.color = "#" + dynamicCurrentObj.color;
        }
        const lang = dynamicCurrentUrl.get("lang") || "";
        dynamicCurrentObj.lang = ({zh_CN: "zh-CN", zh_CHT: "zh-TW", en_US: "en"} as IObject)[lang] || lang;
        dynamicCurrentObj.date = dynamicCurrentUrl.get("date") || "";
        dynamicCurrentObj.weekdayType = dynamicCurrentUrl.get("weekdayType") || "1";
        dynamicCurrentObj.type = dynamicCurrentUrl.get("type") || "1";
        dynamicCurrentObj.content = dynamicCurrentUrl.get("content") || "SiYuan";
    }
    return dynamicCurrentObj;
};

export const genWeekdayOptions = (lang: string, weekdayType: string) => {
    const dynamicWeekdayLang = {
        "1": ["Sun", "周日", "週日"],
        "2": ["SUN", "周天", "週天"],
        "3": ["Sunday", "星期日", "星期日"],
        "4": ["SUNDAY", "星期天", "星期天"],
    };
    let currentLang = 0;
    if (lang === "") {
        lang = window.siyuan.config.lang;
    }
    if (lang === "zh-CN") {
        currentLang = 1;
    } else if (lang === "zh-TW") {
        currentLang = 2;
    }
    return `<option value="1" ${weekdayType === "1" ? " selected" : ""}>${dynamicWeekdayLang[1][currentLang]}</option>
<option value="2" ${weekdayType === "2" ? " selected" : ""}>${dynamicWeekdayLang[2][currentLang]}</option>
<option value="3" ${weekdayType === "3" ? " selected" : ""}>${dynamicWeekdayLang[3][currentLang]}</option>
<option value="4" ${weekdayType === "4" ? " selected" : ""}>${dynamicWeekdayLang[4][currentLang]}</option>`;
};

export const buildDynamicTabHTML = (dynamicURL: string, dynamicCurrentObj: IObject, id: string) => {
    return `<div class="fn__flex emoji__dynamic-color">
                <div class="color__square fn__pointer${dynamicCurrentObj.color === "#d23f31" ? " color__square--current" : ""}" style="background-color:#d23f31"></div>
                <div class="color__square fn__pointer${dynamicCurrentObj.color === "#3575f0" ? " color__square--current" : ""}" style="background-color:#3575f0"></div>
                <div class="color__square fn__pointer${dynamicCurrentObj.color === "#f3a92f" ? " color__square--current" : ""}" style="background-color:#f3a92f"></div>
                <div class="color__square fn__pointer${dynamicCurrentObj.color === "#65b84d" ? " color__square--current" : ""}" style="background-color:#65b84d"></div>
                <div class="color__square fn__pointer${dynamicCurrentObj.color === "#e099ff" ? " color__square--current" : ""}" style="background-color:#e099ff"></div>
                <div class="color__square fn__pointer${dynamicCurrentObj.color === "#ea5d97" ? " color__square--current" : ""}" style="background-color:#ea5d97"></div>
                <div class="color__square fn__pointer${dynamicCurrentObj.color === "#93627f" ? " color__square--current" : ""}" style="background-color:#93627f"></div>
                <div class="color__square fn__pointer${dynamicCurrentObj.color === "#5f6368" ? " color__square--current" : ""}" style="background-color:#5f6368"></div>
                <div class="fn__space--small"></div>
                <input type="text" class="b3-text-field fn__flex-1 fn__flex-center" value="${dynamicCurrentObj.color}">
            </div>
            <div class="fn__flex">
                <span class="fn__space"></span>
                <span class="fn__flex-center ft__on-surface" style="width: 89px">${siyuanI18n.language}</span>
                <span class="fn__space--small"></span>
                <select class="b3-select fn__flex-1">
                    <option value="" ${dynamicCurrentObj.lang === "" ? " selected" : ""}>${siyuanI18n.themeOS}</option>
                    <option value="en" ${dynamicCurrentObj.lang === "en" ? " selected" : ""}>English (en)</option>
                    <option value="zh-TW" ${dynamicCurrentObj.lang === "zh-TW" ? " selected" : ""}>繁體中文 (zh-TW)</option>
                    <option value="zh-CN" ${dynamicCurrentObj.lang === "zh-CN" ? " selected" : ""}>简体中文 (zh-CN)</option>
                </select>
                <span class="fn__space"></span>
            </div>
            <div class="fn__hr"></div>
            <div class="fn__flex">
                <span class="fn__space"></span>
                <span class="fn__flex-center ft__on-surface" style="width: 89px">${siyuanI18n.date}</span>
                <span class="fn__space--small"></span>
                <input type="date" max="9999-12-31" class="b3-text-field fn__flex-1" value="${dynamicCurrentObj.date}"/>
                <span class="fn__space--small"></span>
                <span data-action="clearDate" class="ariaLabel block__icon block__icon--show" aria-label="${siyuanI18n.dynamicIconDateEmptyInfo}"><svg><use xlink:href="#iconTrashcan"></use></svg></span>
                <span class="fn__space"></span>
            </div>
            <div class="fn__hr"></div>
            <div class="fn__flex">
                <span class="fn__space"></span>
                <span class="fn__flex-center ft__on-surface" style="width: 89px">${siyuanI18n.format}</span>
                <span class="fn__space--small"></span>
                <select class="b3-select fn__flex-1">
                    ${genWeekdayOptions(dynamicCurrentObj.lang, dynamicCurrentObj.weekdayType)}
                </select>
                <span class="fn__space"></span>
            </div>
            <div class="fn__flex fn__flex-wrap">
                <img class="emoji__dynamic-item${dynamicCurrentObj.type === "1" ? " emoji__dynamic-item--current" : ""}" src="${dynamicURL}type=1&color=${encodeURIComponent(dynamicCurrentObj.color)}&date=${dynamicCurrentObj.date}&weekdayType=${dynamicCurrentObj.weekdayType}&lang=${dynamicCurrentObj.lang}">
                <img class="emoji__dynamic-item${dynamicCurrentObj.type === "2" ? " emoji__dynamic-item--current" : ""}" src="${dynamicURL}type=2&color=${encodeURIComponent(dynamicCurrentObj.color)}&date=${dynamicCurrentObj.date}&weekdayType=${dynamicCurrentObj.weekdayType}&lang=${dynamicCurrentObj.lang}">
                <img class="emoji__dynamic-item${dynamicCurrentObj.type === "3" ? " emoji__dynamic-item--current" : ""}" src="${dynamicURL}type=3&color=${encodeURIComponent(dynamicCurrentObj.color)}&date=${dynamicCurrentObj.date}&weekdayType=${dynamicCurrentObj.weekdayType}&lang=${dynamicCurrentObj.lang}">
                <img class="emoji__dynamic-item${dynamicCurrentObj.type === "4" ? " emoji__dynamic-item--current" : ""}" src="${dynamicURL}type=4&color=${encodeURIComponent(dynamicCurrentObj.color)}&date=${dynamicCurrentObj.date}&weekdayType=${dynamicCurrentObj.weekdayType}&lang=${dynamicCurrentObj.lang}">
                <img class="emoji__dynamic-item${dynamicCurrentObj.type === "5" ? " emoji__dynamic-item--current" : ""}" src="${dynamicURL}type=5&color=${encodeURIComponent(dynamicCurrentObj.color)}&date=${dynamicCurrentObj.date}&weekdayType=${dynamicCurrentObj.weekdayType}&lang=${dynamicCurrentObj.lang}">
                <img class="emoji__dynamic-item${dynamicCurrentObj.type === "6" ? " emoji__dynamic-item--current" : ""}" src="${dynamicURL}type=6&color=${encodeURIComponent(dynamicCurrentObj.color)}&date=${dynamicCurrentObj.date}&weekdayType=${dynamicCurrentObj.weekdayType}&lang=${dynamicCurrentObj.lang}">
                <img class="emoji__dynamic-item${dynamicCurrentObj.type === "7" ? " emoji__dynamic-item--current" : ""}" src="${dynamicURL}type=7&color=${encodeURIComponent(dynamicCurrentObj.color)}&date=${dynamicCurrentObj.date}&weekdayType=${dynamicCurrentObj.weekdayType}&lang=${dynamicCurrentObj.lang}">
            </div>
            <div class="fn__hr"></div>
            <div class="fn__flex">
                <span class="fn__space"></span>
                <span class="fn__flex-center ft__on-surface" style="width: 89px">${siyuanI18n.custom}</span>
                <span class="fn__space--small"></span>
                <input type="text" class="b3-text-field fn__flex-1" value="">
                <span class="fn__space"></span>
            </div>
            <div>
                <img data-type="text" class="emoji__dynamic-item${dynamicCurrentObj.type === "8" ? " emoji__dynamic-item--current" : ""}" src="${dynamicURL}type=8&color=${encodeURIComponent(dynamicCurrentObj.color)}&content=${encodeURIComponent(dynamicCurrentObj.content)}&id=${id}">
            </div>`;
};

export const bindDynamicEvents = (dialog: Dialog, dynamicURL: string, dynamicCurrentObj: IObject) => {
    const dynamicLangElements: NodeListOf<HTMLSelectElement> = dialog.element.querySelectorAll('[data-type="tab-dynamic"] .b3-select');
    dynamicLangElements[0].addEventListener("change", () => {
        dialog.element.querySelectorAll(".fn__flex-wrap .emoji__dynamic-item").forEach(item => {
            const url = new URLSearchParams(item.getAttribute("src").replace(dynamicURL, ""));
            if (dynamicLangElements[0].value) {
                url.set("lang", dynamicLangElements[0].value);
            } else {
                url.delete("lang");
            }
            item.setAttribute("src", dynamicURL + url.toString());
            dynamicLangElements[1].innerHTML = genWeekdayOptions(dynamicLangElements[0].value, dynamicLangElements[1].value);
        });
    });
    dynamicLangElements[1].addEventListener("change", () => {
        dialog.element.querySelectorAll(".fn__flex-wrap .emoji__dynamic-item").forEach(item => {
            const url = new URLSearchParams(item.getAttribute("src").replace(dynamicURL, ""));
            url.set("weekdayType", dynamicLangElements[1].value);
            item.setAttribute("src", dynamicURL + url.toString());
        });
    });
    const dynamicDateElement = dialog.element.querySelector('[data-type="tab-dynamic"] [type="date"]') as HTMLInputElement;
    dynamicDateElement.addEventListener("change", () => {
        dialog.element.querySelectorAll(".fn__flex-wrap .emoji__dynamic-item").forEach(item => {
            const url = new URLSearchParams(item.getAttribute("src").replace(dynamicURL, ""));
            url.set("date", dynamicDateElement.value ? dayjs(dynamicDateElement.value).format("YYYY-MM-DD") : "");
            item.setAttribute("src", dynamicURL + url.toString());
        });
    });
    const dynamicTextElements: NodeListOf<HTMLInputElement> = dialog.element.querySelectorAll('[data-type="tab-dynamic"] [type="text"]');
    const dynamicTextImgElement = dialog.element.querySelector('.emoji__dynamic-item[data-type="text"]');
    dynamicTextElements[0].addEventListener("input", () => {
        if (!dynamicTextElements[0].value.startsWith("#")) {
            return;
        }
        dialog.element.querySelectorAll(".emoji__dynamic-item").forEach(item => {
            const url = new URLSearchParams(item.getAttribute("src").replace(dynamicURL, ""));
            url.set("color", dynamicTextElements[0].value);
            item.setAttribute("src", dynamicURL + url.toString());
        });
        dialog.element.querySelectorAll(".color__square").forEach((item: HTMLElement) => {
            if (item.style.backgroundColor === dynamicTextElements[0].value) {
                item.classList.add("color__square--current");
            } else {
                item.classList.remove("color__square--current");
            }
        });
    });
    dynamicTextElements[1].value = dynamicCurrentObj.content;
    dynamicTextElements[1].addEventListener("input", () => {
        const url = new URLSearchParams(dynamicTextImgElement.getAttribute("src").replace(dynamicURL, ""));
        url.set("content", dynamicTextElements[1].value);
        dynamicTextImgElement.setAttribute("src", dynamicURL + url.toString());
    });

    return { dynamicTextElements, dynamicDateElement };
};
