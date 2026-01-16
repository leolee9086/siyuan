import kernelApi from './polyfills/kernelApi.js';
let pluginName  = import.meta.resolve('../').split('/').filter(item=>{return item}).pop()
const plugin = siyuan.ws.app.plugins.find(
    plugin => {
        return plugin.name ===pluginName
    }
)
let clientApiInstance=globalThis[Symbol.for(`clientApi`)]
export {clientApiInstance as clientApi}
export {plugin as pluginInstance}
export {plugin as plugin}
export {kernelApi as kernelApi}
export const Constants = {
   devPath:siyuan.config.system.workspaceDir+`/data/plugins/${plugin.name}/source/UI/components`,
}