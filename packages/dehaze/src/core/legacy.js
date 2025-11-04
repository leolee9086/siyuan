// dcpDehaze.js
// 依赖：无（纯原生 API）

function clamp(x, min = 0, max = 255) {
  return Math.max(min, Math.min(max, x));
}

// ---------- 暗通道 ----------
function darkChannel(im, patch = 15) {
  const { data, width, height } = im;
  const out = new Uint8Array(width * height);
  const rad = (patch - 1) >> 1;
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      let minC = 255;
      for (let dy = -rad; dy <= rad; ++dy) {
        for (let dx = -rad; dx <= rad; ++dx) {
          const yy = clamp(y + dy, 0, height - 1);
          const xx = clamp(x + dx, 0, width - 1);
          const p = (yy * width + xx) * 4;
          const v = Math.min(data[p], data[p + 1], data[p + 2]);
          minC = Math.min(minC, v);
        }
      }
      out[y * width + x] = minC;
    }
  }
  return out;
}

// ---------- 全球大气光 ----------
function atmLight(im, dark) {
  const { data, width, height } = im;
  const total = width * height;
  const N = Math.max(Math.floor(total / 1000), 1);
  const arr = Array.from({ length: total }, (_, i) => ({
    idx: i,
    val: dark[i],
  }));
  arr.sort((a, b) => b.val - a.val);
  let A = [0, 0, 0];
  for (let k = 0; k < N; ++k) {
    const p = arr[k].idx * 4;
    A[0] += data[p];
    A[1] += data[p + 1];
    A[2] += data[p + 2];
  }
  A = A.map(v => v / N);
  return A; // [B,G,R]
}

// ---------- 透射率粗估计 ----------
function transmissionEstimate(im, A, patch = 15, omega = 0.95) {
  const { width, height } = im;
  const out = new Float32Array(width * height);
  const { data } = im;
  for (let i = 0; i < width * height; ++i) {
    const p = i * 4;
    const norm = Math.min(
      data[p] / A[0],
      data[p + 1] / A[1],
      data[p + 2] / A[2]
    );
    out[i] = 1 - omega * norm;
  }
  return out;
}

// ---------- Guided Filter ----------
// 单通道灰度引导图，r=半径，eps=正则
function guidedFilter(guide, src, width, height, r = 40, eps = 1e-3) {
  const N = boxFilter(new Float32Array(width * height).fill(1), width, height, r);
  const meanI = boxFilter(guide, width, height, r);
  const meanP = boxFilter(src, width, height, r);
  const corrI = boxFilter(guide.map(v => v * v), width, height, r);
  const corrIP = boxFilter(guide.map((v, i) => v * src[i]), width, height, r);

  const a = new Float32Array(width * height);
  const b = new Float32Array(width * height);
  for (let i = 0; i < width * height; ++i) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    const covIP = corrIP[i] - meanI[i] * meanP[i];
    a[i] = covIP / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxFilter(a, width, height, r);
  const meanB = boxFilter(b, width, height, r);
  return guide.map((v, i) => meanA[i] * v + meanB[i]);
}

function boxFilter(src, width, height, r) {
  const out = new Float32Array(width * height);
  // 1-D horizontal
  for (let y = 0; y < height; ++y) {
    let sum = 0;
    for (let x = 0; x < width + 2 * r; ++x) {
      const pos = x - r;
      const v = pos >= 0 && pos < width ? src[y * width + pos] : 0;
      if (x <= r) sum += v;
      else {
        const old = x - 2 * r - 1 >= 0 ? src[y * width + (x - 2 * r - 1)] : 0;
        sum += v - old;
      }
      if (x >= r) out[y * width + x - r] = sum;
    }
  }
  // 1-D vertical
  const tmp = new Float32Array(width * height);
  for (let x = 0; x < width; ++x) {
    let sum = 0;
    for (let y = 0; y < height + 2 * r; ++y) {
      const pos = y - r;
      const v = pos >= 0 && pos < height ? out[pos * width + x] : 0;
      if (y <= r) sum += v;
      else {
        const old = y - 2 * r - 1 >= 0 ? out[(y - 2 * r - 1) * width + x] : 0;
        sum += v - old;
      }
      if (y >= r) tmp[(y - r) * width + x] = sum;
    }
  }
  // normalize
  const area = (2 * r + 1) ** 2;
  return tmp.map(v => v / area);
}

// ---------- 恢复 ----------
function recover(im, t, A, t0 = 0.1) {
  const { data, width, height } = im;
  const out = new ImageData(width, height);
  for (let i = 0; i < width * height; ++i) {
    const p = i * 4;
    const tc = Math.max(t[i], t0);
    for (let c = 0; c < 3; ++c) {
      out.data[p + c] = clamp((data[p + c] - A[c]) / tc + A[c]);
    }
    out.data[p + 3] = 255;
  }
  return out;
}

// ---------- 主入口 ----------
export function dehaze(img, opts = {}) {
  const {
    patch = 15,
    omega = 0.95,
    t0 = 0.1,
    r = 60,
    eps = 1e-4,
  } = opts;

  // Image → ImageData
  const cvs = document.createElement('canvas');
  [cvs.width, cvs.height] = [img.naturalWidth || img.width, img.naturalHeight || img.height];
  const ctx = cvs.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, cvs.width, cvs.height);

  const dark = darkChannel(im, patch);
  const A = atmLight(im, dark);
  const t = transmissionEstimate(im, A, patch, omega);

  // 灰度引导图
  const gray = new Float32Array(im.width * im.height);
  for (let i = 0; i < im.width * im.height; ++i) {
    const p = i * 4;
    gray[i] = (im.data[p] * 0.299 + im.data[p + 1] * 0.587 + im.data[p + 2] * 0.114) / 255;
  }
  const refined = guidedFilter(gray, t, im.width, im.height, r, eps);
  return recover(im, refined, A, t0);
}