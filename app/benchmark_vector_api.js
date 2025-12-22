// 向量数据库 E2E 召回率与性能基准测试脚本
// 请在思源笔记的开发者工具控制台 (Console) 中运行此脚本

async function runVectorBenchmark() {
    console.clear();
    console.log("🚀 开始向量数据库 E2E 基准测试...");

    // ================= 配置参数 =================
    const CONFIG = {
        collection: "benchmark_recall_test1",
        dimension: 1024,          // 向量维度
        numItems: 10000,         // 测试数据量
        numQueries: 20,         // 查询次数
        topK: 10,               // Recall@K
        batchSize: 100,         // 批量插入大小
        modelName: "bench-model"
    };

    let report = `📊 向量数据库测试报告\n========================\n配置: ${JSON.stringify(CONFIG, null, 2)}\n\n`;
    function log(msg) {
        console.log(msg);
        report += msg + "\n";
    }

    // ================= 辅助函数 =================

    // 生成随机向量
    function randomVector(dim) {
        let vec = new Array(dim);
        let norm = 0;
        for (let i = 0; i < dim; i++) {
            vec[i] = Math.random() * 2 - 1; // [-1, 1]
            norm += vec[i] * vec[i];
        }
        // 归一化
        norm = Math.sqrt(norm);
        for (let i = 0; i < dim; i++) {
            vec[i] /= norm;
        }
        return vec;
    }

    // 计算余弦距离 (1 - CosineSimilarity)
    // 假设向量已归一化，则 CosineDistance = 1 - dot(a, b)
    // 或者直接使用 dot product 比较大小 (dot越大越相似，距离越小)
    function cosineSimilarity(a, b) {
        let dot = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
        }
        return dot;
    }

    // API 请求封装
    async function request(path, data) {
        try {
            const start = performance.now();
            const response = await fetch(path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await response.json();
            const duration = performance.now() - start;
            if (json.code !== 0) throw new Error(json.msg || "Unknown error");
            return { data: json.data, duration };
        } catch (e) {
            console.error("Request failed:", path, e);
            throw e;
        }
    }

    try {
        // 1. 准备环境 (重建 Collection)
        log(`🔹 正在初始化 Collection: ${CONFIG.collection}...`);
        // 先尝试删除清理旧数据（目前API只有delete keys，直接重建比较快）
        // 但 build 接口如果已存在会覆盖吗？看代码 verify_vector_api.js 逻辑好像是 getOrCreate 或者是 reset? 
        // 实际上 build 仅仅是 NewCollection，内存中覆盖。

        await request("/api/vector/collections/build", {
            collection_name: CONFIG.collection,
            dimension: CONFIG.dimension,
        });

        // 2. 生成并插入数据
        log(`🔹 生成并插入 ${CONFIG.numItems} 条数据...`);
        const dataset = []; // 本地保存一份用于 Ground Truth 计算

        for (let i = 0; i < CONFIG.numItems; i++) {
            dataset.push({
                id: `item-${i}`,
                vector: randomVector(CONFIG.dimension)
            });
        }

        let totalInsertTime = 0;
        for (let i = 0; i < CONFIG.numItems; i += CONFIG.batchSize) {
            const chunk = dataset.slice(i, i + CONFIG.batchSize).map(item => ({
                id: item.id,
                meta: { index: i },
                vector: { [CONFIG.modelName]: item.vector }
            }));

            const res = await request("/api/vector/add", {
                collection_name: CONFIG.collection,
                vectors: chunk
            });
            totalInsertTime += res.duration;
            console.log(`   已插入 ${Math.min(i + CONFIG.batchSize, CONFIG.numItems)} / ${CONFIG.numItems}`);
        }
        log(`✅ 数据插入完成，总耗时: ${totalInsertTime.toFixed(2)}ms`);

        // 等待一下确保后台（虽说是同步）处理完毕
        await new Promise(r => setTimeout(r, 1000));

        // 3. 执行召回率测试
        log(`🔹 开始执行 ${CONFIG.numQueries} 次查询测试 Recall@${CONFIG.topK}...`);

        let totalRecall = 0;
        let totalQueryTime = 0;

        for (let q = 0; q < CONFIG.numQueries; q++) {
            const queryVec = randomVector(CONFIG.dimension);

            // 3.1 计算 Ground Truth (暴力搜索)
            // 计算所有 items 与 queryVec 的相似度
            // 这是一个 O(N) 操作，前端 JS 跑 1000-10000 条还可以
            const groundTruth = dataset.map(item => ({
                id: item.id,
                score: cosineSimilarity(queryVec, item.vector)
            }));

            // 按相似度降序排序
            groundTruth.sort((a, b) => b.score - a.score);

            // 取前 K 个 ID
            const topKIds = new Set(groundTruth.slice(0, CONFIG.topK).map(x => x.id));

            // 3.2 调用 API 查询 (HNSW)
            const queryRes = await request("/api/vector/query", {
                collection_name: CONFIG.collection,
                vector_name: CONFIG.modelName,
                vector: queryVec,
                limit: CONFIG.topK,
                ef_search: 100 // 可选参数，控制搜索精度
            });
            totalQueryTime += queryRes.duration;

            // 3.3 计算本次查询的召回率
            const returnedIds = queryRes.data ? queryRes.data.map(x => x.id) : [];
            let hits = 0;
            returnedIds.forEach(id => {
                if (topKIds.has(id)) hits++;
            });

            const recall = hits / CONFIG.topK;
            totalRecall += recall;

            // console.log(`   Query ${q+1}: Recall=${recall.toFixed(2)}, Digits=${hits}/${CONFIG.topK}`);
        }

        const avgRecall = (totalRecall / CONFIG.numQueries * 100).toFixed(2);
        const avgLatency = (totalQueryTime / CONFIG.numQueries).toFixed(2);

        log(`\n🏁 测试完成!`);
        log(`----------------------------------------`);
        log(`🎯 平均召回率 (Recall@${CONFIG.topK}): ${avgRecall}%`);
        log(`⏱️ 平均查询耗时: ${avgLatency} ms`);
        log(`----------------------------------------`);

        if (avgRecall < 80) {
            log("⚠️ 召回率偏低 (<80%)，可能需要增加 ef_search 或检查索引构建参数。");
        } else {
            log("✅ 召回率表现良好。");
        }

        alert(`测试完成！\n平均召回率: ${avgRecall}%\n平均查询耗时: ${avgLatency}ms`);
        return report;

    } catch (e) {
        log(`❌ 测试过程中发生错误: ${e.message}`);
        alert(`测试失败: ${e.message}`);
        console.error(e);
        return report;
    }
}

// 运行
await runVectorBenchmark();
