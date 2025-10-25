
export class subMenu {
    public menus: IMenu[];

    constructor() {
        this.menus = [];
    }

    addSeparator(index?: number, id?: string) {
        if (typeof index === "number") {
            this.menus.splice(index, 0, { type: "separator", id });
        } else {
            this.menus.push({ type: "separator", id });
        }
    }

    addItem(menu: IMenu) {
        if (typeof menu.index === "number") {
            this.menus.splice(menu.index, 0, menu);
        } else {
            this.menus.push(menu);
        }
    }
}
