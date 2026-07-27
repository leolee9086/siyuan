/** 用途：导入菜单 IPC 常量；使用范围：本地路径选择；解耦评估：经子域网关直达常量所有者。 */
import {Constants} from "./imports";
/** 用途：提交导入请求；使用范围：全部导入项；解耦评估：经子域网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：查询桌面文件树 Dock；使用范围：导入成功刷新；解耦评估：经子域网关直达无状态查询。 */
import {getDockByType} from "./imports";
/** 用途：读取已初始化配置；使用范围：只读门禁和本地路径选择；解耦评估：经子域网关直达严格环境入口。 */
import {getSiyuanConfig} from "./imports";
/** 用途：读取当前全局菜单；使用范围：追加和关闭导入菜单；解耦评估：经子域网关直达严格环境入口。 */
import {getSiyuanGlobalMenusMenu} from "./imports";
/** 用途：打开本地路径选择器；使用范围：Electron Markdown 导入；解耦评估：经子域网关直达 IPC 适配器。 */
import {ipcInvoke} from "./imports";
/** 用途：判别 Electron 宿主；使用范围：追加本地路径导入项；解耦评估：经子域网关直达平台声明。 */
import {isElectron} from "./imports";
/** 用途：收窄桌面文件树；使用范围：导入成功刷新；解耦评估：依赖完整领域根而非 class。 */
import {isFilesDomain} from "./imports";
/** 用途：判别移动宿主；使用范围：选择当前文件树；解耦评估：经子域网关直达平台函数。 */
import {isMobile} from "./imports";
/** 用途：收窄移动文件树；使用范围：移动导入成功刷新；解耦评估：依赖完整领域根而非 class。 */
import {isMobileFilesDomain} from "./imports";
/** 用途：构造导入菜单项；使用范围：导入菜单组合根；解耦评估：经子域网关直达唯一实现。 */
import {MenuItem} from "./imports";
/** 用途：读取导入菜单语言；使用范围：导入、文档和文件夹标签；解耦评估：经子域网关直达只读环境。 */
import {siyuanI18n} from "./imports";
/** 用途：压缩包提交上下文；使用范围：文件输入事件；解耦评估：纯数据类型不加载实现。 */
import type {ArchiveImportSubmission} from "./importMenu.types";
/** 用途：完整桌面/移动文件树联合；使用范围：导入成功刷新；解耦评估：纯领域类型不加载实现。 */
import type {ImportFileTree} from "./importMenu.types";

/** 取得当前宿主的完整文件树并验证厂牌；在每次导入完成准备刷新时调用。 @显式返回类型原因：固定桌面与移动完整领域根的联合边界，禁止推导泄露宿主具体类型。 */
const getImportFileTree = (): ImportFileTree => {
    const model = isMobile
        ? window.siyuan.mobile?.docks?.file
        : getDockByType("file")?.data.file;
    if (!model || typeof model !== "object") {
        throw new Error("File tree import requires an initialized file tree model");
    }
    if (isFilesDomain(model) || isMobileFilesDomain(model)) {
        return model;
    }
    throw new Error("File tree import received an incompatible file tree model");
};

/** 展开刚导入的目标路径并关闭菜单；后端确认导入成功后调用。 */
const reloadImportedPath = (notebookId: string, pathString: string) => {
    const files = getImportFileTree();
    const liElement = files.element.querySelector(`[data-path="${pathString}"]`);
    if (!liElement) {
        throw new Error(`Imported file tree path is missing: ${pathString}`);
    }
    const toggleElement = liElement.querySelector(".b3-list-item__toggle");
    if (!toggleElement) {
        throw new Error(`Imported file tree path has no toggle: ${pathString}`);
    }
    toggleElement.classList.remove("fn__hidden");
    files.getLeaf(liElement, notebookId, true);
    getSiyuanGlobalMenusMenu().remove();
};

