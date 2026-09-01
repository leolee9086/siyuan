/* eslint-disable import/namespace */
/**
 * 作用：Protyle 编辑器配置选项
 * 意图：提供默认选项配置，合并用户传入的自定义选项，处理工具栏定义转换
 * 使用范围：在 Protyle 构造函数中创建 Options 实例并调用 merge() 获取最终配置
 * 解耦评估：对 Constants 的引用仅为 UPLOAD_ADDRESS 常量，可改为直接内联值或从 config 获取
 */
import { Constants } from "../../constants";
import { merge } from "./merge";
import { isMobile } from "../../platform";
import { hintEmbed } from "../hint/extend";
import { hintSlash } from "../hint/extend";
import { hintTag } from "../hint/extend";
import { hintRef } from "../hint/extend.hintRef";
import { toolbarKeyToMenu } from "../toolbar/util";
import { getDefaultToolbar } from "../toolbar/defaults";

/**
 * 根据平台返回默认工具栏定义（来自上游 toolbar/defaults 模块，含可配置条目与分隔线元数据）。
 * 作用：仅按平台选择默认工具栏定义，不在此时做按键映射；
 *      在 merge() 中才通过 toolbarKeyToMenu 转换为最终的 IMenuItem[]
 * 意图：避免在类字段初始化时访问 window.siyuan.config.keymap（此时可能尚未就绪），
 *       导致 Protyle 构造失败、文档页签无法打开
 */
const getDefaultToolbarKeys = (): Array<string | IMenuItem> => getDefaultToolbar(isMobile);

/**
 * 作用：将 IProtyleOptions 合并配置
 * 意图：合并默认配置与用户自定义配置，并处理 toolbar 等特殊字段的转换
 * 调用时机：Protyle 构造函数中 new 之后立即调用
 */
export class Options {
    public options: IProtyleOptions;
    private defaultOptions: IProtyleOptions = {
        mode: "wysiwyg",
        blockId: "",
        render: {
            background: false,
            title: false,
            titleShowTop: false,
            hideTitleOnZoom: false,
            gutter: true,
            scroll: false,
            breadcrumb: true,
            breadcrumbDocName: false,
        },
        action: [],
        after: undefined,
        classes: {
            preview: "",
        },
        click: {
            preventInsetEmptyBlock: false
        },
        hint: {
            delay: 200,
            emoji: {
                "+1": "👍",
                "-1": "👎",
                "confused": "😕",
                "eyes": "👀️",
                "heart": "❤️",
                "rocket": "🚀️",
                "smile": "😄",
                "tada": "🎉️",
            },
            emojiPath: "/emojis",
            extend: [{
                key: "((",
                hint: hintRef,
            }, {
                key: "【【",
                hint: hintRef,
            }, {
                key: "（（",
                hint: hintRef,
            }, {
                key: "[[",
                hint: hintRef,
            }, {
                key: "{{",
                hint: hintEmbed,
            }, {
                key: "「「",
                hint: hintEmbed,
            }, {
                key: "「『",
                hint: hintEmbed,
            }, {
                key: "『「",
                hint: hintEmbed,
            }, {
                key: "『『",
                hint: hintEmbed,
            }, {
                key: "#", // 需在 / 之前，否则 #abc/ 会显示菜单
                hint: hintTag,
            }, {
                key: "/",
                hint: hintSlash,
            }, {
                key: "、",
                hint: hintSlash,
            }, {
                key: ":" // 必须在最后一个，否则块引用后的 : 不能被解析
            }],
        },
        lang: window.siyuan.config?.appearance.lang,
        preview: {
            actions: ["desktop", "tablet", "mobile", "mp-wechat", "zhihu", "yuque"],
            delay: 0,
            markdown: {
                paragraphBeginningSpace: window.siyuan.config?.export.paragraphBeginningSpace,
                listStyle: false,
                sanitize: true,
            },
            mode: "both",
        },
        /**
         * 工具栏默认取上游 defaults 模块的定义（按键名与带元数据条目混合），在 merge() 中延迟转换为 IMenuItem[]
         * 不能在类字段初始化时调用 toolbarKeyToMenu——该函数访问 window.siyuan.config.keymap，
         * 而类字段初始化发生在 new Options() 构造时，此时 keymap 可能尚未就绪，
         * 会导致 TypeError 使 Protyle 构造失败、文档页签无法打开
         */
        toolbar: getDefaultToolbarKeys(),
        typewriterMode: false,
        upload: {
            max: 1024 * 1024 * 1024 * 16,
            url: Constants.UPLOAD_ADDRESS,
            extraData: {},
            fieldName: "file[]",
            filename: (name: string) => name.replace(/[\\/:*?"'<>|\[\]\(\)~!`&{}=#%$]/g, ""),
            linkToImgUrl: "",
            withCredentials: false,
        }
    };

    constructor(options: IProtyleOptions) {
        this.options = options;
    }

    /**
     * 合并用户选项与默认选项，返回最终配置
     * 作用：将传入的 options 覆盖默认值，处理 toolbar 的类型转换，合并 hint.emoji 自定义映射
     * 调用时机：Protyle 构造函数中 Options 实例化后立即调用
     */
    public merge() {
        if (!this.options) {
            // 即使没有传入 options，也需要将默认的字符串按键列表转换为 IMenuItem[]
            this.defaultOptions.toolbar = mergeToolbar(this.defaultOptions.toolbar);
            return this.defaultOptions;
        }
        // 优先使用用户传入的 toolbar，否则使用默认值
        if (this.options.toolbar) {
            this.options.toolbar = mergeToolbar(this.options.toolbar);
        } else {
            this.options.toolbar = mergeToolbar(this.defaultOptions.toolbar);
        }
        // 合并用户自定义的 emoji 映射到默认配置中
        if (this.options.hint?.emoji && this.defaultOptions.hint) {
            this.defaultOptions.hint.emoji = this.options.hint.emoji;
        }
        return merge(this.defaultOptions, this.options);
    }
}

/**
 * 将 toolbar 定义从按键名数组转换为 IMenuItem 数组
 * 作用：如果传入的 toolbar 是字符串数组（按键名），则调用 toolbarKeyToMenu 转换
 *      如果已是 IMenuItem 数组，则直接返回
 * 抛出：当 toolbar 为 undefined/null/空 时抛出 Error
 */
function mergeToolbar(toolbar: Array<string | IMenuItem> | undefined){
    if (!toolbar || (Array.isArray(toolbar) && toolbar.length === 0)) {
        throw new Error("必须传入正确的工具条定义");
    }
    return toolbarKeyToMenu(toolbar);
}
