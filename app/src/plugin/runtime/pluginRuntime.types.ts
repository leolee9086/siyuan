/** Plugin 实例调用的完整宿主生命周期能力。 */
export interface IPluginRuntime<TApplication, TPlugin> {
    reloadData: (application: TApplication, plugin: TPlugin) => void;
    addDock: (plugin: TPlugin) => void;
}
