import { Model } from "../layout/Model";
import type {LayoutTab} from "../layout/layout.types";
import { Constants } from "../constants";
import { setPanelFocus } from "../layout/utils/setPanelFocus";
// @ts-ignore
import { onPageNumberChanged } from "./pdf/app";
import { fetchPost } from "../util/network/fetch";
import type {AppFacade} from "../app/AppFacade.types";
import {clearObjectBlockGraphs} from "../layout/dock/obg/clearObjectBlockGraphs";
import {getAllModels} from "../layout/getAll";
import { render } from "./image";
import { createVueComponentLoader } from "../util/vue/mount";
import PDFviewer from "../components/PDFviewer.vue";
import {getDisplayName} from "../util/file/path/operations";
import { isMobile } from "../platform";
import {assetModelBrand} from "./asset.types";
import {resolveAssetURL} from "./assetUrl";
/** 上游 v3.8.0 引入的 PDF 加载状态机：登记超时与观察者，在模型销毁后拦截迟到回调。 */
import {PdfLoadState} from "./pdfLoadState";

/** 资产页签模型的具体运行时实现。 */
export class Asset extends Model<AppFacade, LayoutTab> {
  public override parent: LayoutTab;

  public get [assetModelBrand]() {
    return "Asset" as const;
  }

  public path: string;
  public element: HTMLElement;
  private pdfId: number | string | undefined;
  private pdfPage: number | undefined;
  public pdfObject: any;
  /** 上游引入的加载状态机：销毁后拒绝迟到的渲染与取号回调。 */
  private pdfLoadState = new PdfLoadState();

  public get windowHashIdentity() {
    return {kind: "asset-path", value: this.path} as const;
  }

  constructor(options: { app: AppFacade, tab: LayoutTab, path: string, page?: number | string }) {
    super({app: options.app});
    this.parent = options.tab;
    if (window.siyuan.config?.fileTree?.openFilesUseCurrentTab) {
      options.tab.headElement.classList.add("item--unupdate");
    }
    this.element = options.tab.panelElement;
    this.path = options.path;
    this.pdfId = options.page;
    this.element.addEventListener("click", (event) => {
      clearObjectBlockGraphs(getAllModels());
      if (this.element.parentElement?.parentElement) {
        setPanelFocus(this.element.parentElement.parentElement);
      }
      for (const item of this.app.plugins) {
        item.eventBus.emit("click-pdf", { event });
      }
    });
    if (typeof this.pdfId === "string") {
      this.getPdfId(() => {
        this.render();
      });
      return;
    }
    if (typeof this.pdfId === "number") {
      this.pdfPage = this.pdfId;
    }
    this.render();
  }

  public update(path: string) {
    this.path = path;
    this.parent.updateTitle(getDisplayName(path));
    this.render(false);
  }

  private getPdfId(cb: () => void) {
    fetchPost("/api/asset/getFileAnnotation", {
      path: this.path + ".sya",
    }, (response) => {
      // 上游修复：页签销毁后直接丢弃迟到的批注定位响应。
      if (this.pdfLoadState.isDestroyed) {
        return;
      }
      if (response.code === 1) {
        cb();
        return;
      }
      const config = JSON.parse(response.data.data);
      const pdfId = this.pdfId;
      if (typeof pdfId === "undefined" || !config[pdfId]) {
        this.pdfPage = undefined;
        cb();
        return;
      }
      this.pdfPage = config[pdfId].page ? config[pdfId].page + 1 : config[pdfId].pages[0].index + 1;
      cb();
    });
  }

  public goToPage(pdfId: string | number) {
    if (typeof pdfId === "undefined" || pdfId === null) {
      return;
    }
    this.pdfId = pdfId;
    if (isMobile) {
      return;
    }
    if (typeof pdfId === "string") {
      this.getPdfId(() => {
        if (this.pdfPage) {
          onPageNumberChanged({ value: this.pdfPage, pdfInstance: this.pdfObject, id: this.pdfId });
        }
      });
      return;
    }
    if (typeof pdfId === "number" && !isNaN(pdfId)) {
      onPageNumberChanged({ value: this.pdfId, pdfInstance: this.pdfObject });
    }
  }

  private render(isInit = true) {
    // 上游修复：模型已销毁时不再渲染；重渲染前清理未决的加载任务。
    if (this.pdfLoadState.isDestroyed) {
      return;
    }
    this.pdfLoadState.clearPending();
    // 上游修复：非首次渲染（切换资产）时先安全关闭旧 PDF 实例，避免加载任务泄漏。
    if (!isInit && this.pdfObject) {
      void this.pdfObject.close();
      this.pdfObject = undefined;
    }
    const type = this.path.substr(this.path.lastIndexOf(".")).toLowerCase().split("?")[0] || "";
    const assetURL = resolveAssetURL(this.path);
    // 音视频路径会进入 HTML 属性，必须在模板拼接前转义以防止属性闭合。
    const escapedAssetURL = Lute.EscapeHTMLStr(assetURL);
    if (Constants.SIYUAN_ASSETS_IMAGE.includes(type)) {
      render(this.element, assetURL);
      return;
    }
    if (Constants.SIYUAN_ASSETS_AUDIO.includes(type)) {
      this.element.innerHTML = `<div class="asset"><audio controls="controls" src="${escapedAssetURL}"></audio></div>`;
      return;
    }
    if (Constants.SIYUAN_ASSETS_VIDEO.includes(type)) {
      this.element.innerHTML = `<div class="asset"><video controls="controls" src="${escapedAssetURL}"></video></div>`;
      return;
    }
    if (type === ".pdf" && !isMobile) {
      createVueComponentLoader(
        this.element,
        {
          components: { PDFviewer },
          data: { controller: this },
          template: "<PDFviewer :controller=\"controller\" />"
        }
      );
    }
  }

  /** 上游新增：页签关闭时终止未完成的 PDF 加载任务并释放 viewer 资源。 */
  public destroy() {
    if (!this.pdfLoadState.destroy()) {
      return;
    }
    if (this.pdfObject?.pdfLoadingTask) {
      void this.pdfObject.pdfLoadingTask.destroy();
    }
    this.pdfObject = undefined;
  }
}
