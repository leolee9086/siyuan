/** 思源核心标准响应结构。 */
export interface IStandaloneKernelResponse<T> {
    code: number;
    data: T;
    msg: string;
}
