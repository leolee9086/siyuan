/**
 * ECharts 全局访问封装
 * 提供对 echarts 实例的安全访问
 */

interface IEchartsGlobal {
    getInstanceById: (id: string) => { resize: () => void } | null;
}

/**
 * 获取全局 echarts 对象
 */
export function getEcharts(): IEchartsGlobal | null {
    const echartsGlobal = (globalThis as unknown as { echarts?: IEchartsGlobal }).echarts;
    return echartsGlobal || null;
}

/**
 * 根据实例ID获取echarts图表实例
 */
export function getEchartsInstanceById(instanceId: string): { resize: () => void } | null {
    const echarts = getEcharts();
    if (!echarts) {
        return null;
    }
    return echarts.getInstanceById(instanceId);
}
