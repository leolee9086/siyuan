// 一次性诊断探针：验证 Electron 主进程 net.fetch 到回环 HTTPS 是否受系统代理影响。
// 运行方式：electron net-fetch-probe.js
const {app, net} = require("electron");

app.whenReady().then(async () => {
    const url = "https://127.0.0.1:6806/api/system/getNetwork";
    const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve("timeout"), ms));
    const start = Date.now();
    try {
        const result = await Promise.race([
            net.fetch(url, {method: "POST"}).then(async (response) => {
                const text = await response.text();
                return {ok: response.ok, status: response.status, body: text.slice(0, 200)};
            }),
            timeout(8000),
        ]);
        console.log(`net.fetch result [${Date.now() - start}ms]:`, JSON.stringify(result));
    } catch (error) {
        console.log(`net.fetch rejected [${Date.now() - start}ms]:`, error.message);
    }
    app.exit(0);
});
