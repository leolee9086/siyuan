/**
 * Cronjob.ts - 定时任务管理侧边栏面板
 * 
 * 显示所有已注册的定时任务，支持启用/禁用、立即执行、查看日志等操作
 */

import { Model } from "../Model";
import { Tab } from "../Tab";
import type { AppFacade } from "../../app/AppFacade.types";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { showMessage } from "../../dialog/message";
import { fetchSyncPost } from "../../util/network/fetch";
import {
    列出所有任务,
    启用任务,
    禁用任务,
    立即执行,
    获取日志
} from "../../util/network/cronjobApi";
import type { 任务运行时信息 } from "../../util/network/types";
import { 生成面板HTML, 生成任务列表HTML } from "./cronjob.util";
import { setWindowInterval, clearWindowInterval } from "./dock.environment";
import { openFileById } from "../../editor/utils.openFileById";

/**
 * 初始化界面结构
 * @param element - 面板容器元素
 */
function 初始化界面(element: HTMLElement) {
    element.classList.add("fn__flex-column", "cronjob-panel");
    element.innerHTML = 生成面板HTML();
}

/**
 * 渲染任务列表
 * @param element - 面板容器元素
 * @param tasks - 任务列表数据
 */
function 渲染列表(element: HTMLElement, tasks: 任务运行时信息[]) {
    const listContainer = element.querySelector(".cronjob-list");
    if (!listContainer) {
        return;
    }

    if (tasks.length === 0) {
        listContainer.innerHTML = `
            <div class="b3-list--empty">
                暂无定时任务
                <br><br>
                <small>在文档右键菜单中选择「注册为定时任务」添加</small>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = 生成任务列表HTML(tasks);
}

/**
 * 处理图标点击事件
 * @param cronjob - Cronjob 实例
 * @param type - 图标类型
 */
function 处理图标点击(cronjob: Cronjob, type: string | null) {
    if (type === "min") {
        getDockByType("cronjob")?.toggleModel("cronjob", false, true);
        return;
    }
    if (type === "refresh") {
        cronjob.update();
    }
}

/**
 * 导入任务日志到子文档
 * @param docId 任务文档ID
 */
const 导入任务日志 = async (docId: string) => {
    // 1. 获取文档信息
    const docInfoRes = await fetchSyncPost("/api/block/getDocInfo", { id: docId });
    if (docInfoRes.code !== 0) {
        showMessage("获取文档信息失败: " + docInfoRes.msg);
        return;
    }
    const { notebook, path: parentPath } = docInfoRes.data;

    // 2. 获取日志
    const logs = await 获取日志(docId, 100);
    if (!logs || logs.length === 0) {
        showMessage("暂无日志可导入");
        return;
    }

    // 3. 构建 Markdown
    let md = "## 任务执行日志\n\n";
    md += `> 生成时间: ${new Date().toLocaleString()}\n\n`;
    md += "| 时间 | 级别 | 信息 |\n|---|---|---|\n";

    for (const log of logs) {
        const timeStr = new Date(log.timestamp * 1000).toLocaleString();
        // 简单的转义处理，防止 markdown 格式错乱
        const safeMsg = log.message.replace(/\|/g, "\\|");
        md += `| ${timeStr} | ${log.level} | ${safeMsg} |\n`;
    }

    // 4. 创建子文档
    const newFileName = `Log-${new Date().getTime()}`;
    const newPath = parentPath.replace(/\.sy$/, "") + "/" + newFileName + ".sy";

    const createRes = await fetchSyncPost("/api/filetree/createDocWithMd", {
        notebook,
        path: newPath,
        markdown: md,
        parentID: docId
    });

    if (createRes.code === 0) {
        showMessage("日志已导入到子文档");
        return;
    }
    showMessage("导入失败: " + createRes.msg);
};

/**
 * 任务操作处理映射表
 */
const 动作处理器: Record<string, (cronjob: Cronjob, docId: string) => Promise<void>> = {
    /**
     * 切换任务启用/禁用状态
     * @param cronjob 面板实例
     * @param docId 文档ID
     */
    toggle: async (cronjob, docId) => {
        const task = cronjob.tasks.find(t => t.docId === docId);
        const isRunning = task?.status === "running";
        const success = isRunning
            ? await 禁用任务(docId)
            : await 启用任务(docId);
        if (success) {
            showMessage(isRunning ? "任务已停止" : "任务已启动");
        }
    },
    /**
     * 立即执行一次任务
     * @param cronjob 面板实例
     * @param docId 文档ID
     */
    run: async (cronjob, docId) => {
        const success = await 立即执行(docId);
        if (success) {
            showMessage("任务已开始执行");
        }
    },
    /**
     * 查看并导入日志
     * @param cronjob 面板实例
     * @param docId 文档ID
     */
    logs: async (cronjob, docId) => {
        await 导入任务日志(docId);
    },
    /**
     * 打开定义文档
     * @param cronjob 面板实例
     * @param docId 文档ID
     */
    open: async (cronjob, docId) => {
        openFileById({ app: cronjob.app, id: docId });
    }
};

/**
 * 处理任务具体操作
 * @param cronjob - Cronjob 实例
 * @param docId - 文档 ID
 * @param action - 动作名称
 */
async function 处理任务操作(cronjob: Cronjob, docId: string, action: string) {
    try {
        const processor = 动作处理器[action];
        if (!processor) {
            return;
        }
        await processor(cronjob, docId);
        // 刷新列表
        await cronjob.update();
    } catch (e) {
        console.error("任务操作失败:", e);
        showMessage("操作失败");
    }
}

/**
 * 处理面板点击事件
 * @param cronjob - Cronjob 实例
 * @param event - 鼠标事件
 */
function 处理点击(cronjob: Cronjob, event: MouseEvent) {
    setPanelFocus(cronjob.element);

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    // 处理图标按钮点击
    const iconElement = hasClosestByClassName(target, "block__icon");
    if (iconElement && cronjob.element.contains(iconElement)) {
        处理图标点击(cronjob, iconElement.getAttribute("data-type"));
        return;
    }

    // 处理操作按钮点击
    const actionButton = hasClosestByClassName(target, "cronjob-action");
    if (actionButton) {
        const docId = actionButton.getAttribute("data-doc-id");
        const action = actionButton.getAttribute("data-action");
        if (docId && action) {
            处理任务操作(cronjob, docId, action);
        }
    }
}

/**
 * 定时任务侧边栏面板
 */
export class Cronjob extends Model<AppFacade, Tab> {
    /** 面板根元素 */
    public element: HTMLElement;
    /** 任务列表数据 */
    public tasks: 任务运行时信息[] = [];
    /** 自动刷新定时器 */
    public refreshTimer: number | null = null;

    /**
     * 构造函数
     * @param app - AppFacade 实例
     * @param tab - Tab 实例
     */
    constructor(app: AppFacade, tab: Tab) {
        super({
            app,
            id: tab.id,
            /**
             * 监听后端消息回调
             * @param data 消息数据
             */
            msgCallback: (data) => {
                if (data && (data.cmd === "cronjobUpdate" || data.cmd === "cronjobStatus")) {
                    this.update();
                }
            }
        });
        this.element = tab.panelElement;
        初始化界面(this.element);

        this.element.addEventListener("click", (event) => {
            if (event instanceof MouseEvent) {
                处理点击(this, event);
            }
        });

        this.update();

        // 每 30 秒刷新一次
        this.refreshTimer = setWindowInterval(() => {
            this.update();
        }, 30000);
    }

    /**
     * 刷新任务列表
     */
    public async update() {
        const refreshIcon = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        if (refreshIcon?.classList.contains("fn__rotate")) {
            return; // 避免重复刷新
        }

        refreshIcon?.classList.add("fn__rotate");

        try {
            this.tasks = await 列出所有任务();
            渲染列表(this.element, this.tasks);
        } catch (e) {
            console.error("获取任务列表失败:", e);
        } finally {
            refreshIcon?.classList.remove("fn__rotate");
        }
    }

    /**
     * 销毁面板
     */
    public destroy() {
        if (this.refreshTimer) {
            clearWindowInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}
