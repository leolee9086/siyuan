// 跨目录依赖转发
/** 用途：应用常量定义。使用范围：assets 模块使用常量。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../../constants";
/** 导出 Constants，供 assets 模块使用 */
export { Constants };

/** 用途：添加样式到文档的工具函数。使用范围：assets 模块设置代码主题样式。解耦评估：通过 imports.ts 转发。 */
import { addStyle } from "../../protyle/util/addStyle";
/** 导出 addStyle，供 assets 模块使用 */
export { addStyle };

/** 用途：安全读取思源配置。使用范围：assets 模块读取代码主题配置。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanConfig } from "../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig，供 assets 模块使用 */
export { getSiyuanConfig };

/** 用途：同步 POST 请求函数。使用范围：assets 模块上传图片资源。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "../network/fetch";
/** 导出 fetchSyncPost，供 assets 模块使用 */
export { fetchSyncPost };

/** 用途：平台兼容性检测（iOS）。使用范围：assets 模块平台判断。解耦评估：通过 imports.ts 转发。 */
import { isInIOS } from "../../protyle/util/compatibility";
/** 导出 isInIOS，供 assets 模块使用 */
export { isInIOS };
/** 用途：平台兼容性检测（Android）。使用范围：assets 模块平台判断。解耦评估：通过 imports.ts 转发。 */
import { isInAndroid } from "../../protyle/util/compatibility";
/** 导出 isInAndroid，供 assets 模块使用 */
export { isInAndroid };
/** 用途：平台兼容性检测（Harmony）。使用范围：assets 模块平台判断。解耦评估：通过 imports.ts 转发。 */
import { isInHarmony } from "../../protyle/util/compatibility";
/** 导出 isInHarmony，供 assets 模块使用 */
export { isInHarmony };

/** 用途：获取 iOS WebKit window 对象。使用范围：assets 模块访问移动端原生接口。解耦评估：通过 imports.ts 转发。 */
import { getWindowWebkit } from "../siyuanEnvironments/windowNative.environment";
/** 导出 getWindowWebkit，供 assets 模块使用 */
export { getWindowWebkit };
/** 用途：获取 Android window 对象。使用范围：assets 模块访问移动端原生接口。解耦评估：通过 imports.ts 转发。 */
import { getWindowJSAndroid } from "../siyuanEnvironments/windowNative.environment";
/** 导出 getWindowJSAndroid，供 assets 模块使用 */
export { getWindowJSAndroid };
/** 用途：获取 Harmony window 对象。使用范围：assets 模块访问移动端原生接口。解耦评估：通过 imports.ts 转发。 */
import { getWindowJSHarmony } from "../siyuanEnvironments/windowNative.environment";
/** 导出 getWindowJSHarmony，供 assets 模块使用 */
export { getWindowJSHarmony };
