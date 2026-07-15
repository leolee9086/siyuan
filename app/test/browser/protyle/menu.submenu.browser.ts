import {afterEach, describe, expect, it, vi} from "vitest";
import {createStandaloneProtyleMenu} from "../../../src/protyle-standalone/menu.factory";

const previousSiyuan = Reflect.get(globalThis, "siyuan");

afterEach(() => {
    document.body.innerHTML = "";
    Reflect.set(globalThis, "siyuan", previousSiyuan);
});

describe("standalone menu submenus", () => {
    it("opens nested menu items through the host event capability", () => {
        Reflect.set(globalThis, "siyuan", {standaloneProtyle: true, zIndex: 0});
        const menu = createStandaloneProtyleMenu();
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
        expect(submenu?.style.position).toBe("fixed");
        expect(submenu?.querySelector("[data-id=\"child\"]")).not.toBeNull();

        menu.remove();
        expect(menu.element.classList.contains("fn__none")).toBe(true);

        menu.append(item);
        menu.popup({x: 16, y: 16});
        document.body.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        expect(menu.element.classList.contains("fn__none")).toBe(true);
    });
});
