import { fetchPost } from "../../util/network/fetch";
import { insertHTML } from "../util/insertHTML";
import { isDisabledFeature, updateHotkeyTip } from "../util/compatibility";
import { blockRender } from "../render/blockRender";
import { Constants } from "../../constants";
import { contentRendererRegistry } from "../../registry/contentRenderer/ContentRendererRegistry";
import { highlightRender } from "../render/highlightRender";
import { focusBlock, focusByRange, getEditorRange } from "../util/selection";
import { hasClosestBlock, hasClosestByClassName } from "../util/hasClosest";
import { getContenteditableElement, getTopAloneElement } from "../wysiwyg/getBlock";
import {transaction} from "../wysiwyg/transaction/submit";
import { getDisplayName } from "../../util/file/pathName";
import {withEncryptedNotebook} from "../../util/file/notebook/store";
import { genEmptyElement } from "../../block/element.factory";
import { getOrderedListStart } from "../wysiwyg/list";
import { updateListOrder } from "../wysiwyg/list.updateOrder";
import { escapeHtml } from "../../util/DOM/escape";
import { hideElements } from "../ui/hideElements";
import { avRender } from "../render/av/render";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { addWidgetCacheVersion } from "../util/widgetCache";
import { genAssetHTML } from "../../asset/renderAssets";
import { getAssetExtension, getAssetName } from "../../util/file/path/operations";
import {
    getEntryCatalogNode,
    getPluginSlashEntryKey,
    getSlashMenuEntryPath,
    refreshSlashMenuCatalog,
    SLASH_MENU_ROOT_PATH,
} from "../../config/entryVisibility/catalog";
import {getEntryOrder, isEntryVisible} from "../../config/entryVisibility/runtime";
import {resolveSlashMenuItems, TSlashMenuItem} from "./slashMenu";

// 上游在本文件中定义 genHintItemHTML 与 hintRef；分叉已将两者拆分至独立模块，此处再导出以兼容两类导入路径
export {genHintItemHTML} from "./result/item";
export {hintRef} from "./extend.hintRef";

const getHotkeyOrMarker = (hotkey: string, marker: string) => {
    if (hotkey) {
        return `<span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip(hotkey)}</span>`;
    } else if (marker) {
        return `<span class="b3-list-item__meta">${marker}</span>`;
    }
    return "";
};

