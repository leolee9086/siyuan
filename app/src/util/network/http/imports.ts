/** 用途：认证失效后重载当前页面。使用范围：http/response.ts 的 401 分支；解耦评估：直达可替换的 location 环境实现，不经过上层 network/imports.ts 二次转发。 */
import {reloadLocation} from "../../siyuanEnvironments/windowLocation.environment";

/** 导出页面重载环境能力供 HTTP 响应解码使用。 */
export {reloadLocation};
