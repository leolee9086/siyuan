import { App } from "../index";
import { Constants } from "../constants";
import { ipcRenderer } from "electron";

export const closeWindow = async (app: App) => {
    for (let i = 0; i < app.plugins.length; i++) {
        const plugin = app.plugins[i];
        if (!plugin) {
            continue;
        }
        try {
            await plugin.onunload();
        } catch (e) {
            console.error(e);
        }
    }
    ipcRenderer.send(Constants.SIYUAN_CMD, "destroy");
};
