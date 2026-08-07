import {describe, expect, it} from "vitest";
import {generateButtonHTML} from "../../../src/layout/dock/dock.button";
import {isTDock} from "../../../src/layout/dock/dock.guard";
import {FILE_BROWSER_DOCK_DEFINITIONS} from "../../../src/sforge/fileBrowser/FileBrowser.docks";

describe("file browser Dock registration", () => {
    it.each(FILE_BROWSER_DOCK_DEFINITIONS)("accepts and renders $type", definition => {
        expect(isTDock(definition.type)).toBe(true);
        const html = generateButtonHTML({
            type: definition.type,
            size: {...definition.size},
            show: false,
            icon: definition.icon,
            title: definition.title,
            hotkey: "",
            hotkeyLangId: "",
        }, definition.column, "");

        expect(html).toContain(`data-type="${definition.type}"`);
        expect(html).toContain(`xlink:href="#${definition.icon}"`);
    });
});
