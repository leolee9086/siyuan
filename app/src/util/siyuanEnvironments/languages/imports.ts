/** 用途：构造带版本的语言资源地址。使用范围：languages/environment.ts；解耦评估：直达资源协议常量，不经过其它网关。 */
import {Constants} from "../../../constants";
/** 用途：异步读取静态语言资源。使用范围：languages/environment.ts；解耦评估：直达网络实现，当前子目录规则要求由同层网关暴露。 */
import {fetchGetAsync} from "../../network/fetch";

/** 导出资源版本常量供语言地址构造使用。 */
export {Constants};
/** 导出 Promise 式 GET 能力供语言初始化链等待。 */
export {fetchGetAsync};
