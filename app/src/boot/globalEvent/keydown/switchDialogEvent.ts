import { App } from "../../..";
import { openCard } from "../../../card/openCard";
import { getAllTabs } from "../../../layout/getAll";
import { getDockByType } from "../../../layout/tabUtil";
import { switchDialog } from "../keydown";

export const switchDialogEvent = (app: App, event: MouseEvent) => {
    event.preventDefault();
    let target = event.target as HTMLElement;
    while (target !== switchDialog.element) {
        if (target.classList.contains("b3-list-item")) {
            const currentType = target.getAttribute("data-type");
            if (currentType) {
                if (currentType === "riffCard") {
                    openCard(app);
                } else {
                    getDockByType(currentType).toggleModel(currentType, true);
                }
            } else {
                const currentId = target.getAttribute("data-id");
                getAllTabs().find(item => {
                    if (item.id === currentId) {
                        item.parent.switchTab(item.headElement);
                        item.parent.showHeading();
                        return true;
                    }
                });
            }
            switchDialog.destroy();
            switchDialog = undefined;
            break;
        }
        target = target.parentElement;
    }
};
