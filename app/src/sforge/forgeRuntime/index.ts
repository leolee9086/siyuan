import {getSForgeState, setSForgeState} from "../../config/sforge.global";
import {FORGE_RUNTIME_CONTROL} from "../../config/sforge.symbols";
import {ForgeRuntimeController} from "./controller";
import {ForgeRuntimeControlView} from "./view";

export class ForgeRuntimeControl {
    public readonly controller: ForgeRuntimeController;
    private readonly view: ForgeRuntimeControlView;

    constructor(controller = new ForgeRuntimeController()) {
        this.controller = controller;
        this.view = new ForgeRuntimeControlView(controller);
    }

    public async start(): Promise<void> {
        this.view.connect();
        try {
            await this.controller.start();
        } catch (error) {
            console.error("[Forge Runtime] 控制面初始化失败", error);
        }
    }

    public open(): void {
        this.view.openControlDialog();
    }

    public destroy(): void {
        this.view.destroy();
        this.controller.destroy();
    }
}

export const initForgeRuntimeControl = async (): Promise<ForgeRuntimeControl> => {
    const existing = getSForgeState(FORGE_RUNTIME_CONTROL);
    if (existing) {
        return existing;
    }
    const control = new ForgeRuntimeControl();
    setSForgeState(FORGE_RUNTIME_CONTROL, control);
    await control.start();
    return control;
};
