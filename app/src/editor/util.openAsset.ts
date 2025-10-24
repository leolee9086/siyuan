import { App } from "..";
import { Constants } from "../constants";
import { pathPosix } from "../util/pathName";
import { openFile } from "./util";


export const openAsset = (app: App, assetPath: string, page: number | string, position?: string) => {
    const suffix = pathPosix().extname(assetPath).split("?")[0];
    if (!Constants.SIYUAN_ASSETS_EXTS.includes(suffix)) {
        return;
    }
    openFile({
        app,
        assetPath,
        page,
        position,
        removeCurrentTab: true
    });
};
