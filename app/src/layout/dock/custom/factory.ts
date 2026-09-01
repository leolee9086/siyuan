import type {AppFacade} from "../../../app/AppFacade.types";
import type {TabModelFactoryContext} from "../../../registry/TabRegistry.types";
import {Tab} from "../../Tab";
import {setPanelFocus} from "../../utils/setPanelFocus";
import {clearObjectBlockGraphs} from "../obg/clearObjectBlockGraphs";
import {Custom} from "./Custom";

export const createCustomTabModel = <TData>(context: TabModelFactoryContext<AppFacade, Tab, TData>) => {
    const custom = new Custom<TData>({
        app: context.app,
        tab: context.tab,
        type: context.type,
        data: context.data,
        init: context.registration.init,
        ...(context.registration.destroy ? {destroy: context.registration.destroy} : {}),
        ...(context.registration.beforeDestroy ? {beforeDestroy: context.registration.beforeDestroy} : {}),
        ...(context.registration.resize ? {resize: context.registration.resize} : {}),
        ...(context.registration.update ? {update: context.registration.update} : {}),
    });
    const parentElement = custom.element.parentElement?.parentElement;
    if (parentElement) {
        custom.element.addEventListener("click", () => {
            clearObjectBlockGraphs();
            setPanelFocus(parentElement);
        });
    }
    return custom;
};
