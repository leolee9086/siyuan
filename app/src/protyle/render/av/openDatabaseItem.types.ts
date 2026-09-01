/** 数据库条目导航请求的稳定数据契约。 */
export interface IDatabaseItemOpenData {
    databaseBlockID: string;
    notebookID?: string;
    viewID?: string;
    groupID?: string;
    itemID: string;
}

/** 数据库条目导航的布局选项。 */
export interface IDatabaseItemOpenOptions {
    position?: string;
}

/** 宿主提供的数据库条目打开实现。 */
import type {AppFacade} from "../../../app/AppFacade.types";
export type TDatabaseItemNavigator = (
    app: AppFacade,
    data: IDatabaseItemOpenData,
    options?: IDatabaseItemOpenOptions,
) => Promise<boolean> | boolean;
