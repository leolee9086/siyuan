/** 用途：应用实例类型。使用范围：openAsset 参数类型。解耦评估：通过 imports.ts 转发。 */
import type { AppFacade } from "./imports";
/** 用途：应用常量，判断资产扩展名。使用范围：openAsset 文件类型检查。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "./imports";
/** 用途：路径处理工具，获取文件扩展名。使用范围：openAsset 解析资产类型。解耦评估：通过 imports.ts 转发。 */
import { pathPosix } from "./imports";
/** 用途：打开文件能力。使用范围：openAsset 执行打开操作；解耦评估：通过 Asset open 子域网关显式依赖 Editor 打开组合根。 */
import {openFile} from "./imports";
/** 用途：资产打开参数。使用范围：公开资产导航命令；解耦评估：纯数据领域类型。 */
import type {AssetOpenOptions} from "./openAsset.types";

/**
 * 打开资产文件（图片/音频/视频/PDF）
 * @作用 根据资产路径打开对应的资产文件页签
 * @意图 统一资产文件打开入口，支持页码跳转和位置定位
 * @调用时机 用户点击资产链接或拖拽资产到编辑器时
 * @同步豁免: 生命周期 — 在用户交互中同步打开资产页签
 */
const openAssetWithOptions = (app: AppFacade, options: AssetOpenOptions, keepCursor = false) => {
    const suffix = pathPosix().extname(options.assetPath).toLowerCase();
    if (!Constants.SIYUAN_ASSETS_EXTS.includes(suffix)) {
        return;
    }
    void openFile({
        app,
        assetPath: options.assetPath,
        page: options.page,
        position: options.position ?? undefined,
        ...(keepCursor ? {keepCursor: true} : {}),
        removeCurrentTab: true,
    });
};

export const openAsset = (app: AppFacade, options: AssetOpenOptions) => {
    openAssetWithOptions(app, options);
};

/** 在后台打开资产并保留当前编辑器光标位置。 */
export const openAssetInBackground = (app: AppFacade, assetPath: string, page: number | string) => {
    openAssetWithOptions(app, {assetPath, page}, true);
};