// 内置斜杠菜单的固定条目；id 声明顺序须与 entryVisibility/catalog 的斜杠菜单目录保持一致（见 catalog.test.ts）
export const getBuiltinSlashMenuItems = (protyle: IProtyle): IHintData[] => {
    return [{
        filter: [siyuanI18n.template, "template", "模板", "moban", "muban", "mb"],
        id: "template",
        value: Constants.ZWSP,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconMarkdown"></use></svg><span class="b3-list-item__text">${siyuanI18n.template}</span></div>`,
    }, {
        filter: [siyuanI18n.widget, "widget", "挂件", "guajian", "gj"],
        id: "widget",
        value: Constants.ZWSP + 1,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconBoth"></use></svg><span class="b3-list-item__text">${siyuanI18n.widget}</span></div>`,
    }, {
        filter: [siyuanI18n.assets, "assets", "资源", "ziyuan", "zy"],
        id: "assets",
        value: Constants.ZWSP + 2,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconImage"></use></svg><span class="b3-list-item__text">${siyuanI18n.assets}</span></div>`,
    }, {
        filter: [siyuanI18n.ref, "block reference", "块引用", "kuaiyinyong", "kyy"],
        id: "ref",
        value: "((",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconRef"></use></svg><span class="b3-list-item__text">${siyuanI18n.ref}</span><span class="b3-list-item__meta">((</span></div>`,
    }, {
        filter: [siyuanI18n.blockEmbed, "embed block", "嵌入块", "qianrukuai", "qrk"],
        id: "blockEmbed",
        value: "{{",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconSQL"></use></svg><span class="b3-list-item__text">${siyuanI18n.blockEmbed}</span><span class="b3-list-item__meta">{{</span></div>`,
    // AI 编写入口受功能开关控制，禁用 AI 时不展示该条目（对齐上游）
    }, ...(isDisabledFeature("ai") ? [] : [{
        filter: [siyuanI18n.aiWriting, "ai writing", "ai编写", "aibianxie", "aibx", "人工智能", "rengongzhineng", "rgzn"],
        id: "aiWriting",
        value: Constants.ZWSP + 5,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconSparkles"></use></svg><span class="b3-list-item__text">${siyuanI18n.aiWriting}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.general.aiWriting?.custom || "", "")}</div>`,
    }]), {
        filter: [siyuanI18n.database, "database", "db", "数据库", "shujuku", "sjk", "视图", "view"],
        id: "database",
        value: '<div data-type="NodeAttributeView" data-av-type="table"></div>',
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconDatabase"></use></svg><span class="b3-list-item__text">${siyuanI18n.database}</span></div>`,
    }, {
        filter: [siyuanI18n.newFileRef, "create new doc with reference", "新建文档并引用", "xinjianwendangbingyinyong", "xjwdbyy"],
        id: "newFileRef",
        value: Constants.ZWSP + 4,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconFile"></use></svg><span class="b3-list-item__text">${siyuanI18n.newFileRef}</span></div>`,
    }, {
        filter: [siyuanI18n.newSubDocRef, "create sub doc with reference", "新建子文档并引用", "xinjianziwendangbingyinyong", "xjzwdbyy"],
        id: "newSubDocRef",
        value: Constants.ZWSP + 6,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconFile"></use></svg><span class="b3-list-item__text">${siyuanI18n.newSubDocRef}</span></div>`,
    }, {
        value: "",
        id: "separator_1",
        html: "separator",
    }, {
        filter: [siyuanI18n.heading1, "heading1", "h1", "一级标题", "yijibiaoti", "yjbt"],
        id: "heading1",
        value: "# " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconH1"></use></svg><span class="b3-list-item__text">${siyuanI18n.heading1}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.heading.heading1.custom, "# ")}</div>`,
    }, {
        filter: [siyuanI18n.heading2, "heading2", "h2", "二级标题", "erjibiaoti", "ejbt"],
        id: "heading2",
        value: "## " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconH2"></use></svg><span class="b3-list-item__text">${siyuanI18n.heading2}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.heading.heading2.custom, "## ")}</div>`,
    }, {
        filter: [siyuanI18n.heading3, "heading3", "h3", "三级标题", "sanjibiaoti", "sjbt"],
        id: "heading3",
        value: "### " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconH3"></use></svg><span class="b3-list-item__text">${siyuanI18n.heading3}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.heading.heading3.custom, "### ")}</div>`,
    }, {
        filter: [siyuanI18n.heading4, "heading4", "h4", "四级标题", "sijibiaoti", "sjbt"],
        id: "heading4",
        value: "#### " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconH4"></use></svg><span class="b3-list-item__text">${siyuanI18n.heading4}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.heading.heading4.custom, "#### ")}</div>`,
    }, {
        filter: [siyuanI18n.heading5, "heading5", "h5", "五级标题", "wujibiaoti", "wjbt"],
        id: "heading5",
        value: "##### " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconH5"></use></svg><span class="b3-list-item__text">${siyuanI18n.heading5}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.heading.heading5.custom, "##### ")}</div>`,
    }, {
        filter: [siyuanI18n.heading6, "heading6", "h6", "六级标题", "liujibiaoti", "ljbt"],
        id: "heading6",
        value: "###### " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconH6"></use></svg><span class="b3-list-item__text">${siyuanI18n.heading6}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.heading.heading6.custom, "###### ")}</div>`,
    }, {
        filter: [siyuanI18n.list, "unordered list", "无序列表", "wuxvliebiao", "wuxuliebiao", "wxlb"],
        id: "list",
        value: "- " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconList"></use></svg><span class="b3-list-item__text">${siyuanI18n.list}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.insert.list?.custom || "", "- ")}</div>`,
    }, {
        filter: [siyuanI18n["ordered-list"], "order list", "ordered list", "有序列表", "youxvliebiao", "youxuliebiao", "yxlb"],
        id: "orderedList",
        value: "1. " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconOrderedList"></use></svg><span class="b3-list-item__text">${siyuanI18n["ordered-list"]}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.insert["ordered-list"]?.custom || "", "1. ")}</div>`,
    }, {
        filter: [siyuanI18n.check, "task list", "todo list", "任务列表", "renwuliebiao", "rwlb"],
        id: "check",
        value: "- [ ] " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconCheck"></use></svg><span class="b3-list-item__text">${siyuanI18n.check}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.insert.check.custom, "[]")}</div>`,
    }, {
        filter: [siyuanI18n.quote, "blockquote", "bq", "引述", "yinshu", "ys"],
        id: "quote",
        value: "> " + Lute.Caret,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconQuote"></use></svg><span class="b3-list-item__text">${siyuanI18n.quote}</span>${getHotkeyOrMarker(getSiyuanConfig().keymap.editor.insert.quote?.custom || "", ">")}</div>`,
    }, {
        filter: [siyuanI18n.callout, "callout", "ts", "提示", "tishi", "note"],
        id: "calloutNote",
        value: `> [!NOTE]\n> ${Lute.Caret}`,
        html: `<div class="b3-list-item__first"><span class="b3-list-item__graphic">✏️</span><span class="b3-list-item__text">${siyuanI18n.callout} - <span style="color: var(--b3-callout-note)">Note</span></span></div>`,
    }, {
        filter: [siyuanI18n.callout, "callout", "ts", "提示", "tishi", "tip"],
        id: "calloutTip",
        value: `> [!TIP]\n> ${Lute.Caret}`,
        html: `<div class="b3-list-item__first"><span class="b3-list-item__graphic">💡</span><span class="b3-list-item__text">${siyuanI18n.callout} - <span style="color: var(--b3-callout-tip)">Tip</span></span></div>`,
    }, {
        filter: [siyuanI18n.callout, "callout", "ts", "提示", "tishi", "important"],
        id: "calloutImportant",
        value: `> [!IMPORTANT]\n> ${Lute.Caret}`,
        html: `<div class="b3-list-item__first"><span class="b3-list-item__graphic">❗</span><span class="b3-list-item__text">${siyuanI18n.callout} - <span style="color: var(--b3-callout-important)">Important</span></span></div>`,
    }, {
        filter: [siyuanI18n.callout, "callout", "ts", "提示", "tishi", "warning"],
        id: "calloutWarning",
        value: `> [!WARNING]\n> ${Lute.Caret}`,
        html: `<div class="b3-list-item__first"><span class="b3-list-item__graphic">⚠️</span><span class="b3-list-item__text">${siyuanI18n.callout} - <span style="color: var(--b3-callout-warning)">Warning</span></span></div>`,
    }, {
        filter: [siyuanI18n.callout, "callout", "ts", "提示", "tishi", "caution"],
        id: "calloutCaution",
        value: `> [!CAUTION]\n> ${Lute.Caret}`,
        html: `<div class="b3-list-item__first"><span class="b3-list-item__graphic">🚨</span><span class="b3-list-item__text">${siyuanI18n.callout} - <span style="color: var(--b3-callout-caution)">Caution</span></span></div>`,
    }, {
        filter: [siyuanI18n.code, "code block", "代码块", "daimakuai", "dmk"],
        id: "code",
        value: "```",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconCode"></use></svg><span class="b3-list-item__text">${siyuanI18n.code}</span>${getHotkeyOrMarker(window.siyuan.config.keymap.editor.insert.code.custom, "```" + siyuanI18n.enterKey)}</div>`,
    }, {
        filter: [siyuanI18n.table, "table", "表格", "biaoge", "bg"],
        id: "table",
        value: `| ${Lute.Caret} |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |`,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconTable"></use></svg><span class="b3-list-item__text">${siyuanI18n.table}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.table.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.line, "thematic break", "divider", "分隔线", "分割线", "fengexian", "fgx"],
        id: "line",
        value: "---",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconLine"></use></svg><span class="b3-list-item__text">${siyuanI18n.line}</span><span class="b3-list-item__meta">---</span></div>`,
    }, {
        filter: [siyuanI18n.math, "formulas block", "math block", "数学公式块", "shuxuegongshikuai", "sxgsk"],
        id: "math",
        value: "$$",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconMath"></use></svg><span class="b3-list-item__text">${siyuanI18n.math}</span><span class="b3-list-item__meta">$$</span></div>`,
    }, {
        filter: ["html"],
        id: "html",
        value: "<div>",
        html: '<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconHTML5"></use></svg><span class="b3-list-item__text">HTML</span></div>',
    // 数据库视图入口：表格 / 看板 / 卡片视图（对齐上游新增条目）
    }, {
        filter: [window.siyuan.languages.databaseTableView, "database table view", "数据库表格视图", "shujukubiaogeshitu", "sjkbgs"],
        id: "databaseTableView",
        value: '<div data-type="NodeAttributeView" data-av-type="table"></div>',
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconTable"></use></svg><span class="b3-list-item__text">${window.siyuan.languages.databaseTableView}</span></div>`,
    }, {
        filter: [window.siyuan.languages.databaseKanbanView, "database kanban view", "数据库看板视图", "shujukukanbanshitu", "sjkkbs"],
        id: "databaseKanbanView",
        value: '<div data-type="NodeAttributeView" data-av-type="kanban"></div>',
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconBoard"></use></svg><span class="b3-list-item__text">${window.siyuan.languages.databaseKanbanView}</span></div>`,
    }, {
        filter: [window.siyuan.languages.databaseGalleryView, "database card view", "database gallery view", "数据库卡片视图", "shujukukapianshitu", "sjkkps"],
        id: "databaseGalleryView",
        value: '<div data-type="NodeAttributeView" data-av-type="gallery"></div>',
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconGallery"></use></svg><span class="b3-list-item__text">${window.siyuan.languages.databaseGalleryView}</span></div>`,
    }, {
        value: "",
        id: "separator_2",
        html: "separator",
    }, {
        filter: [siyuanI18n.emoji, "emoji", "表情", "biaoqing", "bq"],
        id: "emoji",
        value: "emoji",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconEmoji"></use></svg><span class="b3-list-item__text">${siyuanI18n.emoji}</span><span class="b3-list-item__meta">:</span></div>`,
    }, {
        filter: [siyuanI18n.link, "link", "a", "链接", "lianjie", "lj"],
        id: "link",
        value: "a",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconLink"></use></svg><span class="b3-list-item__text">${siyuanI18n.link}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.link.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.bold, "bold", "strong", "粗体", "cuti", "ct", "加粗", "jiacu", "jc"],
        id: "bold",
        value: "strong",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconBold"></use></svg><span class="b3-list-item__text">${siyuanI18n.bold}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.bold.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.italic, "italic", "em", "斜体", "xieti", "xt"],
        id: "italic",
        value: "em",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconItalic"></use></svg><span class="b3-list-item__text">${siyuanI18n.italic}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.italic.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.underline, "underline", "下划线", "xiahuaxian", "xhx"],
        id: "underline",
        value: "u",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconUnderline"></use></svg><span class="b3-list-item__text">${siyuanI18n.underline}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.underline.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.strike, "strike", "delete", "删除线", "shanchuxian", "scx"],
        id: "strike",
        value: "s",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconStrike"></use></svg><span class="b3-list-item__text">${siyuanI18n.strike}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.strike.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.mark, "mark", "标记", "biaoji", "bj", "高亮", "gaoliang", "gl"],
        id: "mark",
        value: "mark",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconMark"></use></svg><span class="b3-list-item__text">${siyuanI18n.mark}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.mark.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.sup, "superscript", "上标", "shangbiao", "sb"],
        id: "sup",
        value: "sup",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconSup"></use></svg><span class="b3-list-item__text">${siyuanI18n.sup}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.sup.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.sub, "subscript", "下标", "xiaobiao", "xb"],
        id: "sub",
        value: "sub",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconSub"></use></svg><span class="b3-list-item__text">${siyuanI18n.sub}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.sub.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n["inline-code"], "inline code", "行级代码", "hangjidaima", "hjdm"],
        id: "inlineCode",
        value: "code",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconInlineCode"></use></svg><span class="b3-list-item__text">${siyuanI18n["inline-code"]}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert["inline-code"].custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.kbd, "kbd", "键盘", "jianpan", "jp"],
        id: "kbd",
        value: "kbd",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconKeymap"></use></svg><span class="b3-list-item__text">${siyuanI18n.kbd}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.kbd.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n.tag, "tags", "标签", "biaoqian", "bq"],
        id: "tag",
        value: "tag",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconTag"></use></svg><span class="b3-list-item__text">${siyuanI18n.tag}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert.tag.custom))}</span></div>`,
    }, {
        filter: [siyuanI18n["inline-math"], "inline formulas", "inline math", "行级公式", "hangjigongshi", "hjgs", "行级数学公式", "hangjishuxvegongshi", "hangjishuxuegongshi", "hjsxgs"],
        id: "inlineMath",
        value: "inline-math",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconMath"></use></svg><span class="b3-list-item__text">${siyuanI18n["inline-math"]}</span><span class="b3-menu__accelerator b3-menu__accelerator--hotkey">${updateHotkeyTip((window.siyuan.config.keymap.editor.insert["inline-math"].custom))}</span></div>`,
    }, {
        value: "",
        id: "separator_3",
        html: "separator",
    }, {
        filter: [siyuanI18n.insertAsset, "insert image or file", "upload", "插入图片或文件", "charutupianhuowenjian", "crtphwj", "上传", "sc"],
        id: "insertAsset",
        value: Constants.ZWSP + 3,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconDownload"></use></svg><span class="b3-list-item__text">${siyuanI18n.insertAsset}</span>
<input class="b3-form__upload" type="file" multiple="multiple"${protyle.options.upload.accept ? ' accept="' + protyle.options.upload.accept + '"' : ""}></div>`,
    // 嵌入 HTML 文件入口（对齐上游新增条目）
    }, {
        filter: [window.siyuan.languages.insertHTMLFile, "embed html file", "iframe", "嵌入 html 文件", "qianruhtmlwenjian", "qrhtmlwj"],
        id: "insertHTMLFile",
        value: Constants.ZWSP + 3,
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconHTML5"></use></svg><span class="b3-list-item__text">${window.siyuan.languages.insertHTMLFile}</span>
<input class="b3-form__upload" data-upload-mode="html-iframe" type="file" multiple="multiple" accept=".html,.htm"></div>`,
    }, {
        filter: [siyuanI18n.insertIframeURL, "insert iframe link", "插入 iframe 链接", "charuiframelianjie", "criframelj"],
        id: "insertIframeURL",
        value: '<iframe sandbox="allow-forms allow-presentation allow-same-origin allow-scripts allow-modals allow-popups allow-storage-access-by-user-activation" src="" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>',
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconGlobe"></use></svg><span class="b3-list-item__text">${siyuanI18n.insertIframeURL}</span></div>`,
    }, {
        filter: [siyuanI18n.insertImgURL, "insert image link", "image", "img", "插入图片链接", "charutupianlianjie", "crtplj"],
        id: "insertImgURL",
        value: "![]()",
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconImage"></use></svg><span class="b3-list-item__text">${siyuanI18n.insertImgURL}</span></div>`,
    }, {
        filter: [siyuanI18n.insertVideoURL, "insert video link", "插入视频链接", "charushipinlianjie", "crsplj"],
        id: "insertVideoURL",
        value: '<video controls="controls" src=""></video>',
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconVideo"></use></svg><span class="b3-list-item__text">${siyuanI18n.insertVideoURL}</span></div>`,
    }, {
        filter: [siyuanI18n.insertAudioURL, "insert audio link", "插入音频链接", "charuyinpinlianjie", "cryplj"],
        id: "insertAudioURL",
        value: '<audio controls="controls" src=""></audio>',
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconRecord"></use></svg><span class="b3-list-item__text">${siyuanI18n.insertAudioURL}</span></div>`,
    }, {
        value: "",
        id: "separator_4",
        html: "separator",
    }, {
        filter: [siyuanI18n.staff, "staff", "五线谱", "wuxianpu", "wxp"],
        id: "staff",
        value: "```abc\n```",
        html: `<div class="b3-list-item__first"><span class="b3-list-item__text">ABC</span><span class="b3-list-item__meta">${siyuanI18n.staff}</span></div>`,
    }, {
        filter: [siyuanI18n.chart, "chart", "图表", "tubiao", "tb"],
        id: "chart",
        value: "```echarts\n```",
        html: `<div class="b3-list-item__first"><span class="b3-list-item__text">Chart</span><span class="b3-list-item__meta">${siyuanI18n.chart}</span></div>`,
    }, {
        filter: ["flowchart", "flow chart", "流程图", "liuchengtu", "lct"],
        id: "flowChart",
        value: "```flowchart\n```",
        html: '<div class="b3-list-item__first"><span class="b3-list-item__text">FlowChart</span><span class="b3-list-item__meta">Flow Chart</span></div>',
    }, {
        filter: ["graphviz", "状态图", "zhuangtaitu", "ztt"],
        id: "graph",
        value: "```graphviz\n```",
        html: '<div class="b3-list-item__first"><span class="b3-list-item__text">Graphviz</span><span class="b3-list-item__meta">Graph</span></div>',
    }, {
        filter: ["mermaid", "diagram", "图表", "tubiao", "tb"],
        id: "mermaid",
        value: "```mermaid\n```",
        html: '<div class="b3-list-item__first"><span class="b3-list-item__text">Mermaid</span><span class="b3-list-item__meta">Mermaid</span></div>',
    }, {
        filter: [siyuanI18n.mindmap, "mindmap", "脑图", "naotu", "nt"],
        id: "mindmap",
        value: "```mindmap\n```",
        html: `<div class="b3-list-item__first"><span class="b3-list-item__text">Mind map</span><span class="b3-list-item__meta">${siyuanI18n.mindmap}</span></div>`,
    }, {
        filter: ["plantuml", "建模语言", "jianmoyuyan", "jmyy"],
        id: "UML",
        value: "```plantuml\n```",
        html: '<div class="b3-list-item__first"><span class="b3-list-item__text">PlantUML</span><span class="b3-list-item__meta">UML</span></div>',
    }, {
        value: "",
        id: "separator_5",
        html: "separator",
    }, {
        filter: [siyuanI18n.infoStyle, "info style", "信息样式", "xinxiyangshi", "xxys"],
        id: "infoStyle",
        value: `style${Constants.ZWSP}color: var(--b3-card-info-color);background-color: var(--b3-card-info-background);`,
        html: `<div class="b3-list-item__first"><div style="color: var(--b3-card-info-color);background-color: var(--b3-card-info-background);" class="color__square color__square--list">A</div><span class="b3-list-item__text">${siyuanI18n.infoStyle}</span></div>`,
    }, {
        filter: [siyuanI18n.successStyle, "success style", "成功样式", "chenggongyangshi", "cgys"],
        id: "successStyle",
        value: `style${Constants.ZWSP}color: var(--b3-card-success-color);background-color: var(--b3-card-success-background);`,
        html: `<div class="b3-list-item__first"><div style="color: var(--b3-card-success-color);background-color: var(--b3-card-success-background);" class="color__square color__square--list">A</div><span class="b3-list-item__text">${siyuanI18n.successStyle}</span></div>`,
    }, {
        filter: [siyuanI18n.warningStyle, "warning style", "警告样式", "jinggaoyangshi", "jgys"],
        id: "warningStyle",
        value: `style${Constants.ZWSP}color: var(--b3-card-warning-color);background-color: var(--b3-card-warning-background);`,
        html: `<div class="b3-list-item__first"><div style="color: var(--b3-card-warning-color);background-color: var(--b3-card-warning-background);" class="color__square color__square--list">A</div><span class="b3-list-item__text">${siyuanI18n.warningStyle}</span></div>`,
    }, {
        filter: [siyuanI18n.errorStyle, "error style", "错误样式", "cuowuyangshi", "cwys"],
        id: "errorStyle",
        value: `style${Constants.ZWSP}color: var(--b3-card-error-color);background-color: var(--b3-card-error-background);`,
        html: `<div class="b3-list-item__first"><div style="color: var(--b3-card-error-color);background-color: var(--b3-card-error-background);" class="color__square color__square--list">A</div><span class="b3-list-item__text">${siyuanI18n.errorStyle}</span></div>`,
    }, {
        filter: [siyuanI18n.clearFontStyle, "clear style", "清除样式", "qingchuyangshi", "qcys"],
        id: "clearFontStyle",
        value: `style${Constants.ZWSP}`,
        html: `<div class="b3-list-item__first"><div class="color__square color__square--list">A</div><span class="b3-list-item__text">${siyuanI18n.clearFontStyle}</span></div>`,
    }, {
        value: "",
        id: "separator_6",
        html: "separator",
    }];
};

