import { isElectron } from "../../../../platform";
import { ipcSend } from "../../../../window/imports";
import { App, Constants } from "../imports";


/**
 * 
 * @param app 
 * @returns 
 * @AITODO 
 */
export const sendUnregisterGlobalShortcut = (app: App) => {
    if (!isElectron) {
        return;
    }
    ipcSend(Constants.SIYUAN_CMD, {
        cmd: "unregisterGlobalShortcut",
        accelerator: window.siyuan.config.keymap.general.toggleWin.custom
    });
    app.plugins.forEach(plugin => {
        plugin.commands.forEach(command => {
            if (command.globalCallback) {
                ipcSend(Constants.SIYUAN_CMD, {
                    cmd: "unregisterGlobalShortcut",
                    accelerator: command.customHotkey
                });
            }
        });
    });
};
