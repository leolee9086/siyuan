import { Constants } from "../constants";
import { openFileById } from "../editor/utils.openFileById";
import { openMobileFileById } from "../mobile/editor";
import { zoomOut } from "./protyle.zoomOut";


export const enterBack = (protyle: IProtyle, id: string) => {
    if (!protyle.block.showAll) {
        const ids = protyle.path.split("/");
        if (ids.length > 2) {
            /// #if MOBILE
            openMobileFileById(protyle.app, ids[ids.length - 2], [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]);
            /// #else
            openFileById({
                app: protyle.app,
                id: ids[ids.length - 2],
                action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
            });
            /// #endif
        }
    } else {
        zoomOut({ protyle, id: protyle.block.parent2ID, focusId: id });
    }
};