// 斜杠菜单：按入口可见性与自定义顺序解析内置与插件条目（对齐上游 entryVisibility 管线）
export const hintSlash = (key: string, protyle: IProtyle, sourceOrHideConfiguredCreate: THintSource | boolean = false) => {
    const enabled = isEntryVisible(SLASH_MENU_ROOT_PATH);
    if (!enabled) {
        return [];
    }
    const hideConfiguredCreate = typeof sourceOrHideConfiguredCreate === "boolean" && sourceOrHideConfiguredCreate;
    const builtinList = getBuiltinSlashMenuItems(protyle);
    const allList = builtinList.map<TSlashMenuItem>((item) => ({
        ...item,
        entryKey: item.id || "",
    }));
    let hasPlugin = false;
    protyle.app.plugins.forEach((plugin) => {
        plugin.protyleSlash.forEach(slash => {
            allList.push({
                filter: slash.filter,
                id: slash.id,
                entryKey: getPluginSlashEntryKey(plugin.name, slash.id,
                    slash.html === "separator" ? "separator" : "entry"),
                value: `plugin${Constants.ZWSP}${plugin.name}${Constants.ZWSP}${slash.id}`,
                html: slash.html
            });
            hasPlugin = true;
        });
    });
    if (!hasPlugin) {
        allList.pop();
    }
    refreshSlashMenuCatalog(protyle.app.plugins);
    return resolveSlashMenuItems(allList.filter((item) =>
        getEntryCatalogNode(getSlashMenuEntryPath(item.entryKey))), {
        enabled,
        hideConfiguredCreate,
        key,
        order: getEntryOrder(SLASH_MENU_ROOT_PATH),
        visible: (entryKey) => isEntryVisible(getSlashMenuEntryPath(entryKey)),
    });
};

