
export class subMenu {
    public menus: IMenu[];

    constructor() {
        this.menus = [];
    }

    addSeparator(index?: number, id?: string) {
        const separator: IMenu = { type: "separator", ...(id && { id }) };
        if (typeof index !== "number") {
            this.menus.push(separator);
            return;
        }
        this.menus.splice(index, 0, separator);
    }

    addItem(menu: IMenu) {
        if (typeof menu.index !== "number") {
            this.menus.push(menu);
            return;
        }
        this.menus.splice(menu.index, 0, menu);
    }
}
