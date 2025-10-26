// Generated API client for group ui
export class UiApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').UiReloadAttributeViewParams} UiReloadAttributeViewParams
 * @typedef {import('./index.d.ts').UiReloadAttributeViewResponse} UiReloadAttributeViewResponse
 * 重新加载指定的属性视图。通常在属性视图的结构或数据发生变化后调用，以刷新显示。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {UiReloadAttributeViewParams} params - Request parameters.
 * @returns {Promise<UiReloadAttributeViewResponse>}
 */
  reloadAttributeView(params) {
    return this.fetcher('POST', '/api/ui/reloadAttributeView', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').UiReloadFiletreeResponse} UiReloadFiletreeResponse
 * 重新加载文件树。当文档结构发生变化（如创建、删除、移动文档或笔记本）后，调用此接口以刷新文件树显示。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<UiReloadFiletreeResponse>}
 */
  reloadFiletree() {
    return this.fetcher('POST', '/api/ui/reloadFiletree', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').UiReloadProtyleParams} UiReloadProtyleParams
 * @typedef {import('./index.d.ts').UiReloadProtyleResponse} UiReloadProtyleResponse
 * 重新加载指定的 Protyle 编辑器实例。通常在编辑器内容或状态在后端被修改后调用，以刷新前端显示。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {UiReloadProtyleParams} params - Request parameters.
 * @returns {Promise<UiReloadProtyleResponse>}
 */
  reloadProtyle(params) {
    return this.fetcher('POST', '/api/ui/reloadProtyle', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').UiReloadTagResponse} UiReloadTagResponse
 * 重新加载标签列表。当标签被创建、删除、重命名或引用发生变化后，调用此接口以刷新标签面板的显示。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<UiReloadTagResponse>}
 */
  reloadTag() {
    return this.fetcher('POST', '/api/ui/reloadTag', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').UiReloadUIResponse} UiReloadUIResponse
 * 触发整个用户界面的重新加载。这是一个比较重的操作，通常在发生可能影响全局UI状态的重大变更后使用，或者作为一种通用的刷新手段。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<UiReloadUIResponse>}
 */
  reloadUI() {
    return this.fetcher('POST', '/api/ui/reloadUI', {}, true);
  }

}
