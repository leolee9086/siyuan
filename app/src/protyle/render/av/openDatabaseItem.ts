import {getDatabaseItemNavigator} from "./openDatabaseItem.port";
import {queueAVLocateRequest} from "./locate/activation/activation";

import type {AppFacade} from "../../../app/AppFacade.types";
import type {IDatabaseItemOpenData, IDatabaseItemOpenOptions} from "./openDatabaseItem.types";

export type {IDatabaseItemOpenData, IDatabaseItemOpenOptions} from "./openDatabaseItem.types";

export const openDatabaseItem = async (app: AppFacade, data: IDatabaseItemOpenData, options?: IDatabaseItemOpenOptions) => {
    if (!data.databaseBlockID || !data.itemID) {
        return false;
    }
    queueAVLocateRequest(data.databaseBlockID, {
        itemID: data.itemID,
        viewID: data.viewID,
        groupID: data.groupID,
    });
    const result = getDatabaseItemNavigator()(app, data, options);
    return await result;
};
