/* esm.sh - onnxruntime-common@1.23.2 */
var P = new Map
  , A = []
  , J = (t, e, n) => {
    if (e && typeof e.init == "function" && typeof e.createInferenceSessionHandler == "function") {
        let s = P.get(t);
        if (s === void 0)
            P.set(t, {
                backend: e,
                priority: n
            });
        else {
            if (s.priority > n)
                return;
            if (s.priority === n && s.backend !== e)
                throw new Error(`cannot register backend "${t}" using priority ${n}`)
        }
        if (n >= 0) {
            let r = A.indexOf(t);
            r !== -1 && A.splice(r, 1);
            for (let d = 0; d < A.length; d++)
                if (P.get(A[d]).priority <= n) {
                    A.splice(d, 0, t);
                    return
                }
            A.push(t)
        }
        return
    }
    throw new TypeError("not a valid backend")
}
  , Q = async t => {
    let e = P.get(t);
    if (!e)
        return "backend not found.";
    if (e.initialized)
        return e.backend;
    if (e.aborted)
        return e.error;
    {
        let n = !!e.initPromise;
        try {
            return n || (e.initPromise = e.backend.init(t)),
            await e.initPromise,
            e.initialized = !0,
            e.backend
        } catch (s) {
            return n || (e.error = `${s}`,
            e.aborted = !0),
            e.error
        } finally {
            delete e.initPromise
        }
    }
}
  , G = async t => {
    let e = t.executionProviders || [], n = e.map(i => typeof i == "string" ? i : i.name), s = n.length === 0 ? A : n, r, d = [], c = new Set;
    for (let i of s) {
        let o = await Q(i);
        typeof o == "string" ? d.push({
            name: i,
            err: o
        }) : (r || (r = o),
        r === o && c.add(i))
    }
    if (!r)
        throw new Error(`no available backend found. ERR: ${d.map(i => `[${i.name}] ${i.err}`).join(", ")}`);
    for (let {name: i, err: o} of d)
        n.includes(i) && console.warn(`removing requested execution provider "${i}" from session options because it is not available: ${o}`);
    let a = e.filter(i => c.has(typeof i == "string" ? i : i.name));
    return [r, new Proxy(t,{
        get: (i, o) => o === "executionProviders" ? a : Reflect.get(i, o)
    })]
}
;
var _ = "1.23.2";
var F = "warning"
  , h = {
    wasm: {},
    webgl: {},
    webgpu: {},
    versions: {
        common: _
    },
    set logLevel(t) {
        if (t !== void 0) {
            if (typeof t != "string" || ["verbose", "info", "warning", "error", "fatal"].indexOf(t) === -1)
                throw new Error(`Unsupported logging level: ${t}`);
            F = t
        }
    },
    get logLevel() {
        return F
    }
};
Object.defineProperty(h, "logLevel", {
    enumerable: !0
});
var ae = h;
var O = (t, e) => {
    let n = typeof document < "u" ? document.createElement("canvas") : new OffscreenCanvas(1,1);
    n.width = t.dims[3],
    n.height = t.dims[2];
    let s = n.getContext("2d");
    if (s != null) {
        let r, d;
        e?.tensorLayout !== void 0 && e.tensorLayout === "NHWC" ? (r = t.dims[2],
        d = t.dims[3]) : (r = t.dims[3],
        d = t.dims[2]);
        let c = e?.format !== void 0 ? e.format : "RGB", a = e?.norm, i, o;
        a === void 0 || a.mean === void 0 ? i = [255, 255, 255, 255] : typeof a.mean == "number" ? i = [a.mean, a.mean, a.mean, a.mean] : (i = [a.mean[0], a.mean[1], a.mean[2], 0],
        a.mean[3] !== void 0 && (i[3] = a.mean[3])),
        a === void 0 || a.bias === void 0 ? o = [0, 0, 0, 0] : typeof a.bias == "number" ? o = [a.bias, a.bias, a.bias, a.bias] : (o = [a.bias[0], a.bias[1], a.bias[2], 0],
        a.bias[3] !== void 0 && (o[3] = a.bias[3]));
        let f = d * r
          , u = 0
          , l = f
          , p = f * 2
          , m = -1;
        c === "RGBA" ? (u = 0,
        l = f,
        p = f * 2,
        m = f * 3) : c === "RGB" ? (u = 0,
        l = f,
        p = f * 2) : c === "RBG" && (u = 0,
        p = f,
        l = f * 2);
        for (let w = 0; w < d; w++)
            for (let b = 0; b < r; b++) {
                let T = (t.data[u++] - o[0]) * i[0]
                  , E = (t.data[l++] - o[1]) * i[1]
                  , g = (t.data[p++] - o[2]) * i[2]
                  , I = m === -1 ? 255 : (t.data[m++] - o[3]) * i[3];
                s.fillStyle = "rgba(" + T + "," + E + "," + g + "," + I + ")",
                s.fillRect(b, w, 1, 1)
            }
        if ("toDataURL"in n)
            return n.toDataURL();
        throw new Error("toDataURL is not supported")
    } else
        throw new Error("Can not access image data")
}
  , k = (t, e) => {
    let n = typeof document < "u" ? document.createElement("canvas").getContext("2d") : new OffscreenCanvas(1,1).getContext("2d"), s;
    if (n != null) {
        let r, d, c;
        e?.tensorLayout !== void 0 && e.tensorLayout === "NHWC" ? (r = t.dims[2],
        d = t.dims[1],
        c = t.dims[3]) : (r = t.dims[3],
        d = t.dims[2],
        c = t.dims[1]);
        let a = e !== void 0 && e.format !== void 0 ? e.format : "RGB", i = e?.norm, o, f;
        i === void 0 || i.mean === void 0 ? o = [255, 255, 255, 255] : typeof i.mean == "number" ? o = [i.mean, i.mean, i.mean, i.mean] : (o = [i.mean[0], i.mean[1], i.mean[2], 255],
        i.mean[3] !== void 0 && (o[3] = i.mean[3])),
        i === void 0 || i.bias === void 0 ? f = [0, 0, 0, 0] : typeof i.bias == "number" ? f = [i.bias, i.bias, i.bias, i.bias] : (f = [i.bias[0], i.bias[1], i.bias[2], 0],
        i.bias[3] !== void 0 && (f[3] = i.bias[3]));
        let u = d * r;
        if (e !== void 0 && (e.format !== void 0 && c === 4 && e.format !== "RGBA" || c === 3 && e.format !== "RGB" && e.format !== "BGR"))
            throw new Error("Tensor format doesn't match input tensor dims");
        let l = 4
          , p = 0
          , m = 1
          , w = 2
          , b = 3
          , T = 0
          , E = u
          , g = u * 2
          , I = -1;
        a === "RGBA" ? (T = 0,
        E = u,
        g = u * 2,
        I = u * 3) : a === "RGB" ? (T = 0,
        E = u,
        g = u * 2) : a === "RBG" && (T = 0,
        g = u,
        E = u * 2),
        s = n.createImageData(r, d);
        for (let B = 0; B < d * r; p += l,
        m += l,
        w += l,
        b += l,
        B++)
            s.data[p] = (t.data[T++] - f[0]) * o[0],
            s.data[m] = (t.data[E++] - f[1]) * o[1],
            s.data[w] = (t.data[g++] - f[2]) * o[2],
            s.data[b] = I === -1 ? 255 : (t.data[I++] - f[3]) * o[3]
    } else
        throw new Error("Can not access image data");
    return s
}
;
var U = (t, e) => {
    if (t === void 0)
        throw new Error("Image buffer must be defined");
    if (e.height === void 0 || e.width === void 0)
        throw new Error("Image height and width must be defined");
    if (e.tensorLayout === "NHWC")
        throw new Error("NHWC Tensor layout is not supported yet");
    let {height: n, width: s} = e, r = e.norm ?? {
        mean: 255,
        bias: 0
    }, d, c;
    typeof r.mean == "number" ? d = [r.mean, r.mean, r.mean, r.mean] : d = [r.mean[0], r.mean[1], r.mean[2], r.mean[3] ?? 255],
    typeof r.bias == "number" ? c = [r.bias, r.bias, r.bias, r.bias] : c = [r.bias[0], r.bias[1], r.bias[2], r.bias[3] ?? 0];
    let a = e.format !== void 0 ? e.format : "RGBA"
      , i = e.tensorFormat !== void 0 && e.tensorFormat !== void 0 ? e.tensorFormat : "RGB"
      , o = n * s
      , f = i === "RGBA" ? new Float32Array(o * 4) : new Float32Array(o * 3)
      , u = 4
      , l = 0
      , p = 1
      , m = 2
      , w = 3
      , b = 0
      , T = o
      , E = o * 2
      , g = -1;
    a === "RGB" && (u = 3,
    l = 0,
    p = 1,
    m = 2,
    w = -1),
    i === "RGBA" ? g = o * 3 : i === "RBG" ? (b = 0,
    E = o,
    T = o * 2) : i === "BGR" && (E = 0,
    T = o,
    b = o * 2);
    for (let B = 0; B < o; B++,
    l += u,
    m += u,
    p += u,
    w += u)
        f[b++] = (t[l] + c[0]) / d[0],
        f[T++] = (t[p] + c[1]) / d[1],
        f[E++] = (t[m] + c[2]) / d[2],
        g !== -1 && w !== -1 && (f[g++] = (t[w] + c[3]) / d[3]);
    return i === "RGBA" ? new y("float32",f,[1, 4, n, s]) : new y("float32",f,[1, 3, n, s])
}
  , M = async (t, e) => {
    let n = typeof HTMLImageElement < "u" && t instanceof HTMLImageElement, s = typeof ImageData < "u" && t instanceof ImageData, r = typeof ImageBitmap < "u" && t instanceof ImageBitmap, d = typeof t == "string", c, a = e ?? {}, i = () => {
        if (typeof document < "u")
            return document.createElement("canvas");
        if (typeof OffscreenCanvas < "u")
            return new OffscreenCanvas(1,1);
        throw new Error("Canvas is not supported")
    }
    , o = f => typeof HTMLCanvasElement < "u" && f instanceof HTMLCanvasElement || f instanceof OffscreenCanvas ? f.getContext("2d") : null;
    if (n) {
        let f = i();
        f.width = t.width,
        f.height = t.height;
        let u = o(f);
        if (u != null) {
            let l = t.height
              , p = t.width;
            if (e !== void 0 && e.resizedHeight !== void 0 && e.resizedWidth !== void 0 && (l = e.resizedHeight,
            p = e.resizedWidth),
            e !== void 0) {
                if (a = e,
                e.tensorFormat !== void 0)
                    throw new Error("Image input config format must be RGBA for HTMLImageElement");
                a.tensorFormat = "RGBA",
                a.height = l,
                a.width = p
            } else
                a.tensorFormat = "RGBA",
                a.height = l,
                a.width = p;
            u.drawImage(t, 0, 0),
            c = u.getImageData(0, 0, p, l).data
        } else
            throw new Error("Can not access image data")
    } else if (s) {
        let f, u;
        if (e !== void 0 && e.resizedWidth !== void 0 && e.resizedHeight !== void 0 ? (f = e.resizedHeight,
        u = e.resizedWidth) : (f = t.height,
        u = t.width),
        e !== void 0 && (a = e),
        a.format = "RGBA",
        a.height = f,
        a.width = u,
        e !== void 0) {
            let l = i();
            l.width = u,
            l.height = f;
            let p = o(l);
            if (p != null)
                p.putImageData(t, 0, 0),
                c = p.getImageData(0, 0, u, f).data;
            else
                throw new Error("Can not access image data")
        } else
            c = t.data
    } else if (r) {
        if (e === void 0)
            throw new Error("Please provide image config with format for Imagebitmap");
        let f = i();
        f.width = t.width,
        f.height = t.height;
        let u = o(f);
        if (u != null) {
            let l = t.height
              , p = t.width;
            return u.drawImage(t, 0, 0, p, l),
            c = u.getImageData(0, 0, p, l).data,
            a.height = l,
            a.width = p,
            U(c, a)
        } else
            throw new Error("Can not access image data")
    } else {
        if (d)
            return new Promise( (f, u) => {
                let l = i()
                  , p = o(l);
                if (!t || !p)
                    return u();
                let m = new Image;
                m.crossOrigin = "Anonymous",
                m.src = t,
                m.onload = () => {
                    l.width = m.width,
                    l.height = m.height,
                    p.drawImage(m, 0, 0, l.width, l.height);
                    let w = p.getImageData(0, 0, l.width, l.height);
                    a.height = l.height,
                    a.width = l.width,
                    f(U(w.data, a))
                }
            }
            );
        throw new Error("Input data provided is not supported - aborted tensor creation")
    }
    if (c !== void 0)
        return U(c, a);
    throw new Error("Input data provided is not supported - aborted tensor creation")
}
  , S = (t, e) => {
    let {width: n, height: s, download: r, dispose: d} = e
      , c = [1, s, n, 4];
    return new y({
        location: "texture",
        type: "float32",
        texture: t,
        dims: c,
        download: r,
        dispose: d
    })
}
  , j = (t, e) => {
    let {dataType: n, dims: s, download: r, dispose: d} = e;
    return new y({
        location: "gpu-buffer",
        type: n ?? "float32",
        gpuBuffer: t,
        dims: s,
        download: r,
        dispose: d
    })
}
  , z = (t, e) => {
    let {dataType: n, dims: s, download: r, dispose: d} = e;
    return new y({
        location: "ml-tensor",
        type: n ?? "float32",
        mlTensor: t,
        dims: s,
        download: r,
        dispose: d
    })
}
  , H = (t, e, n) => new y({
    location: "cpu-pinned",
    type: t,
    data: e,
    dims: n ?? [e.length]
});
var x = new Map([["float32", Float32Array], ["uint8", Uint8Array], ["int8", Int8Array], ["uint16", Uint16Array], ["int16", Int16Array], ["int32", Int32Array], ["bool", Uint8Array], ["float64", Float64Array], ["uint32", Uint32Array], ["int4", Uint8Array], ["uint4", Uint8Array]])
  , C = new Map([[Float32Array, "float32"], [Uint8Array, "uint8"], [Int8Array, "int8"], [Uint16Array, "uint16"], [Int16Array, "int16"], [Int32Array, "int32"], [Float64Array, "float64"], [Uint32Array, "uint32"]])
  , V = !1
  , W = () => {
    if (!V) {
        V = !0;
        let t = typeof BigInt64Array < "u" && BigInt64Array.from
          , e = typeof BigUint64Array < "u" && BigUint64Array.from
          , n = globalThis.Float16Array
          , s = typeof n < "u" && n.from;
        t && (x.set("int64", BigInt64Array),
        C.set(BigInt64Array, "int64")),
        e && (x.set("uint64", BigUint64Array),
        C.set(BigUint64Array, "uint64")),
        s ? (x.set("float16", n),
        C.set(n, "float16")) : x.set("float16", Uint16Array)
    }
}
;
var Y = t => {
    let e = 1;
    for (let n = 0; n < t.length; n++) {
        let s = t[n];
        if (typeof s != "number" || !Number.isSafeInteger(s))
            throw new TypeError(`dims[${n}] must be an integer, got: ${s}`);
        if (s < 0)
            throw new RangeError(`dims[${n}] must be a non-negative integer, got: ${s}`);
        e *= s
    }
    return e
}
  , q = (t, e) => {
    switch (t.location) {
    case "cpu":
        return new y(t.type,t.data,e);
    case "cpu-pinned":
        return new y({
            location: "cpu-pinned",
            data: t.data,
            type: t.type,
            dims: e
        });
    case "texture":
        return new y({
            location: "texture",
            texture: t.texture,
            type: t.type,
            dims: e
        });
    case "gpu-buffer":
        return new y({
            location: "gpu-buffer",
            gpuBuffer: t.gpuBuffer,
            type: t.type,
            dims: e
        });
    case "ml-tensor":
        return new y({
            location: "ml-tensor",
            mlTensor: t.mlTensor,
            type: t.type,
            dims: e
        });
    default:
        throw new Error(`tensorReshape: tensor location ${t.location} is not supported`)
    }
}
;
var y = class {
    constructor(e, n, s) {
        W();
        let r, d;
        if (typeof e == "object" && "location"in e)
            switch (this.dataLocation = e.location,
            r = e.type,
            d = e.dims,
            e.location) {
            case "cpu-pinned":
                {
                    let a = x.get(r);
                    if (!a)
                        throw new TypeError(`unsupported type "${r}" to create tensor from pinned buffer`);
                    if (!(e.data instanceof a))
                        throw new TypeError(`buffer should be of type ${a.name}`);
                    this.cpuData = e.data;
                    break
                }
            case "texture":
                {
                    if (r !== "float32")
                        throw new TypeError(`unsupported type "${r}" to create tensor from texture`);
                    this.gpuTextureData = e.texture,
                    this.downloader = e.download,
                    this.disposer = e.dispose;
                    break
                }
            case "gpu-buffer":
                {
                    if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4")
                        throw new TypeError(`unsupported type "${r}" to create tensor from gpu buffer`);
                    this.gpuBufferData = e.gpuBuffer,
                    this.downloader = e.download,
                    this.disposer = e.dispose;
                    break
                }
            case "ml-tensor":
                {
                    if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint64" && r !== "int8" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4")
                        throw new TypeError(`unsupported type "${r}" to create tensor from MLTensor`);
                    this.mlTensorData = e.mlTensor,
                    this.downloader = e.download,
                    this.disposer = e.dispose;
                    break
                }
            default:
                throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)
            }
        else {
            let a, i;
            if (typeof e == "string")
                if (r = e,
                i = s,
                e === "string") {
                    if (!Array.isArray(n))
                        throw new TypeError("A string tensor's data must be a string array.");
                    a = n
                } else {
                    let o = x.get(e);
                    if (o === void 0)
                        throw new TypeError(`Unsupported tensor type: ${e}.`);
                    if (Array.isArray(n)) {
                        if (e === "float16" && o === Uint16Array || e === "uint4" || e === "int4")
                            throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${o.name} as data.`);
                        e === "uint64" || e === "int64" ? a = o.from(n, BigInt) : a = o.from(n)
                    } else if (n instanceof o)
                        a = n;
                    else if (n instanceof Uint8ClampedArray)
                        if (e === "uint8")
                            a = Uint8Array.from(n);
                        else
                            throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");
                    else if (e === "float16" && n instanceof Uint16Array && o !== Uint16Array)
                        a = new globalThis.Float16Array(n.buffer,n.byteOffset,n.length);
                    else
                        throw new TypeError(`A ${r} tensor's data must be type of ${o}`)
                }
            else if (i = n,
            Array.isArray(e)) {
                if (e.length === 0)
                    throw new TypeError("Tensor type cannot be inferred from an empty array.");
                let o = typeof e[0];
                if (o === "string")
                    r = "string",
                    a = e;
                else if (o === "boolean")
                    r = "bool",
                    a = Uint8Array.from(e);
                else
                    throw new TypeError(`Invalid element type of data array: ${o}.`)
            } else if (e instanceof Uint8ClampedArray)
                r = "uint8",
                a = Uint8Array.from(e);
            else {
                let o = C.get(e.constructor);
                if (o === void 0)
                    throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);
                r = o,
                a = e
            }
            if (i === void 0)
                i = [a.length];
            else if (!Array.isArray(i))
                throw new TypeError("A tensor's dims must be a number array");
            d = i,
            this.cpuData = a,
            this.dataLocation = "cpu"
        }
        let c = Y(d);
        if (this.cpuData && c !== this.cpuData.length && !((r === "uint4" || r === "int4") && Math.ceil(c / 2) === this.cpuData.length))
            throw new Error(`Tensor's size(${c}) does not match data length(${this.cpuData.length}).`);
        this.type = r,
        this.dims = d,
        this.size = c
    }
    static async fromImage(e, n) {
        return M(e, n)
    }
    static fromTexture(e, n) {
        return S(e, n)
    }
    static fromGpuBuffer(e, n) {
        return j(e, n)
    }
    static fromMLTensor(e, n) {
        return z(e, n)
    }
    static fromPinnedBuffer(e, n, s) {
        return H(e, n, s)
    }
    toDataURL(e) {
        return O(this, e)
    }
    toImageData(e) {
        return k(this, e)
    }
    get data() {
        if (this.ensureValid(),
        !this.cpuData)
            throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");
        return this.cpuData
    }
    get location() {
        return this.dataLocation
    }
    get texture() {
        if (this.ensureValid(),
        !this.gpuTextureData)
            throw new Error("The data is not stored as a WebGL texture.");
        return this.gpuTextureData
    }
    get gpuBuffer() {
        if (this.ensureValid(),
        !this.gpuBufferData)
            throw new Error("The data is not stored as a WebGPU buffer.");
        return this.gpuBufferData
    }
    get mlTensor() {
        if (this.ensureValid(),
        !this.mlTensorData)
            throw new Error("The data is not stored as a WebNN MLTensor.");
        return this.mlTensorData
    }
    async getData(e) {
        switch (this.ensureValid(),
        this.dataLocation) {
        case "cpu":
        case "cpu-pinned":
            return this.data;
        case "texture":
        case "gpu-buffer":
        case "ml-tensor":
            {
                if (!this.downloader)
                    throw new Error("The current tensor is not created with a specified data downloader.");
                if (this.isDownloading)
                    throw new Error("The current tensor is being downloaded.");
                try {
                    this.isDownloading = !0;
                    let n = await this.downloader();
                    return this.downloader = void 0,
                    this.dataLocation = "cpu",
                    this.cpuData = n,
                    e && this.disposer && (this.disposer(),
                    this.disposer = void 0),
                    n
                } finally {
                    this.isDownloading = !1
                }
            }
        default:
            throw new Error(`cannot get data from location: ${this.dataLocation}`)
        }
    }
    dispose() {
        if (this.isDownloading)
            throw new Error("The current tensor is being downloaded.");
        this.disposer && (this.disposer(),
        this.disposer = void 0),
        this.cpuData = void 0,
        this.gpuTextureData = void 0,
        this.gpuBufferData = void 0,
        this.mlTensorData = void 0,
        this.downloader = void 0,
        this.isDownloading = void 0,
        this.dataLocation = "none"
    }
    ensureValid() {
        if (this.dataLocation === "none")
            throw new Error("The tensor is disposed.")
    }
    reshape(e) {
        if (this.ensureValid(),
        this.downloader || this.disposer)
            throw new Error("Cannot reshape a tensor that owns GPU resource.");
        return q(this, e)
    }
}
;
var R = y;
var X = (t, e) => {
    (typeof h.trace > "u" ? !h.wasm.trace : !h.trace) || console.timeStamp(`${t}::ORT::${e}`)
}
  , K = (t, e) => {
    let n = new Error().stack?.split(/\r\n|\r|\n/g) || []
      , s = !1;
    for (let r = 0; r < n.length; r++) {
        if (s && !n[r].includes("TRACE_FUNC")) {
            let d = `FUNC_${t}::${n[r].trim().split(" ")[1]}`;
            e && (d += `::${e}`),
            X("CPU", d);
            return
        }
        n[r].includes("TRACE_FUNC") && (s = !0)
    }
}
  , v = t => {
    (typeof h.trace > "u" ? !h.wasm.trace : !h.trace) || K("BEGIN", t)
}
  , N = t => {
    (typeof h.trace > "u" ? !h.wasm.trace : !h.trace) || K("END", t)
}
  , L = t => {
    (typeof h.trace > "u" ? !h.wasm.trace : !h.trace) || console.time(`ORT::${t}`)
}
  , $ = t => {
    (typeof h.trace > "u" ? !h.wasm.trace : !h.trace) || console.timeEnd(`ORT::${t}`)
}
;
var D = class t {
    constructor(e) {
        this.handler = e
    }
    async run(e, n, s) {
        v(),
        L("InferenceSession.run");
        let r = {}
          , d = {};
        if (typeof e != "object" || e === null || e instanceof R || Array.isArray(e))
            throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");
        let c = !0;
        if (typeof n == "object") {
            if (n === null)
                throw new TypeError("Unexpected argument[1]: cannot be null.");
            if (n instanceof R)
                throw new TypeError("'fetches' cannot be a Tensor");
            if (Array.isArray(n)) {
                if (n.length === 0)
                    throw new TypeError("'fetches' cannot be an empty array.");
                c = !1;
                for (let o of n) {
                    if (typeof o != "string")
                        throw new TypeError("'fetches' must be a string array or an object.");
                    if (this.outputNames.indexOf(o) === -1)
                        throw new RangeError(`'fetches' contains invalid output name: ${o}.`);
                    r[o] = null
                }
                if (typeof s == "object" && s !== null)
                    d = s;
                else if (typeof s < "u")
                    throw new TypeError("'options' must be an object.")
            } else {
                let o = !1
                  , f = Object.getOwnPropertyNames(n);
                for (let u of this.outputNames)
                    if (f.indexOf(u) !== -1) {
                        let l = n[u];
                        (l === null || l instanceof R) && (o = !0,
                        c = !1,
                        r[u] = l)
                    }
                if (o) {
                    if (typeof s == "object" && s !== null)
                        d = s;
                    else if (typeof s < "u")
                        throw new TypeError("'options' must be an object.")
                } else
                    d = n
            }
        } else if (typeof n < "u")
            throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");
        for (let o of this.inputNames)
            if (typeof e[o] > "u")
                throw new Error(`input '${o}' is missing in 'feeds'.`);
        if (c)
            for (let o of this.outputNames)
                r[o] = null;
        let a = await this.handler.run(e, r, d)
          , i = {};
        for (let o in a)
            if (Object.hasOwnProperty.call(a, o)) {
                let f = a[o];
                f instanceof R ? i[o] = f : i[o] = new R(f.type,f.data,f.dims)
            }
        return $("InferenceSession.run"),
        N(),
        i
    }
    async release() {
        return this.handler.dispose()
    }
    static async create(e, n, s, r) {
        v(),
        L("InferenceSession.create");
        let d, c = {};
        if (typeof e == "string") {
            if (d = e,
            typeof n == "object" && n !== null)
                c = n;
            else if (typeof n < "u")
                throw new TypeError("'options' must be an object.")
        } else if (e instanceof Uint8Array) {
            if (d = e,
            typeof n == "object" && n !== null)
                c = n;
            else if (typeof n < "u")
                throw new TypeError("'options' must be an object.")
        } else if (e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer) {
            let f = e
              , u = 0
              , l = e.byteLength;
            if (typeof n == "object" && n !== null)
                c = n;
            else if (typeof n == "number") {
                if (u = n,
                !Number.isSafeInteger(u))
                    throw new RangeError("'byteOffset' must be an integer.");
                if (u < 0 || u >= f.byteLength)
                    throw new RangeError(`'byteOffset' is out of range [0, ${f.byteLength}).`);
                if (l = e.byteLength - u,
                typeof s == "number") {
                    if (l = s,
                    !Number.isSafeInteger(l))
                        throw new RangeError("'byteLength' must be an integer.");
                    if (l <= 0 || u + l > f.byteLength)
                        throw new RangeError(`'byteLength' is out of range (0, ${f.byteLength - u}].`);
                    if (typeof r == "object" && r !== null)
                        c = r;
                    else if (typeof r < "u")
                        throw new TypeError("'options' must be an object.")
                } else if (typeof s < "u")
                    throw new TypeError("'byteLength' must be a number.")
            } else if (typeof n < "u")
                throw new TypeError("'options' must be an object.");
            d = new Uint8Array(f,u,l)
        } else
            throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
        let[a,i] = await G(c)
          , o = await a.createInferenceSessionHandler(d, i);
        return $("InferenceSession.create"),
        N(),
        new t(o)
    }
    startProfiling() {
        this.handler.startProfiling()
    }
    endProfiling() {
        this.handler.endProfiling()
    }
    get inputNames() {
        return this.handler.inputNames
    }
    get outputNames() {
        return this.handler.outputNames
    }
    get inputMetadata() {
        return this.handler.inputMetadata
    }
    get outputMetadata() {
        return this.handler.outputMetadata
    }
}
;
var Pe = D;
export {Pe as InferenceSession, X as TRACE, L as TRACE_EVENT_BEGIN, $ as TRACE_EVENT_END, v as TRACE_FUNC_BEGIN, N as TRACE_FUNC_END, R as Tensor, ae as env, J as registerBackend};
//# sourceMappingURL=onnxruntime-common.mjs.map
