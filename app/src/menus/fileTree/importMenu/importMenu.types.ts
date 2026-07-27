/** 用途：桌面文件树完整领域根；使用范围：导入完成后的宿主联合类型；解耦评估：经本子域网关直达抽象声明。 */
import type {FilesDomain} from "./imports";
/** 用途：移动文件树完整领域根；使用范围：导入完成后的宿主联合类型；解耦评估：经本子域网关直达抽象声明。 */
import type {MobileFilesDomain} from "./imports";

/** 文件导入完成后可能需要刷新的完整桌面或移动文件树领域根。 */
export type ImportFileTree = FilesDomain | MobileFilesDomain;

/** 压缩包选择事件提交所需的完整一次性上下文。 */
export interface ArchiveImportSubmission {
    input: HTMLInputElement;
    notebookId: string;
    pathString: string;
    id: string;
    endpoint: string;
}