export const hintTag = (key: string, protyle: IProtyle): IHintData[] => {
    if (!protyle.hint) {
        throw new Error("Protyle hint module is not initialized");
    }
    protyle.hint.genLoading(protyle);
    fetchPost("/api/search/searchTag", {
        k: key,
    }, (response) => {
        if (protyle.hint.element.classList.contains("fn__none")) {
            return;
        }
        const dataList: IHintData[] = [];
        let hasKey = false;
        response.data.tags.forEach((item: string) => {
            const value = item.replace(/<mark>/g, "").replace(/<\/mark>/g, "");
            dataList.push({
                value: `<span data-type="tag">${value}</span>`,
                html: `<div class="b3-list-item__text">${item}</div>`,
            });
            if (value === response.data.k) {
                hasKey = true;
            }
        });
        if (response.data.k && !hasKey) {
            dataList.splice(0, 0, {
                value: `<span data-type="tag">${response.data.k}</span>`,
                html: `<div class="b3-list-item__text">${siyuanI18n.newTag} <mark>${escapeHtml(response.data.k)}</mark></div>`,
            });
            if (dataList.length > 1) {
                dataList[1] ? dataList[1].focus = true : void 0;
            }
        }
        if (!protyle.hint) {
            throw new Error("Protyle hint module is not initialized");
        }
        protyle.hint.genHTML(dataList, protyle, true, "hint");
    });

    return [];
};