/** 创建 Electron 本地 Markdown 文档或目录导入项；构建桌面导入子菜单时调用。 */
const createStandardMarkdownImport = (options: {
    notebookId: string;
    pathString: string;
    label: string;
    isDoc?: boolean;
}) => ({
    id: options.isDoc ? "importMarkdownDoc" : "importMarkdownFolder",
    icon: options.isDoc ? "iconMarkdown" : "iconFolder",
    label: options.label,
    /** 打开系统路径选择器并保持原后端导入、成功刷新时序。 */
    click: async () => {
        const filters = options.isDoc ? [{name: "Markdown", extensions: ["md", "markdown"]}] : [];
        const localPath = await ipcInvoke<{filePaths: string[]}>(Constants.SIYUAN_GET, {
            cmd: "showOpenDialog",
            defaultPath: getSiyuanConfig().system.homeDir,
            filters,
            properties: [options.isDoc ? "openFile" : "openDirectory"],
        });
        if (localPath.filePaths.length === 0) {
            return;
        }
        fetchPost("/api/import/importStdMd", {
            notebook: options.notebookId,
            localPath: localPath.filePaths[0],
            toPath: options.pathString,
        }, () => reloadImportedPath(options.notebookId, options.pathString));
    },
});

/** 提交已选择的压缩包，并在后端确认成功后刷新同一路径。 */
const submitSelectedArchive = (submission: ArchiveImportSubmission) => {
    const file = submission.input.files?.[0];
    if (!file) {
        throw new Error(`Archive import file is missing: ${submission.id}`);
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("notebook", submission.notebookId);
    formData.append("toPath", submission.pathString);
    fetchPost(submission.endpoint, formData, () => reloadImportedPath(submission.notebookId, submission.pathString));
};

/** 创建浏览器文件输入驱动的压缩包导入项；构建所有宿主导入子菜单时调用。 */
const createArchiveImport = (
    notebookId: string,
    pathString: string,
    options: {id: string; icon: string; label: string; endpoint: string},
) => ({
    id: options.id,
    icon: options.icon,
    label: `${options.label}<input class="b3-form__upload" type="file" accept="application/zip">`,
    /** 在菜单项挂载后绑定唯一文件输入，并保持原 FormData 字段与请求时序。 */
    bind: (element: HTMLElement) => {
        const input = element.querySelector<HTMLInputElement>(".b3-form__upload");
        if (!input) {
            throw new Error(`Archive import input is missing: ${options.id}`);
        }
        /** 每次 change 读取当前 input 文件，不缓存可变文件状态。 */
        input.addEventListener("change", () => submitSelectedArchive({
            input, notebookId, pathString, id: options.id, endpoint: options.endpoint,
        }));
    },
});

/** 按原固定顺序生成压缩包入口，并只在 Electron 追加本地 Markdown 入口。 */
const createImportSubmenu = (notebookId: string, pathString: string) => [
    createArchiveImport(notebookId, pathString, {
        id: "importSiYuanZip",
        icon: "iconSiYuan",
        label: "SiYuan .sy.zip",
        endpoint: "/api/import/importSY",
    }),
    createArchiveImport(notebookId, pathString, {
        id: "importMarkdownZip",
        icon: "iconMarkdown",
        label: "Markdown .zip",
        endpoint: "/api/import/importZipMd",
    }),
    ...(isElectron ? [
        createStandardMarkdownImport({
            notebookId,
            pathString,
            label: `Markdown ${siyuanI18n.doc}`,
            isDoc: true,
        }),
        createStandardMarkdownImport({
            notebookId,
            pathString,
            label: `Markdown ${siyuanI18n.folder}`,
        }),
    ] : []),
];

/** @同步豁免: UI构建 */
/** 将完整导入菜单追加到当前文件树菜单。 */
export const appendFileTreeImportMenu = (notebookId: string, pathString: string) => {
    if (getSiyuanConfig().readonly) {
        return;
    }
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "import",
        icon: "iconDownload",
        label: siyuanI18n.import,
        submenu: createImportSubmenu(notebookId, pathString),
    }).element);
};
