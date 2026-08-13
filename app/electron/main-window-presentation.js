const presentMainWindow = (browserWindow, {openAsHidden, maximized}) => {
    if (!browserWindow || typeof browserWindow.show !== "function" ||
        typeof browserWindow.minimize !== "function" ||
        typeof browserWindow.maximize !== "function" ||
        typeof browserWindow.unmaximize !== "function") {
        throw new TypeError("A main BrowserWindow with presentation controls is required.");
    }

    if (openAsHidden) {
        browserWindow.minimize();
        return "hidden";
    }

    browserWindow.show();
    if (maximized) {
        browserWindow.maximize();
        return "maximized";
    }
    browserWindow.unmaximize();
    return "visible";
};

module.exports = {presentMainWindow};