export const hintEmbed = (key: string, protyle: IProtyle): IHintData[] => {
    if (key.endsWith("}}") || key.endsWith("」」")) {
        return [];
    }
    if (!protyle.hint) {
        throw new Error("Protyle hint module is not initialized");
    }
    if (!protyle.wysiwyg) {
        throw new Error("Protyle wysiwyg module is not initialized");
    }
    protyle.hint.genLoading(protyle);
    const nodeElement = hasClosestBlock(getEditorRange(protyle.wysiwyg.element).startContainer);
    fetchPost("/api/search/searchRefBlock", withEncryptedNotebook(protyle.notebookId, {
        k: key,
        isDatabase: false,
        beforeLen: Math.floor((Math.max(protyle.element.clientWidth / 2, 320) - 58) / 28.8),
        id: nodeElement ? nodeElement.getAttribute("data-node-id") : protyle.block.parentID,
        rootID: protyle.block.rootID,
    }), (response) => {
        const dataList: IHintData[] = [];
        response.data.blocks.forEach((item: IBlock) => {
            dataList.push({
                value: `{{select * from blocks where id='${item.id}'}}`,
                html: genHintItemHTML(item),
            });
        });
        if (dataList.length === 0) {
            dataList.push({
                value: "",
                html: siyuanI18n.emptyContent,
            });
        }
        if (!protyle.hint) {
            throw new Error("Protyle hint module is not initialized");
        }
        protyle.hint.genHTML(dataList, protyle, true, "hint");
    });
    return [];
};

