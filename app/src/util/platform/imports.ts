// 跨目录依赖转发
/** 用途：安全随机数生成。使用范围：platform 模块生成唯一 ID。解耦评估：通过 imports.ts 转发。 */
import { getRandomValues } from "../siyuanEnvironments/windowStandard.environment";
/** 导出 getRandomValues，供 platform 模块使用 */
export { getRandomValues };

/** 用途：消息提示能力。使用范围：platform 模块显示订阅提示。解耦评估：通过 imports.ts 转发。 */
import { showMessage } from "../../dialog/message";
/** 导出 showMessage，供 platform 模块使用 */
export { showMessage };

/** 用途：获取云服务 URL。使用范围：platform 模块订阅提示链接。解耦评估：通过 imports.ts 转发。 */
import { getCloudURL } from "../../config/util/about";
/** 导出 getCloudURL，供 platform 模块使用 */
export { getCloudURL };

/** 用途：国际化文本。使用范围：platform 模块订阅提示文案。解耦评估：通过 imports.ts 转发。 */
import { siyuanI18n } from "../siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n，供 platform 模块使用 */
export { siyuanI18n };

/** 用途：安全读取用户信息。使用范围：platform 模块订阅检查。解耦评估：通过 imports.ts 转发。 */
import { getSafeSiyuanUser } from "../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSafeSiyuanUser，供 platform 模块使用 */
export { getSafeSiyuanUser };

/** 用途：读取思源配置。使用范围：platform 模块平台判断。解耦评估：通过 imports.ts 转发。 */
import { getSiyuanConfig } from "../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig，供 platform 模块使用 */
export { getSiyuanConfig };
