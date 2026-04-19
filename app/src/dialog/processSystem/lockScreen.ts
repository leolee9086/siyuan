import { fetchPost } from "../../card/imports";
import { exportLayout } from "../../layout/layout-serialization";
import { App, isMobile } from "../../plugin/imports";
import { saveScroll } from "../../protyle/scroll/saveScroll";


export const lockScreen = async (app: App) => {
    if (window.siyuan.config.readonly || window.siyuan.isPublish) {
        return;
    }
    app.plugins.forEach(item => {
        item.eventBus.emit("lock-screen");
    });
    if (isMobile()) {
        if (!window.siyuan.mobile.editor) {
            return;
        }
        await saveScroll(window.siyuan.mobile.editor.protyle);
        fetchPost("/api/system/logoutAuth");
        return;
    }
    exportLayout({
        errorExit: false,
        cb() {
            fetchPost("/api/system/logoutAuth");
        }
    });
};

