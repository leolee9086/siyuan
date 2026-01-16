export function kMeans(data, k,算法) {
    // Initialize cluster centers and assignments
    let centers = [];
    for (let i = 0; i < k; i++) {
        const idx = (Math.floor(Math.random() * (data.length / 4))) * 4;
        centers.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
    let assignments = new Array(data.length / 4).fill(-1);
    let _counts =[]
    let changed = true;
    while (changed) {
        changed = false;
        // Assign pixels to the nearest cluster center
        for (let i = 0; i < data.length; i += 4) {
            const pixel = [data[i], data[i + 1], data[i + 2]];
            let minDistance = Infinity;
            let assignedCluster = 0;
            for (let j = 0; j < k; j++) {
              const distance =算法(pixel, centers[j]);
              //    const distance =(euclideanDistance(pixel, centers[j]));
                if (distance < minDistance) {
                    minDistance = distance;
                    assignedCluster = j;
                }
            }
            if (assignments[i / 4] !== assignedCluster) {
                assignments[i / 4] = assignedCluster;
                changed = true;
            }
        }
        // Update cluster centers
        let sums = Array(k).fill(null).map(() => [0, 0, 0]);
        let counts = Array(k).fill(0);
        for (let i = 0; i < assignments.length; i++) {
            const clusterIdx = assignments[i];
            sums[clusterIdx][0] += data[i * 4];
            sums[clusterIdx][1] += data[i * 4 + 1];
            sums[clusterIdx][2] += data[i * 4 + 2];
            counts[clusterIdx]++;
        }
        for (let i = 0; i < k; i++) {
            if (counts[i] > 0) {
                centers[i] = sums[i].map(x => x / counts[i]);
                _counts[i]=counts[i]
            }
        }
    }

    const sortedCenters = centers.map((center, index) => ({
        color: center,
        count: _counts[index]
    })).sort((a, b) => b.count - a.count).map(item => item.color);
    return { centers: sortedCenters, assignments };
}
/*export function kMeans(data, k, distanceFunction) {
    // Initialize cluster centers using k-means++ algorithm
    let centers = [];
    const firstIdx = Math.floor(Math.random() * (data.length / 4)) * 4;
    centers.push([data[firstIdx], data[firstIdx + 1], data[firstIdx + 2]]);

    for (let i = 1; i < k; i++) {
        let distances = new Array(data.length / 4).fill(Infinity);
        for (let j = 0; j < data.length; j += 4) {
            const pixel = [data[j], data[j + 1], data[j + 2]];
            for (let c = 0; c < centers.length; c++) {
                const d = distanceFunction(pixel, centers[c]);
                distances[j / 4] = Math.min(distances[j / 4], d);
            }
        }
        let totalDistance = distances.reduce((acc, val) => acc + val, 0);
        let r = Math.random() * totalDistance;
        let sum = 0;
        for (let j = 0; j < distances.length; j++) {
            sum += distances[j];
            if (sum >= r) {
                centers.push([data[j * 4], data[j * 4 + 1], data[j * 4 + 2]]);
                break;
            }
        }
    }

    let assignments = new Array(data.length / 4).fill(-1);
    let _counts = [];
    let changed = true;
    while (changed) {
        changed = false;
        // Assign pixels to the nearest cluster center
        for (let i = 0; i < data.length; i += 4) {
            const pixel = [data[i], data[i + 1], data[i + 2]];
            let minDistance = Infinity;
            let assignedCluster = 0;
            for (let j = 0; j < k; j++) {
                const distance = distanceFunction(pixel, centers[j]);
                if (distance < minDistance) {
                    minDistance = distance;
                    assignedCluster = j;
                }
            }
            if (assignments[i / 4] !== assignedCluster) {
                assignments[i / 4] = assignedCluster;
                changed = true;
            }
        }
        // Update cluster centers
        let sums = Array(k).fill(null).map(() => [0, 0, 0]);
        let counts = Array(k).fill(0);
        for (let i = 0; i < assignments.length; i++) {
            const clusterIdx = assignments[i];
            sums[clusterIdx][0] += data[i * 4];
            sums[clusterIdx][1] += data[i * 4 + 1];
            sums[clusterIdx][2] += data[i * 4 + 2];
            counts[clusterIdx]++;
        }
        for (let i = 0; i < k; i++) {
            if (counts[i] > 0) {
                centers[i] = sums[i].map(x => x / counts[i]);
                _counts[i] = counts[i];
            } else {
                // Handle the case where a cluster has no points assigned to it
                centers[i] = null;
            }
        }
    }

    // Remove any invalid centers before sorting
    const validCenters = centers.filter(center => center !== null);
    const sortedCenters = validCenters.map((center, index) => ({
        color: center,
        count: _counts[index]
    })).sort((a, b) => b.count - a.count).map(item => item.color);
    return { centers: sortedCenters, assignments };
}*/