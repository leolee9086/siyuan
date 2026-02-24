import * as dayjs from "dayjs";
import {unicode2Emoji} from "../../../emoji";
import {Constants} from "../../../constants";
import {escapeAttr, escapeHtml} from "../../../util/escape";
import {getCompressURL} from "../../../util/image";
// S-forge: 本地改进 - 使用统一的国际化环境获取方式
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

const renderCellURL = (urlContent: string) => {
    let host = urlContent;
    let suffix = "";
    try {
        const urlObj = new URL(urlContent);
        if (urlObj.protocol.startsWith("http")) {
            host = urlObj.host;
            suffix = urlObj.href.replace(urlObj.origin, "");
            if (suffix.length > 12) {
                suffix = suffix.substring(0, 4) + "..." + suffix.substring(suffix.length - 6);
            }
        }
    } catch (e) {
        // 不是 url 地址
        host = Lute.EscapeHTMLStr(urlContent);
    }
    // https://github.com/siyuan-note/siyuan/issues/9291
    return `<span class="av__celltext av__celltext--url" data-type="url" data-href="${escapeAttr(urlContent)}"><span>${host}</span><span class="ft__on-surface">${suffix}</span></span>`;
};

export const getCellText = (cellElement: HTMLElement | false) => {
    if (!cellElement) {
        return "";
    }
    let cellText = "";
    const textElements = cellElement.querySelectorAll(".b3-chip, .av__celltext--ref, .av__celltext");
    if (textElements.length > 0) {
        textElements.forEach(item => {
            if (item.querySelector(".av__cellicon")) {
                cellText += `${item.firstChild.textContent} → ${item.lastChild.textContent}, `;
            } else if (item.getAttribute("data-type") === "url") {
                cellText = item.getAttribute("data-href") + ", ";
            } else if (item.getAttribute("data-type") !== "block-more") {
                cellText += item.textContent + ", ";
            }
        });
        cellText = cellText.substring(0, cellText.length - 2);
    } else {
        cellText = cellElement.textContent;
    }
    return cellText;
};

export const renderCellAttr = (cellElement: Element, value: IAVCellValue) => {
    if (value.type === "checkbox") {
        if (value.checkbox.checked) {
            cellElement.classList.add("av__cell-check");
            cellElement.classList.remove("av__cell-uncheck");
        } else {
            cellElement.classList.remove("av__cell-check");
            cellElement.classList.add("av__cell-uncheck");
        }
    } else if (value.type === "block") {
        if (value.isDetached) {
            cellElement.setAttribute("data-detached", "true");
        } else {
            cellElement.querySelector(".av__celltext").setAttribute("data-id", value.block.id);
            cellElement.removeAttribute("data-detached");
        }
    }
};

const renderRollup = (cellValue: IAVCellValue, showIcon: boolean) => {
    let text = "";
    if (["text"].includes(cellValue.type)) {
        text = cellValue ? (cellValue[cellValue.type as "text"].content || "") : "";
    } else if (["email", "phone"].includes(cellValue.type)) {
        const emailContent = cellValue ? cellValue[cellValue.type as "email"].content : "";
        if (emailContent) {
            text = `<span class="av__celltext av__celltext--url" data-type="${cellValue.type}">${emailContent}</span>`;
        }
    } else if ("url" === cellValue.type) {
        const urlContent = cellValue?.url?.content || "";
        if (urlContent) {
            text = renderCellURL(urlContent);
        }
    } else if (cellValue.type === "block") {
        if (cellValue?.isDetached) {
            text = `<span class="av__celltext">${Lute.EscapeHTMLStr(cellValue.block?.content || siyuanI18n.untitled)}</span>`;
        } else {
            text = `<span class="b3-menu__avemoji${showIcon ? "" : " fn__none"}" data-unicode="${cellValue.block.icon || ""}">${unicode2Emoji(cellValue.block.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].file)}</span><span data-type="block-ref" data-id="${cellValue.block?.id}" data-subtype="s" class="av__celltext av__celltext--ref">${Lute.EscapeHTMLStr(cellValue.block?.content || siyuanI18n.untitled)}</span>`;
        }
    } else if (cellValue.type === "number") {
        text = cellValue?.number.formattedContent || cellValue?.number.content.toString() || "";
    } else if (cellValue.type === "checkbox") {
        text += `<svg class="av__checkbox"><use xlink:href="#icon${cellValue?.checkbox?.checked ? "Check" : "Uncheck"}"></use></svg><span class="fn__space"></span>`;
    } else if (["date", "updated", "created"].includes(cellValue.type)) {
        const dataValue = cellValue ? cellValue[cellValue.type as "date"] : null;
        if (dataValue.formattedContent) {
            text = dataValue.formattedContent;
        } else {
            if (dataValue && dataValue.isNotEmpty) {
                text = dayjs(dataValue.content).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
            }
            if (dataValue && dataValue.hasEndDate && dataValue.isNotEmpty && dataValue.isNotEmpty2) {
                text = `<svg class="av__cellicon"><use xlink:href="#iconForward"></use></svg>${dayjs(dataValue.content2).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")}`;
            }
        }
        if (text) {
            text = `<span class="av__celltext">${text}</span>`;
        }
    }
    return text;
};

