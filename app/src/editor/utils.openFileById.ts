import { App } from "..";
import { showMessage } from "../dialog/message";
import { Model } from "../layout/Model";
import { fetchSyncPost } from "../util/fetch";
import { openFile } from "./util";


export const openFileById = async (options: {
    app: App;
    id: string;
    position?: string;
    mode?: TEditorMode;
    action?: TProtyleAction[];
    keepCursor?: boolean;
    zoomIn?: boolean;
    removeCurrentTab?: boolean;
    openNewTab?: boolean;
    afterOpen?: (model: Model) => void;
}) => {
    const response = await fetchSyncPost("/api/block/getBlockInfo", { id: options.id });
    if (response.code === -1) {
        return;
    }
    if (response.code === 3) {
        showMessage(response.msg);
        return;
    }

    return openFile({
        app: options.app,
        fileName: response.data.rootTitle,
        rootIcon: response.data.rootIcon,
        rootID: response.data.rootID,
        id: options.id,
        position: options.position,
        mode: options.mode,
        action: options.action,
        zoomIn: options.zoomIn,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        afterOpen: options.afterOpen,
        openNewTab: options.openNewTab
    });
};
