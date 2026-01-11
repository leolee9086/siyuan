import kernelApi from './polyfills/kernelApi.js';
import "./utils/pluginSymbolRegistry.js"
kernelApi.sql=kernelApi.SQL
let pluginName  = import.meta.resolve('../').split('/').filter(item=>{return item}).pop()

let clientApiInstance=globalThis[Symbol.for(`clientApi`)]
export {clientApiInstance as clientApi}
export { plugin} from './utils/pluginSymbolRegistry.js'
export {kernelApi as kernelApi}
export const Constants={
    Port_Internal_Path:'/data/public/sacPorts.json'
}