export const renderCell = (cellValue: IAVCellValue, rowIndex = 0, showIcon = true, type: TAVView = "table") => {
    let text = "";
    if ("template" === cellValue.type) {
        text = `<span class="av__celltext">${cellValue ? (cellValue.template.content || "") : ""}</span>`;
    } else if ("text" === cellValue.type) {
        text = `<span class="av__celltext">${cellValue ? Lute.EscapeHTMLStr(cellValue.text.content || "") : ""}</span>`;
    } else if (["email", "phone"].includes(cellValue.type)) {
        text = `<span class="av__celltext av__celltext--url" data-type="${cellValue.type}">${cellValue ? Lute.EscapeHTMLStr(cellValue[cellValue.type as "email"].content || "") : ""}</span>`;
    } else if ("url" === cellValue.type) {
        text = renderCellURL(cellValue?.url?.content || "");
    } else if (cellValue.type === "block") {
        // 不可使用换行 https://github.com/siyuan-note/siyuan/issues/11365
        if (cellValue?.isDetached) {
            text = `<span class="av__celltext">${Lute.EscapeHTMLStr(cellValue.block.content || "")}</span><span class="b3-chip b3-chip--info b3-chip--small" data-type="block-more">${siyuanI18n.more}</span>`;
        } else {
            text = `<span class="b3-menu__avemoji${showIcon ? "" : " fn__none"}" data-unicode="${cellValue.block.icon || ""}">${unicode2Emoji(cellValue.block.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].file)}</span><span data-type="block-ref" data-id="${cellValue.block.id}" data-subtype="s" class="av__celltext av__celltext--ref">${Lute.EscapeHTMLStr(cellValue.block.content)}</span><span class="b3-chip b3-chip--info b3-chip--small" data-type="block-more">${siyuanI18n.update}</span>`;
        }
    } else if (cellValue.type === "number") {
        text = `<span class="av__celltext" data-content="${cellValue?.number.isNotEmpty ? cellValue?.number.content : ""}">${cellValue?.number.formattedContent || cellValue?.number.content || ""}</span>`;
    } else if (cellValue.type === "mSelect" || cellValue.type === "select") {
        cellValue?.mSelect?.forEach((item, index) => {
            if (cellValue.type === "select" && index > 0) {
                return;
            }
            text += `<span class="b3-chip" style="background-color:var(--b3-font-background${item.color});color:var(--b3-font-color${item.color})">${escapeHtml(item.content)}</span>`;
        });
    } else if (cellValue.type === "date") {
        const dataValue = cellValue ? cellValue.date : null;
        text = `<span class="av__celltext" data-value='${JSON.stringify(dataValue)}'>`;
        if (dataValue && dataValue.isNotEmpty) {
            text += dayjs(dataValue.content).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm");
        }
        if (dataValue && dataValue.hasEndDate && dataValue.isNotEmpty && dataValue.isNotEmpty2) {
            text += `<svg class="av__cellicon"><use xlink:href="#iconForward"></use></svg>${dayjs(dataValue.content2).format(dataValue.isNotTime ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")}`;
        }
        text += "</span>";
    } else if (["created", "updated"].includes(cellValue.type)) {
        const dataValue = cellValue ? cellValue[cellValue.type as "date"] : null;
        text = `<span class="av__celltext" data-value='${JSON.stringify(dataValue)}'>`;
        if (dataValue && dataValue.isNotEmpty) {
            text += dataValue.formattedContent;
        }
        text += "</span>";
    } else if (["lineNumber"].includes(cellValue.type)) {
        // 渲染行号
        text = `<span class="av__celltext" data-value='${rowIndex + 1}'>${rowIndex + 1}</span>`;
    } else if (cellValue.type === "mAsset") {
        cellValue?.mAsset?.forEach((item) => {
            if (item.type === "image") {
                text += `<img loading="lazy" class="av__cellassetimg ariaLabel" aria-label="${item.content}" src="${getCompressURL(item.content)}">`;
            } else {
                text += `<span class="b3-chip av__celltext--url ariaLabel" aria-label="${escapeAttr(item.content)}" data-name="${escapeAttr(item.name)}" data-url="${escapeAttr(item.content)}">${item.name || item.content}</span>`;
            }
        });
    } else if (cellValue.type === "checkbox") {
        text += `<div class="fn__flex"><svg class="av__checkbox"><use xlink:href="#icon${cellValue?.checkbox?.checked ? "Check" : "Uncheck"}"></use></svg>`;
        if (["gallery", "kanban"].includes(type) && cellValue?.checkbox?.content) {
            text += `<span class="fn__space"></span>${cellValue?.checkbox?.content}`;
        }
        text += "</div>";
    } else if (cellValue.type === "rollup") {
        let rollupType;
        cellValue?.rollup?.contents?.forEach((item) => {
            const rollupText = ["template", "select", "mSelect", "mAsset", "relation"].includes(item.type) ? renderCell(item, rowIndex, showIcon, type) : renderRollup(item, showIcon);
            if (rollupText) {
                text += rollupText + (item.type === "checkbox" ? "" : ", ");
            }
            rollupType = item.type;
        });
        if (text) {
            if (rollupType === "checkbox") {
                text = `<div class="fn__flex">${text}</div>`;
            } else if (text.endsWith(", ")) {
                text = text.substring(0, text.length - 2);
            }
        }
    } else if (cellValue.type === "relation") {
        cellValue?.relation?.contents?.forEach((item, index) => {
            if (item && item.block) {
                const rowID = cellValue.relation.blockIDs[index];
                if (item?.isDetached) {
                    text += `<span data-row-id="${rowID}" class="av__cell--relation"><span class="${showIcon ? "" : " fn__none"}">➖<span class="fn__space--5"></span></span><span class="av__celltext">${Lute.EscapeHTMLStr(item.block.content || siyuanI18n.untitled)}</span></span>`;
                } else {
                    // data-block-id 用于更新 emoji
                    text += `<span data-row-id="${rowID}" class="av__cell--relation" data-block-id="${item.block.id}"><span class="b3-menu__avemoji${showIcon ? "" : " fn__none"}" data-unicode="${item.block.icon || ""}">${unicode2Emoji(item.block.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].file)}</span><span data-type="block-ref" data-id="${item.block.id}" data-subtype="s" class="av__celltext av__celltext--ref">${Lute.EscapeHTMLStr(item.block.content || siyuanI18n.untitled)}</span></span>`;
                }
            }
        });
        if (text && text.endsWith(", ")) {
            text = text.substring(0, text.length - 2);
        }
    }

    if ((["text", "template", "url", "email", "phone", "date", "created", "updated"].includes(cellValue.type) && cellValue[cellValue.type as "url"]?.content) ||
        cellValue.type === "lineNumber" ||
        (cellValue.type === "number" && cellValue.number?.isNotEmpty) ||
        (cellValue.type === "block" && cellValue.block?.content)) {
        text += `<span ${cellValue.type !== "number" ? "" : 'style="right:auto;left:5px"'} data-type="copy" class="block__icon"><svg><use xlink:href="#iconCopy"></use></svg></span>`;
    }
    return text;
};
