/**
 * 嵌入管理 Dock 主组件
 * 复用 CustomLists 模式实现
 */

import { Tab } from "../../Tab";
import { Model } from "../../Model";
import { App } from "../../../index";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getDockByType } from "../../tabUtil";
import { embeddingText } from "../../../util/lib/embedding/transformer";
import type { IEmbeddingDataset, IDatasetStatus, IEmbeddingProgress } from "./embeddingDock.types";
import {
    获取数据集列表,
    获取待嵌入块,
    获取已嵌入块,
    推送块嵌入,
    添加数据集,
    删除数据集,
    更新数据集,
} from "./embeddingDock.api";

// 默认模型配置
const 默认模型名 = "leolee9086/text2vec-base-chinese";
const 默认模型维度 = 768;

/**
 * 注入样式补丁
 */
const injectStyles = () => {
    const styleId = "embedding-dock-styles";
    if (document.getElementById(styleId)) {
        return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
        .sy__embedding-dock {
            background-color: var(--b3-theme-surface);
        }
        .embedding-dock__list {
            padding: 8px 0;
        }
        .embedding-dock__item {
            padding: 12px 16px;
            border-bottom: 1px solid var(--b3-border-color);
            transition: background-color 0.2s;
            position: relative;
        }
        .embedding-dock__item:hover {
            background-color: var(--b3-list-hover);
        }
        .embedding-dock__item-header {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .embedding-dock__item-icon {
            width: 14px;
            height: 14px;
            margin-right: 8px;
            color: var(--b3-theme-primary);
        }
        .embedding-dock__item-title {
            font-weight: bold;
            flex: 1;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--b3-theme-on-surface);
        }
        .embedding-dock__item-type {
            font-size: 11px;
            color: var(--b3-theme-on-surface-light);
            background: var(--b3-border-color);
            padding: 1px 4px;
            border-radius: 3px;
            margin-left: 8px;
        }
        .embedding-dock__item-info {
            font-size: 12px;
            color: var(--b3-theme-on-surface-light);
            margin-bottom: 8px;
            padding-left: 22px;
            line-height: 1.4;
        }
        .embedding-dock__item-sql {
            font-family: var(--b3-font-family-code);
            opacity: 0.8;
            font-size: 11px;
            word-break: break-all;
        }
        .embedding-dock__item-status {
            font-size: 12px;
            margin-bottom: 12px;
            padding-left: 22px;
            color: var(--b3-theme-on-surface-light);
        }
        .embedding-dock__item-actions {
            display: flex;
            gap: 8px;
            padding-left: 22px;
        }
        .embedding-dock__empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            color: var(--b3-theme-on-surface-light);
            text-align: center;
        }
        .embedding-dock__empty-icon {
            width: 48px;
            height: 48px;
            margin-bottom: 16px;
            opacity: 0.2;
        }
        .embedding-dock__progress {
            padding: 16px;
            border-top: 1px solid var(--b3-border-color);
            background: var(--b3-theme-surface);
            box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
        }
        .embedding-dock__progress-bar-container {
            height: 6px;
            background: var(--b3-border-color);
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        .embedding-dock__progress-bar {
            height: 100%;
            background: var(--b3-theme-primary);
            width: 0%;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* Split Button 样式 */
        .embedding-dock__split-btn {
            display: inline-flex;
            position: relative;
        }
        .embedding-dock__split-btn-main {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            border-right: none;
        }
        .embedding-dock__split-btn-dropdown {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            padding: 4px 6px;
            min-width: 0;
        }
        .embedding-dock__split-btn-dropdown svg {
            width: 10px;
            height: 10px;
        }
        .embedding-dock__dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            z-index: 100;
            min-width: 120px;
            background: var(--b3-theme-surface);
            border: 1px solid var(--b3-border-color);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 4px 0;
            display: none;
        }
        .embedding-dock__dropdown-menu.show {
            display: block;
        }
        .embedding-dock__dropdown-item {
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .embedding-dock__dropdown-item:hover {
            background: var(--b3-list-hover);
        }
        .embedding-dock__dropdown-item.active {
            color: var(--b3-theme-primary);
        }
        .embedding-dock__dropdown-item svg {
            width: 12px;
            height: 12px;
        }
    `;
    document.head.appendChild(style);
};

const truncateSQL = (sql: string): string => {
    if (sql.length <= 50) {
        return sql;
    }
    return sql.substring(0, 50) + "...";
};

const renderDatasetItemHTML = (dataset: IEmbeddingDataset, status?: IDatasetStatus): string => {
    const typeIcon = dataset.type === "dynamic" ? "iconSQL" : "iconList";
    const typeLabel = dataset.type === "dynamic" ? "动态" : "静态";

    const pendingText = status
        ? `✅ ${status.embedded} 已嵌入 / ⏳ ${status.pending} 待处理`
        : "加载中...";

    // 当前嵌入模式
    const embedMode = dataset.embedMode || "incremental";
    const embedLabel = embedMode === "full" ? "全量嵌入" : "增量嵌入";

    return `
        <div class="embedding-dock__item" data-id="${dataset.id}" data-embed-mode="${embedMode}">
            <div class="embedding-dock__item-header">
                <svg class="embedding-dock__item-icon"><use xlink:href="#${typeIcon}"></use></svg>
                <span class="embedding-dock__item-title">${dataset.title}</span>
                <span class="embedding-dock__item-type">${typeLabel}</span>
            </div>
            <div class="embedding-dock__item-info">
                ${dataset.type === "dynamic"
            ? `<div class="embedding-dock__item-sql">${truncateSQL(String(dataset.target))}</div>`
            : `<div class="embedding-dock__item-count">手动添加 ${Array.isArray(dataset.target) ? dataset.target.length : 0} 个块</div>`
        }
            </div>
            <div class="embedding-dock__item-status">${pendingText}</div>
            <div class="embedding-dock__item-actions">
                ${dataset.type === "dynamic"
            ? "<button class=\"b3-button b3-button--small b3-button--outline\" data-action=\"refresh-scope\">刷新范围</button>"
            : ""
        }
                <div class="embedding-dock__split-btn">
                    <button class="b3-button b3-button--small b3-button--outline embedding-dock__split-btn-main" data-action="embed">${embedLabel}</button>
                    <button class="b3-button b3-button--small b3-button--outline embedding-dock__split-btn-dropdown" data-action="embed-dropdown">
                        <svg><use xlink:href="#iconDown"></use></svg>
                    </button>
                    <div class="embedding-dock__dropdown-menu">
                        <div class="embedding-dock__dropdown-item${embedMode === "incremental" ? " active" : ""}" data-mode="incremental">
                            <svg><use xlink:href="#iconAdd"></use></svg>
                            增量嵌入
                        </div>
                        <div class="embedding-dock__dropdown-item${embedMode === "full" ? " active" : ""}" data-mode="full">
                            <svg><use xlink:href="#iconRefresh"></use></svg>
                            全量重新嵌入
                        </div>
                    </div>
                </div>
                <button class="b3-button b3-button--small b3-button--text" data-action="config">配置</button>
                <button class="b3-button b3-button--small b3-button--text" data-action="delete">删除</button>
            </div>
        </div>
    `;
};

export class EmbeddingDock extends Model<App, Tab> {
    public element: HTMLElement;
    private datasets: IEmbeddingDataset[] = [];
    private statuses: Map<string, IDatasetStatus> = new Map();
    private progress: IEmbeddingProgress = { total: 0, current: 0, status: "idle" };

    constructor(app: App, tab: Tab) {
        super({
            app,
            id: tab.id,
            msgCallback: (data) => {
                this.onMessage(data);
            }
        });
        this.element = tab.panelElement;
        this.element.classList.add("fn__flex-column", "file-tree", "sy__embedding-dock");

        // 注入样式补丁
        injectStyles();

        this.initLayout();
        this.loadDatasets();
        this.bindEvents();
    }

    private initLayout() {
        this.element.innerHTML = `<div class="block__icons">
    <div class="block__logo">
        <svg class="block__logoicon"><use xlink:href="#iconDatabase"></use></svg>嵌入管理
    </div>
    <span class="fn__flex-1 fn__space"></span>
    <span data-type="add" class="block__icon ariaLabel" aria-label="新建数据集">
        <svg><use xlink:href="#iconAdd"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="refresh" class="block__icon ariaLabel" aria-label="${siyuanI18n.refresh}">
        <svg><use xlink:href="#iconRefresh"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="min" class="block__icon ariaLabel" aria-label="${siyuanI18n.min}">
        <svg><use xlink:href="#iconMin"></use></svg>
    </span>
</div>
<div class="fn__flex-1" style="overflow: auto;">
    <div class="embedding-dock__list"></div>
</div>
<div class="embedding-dock__progress fn__none">
    <div class="embedding-dock__progress-bar-container">
        <div class="embedding-dock__progress-bar"></div>
    </div>
    <div class="embedding-dock__progress-text fn__flex-center" style="font-size: 12px;"></div>
</div>`;
    }

    private loadDatasets() {
        this.datasets = 获取数据集列表();
        this.renderList();
        this.loadStatuses();
    }

    private async loadStatuses() {
        for (const dataset of this.datasets) {
            try {
                // 如果是静态数据集，传 ID 名单；动态数据集后续可传 SQL
                const ids = dataset.type === "static" ? (Array.isArray(dataset.target) ? dataset.target : [dataset.target]) : undefined;

                // 并行获取待嵌入和已嵌入数量
                const [pendingResult, embeddedResult] = await Promise.all([
                    获取待嵌入块(dataset.id, dataset.model, 1, false, ids),
                    获取已嵌入块(dataset.id, dataset.model, 1, 0),
                ]);

                this.statuses.set(dataset.id, {
                    embedded: embeddedResult.total,
                    pending: pendingResult.total,
                    lastRefresh: Date.now(),
                });
                this.renderList();
            } catch (error) {
                console.error(`加载数据集 ${dataset.id} 状态失败:`, error);
            }
        }
    }

    private renderList() {
        const listElement = this.element.querySelector(".embedding-dock__list");
        if (!listElement) {
            return;
        }

        if (this.datasets.length === 0) {
            listElement.innerHTML = `
                <div class="embedding-dock__empty">
                    <div class="embedding-dock__empty-icon">
                        <svg><use xlink:href="#iconDatabase"></use></svg>
                    </div>
                    <div class="embedding-dock__empty-text">暂无数据集</div>
                    <button class="b3-button" data-type="add-first" style="margin-top: 16px;">
                        <svg><use xlink:href="#iconAdd"></use></svg>
                        新建数据集
                    </button>
                </div>
            `;
            return;
        }

        listElement.innerHTML = this.datasets.map(dataset => {
            return renderDatasetItemHTML(dataset, this.statuses.get(dataset.id));
        }).join("");
    }

    private bindEvents() {
        // @内联回调
        this.element.addEventListener("click", (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // 关闭所有下拉菜单（点击其他地方时）
            const allDropdowns = this.element.querySelectorAll(".embedding-dock__dropdown-menu.show");
            allDropdowns.forEach(menu => {
                if (!menu.contains(target) && !target.closest(".embedding-dock__split-btn-dropdown")) {
                    menu.classList.remove("show");
                }
            });

            // 头部按钮
            const iconButton = target.closest(".block__icon") as HTMLElement;
            if (iconButton) {
                const type = iconButton.getAttribute("data-type");
                this.handleIconClick(type);
                return;
            }

            // 下拉菜单项点击
            const dropdownItem = target.closest(".embedding-dock__dropdown-item") as HTMLElement;
            if (dropdownItem) {
                const mode = dropdownItem.getAttribute("data-mode");
                const item = dropdownItem.closest(".embedding-dock__item") as HTMLElement;
                const datasetId = item?.getAttribute("data-id");
                if (datasetId && mode) {
                    this.handleModeChange(datasetId, mode as "incremental" | "full");
                }
                // 关闭下拉菜单
                const menu = dropdownItem.closest(".embedding-dock__dropdown-menu");
                if (menu) {
                    menu.classList.remove("show");
                }
                return;
            }

            // 数据集操作按钮
            const actionButton = target.closest("[data-action]") as HTMLElement;
            if (actionButton) {
                const action = actionButton.getAttribute("data-action");

                // 特殊处理：下拉按钮切换菜单显示
                if (action === "embed-dropdown") {
                    const splitBtn = actionButton.closest(".embedding-dock__split-btn");
                    const menu = splitBtn?.querySelector(".embedding-dock__dropdown-menu");
                    if (menu) {
                        // 关闭其他打开的菜单
                        allDropdowns.forEach(m => {
                            if (m !== menu) {
                                m.classList.remove("show");
                            }
                        });
                        menu.classList.toggle("show");
                    }
                    return;
                }

                const item = actionButton.closest(".embedding-dock__item") as HTMLElement;
                const datasetId = item?.getAttribute("data-id");
                if (datasetId && action) {
                    this.handleAction(datasetId, action);
                }
                return;
            }

            // 空状态添加按钮
            if (target.closest("[data-type='add-first']")) {
                this.showAddDialog();
            }
        });
    }

    private handleIconClick(type: string | null) {
        if (type === "add") {
            this.showAddDialog();
        } else if (type === "refresh") {
            this.loadDatasets();
        } else if (type === "min") {
            getDockByType("embedding_dock")?.toggleModel("embedding_dock", false, true);
        }
    }

    private handleAction(datasetId: string, action: string) {
        const dataset = this.datasets.find(d => d.id === datasetId);
        if (!dataset) {
            return;
        }

        if (action === "embed") {
            this.startEmbedding(dataset);
        } else if (action === "refresh-scope") {
            this.refreshScope(dataset);
        } else if (action === "config") {
            console.log("配置数据集:", dataset);
        } else if (action === "delete") {
            if (confirm(`确定删除数据集 "${dataset.title}" 吗？`)) {
                删除数据集(dataset.id);
                this.loadDatasets();
            }
        }
    }

    private handleModeChange(datasetId: string, mode: "incremental" | "full") {
        const dataset = this.datasets.find(d => d.id === datasetId);
        if (!dataset) {
            return;
        }

        // 更新数据集的嵌入模式
        dataset.embedMode = mode;
        更新数据集(datasetId, { embedMode: mode });

        // 重新渲染列表以更新按钮文字
        this.renderList();

        // 立即执行嵌入
        this.startEmbedding(dataset);
    }

    private showAddDialog() {
        const id = `ds_${Date.now().toString(36)}`;
        const newDataset: IEmbeddingDataset = {
            id,
            title: `数据集 ${this.datasets.length + 1}`,
            icon: "iconDatabase",
            type: "static",
            target: [],
            model: 默认模型名,
            scopeVersion: 1,
        };
        添加数据集(newDataset);
        this.loadDatasets();
    }

    private async refreshScope(dataset: IEmbeddingDataset) {
        try {
            const result = await 获取待嵌入块(dataset.id, dataset.model, 100, true);
            this.statuses.set(dataset.id, {
                embedded: 0,
                pending: result.total,
                lastRefresh: Date.now(),
            });
            this.renderList();
        } catch (error) {
            console.error("刷新范围失败:", error);
        }
    }

    private async startEmbedding(dataset: IEmbeddingDataset) {
        if (this.progress.status === "embedding") {
            return;
        }

        this.progress = { total: 0, current: 0, status: "embedding" };
        this.updateProgressUI();

        try {
            // 根据嵌入模式决定是否强制重新嵌入
            const force = dataset.embedMode === "full";
            const modeLabel = force ? "全量重新嵌入" : "增量嵌入";
            console.log(`[Embedding] 开始处理数据集: ${dataset.title} (${dataset.id}), 模式: ${modeLabel}`);

            const ids = dataset.type === "static" ? (Array.isArray(dataset.target) ? dataset.target : [dataset.target]) : undefined;
            const { pending, total } = await 获取待嵌入块(dataset.id, dataset.model, 1000, false, ids, force);


            if (total === 0 || pending.length === 0) {
                console.log("[Embedding] 没有待嵌入的数据块");
                this.progress = { total: 0, current: 0, status: "done" };
                this.updateProgressUI();
                const textEl = this.element.querySelector(".embedding-dock__progress-text");
                if (textEl) {
                    textEl.textContent = "∅ 没有待嵌入的数据块";
                }
                setTimeout(() => {
                    this.element.querySelector(".embedding-dock__progress")?.classList.add("fn__none");
                }, 3000);
                return;
            }

            this.progress.total = total;
            this.updateProgressUI();

            const batchSize = 10;
            for (let i = 0; i < pending.length; i += batchSize) {
                const batch = pending.slice(i, i + batchSize);
                const vectors: { id: string; vector: number[] }[] = [];

                const progressText = `[TransformerJS] 正在计算向量 (${i + 1}-${Math.min(i + batchSize, pending.length)}/${total})...`;
                console.log(progressText);
                const textEl = this.element.querySelector(".embedding-dock__progress-text");
                if (textEl) {
                    textEl.textContent = progressText;
                }

                for (const block of batch) {
                    try {
                        const vector = await embeddingText(block.content);
                        vectors.push({
                            id: block.id,
                            vector: Array.from(vector),
                        });
                    } catch (e) {
                        console.error(`[Embedding] 向量化失败 ID: ${block.id}`, e);
                        // 单块失败继续处理其它块
                    }
                }

                if (vectors.length > 0) {
                    const pushText = `[Embedding] 正在推送至向量库 (${vectors.length} 个)...`;
                    console.log(pushText);
                    if (textEl) {
                        textEl.textContent = pushText;
                    }
                    await 推送块嵌入(vectors, dataset.model, 默认模型维度, dataset.id);
                    this.progress.current += vectors.length;
                    this.updateProgressUI();
                }
            }

            this.progress.status = "done";
            this.updateProgressUI();

            setTimeout(() => {
                const progressEl = this.element.querySelector(".embedding-dock__progress");
                progressEl?.classList.add("fn__none");
                this.loadDatasets();
            }, 2000);

        } catch (error) {
            console.error("[Embedding] 处理过程中发生错误:", error);
            this.progress.status = "error";
            this.progress.error = (error as Error).message || "未知错误";
            this.updateProgressUI();
        }
    }

    private updateProgressUI() {
        const progressEl = this.element.querySelector(".embedding-dock__progress");
        const barEl = this.element.querySelector(".embedding-dock__progress-bar") as HTMLElement;
        const textEl = this.element.querySelector(".embedding-dock__progress-text");

        if (!progressEl || !barEl || !textEl) {
            return;
        }

        progressEl.classList.remove("fn__none");

        if (this.progress.total > 0) {
            const percent = Math.round((this.progress.current / this.progress.total) * 100);
            barEl.style.width = `${percent}%`;
        }

        if (this.progress.status === "embedding") {
            textEl.textContent = `正在嵌入... ${this.progress.current}/${this.progress.total}`;
        } else if (this.progress.status === "done") {
            textEl.textContent = "✓ 嵌入完成";
        } else if (this.progress.status === "error") {
            textEl.textContent = `✗ 错误: ${this.progress.error}`;
        }
    }

    private onMessage(data: IWebSocketData) {
        if (data.cmd === "transactions") {
            // TODO: 解析变更
        }
    }
}
