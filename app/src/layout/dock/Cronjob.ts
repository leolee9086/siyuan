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

/**
 * 定时任务侧边栏面板
 */
export class Cronjob extends Model {
    /** 面板根元素 */
    private element: HTMLElement;
    /** 任务列表数据 */
    private tasks: 任务运行时信息[] = [];
    /** 自动刷新定时器 */
    private refreshTimer: number | null = null;

    constructor(app: App, tab: Tab) {
        super({
            app,
            id: tab.id,
            msgCallback: (data) => {
                this._处理消息(data);
            }
        });
        this.element = tab.panelElement;
        this._初始化界面();
        this._绑定事件();
        this.update();
        this._启动自动刷新();
    }

    // ============== 初始化 ==============

    private _初始化界面() {
        this.element.classList.add("fn__flex-column", "cronjob-panel");
        this.element.innerHTML = 生成面板HTML();
    }

    private _启动自动刷新() {
        // 每 30 秒刷新一次
        this.refreshTimer = window.setInterval(() => {
            this.update();
        }, 30000);
    }

    // ============== 消息处理 ==============

    private _处理消息(data: IWebSocketData) {
        if (!data) {
            return;
        }
        // 监听相关事件触发刷新
        if (data.cmd === "cronjobUpdate" || data.cmd === "cronjobStatus") {
            this.update();
        }
    }

    // ============== 事件绑定 ==============

    private _绑定事件() {
        this.element.addEventListener("click", (event) => {
            if (event instanceof MouseEvent) {
                this._处理点击(event);
            }
        });
    }

    private _处理点击(event: MouseEvent) {
        setPanelFocus(this.element);

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        // 处理图标按钮点击
        const iconElement = hasClosestByClassName(target, "block__icon");
        if (iconElement && this.element.contains(iconElement)) {
            this._处理图标点击(iconElement.getAttribute("data-type"));
            return;
        }

        // 处理操作按钮点击
        const actionButton = hasClosestByClassName(target, "cronjob-action");
        if (actionButton) {
            const docId = actionButton.getAttribute("data-doc-id");
            const action = actionButton.getAttribute("data-action");
            if (docId && action) {
                this._处理任务操作(docId, action);
            }
        }
    }

    private _处理图标点击(type: string | null) {
        if (type === "min") {
            getDockByType("cronjob")?.toggleModel("cronjob", false, true);
            return;
        }
        if (type === "refresh") {
            this.update();
        }
    }

    private async _处理任务操作(docId: string, action: string) {
        try {
            switch (action) {
                case "toggle": {
                    const task = this.tasks.find(t => t.docId === docId);
                    const isRunning = task?.status === "running";
                    const success = isRunning
                        ? await 禁用任务(docId)
                        : await 启用任务(docId);
                    if (success) {
                        showMessage(isRunning ? "任务已停止" : "任务已启动");
                    }
                    break;
                }
                case "run": {
                    const success = await 立即执行(docId);
                    if (success) {
                        showMessage("任务已开始执行");
                    }
                    break;
                }
                case "logs":
                    // TODO: 打开日志对话框
                    showMessage("日志功能开发中");
                    break;
            }
            // 刷新列表
            await this.update();
        } catch (e) {
            console.error("任务操作失败:", e);
            showMessage("操作失败");
        }
    }

    // ============== 数据更新 ==============

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
            this._渲染列表();
        } catch (e) {
            console.error("获取任务列表失败:", e);
        } finally {
            refreshIcon?.classList.remove("fn__rotate");
        }
    }

    private _渲染列表() {
        const listContainer = this.element.querySelector(".cronjob-list");
        if (!listContainer) {
            return;
        }

        if (this.tasks.length === 0) {
            listContainer.innerHTML = `
                <div class="b3-list--empty">
                    暂无定时任务
                    <br><br>
                    <small>在文档右键菜单中选择「注册为定时任务」添加</small>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = 生成任务列表HTML(this.tasks);
    }

    // ============== 生命周期 ==============

    /**
     * 销毁面板
     */
    public destroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}

// 英文别名导出
export { Cronjob as CronjobDock };
