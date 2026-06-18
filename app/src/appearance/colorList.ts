/** 用途：国际化文案。使用范围：生成中英文主题色标签与 CSS 变量映射表。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";

/**
 * 主题文件中必然存在的颜色列表
 *
 * @同步豁免: UI构建 - 供 Vue 模板同步遍历渲染，无法使用 async
 */
export const genThemedColorList = () => ({
    [siyuanI18n.colorFont + "1"]: "--b3-font-color1",
    [siyuanI18n.colorFont + "2"]: "--b3-font-color2",
    [siyuanI18n.colorFont + "3"]: "--b3-font-color3",
    [siyuanI18n.colorFont + "4"]: "--b3-font-color4",
    [siyuanI18n.colorFont + "5"]: "--b3-font-color5",
    [siyuanI18n.colorFont + "6"]: "--b3-font-color6",
    [siyuanI18n.colorFont + "7"]: "--b3-font-color7",
    [siyuanI18n.colorFont + "8"]: "--b3-font-color8",
    [siyuanI18n.colorFont + "9"]: "--b3-font-color9",
    [siyuanI18n.colorFont + "10"]: "--b3-font-color10",
    [siyuanI18n.colorFont + "11"]: "--b3-font-color11",
    [siyuanI18n.colorFont + "12"]: "--b3-font-color12",
    [siyuanI18n.colorFont + "13"]: "--b3-font-color13",
    [siyuanI18n.colorPrimary + "1"]: "--b3-font-background1",
    [siyuanI18n.colorPrimary + "2"]: "--b3-font-background2",
    [siyuanI18n.colorPrimary + "3"]: "--b3-font-background3",
    [siyuanI18n.colorPrimary + "4"]: "--b3-font-background4",
    [siyuanI18n.colorPrimary + "5"]: "--b3-font-background5",
    [siyuanI18n.colorPrimary + "6"]: "--b3-font-background6",
    [siyuanI18n.colorPrimary + "7"]: "--b3-font-background7",
    [siyuanI18n.colorPrimary + "8"]: "--b3-font-background8",
    [siyuanI18n.colorPrimary + "9"]: "--b3-font-background9",
    [siyuanI18n.colorPrimary + "10"]: "--b3-font-background10",
    [siyuanI18n.colorPrimary + "11"]: "--b3-font-background11",
    [siyuanI18n.colorPrimary + "12"]: "--b3-font-background12",
    [siyuanI18n.colorPrimary + "13"]: "--b3-font-background13",
    ["PDF" + siyuanI18n.colorPrimary + "1"]: "--b3-pdf-background1",
    ["PDF" + siyuanI18n.colorPrimary + "2"]: "--b3-pdf-background2",
    ["PDF" + siyuanI18n.colorPrimary + "3"]: "--b3-pdf-background3",
    ["PDF" + siyuanI18n.colorPrimary + "4"]: "--b3-pdf-background4",
    ["PDF" + siyuanI18n.colorPrimary + "5"]: "--b3-pdf-background5",
    ["PDF" + siyuanI18n.colorPrimary + "6"]: "--b3-pdf-background6",
    ["PDF" + siyuanI18n.colorPrimary + "7"]: "--b3-pdf-background7",
});