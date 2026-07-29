/** 本模块是原 `util/assets.ts` 中编辑器内联样式生成与应用职责的唯一现行所有者。 */
import {isWin11} from "../../protyle/util/compatibility";
import {isMac} from "../platform/hotkey/format";
import {isIPad, isIPhone} from "../platform/functions";
import { getSiyuanConfig } from "../siyuanEnvironments/getSiyuanConfig.environment";

export const setInlineStyle = async (set = true, servePath = "../../../") => {
    let style;
    // Emojis Reset: 字体中包含了 emoji，需重置
    // Emojis Additional： 苹果/win11 字体中没有的 emoji
    if (isMac() || isIPad() || isIPhone()) {
        style = `@font-face {
  font-family: "Emojis Additional";
  src: url(${servePath}appearance/fonts/Noto-COLRv1-2.047/Noto-COLRv1.woff2) format("woff2");
  unicode-range: U+1fae9, U+1fac6, U+1fabe, U+1fadc, U+e50a, U+1fa89, U+1fadf, U+1f1e6-1f1ff, U+1fa8f;
}
@font-face {
  font-family: "Emojis Reset";
  src: local("Apple Color Emoji"),
  local("Segoe UI Emoji"),
  local("Segoe UI Symbol");
  unicode-range: U+21a9, U+21aa, U+2122, U+2194-2199, U+23cf, U+25b6, U+25c0, U+25fb, U+25fc, U+25aa, U+25ab, U+2600-2603,
  U+260e, U+2611, U+261d, U+2639, U+263a, U+2640, U+2642, U+2660, U+2663, U+2665, U+2666, U+2668, U+267b, U+26aa, U+26ab, 
  U+2702, U+2708, U+2934, U+2935, U+1f170, U+1f171, U+1f17e, U+1f17f, U+1f202, U+1f21a, U+1f22f, U+1f232-1f23a, U+1f250, 
  U+1f251, U+1fae4, U+2049, U+203c, U+3030, U+303d, U+24c2, U+26a0, U+26a1, U+26be, U+27a1, U+2b05-2b07, U+3297, U+3299, U+a9, U+ae;
  size-adjust: 115%;
}
@font-face {
  font-family: "Emojis";
  src: local("Apple Color Emoji"),
  local("Segoe UI Emoji"),
  local("Segoe UI Symbol");
  size-adjust: 115%;
}`;
    } else if (await isWin11()) {
        // Win11 Browser
        style = `@font-face {
  font-family: "Emojis Additional";
  src: url(${servePath}appearance/fonts/Noto-COLRv1-2.047/Noto-COLRv1.woff2) format("woff2");
  unicode-range: U+1fae9, U+1fac6, U+1fabe, U+1fadc, U+e50a, U+1fa89, U+1fadf, U+1f1e6-1f1ff, U+1f3f4, U+e0067, U+e0062,
  U+e0065, U+e006e, U+e007f, U+e0073, U+e0063, U+e0074, U+e0077, U+e006c;
  size-adjust: 85%;
}
@font-face {
  font-family: "Emojis Reset";
  src: local("Segoe UI Emoji"),
  local("Segoe UI Symbol");
  unicode-range: U+263a, U+21a9, U+2642, U+303d, U+2197, U+2198, U+2199, U+2196, U+2195, U+2194, U+2660, U+2665, U+2666, 
  U+2663, U+3030, U+21aa, U+25b6, U+25c0, U+2640, U+203c, U+a9, U+ae, U+2122;
  size-adjust: 85%;
}
@font-face {
  font-family: "Emojis";
  src: local("Segoe UI Emoji"),
  local("Segoe UI Symbol");
  size-adjust: 85%;
}`;
    } else {
        style = `@font-face {
  font-family: "Emojis Reset";
  src: url(${servePath}appearance/fonts/Noto-COLRv1-2.047/Noto-COLRv1.woff2) format("woff2");
  unicode-range: U+1f170-1f171, U+1f17e, U+1f17f, U+1f21a, U+1f22f, U+1f232-1f23a, U+1f250, U+1f251, U+1f32b, U+1f3bc,
  U+1f411, U+1f42d, U+1f42e, U+1f431, U+1f435, U+1f441, U+1f4a8, U+1f4ab, U+1f525, U+1f600-1f60d, U+1f60f-1f623,
  U+1f625-1f62b, U+1f62d-1f63f, U+1F643, U+1F640, U+1f79, U+1f8f, U+1fa79, U+1fae4, U+1fae9, U+1fac6, U+1fabe, U+1fadf,
  U+200d, U+203c, U+2049, U+2122, U+2139, U+2194-2199, U+21a9, U+21aa, U+23cf, U+25aa, U+25ab, U+25b6, U+25c0, U+25fb-25fe,
  U+2611, U+2615, U+2618, U+261d, U+2620, U+2622, U+2623, U+2626, U+262a, U+262e, U+2638-263a, U+2640, U+2642, U+2648-2653,
  U+265f, U+2660, U+2663, U+2665, U+2666, U+267b, U+267e, U+267f, U+2692-2697, U+2699, U+269b, U+269c, U+26a0, U+26a1,
  U+26a7, U+26aa, U+26ab, U+26b0, U+26b1, U+2702, U+2708, U+2709, U+270c, U+270d, U+2712, U+2714, U+2716, U+271d, U+2733,
  U+2734, U+2744, U+2747, U+2763, U+2764, U+2934-2935, U+3030, U+303d, U+3297, U+3299, U+fe0f, U+e50a, U+a9, U+ae;
  size-adjust: 92%;
}
@font-face {
  font-family: "Emojis";
  src: url(${servePath}appearance/fonts/Noto-COLRv1-2.047/Noto-COLRv1.woff2) format("woff2"),
  local("Segoe UI Emoji"),
  local("Segoe UI Symbol"),
  local("Apple Color Emoji"),
  local("Twemoji Mozilla"),
  local("Noto Color Emoji"),
  local("Android Emoji"),
  local("EmojiSymbols");
  size-adjust: 92%;
}`;
    }
    style += `\n:root { --b3-font-size-editor: ${getSiyuanConfig().editor.fontSize}px }
.b3-typography code:not(.hljs), .protyle-wysiwyg span[data-type~=code] { font-variant-ligatures: ${getSiyuanConfig().editor.codeLigatures ? "normal" : "none"} }${getSiyuanConfig().editor.justify ? "\n.protyle-wysiwyg [data-node-id] { text-align: justify }" : ""}`;
    if (getSiyuanConfig().editor.rtl) {
        style += `\n.protyle-title__input,
.protyle-wysiwyg .p,
.protyle-wysiwyg .code-block .hljs,
.protyle-wysiwyg .table,
.protyle-wysiwyg .render-node protyle-html,
.protyle-wysiwyg .render-node > div[spin="1"],
.protyle-wysiwyg [data-type="NodeHeading"] {direction: rtl}
.protyle-wysiwyg [data-node-id].li > .protyle-action {
    right: 0;
    left: auto;
    direction: rtl;
}
.protyle-wysiwyg [data-node-id].li > [data-node-id] {
    margin-right: 34px;
    margin-left: 0;
}
.protyle-wysiwyg [data-node-id].li::before {
    right: 17px;
    left: auto;
}
.b3-typography table:not([style*="text-align: left"]) {
  margin-left: auto;
}`;
    }
    if (getSiyuanConfig().editor.fontFamily) {
        style += `\n.b3-typography:not(.b3-typography--default), .protyle-wysiwyg, .protyle-title {${getSiyuanConfig().editor.fontWeight ? `font-weight: ${getSiyuanConfig().editor.fontWeight};` : ""}font-family: "Emojis Additional", "Emojis Reset", "${getSiyuanConfig().editor.fontFamily}", var(--b3-font-family)}`;
    }
    // pad 端菜单移除显示，如工作空间
    if ("ontouchend" in document) {
        style += "\n.b3-menu .b3-menu__action {opacity: 0.68;}";
    }
    if (set) {
        const siyuanStyle = document.getElementById("siyuanStyle");
        if (siyuanStyle) {
            siyuanStyle.innerHTML = style;
        } else {
            document.querySelector("#pluginsStyle")?.insertAdjacentHTML("beforebegin", `<style id="siyuanStyle">${style}</style>`);
        }
    }
    return style;
};
