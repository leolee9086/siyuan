/**
 * Cronjob.ts - 定时任务管理侧边栏面板
 * 
 * 显示所有已注册的定时任务，支持启用/禁用、立即执行、查看日志等操作
 */

import { Model } from "../Model";
import { Tab } from "../Tab";
import { App } from "../../index";
import { setPanelFocus } from "../utils/setPanelFocus";
import { getDockByType } from "../tabUtil";
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
import { showMessage } from "../../dialog/message";
import {
    列出所有任务,
    启用任务,
    禁用任务,
    立即执行
} from "../../util/cronjobApi";
import { 任务运行时信息 } from "../../util/cronjob.types";
import { 生成面板HTML, 生成任务列表HTML } from "./cronjob.util";
import { setWindowInterval, clearWindowInterval } from "./dock.environment";

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
 * 任务操作处理映射表
 */
const 动作处理器: Record<string, (cronjob: Cronjob, docId: string) => Promise<void>> = {
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
    run: async (cronjob, docId) => {
        const success = await 立即执行(docId);
        if (success) {
            showMessage("任务已开始执行");
        }
    },
    logs: async () => {
        // TODO: 打开日志对话框
        showMessage("日志功能开发中");
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
        if (processor) {
            await processor(cronjob, docId);
        }
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
export class Cronjob extends Model {
    /** 面板根元素 */
    public element: HTMLElement;
    /** 任务列表数据 */
    public tasks: 任务运行时信息[] = [];
    /** 自动刷新定时器 */
    public refreshTimer: number | null = null;

    /**
     * 构造函数
     * @param app - App 实例
     * @param tab - Tab 实例
     */
    constructor(app: App, tab: Tab) {
        super({
            app,
            id: tab.id,
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

// 英文别名导出
export { Cronjob as CronjobDock };