export const hintRenderTemplate = (value: string, protyle: IProtyle, nodeElement: Element) => {
    fetchPost("/api/template/render", {
        id: protyle.block.parentID,
        path: value
    }, (response) => {
        if (!protyle.wysiwyg) {
            throw new Error("Protyle wysiwyg module is not initialized");
        }
        if (!protyle.toolbar) {
            throw new Error("Protyle toolbar module is not initialized");
        }
        focusByRange(protyle.toolbar.range);
        const editElement = getContenteditableElement(nodeElement);
        if (editElement && editElement.textContent.trim() === "") {
            insertHTML(response.data.content, protyle, true);
        } else {
            insertHTML(response.data.content, protyle);
        }
        // https://github.com/siyuan-note/siyuan/issues/4488
        protyle.wysiwyg.element.querySelectorAll('[status="temp"]').forEach(item => {
            item.remove();
        });
        blockRender(protyle, protyle.wysiwyg.element);
        contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
        highlightRender(protyle.wysiwyg.element);
        avRender(protyle.wysiwyg.element, protyle);
        hideElements(["util"], protyle);
    });
};

export const hintRenderWidget = (value: string, protyle: IProtyle) => {
    if (!protyle.toolbar) {
        throw new Error("Protyle toolbar module is not initialized");
    }
    if (!protyle.lute) {
        throw new Error("Protyle lute module is not initialized");
    }
    focusByRange(protyle.toolbar.range);
    // src 地址以 / 结尾
    // Use the path ending with `/` when loading the widget https://github.com/siyuan-note/siyuan/issues/10520
    // 追加内核版本参数，使挂件 iframe 缓存随版本失效（对齐上游）
    const src = addWidgetCacheVersion(`/widgets/${value}/`, Constants.SIYUAN_VERSION);
    insertHTML(protyle.lute.SpinBlockDOM(`<iframe src="${src}" data-subtype="widget" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>`), protyle, true);
    hideElements(["util"], protyle);
};

