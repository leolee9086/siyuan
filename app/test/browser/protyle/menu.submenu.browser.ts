import {afterEach, describe, expect, it, vi} from "vitest";

const previousSiyuan = Reflect.get(globalThis, "siyuan");

const importNativeModule = async (url: string) => {
    const exportKey = `__protyleMenuEntry${Date.now()}`;
    const loadedEvent = `${exportKey}:loaded`;
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `import * as entry from ${JSON.stringify(url)}; Reflect.set(window, ${JSON.stringify(exportKey)}, entry); window.dispatchEvent(new Event(${JSON.stringify(loadedEvent)}));`;
    await new Promise<void>((resolve, reject) => {
        window.addEventListener(loadedEvent, () => resolve(), {once: true});
        script.addEventListener("error", () => reject(new Error(`Failed to import ${url}`)), {once: true});
        document.head.append(script);
    });
    const entry = Reflect.get(window, exportKey) as {createProtyleMenu: (options?: {closeOnOutsideClick?: boolean}) => IProtyleMenuPort};
    Reflect.deleteProperty(window, exportKey);
    script.remove();
    return entry;
};

afterEach(() => {
    document.body.innerHTML = "";
    Reflect.set(globalThis, "siyuan", previousSiyuan);
});

describe("standalone menu submenus", () => {
    it("opens nested menu items through the unified host implementation", async () => {
        Reflect.set(globalThis, "siyuan", {standaloneProtyle: true, zIndex: 0});
        const {createProtyleMenu} = await importNativeModule("/protyle-app/protyle.js");
        const menu = createProtyleMenu({closeOnOutsideClick: true});
        const click = vi.fn();
        const item = document.createElement("button");
        item.className = "b3-menu__item";
        item.innerHTML = "<span class=\"b3-menu__label\">Parent</span>";
        const submenu = document.createElement("div");
        submenu.className = "b3-menu__submenu";
        const items = document.createElement("div");
        items.className = "b3-menu__items";
        const child = document.createElement("button");
        child.className = "b3-menu__item";
        child.dataset.id = "child";
        child.addEventListener("click", click);
        items.append(child);
        submenu.append(items);
        item.append(submenu);

        menu.append(item);
        menu.popup({x: 16, y: 16});
        item.dispatchEvent(new MouseEvent("mouseover", {bubbles: true}));

        expect(item.classList.contains("b3-menu__item--show")).toBe(true);
        expect(submenu).not.toBeNull();
        expect(submenu?.querySelector("[data-id=\"child\"]")).not.toBeNull();

        menu.remove(true);
        expect(item.classList.contains("b3-menu__item--show")).toBe(false);
        expect(menu.element.classList.contains("fn__none")).toBe(false);

        menu.element.setAttribute("data-name", "stale-menu");
        menu.fullscreen();
        expect(menu.element.firstElementChild?.classList.contains("fn__none")).toBe(false);

        menu.remove();
        expect(menu.element.classList.contains("fn__none")).toBe(true);
        expect(menu.element.hasAttribute("data-name")).toBe(false);

        menu.append(item);
        menu.popup({x: 16, y: 16});
        document.body.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        expect(menu.element.classList.contains("fn__none")).toBe(true);
    });
});
