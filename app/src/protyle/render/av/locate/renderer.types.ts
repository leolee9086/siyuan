/** AV 根渲染器的生命周期契约。 */
export type TAVLocateRenderer = (
    element: HTMLElement,
    protyle: IProtyle,
    cb?: (data: IAV) => void,
    renderAll?: boolean,
    avData?: IAV,
) => Promise<void>;
