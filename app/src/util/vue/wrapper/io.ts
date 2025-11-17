import { VueComponent } from "./types";

export const getComponentIo = (component: VueComponent) => {
    console.log(component)
    const name = (component as any)?.name
    const props = (component as any)?.props;
    const emits = (component as any)?.emits;
    return {
        name, props, emits
    }
}