const assert = require("node:assert/strict");
const test = require("node:test");
const createWebpackConfigs = require("../webpack.config");

test("Development builds expose explicit continuous and one-shot lifecycles", () => {
    const continuous = createWebpackConfigs({}, {mode: "development"});
    const oneShot = createWebpackConfigs({oneShot: true}, {mode: "development"});
    const production = createWebpackConfigs({}, {mode: "production"});

    assert.equal(continuous.every((config) => config.watch === true), true);
    assert.equal(oneShot.every((config) => config.watch === false), true);
    assert.equal(production.every((config) => config.watch === false), true);
    assert.deepEqual(
        oneShot.map((config) => config.name),
        continuous.map((config) => config.name),
    );
});

test("Module library entry files keep the stable names used by standalone bootstraps", () => {
    const development = createWebpackConfigs({oneShot: true}, {mode: "development"});
    const production = createWebpackConfigs({}, {mode: "production"});
    const developmentProtyle = development.find((config) => config.name === "protyle-app");
    const productionProtyle = production.find((config) => config.name === "protyle-app");
    const developmentAgent = development.find((config) => config.name === "agent-app");

    assert.equal(developmentProtyle.output.filename({chunk: {name: "protyle"}}), "[name].js");
    assert.equal(productionProtyle.output.filename({chunk: {name: "protyle"}}), "[name].js");
    assert.equal(developmentProtyle.output.chunkFilename, "[name].js");
    assert.equal(productionProtyle.output.chunkFilename, "[name].[contenthash].js");
    assert.equal(developmentAgent.output.filename({chunk: {name: "agent-panel"}}), "agent-panel.js");
});
