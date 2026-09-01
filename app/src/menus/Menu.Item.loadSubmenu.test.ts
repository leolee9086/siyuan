import { describe, it, expect, vi } from "vitest";
import { MenuItem, CUSTOM_EVENT_LOAD_SUBMENU } from "./Menu.Item";

describe("Menu.Item loadSubmenu", () => {
    it("renders loading placeholder and loads once", async () => {
        (globalThis as any).window = (globalThis as any).window || {};
        const win = (globalThis as any).window;
        win.siyuan = win.siyuan || {};
        win.siyuan.languages = win.siyuan.languages || {loading: "Loading", emptyContent: "Empty"};
        win.siyuan.menus = win.siyuan.menus || {menu: {element: document.createElement("div"), showSubMenu: vi.fn()}};
        let callCount = 0;
        const loadFn = vi.fn(async (): Promise<IMenu[]> => {
            callCount++;
            return [{label: "child", icon: "iconTest"} as IMenu];
        });
        const item = new MenuItem({label: "parent", loadSubmenu: loadFn});
        document.body.append(item.element);
        const submenu = item.element.querySelector(".b3-menu__submenu");
        expect(submenu).not.toBeNull();
        expect(submenu!.textContent).toContain("Loading");
        item.element.dispatchEvent(new CustomEvent(CUSTOM_EVENT_LOAD_SUBMENU, {detail: {}}));
        await new Promise((r) => setTimeout(r, 10));
        const firstCount = callCount;
        expect(firstCount).toBeGreaterThan(0);
        expect(loadFn).toHaveBeenCalledTimes(firstCount);
        item.element.dispatchEvent(new CustomEvent(CUSTOM_EVENT_LOAD_SUBMENU, {detail: {}}));
        await new Promise((r) => setTimeout(r, 10));
        expect(callCount).toBe(firstCount);
        item.element.dispatchEvent(new CustomEvent(CUSTOM_EVENT_LOAD_SUBMENU, {detail: {focus: true}}));
        await new Promise((r) => setTimeout(r, 10));
        expect(callCount).toBe(firstCount);
    });

    it("exposes CUSTOM_EVENT_LOAD_SUBMENU", () => {
        expect(CUSTOM_EVENT_LOAD_SUBMENU).toBe("load-submenu");
    });
});