// 按资源路径生成资源 HTML 并插入正文（上游新增，供 menus/protyle 调用）
export const hintRenderAssets = (value: string, protyle: IProtyle) => {
    if (!protyle.toolbar) {
        throw new Error("Protyle toolbar module is not initialized");
    }
    focusByRange(protyle.toolbar.range);
    const type = getAssetExtension(value).toLowerCase();
    const filename = value.startsWith("assets/") ? getAssetName(value) : value;
    insertHTML(genAssetHTML(type, value, filename, value.startsWith("assets/") ? filename + type : value), protyle);
    hideElements(["util"], protyle);
};

export const hintMoveBlock = (pathString: string, sourceElements: Element[], protyle: IProtyle) => {
    if (pathString === "/") {
        return;
    }
    const parentID = getDisplayName(pathString, true, true);
    if (protyle.block.rootID === parentID) {
        return;
    }
    const doOperations: IOperation[] = [];
    let topSourceElement: Element | undefined;
    const parentElement = sourceElements[0]?.parentElement;
    // 移动前记录原始有序列表起始编号，避免元素移除后重算导致序号漂移（对齐上游）
    const listStart = parentElement ? getOrderedListStart(parentElement) : 1;
    let sideElement;
    sourceElements.forEach((item, index) => {
        if (index === sourceElements.length - 1 &&
            // 动态加载过慢，导致 item 被移除
            item.parentElement) {
            topSourceElement = getTopAloneElement(item);
            sideElement = topSourceElement.nextElementSibling || topSourceElement.previousElementSibling;
            if (topSourceElement === item) {
                topSourceElement = undefined;
            }
        }
        const id = item.getAttribute("data-node-id");
        if (!id) {
            throw new Error("Block id is missing");
        }
        doOperations.push({
            action: "append",
            id,
            parentID,
        });
        item.remove();
    });
    // 删除空元素
    if (topSourceElement) {
        const id = topSourceElement.getAttribute("data-node-id");
        if (!id) {
            throw new Error("Block id is missing");
        }
        doOperations.push({
            action: "delete",
            id,
        });
        topSourceElement.remove();
    } else if (parentElement && parentElement.classList.contains("list") && parentElement.getAttribute("data-subtype") === "o" &&
        parentElement.childElementCount > 1) {
        updateListOrder(parentElement, listStart);
        Array.from(parentElement.children).forEach((item) => {
            if (item.classList.contains("protyle-attr")) {
                return;
            }
            const id = item.getAttribute("data-node-id");
            if (!id) {
                throw new Error("Block id is missing");
            }
            item.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
            doOperations.push({
                action: "update",
                id,
                data: item.outerHTML
            });
        });
    } else if (parentElement && protyle.block.showAll && parentElement.classList.contains("protyle-wysiwyg") && parentElement.childElementCount === 0) {
        setTimeout(() => {
            const id = protyle.block.parent2ID;
            if (!id) {
                throw new Error("Block id is missing");
            }
            protyle.getInstance().zoomOut({id, focusId: id});
        }, Constants.TIMEOUT_INPUT * 2 + 100);
    } else if (parentElement && parentElement.classList.contains("protyle-wysiwyg") && parentElement.innerHTML === "" &&
        !hasClosestByClassName(parentElement, "block__edit", true) &&
        protyle.block.id === protyle.block.rootID) {
        // 根文档原内容为空
        const newId = Lute.NewNodeID();
        const newElement = genEmptyElement(false, false, newId);
        doOperations.splice(0, 0, {
            action: "insert",
            id: newId,
            data: newElement.outerHTML,
            parentID: protyle.block.parentID
        });
        parentElement.innerHTML = newElement.outerHTML;
        focusBlock(newElement);
    } else if (sideElement) {
        focusBlock(sideElement);
    }
    // 跨文档不支持撤销
    transaction(protyle, doOperations);
};
