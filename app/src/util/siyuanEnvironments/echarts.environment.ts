/**
 * ECharts 全局访问封装
 * 提供对 echarts 实例的安全访问
 */

/**
 * 获取全局 echarts 对象
 */
export function getEcharts() {
    const echartsGlobal = window.echarts;
    return echartsGlobal || null;
}

/**
 * 根据实例ID获取echarts图表实例
 */
export function getEchartsInstanceById(instanceId: string | null) {
    if (!instanceId) {
        return null;
    }
    const echarts = getEcharts();
    if (!echarts) {
        return null;
    }
    return echarts.getInstanceById(instanceId);
}

/**
 * 初始化 echarts 实例
 */
export function initEcharts(
    dom: HTMLElement | null,
    theme?: string,
    opts?: { width?: number | undefined }
): IEchartsInstance | null {
    const echarts = getEcharts();
    if (!echarts || !dom) {
        return null;
    }
    const options: { width: number } = {
        width: opts?.width ?? dom.clientWidth
    };
    return echarts.init(dom, theme, options);
}

/**
 * 销毁 echarts 实例
 */
export function disposeEcharts(dom: Element | null): void {
    const echarts = getEcharts();
    if (!echarts || !dom) {
        return;
    }
    echarts.dispose(dom);
}
