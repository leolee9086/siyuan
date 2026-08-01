/** 用途：读取当前应用标识；使用范围：原生 Agent SSE 默认请求头；解耦评估：只读平台常量是传输适配器的外部依赖，不进入协议解析模块。 */
import {Constants} from "../../../../../constants";

/** 导出平台常量供 SSE 请求适配器使用。 */
export {Constants};
