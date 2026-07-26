/** 用途：带本地路径文件协议；使用范围：目录输入收窄；解耦评估：同域纯类型直达声明。 */
import type {UploadFileWithPath} from "./transport.types";

/** 判断浏览器文件是否携带桌面目录上传所需的字符串路径。 */
export const isUploadFileWithPath = (file: File): file is UploadFileWithPath =>
    "path" in file && typeof file.path === "string";
