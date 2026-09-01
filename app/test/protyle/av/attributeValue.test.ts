import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../../src/protyle/render/av/value/imports", () => ({
    dayjs: (value: number) => ({format: (pattern: string) => `${pattern}:${value}`}),
    Constants: {LOCAL_IMAGES: "local-images"},
    unicode2Emoji: (icon: string) => `emoji:${icon}`,
    getCompressURL: (url: string) => `compressed:${url}`,
    escapeAriaLabel: (value: string) => `aria:${value}`,
    escapeAttr: (value: string) => `attr:${value}`,
    escapeHtml: (value: string) => `html:${value}`,
    siyuanI18n: {
        empty: "Empty",
        format: "Format",
        openBy: "Open",
        untitled: "Untitled",
    },
}));

import {genAVValueHTML, getAVTemplateHTML} from "../../../src/protyle/render/av/value/render";

beforeEach(() => {
    Object.assign(window, {
        DOMPurify: {sanitize: (content: string) => `sanitized:${content}`},
        siyuan: {
            config: {editor: {allowHTMLBLockScript: false}},
            storage: {"local-images": {file: "default-icon"}},
        },
    });
    vi.stubGlobal("Lute", {EscapeHTMLStr: (value: string) => `lute:${value}`});
});

describe("AV attribute value rendering", () => {
    it("keeps template sanitization controlled by the editor setting", () => {
        expect(getAVTemplateHTML("<script>bad()</script>")).toBe("sanitized:<script>bad()</script>");

        window.siyuan.config.editor.allowHTMLBLockScript = true;

        expect(getAVTemplateHTML("<b>trusted</b>")).toBe("<b>trusted</b>");
    });

    it("renders only the first option for a single-select value", () => {
        const value = {
            type: "select",
            mSelect: [
                {content: "First", color: "1"},
                {content: "Second", color: "2"},
            ],
        } as IAVCellValue;

        expect(genAVValueHTML(value)).toBe('<span class="b3-chip b3-chip--middle" style="background-color:var(--b3-font-backgroundattr:1);color:var(--b3-font-colorattr:1)">html:First</span>');
    });

    it("preserves URL input and open-action markup", () => {
        const value = {type: "url", url: {content: "https://example.com"}} as IAVCellValue;

        expect(genAVValueHTML(value)).toBe(`<input value="attr:https://example.com" class="b3-text-field b3-text-field--text fn__flex-1" placeholder="Empty">
<span class="fn__space"></span>
<a href="attr:https://example.com" target="_blank" aria-label="Open" class="block__icon block__icon--show fn__flex-center b3-tooltips__w b3-tooltips"><svg><use xlink:href="#iconLink"></use></svg></a>`);
    });

    it("recursively renders mixed rollup values with the original delimiter", () => {
        const value = {
            type: "rollup",
            rollup: {
                contents: [
                    {type: "text", text: {content: "Hello"}},
                    {type: "checkbox", checkbox: {checked: true}},
                ],
            },
        } as IAVCellValue;

        expect(genAVValueHTML(value)).toBe('html:Hello,&nbsp;<svg class="av__checkbox"><use xlink:href="#iconCheck"></use></svg>');
    });
});
