export const isMenuItem = (item: unknown): item is IMenuItem => {
    if (typeof item !== "object" || item === null) {
        return false;
    }
    const menuItem = item as IMenuItem;
    if (typeof menuItem.name !== "string") {
        return false;
    }
    if (menuItem.tip && typeof menuItem.tip !== "string") {
        return false;
    }
    if (menuItem.lang && typeof menuItem.lang !== "string") {
        return false;
    }
    if (menuItem.icon && typeof menuItem.icon !== "string") {
        return false;
    }
    if (menuItem.hotkey && typeof menuItem.hotkey !== "string") {
        return false;
    }
    if (menuItem.tipPosition && typeof menuItem.tipPosition !== "string") {
        return false;
    }
    if (menuItem.click && typeof menuItem.click !== "function") {
        return false;
    }
    return true;
};
