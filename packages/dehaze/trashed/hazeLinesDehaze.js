// ------------------------------------------------------------
//  Haze-Lines Dehazing (CVPR 2016 / TPAMI 2020) 完整 JS 实现
//  Author : @zxdawn 2024-07
// ------------------------------------------------------------
async function hazeLinesDehaze(srcImg){
    const w = srcImg.width, h = srcImg.height, N = w*h;
    const data = srcImg.data;
    // ---------- 1. 估计大气光 A ----------
    let maxSum=0; const A=[0,0,0];
    for(let i=0;i<data.length;i+=4){
        const s=data[i]+data[i+1]+data[i+2];
        if(s>maxSum){ maxSum=s; A[0]=data[i];A[1]=data[i+1];A[2]=data[i+2]; }
    }
  
    // ---------- 2. 坐标变换 & 球坐标 ----------
    const IA = new Float32Array(N*3);   // I-A
    const sph = new Float32Array(N*3);  // r,θ,φ
    const idx2xyz = i => [data[4*i]-A[0],data[4*i+1]-A[1],data[4*i+2]-A[2]];
    for(let i=0;i<N;i++){
        const [r,g,b]=idx2xyz(i);
        IA[3*i]=r; IA[3*i+1]=g; IA[3*i+2]=b;
        const len = Math.sqrt(r*r+g*g+b*b)+1e-8;
        sph[3*i]=len;               // r
        sph[3*i+1] = Math.acos(Math.max(-1,Math.min(1,g/len)));           // θ
        sph[3*i+2] = Math.atan2(b,r);                                      // φ
    }
  
    // ---------- 3. KD-Tree 球面聚类（雾线） ----------
    // 使用固定 2000 个中心 + 最近邻
    const nLines = 2000;
    const centers = [];
    for(let k=0;k<nLines;k++){
        centers.push([
          Math.acos(-1+2*Math.random()),          // θ
          Math.random()*2*Math.PI-Math.PI         // φ
        ]);
    }
    const lineIds = new Int16Array(N);
    function dist2(a,b){
        const dθ=a[0]-b[0], dφ=a[1]-b[1];
        return dθ*dθ+dφ*dφ;          // 球面距离近似
    }
    for(let i=0;i<N;i++){
        const p=[sph[3*i+1],sph[3*i+2]];
        let best=0,bestD=dist2(p,centers[0]);
        for(let k=1;k<nLines;k++){
            const d=dist2(p,centers[k]);
            if(d<bestD){ bestD=d; best=k; }
        }
        lineIds[i]=best;
    }
  
    // ---------- 4. 每个雾线估计 r_max ----------
    const rMax = new Float32Array(nLines);
    for(let i=0;i<nLines;i++) rMax[i]=0;
    for(let i=0;i<N;i++){
        const r=sph[3*i];
        const lid=lineIds[i];
        if(r>rMax[lid]) rMax[lid]=r;
    }
  
    // ---------- 5. 初始透射图 ----------
    const tRaw = new Float32Array(N);
    for(let i=0;i<N;i++){
        const lid=lineIds[i];
        const r=sph[3*i];
        tRaw[i]=r/(rMax[lid]+1e-6);
        tRaw[i]=Math.max(0.1,Math.min(1,tRaw[i]));
    }
  
    // ---------- 6. WLS 正则化 ----------
    const λ = 0.5;
    const {rows,cols,val,b} = buildWLS(tRaw,w,h,λ);
    const tSmooth = solveCG(rows,cols,val,b,N,200);
  
    // ---------- 7. 恢复图像 ----------
    const out = new Uint8ClampedArray(N*4);
    for(let i=0;i<N;i++){
        const t = Math.max(tSmooth[i],0.1);
        const r=(data[4*i]-A[0])/t + A[0];
        const g=(data[4*i+1]-A[1])/t + A[1];
        const b=(data[4*i+2]-A[2])/t + A[2];
        out[4*i]=Math.min(255,Math.max(0,r));
        out[4*i+1]=Math.min(255,Math.max(0,g));
        out[4*i+2]=Math.min(255,Math.max(0,b));
        out[4*i+3]=255;
    }
    return new ImageData(out,w,h);
  }
  
  // ------------------------------------------------------------
  // WLS 构建稀疏矩阵： (I + λ L) t = t_raw
  function buildWLS(t,w,h,λ){
    const N=w*h;
    const eps=1e-4,alpha=1.2;
    const rows=[],cols=[],val=[];
    const b=[...t];
    let ptr=0;
    function add(u,v,c){
        rows.push(u);cols.push(v);val.push(c);
    }
    for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
            const u=y*w+x;
            let sum=1;
            for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
                const nx=x+dx, ny=y+dy;
                if(nx<0||nx>=w||ny<0||ny>=h) continue;
                const v=ny*w+nx;
                // 计算权重
                const d=Math.abs(t[u]-t[v]);
                const wk=λ*Math.pow(Math.sqrt(d*d+eps),-alpha);
                add(u,v,-wk);
                sum+=wk;
            }
            add(u,u,sum);
        }
    }
    return {rows,cols,val,b};
  }
  
  // ------------------------------------------------------------
  // 共轭梯度求解稀疏系统
  function solveCG(rows,cols,val,b,N,maxIt){
    const A = numeric.ccsScatter(rows,cols,val);
    const x = numeric.ccsLUPSolve(numeric.ccsLUP(A), b);
    return x;
  }
  