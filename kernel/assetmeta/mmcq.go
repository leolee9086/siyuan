package assetmeta

import (
	"image"
	"math"
	"sort"
)

// MMCQ (Modified Median Cut Quantization) 色彩量化算法
// 用于从图像中提取主色调

const (
	// sigBits 用于量化的有效位数 (5 位 = 32 级)
	sigBits = 5
	// rShift 右移位数
	rShift = 8 - sigBits
	// maxIterations 最大迭代次数
	maxIterations = 1000
	// fracByPopulation 按像素数量切割的比例
	fracByPopulation = 0.75
)

// vbox 色彩空间盒子
type vbox struct {
	r1, r2 int    // R 范围 [r1, r2]
	g1, g2 int    // G 范围
	b1, b2 int    // B 范围
	histo  []int  // 颜色直方图引用
	count  int    // 像素数量 (缓存)
	volume int    // 体积 (缓存)
	avg    [3]int // 平均颜色 (缓存)
}

// newVBox 创建新的色彩盒子
func newVBox(r1, r2, g1, g2, b1, b2 int, histo []int) *vbox {
	return &vbox{
		r1: r1, r2: r2,
		g1: g1, g2: g2,
		b1: b1, b2: b2,
		histo: histo,
		count: -1, // 未计算
	}
}

// getColorIndex 获取颜色在直方图中的索引
func getColorIndex(r, g, b int) int {
	return (r << (2 * sigBits)) + (g << sigBits) + b
}

// countPixels 统计盒子内的像素数
func (v *vbox) countPixels() int {
	if v.count >= 0 {
		return v.count
	}

	count := 0
	for r := v.r1; r <= v.r2; r++ {
		for g := v.g1; g <= v.g2; g++ {
			for b := v.b1; b <= v.b2; b++ {
				count += v.histo[getColorIndex(r, g, b)]
			}
		}
	}
	v.count = count
	return count
}

// getVolume 获取盒子体积
func (v *vbox) getVolume() int {
	if v.volume > 0 {
		return v.volume
	}
	v.volume = (v.r2 - v.r1 + 1) * (v.g2 - v.g1 + 1) * (v.b2 - v.b1 + 1)
	return v.volume
}

// getAverage 获取平均颜色
func (v *vbox) getAverage() [3]int {
	if v.avg[0]+v.avg[1]+v.avg[2] > 0 {
		return v.avg
	}

	mult := 1 << rShift
	var rSum, gSum, bSum, count int

	for r := v.r1; r <= v.r2; r++ {
		for g := v.g1; g <= v.g2; g++ {
			for b := v.b1; b <= v.b2; b++ {
				h := v.histo[getColorIndex(r, g, b)]
				if h > 0 {
					count += h
					rSum += h * (r + 1) * mult // +1 是为了避免 0
					gSum += h * (g + 1) * mult
					bSum += h * (b + 1) * mult
				}
			}
		}
	}

	if count > 0 {
		v.avg = [3]int{
			clamp(rSum/count - mult/2),
			clamp(gSum/count - mult/2),
			clamp(bSum/count - mult/2),
		}
	} else {
		v.avg = [3]int{
			clamp(mult * (v.r1 + v.r2 + 1) / 2),
			clamp(mult * (v.g1 + v.g2 + 1) / 2),
			clamp(mult * (v.b1 + v.b2 + 1) / 2),
		}
	}
	return v.avg
}

// copy 复制盒子
func (v *vbox) copy() *vbox {
	return &vbox{
		r1: v.r1, r2: v.r2,
		g1: v.g1, g2: v.g2,
		b1: v.b1, b2: v.b2,
		histo: v.histo,
		count: -1,
	}
}

// medianCutApply 执行中值切割
func medianCutApply(vb *vbox) (*vbox, *vbox) {
	if vb.countPixels() == 0 {
		return nil, nil
	}
	if vb.countPixels() == 1 {
		return vb.copy(), nil
	}

	// 找到最长的轴
	rw := vb.r2 - vb.r1
	gw := vb.g2 - vb.g1
	bw := vb.b2 - vb.b1
	maxw := max(rw, gw, bw)

	var total int
	var partialSum []int

	// 根据最长轴进行切割
	switch maxw {
	case rw:
		partialSum = make([]int, vb.r2-vb.r1+1)
		for r := vb.r1; r <= vb.r2; r++ {
			sum := 0
			for g := vb.g1; g <= vb.g2; g++ {
				for b := vb.b1; b <= vb.b2; b++ {
					sum += vb.histo[getColorIndex(r, g, b)]
				}
			}
			total += sum
			partialSum[r-vb.r1] = total
		}
	case gw:
		partialSum = make([]int, vb.g2-vb.g1+1)
		for g := vb.g1; g <= vb.g2; g++ {
			sum := 0
			for r := vb.r1; r <= vb.r2; r++ {
				for b := vb.b1; b <= vb.b2; b++ {
					sum += vb.histo[getColorIndex(r, g, b)]
				}
			}
			total += sum
			partialSum[g-vb.g1] = total
		}
	default: // bw
		partialSum = make([]int, vb.b2-vb.b1+1)
		for b := vb.b1; b <= vb.b2; b++ {
			sum := 0
			for r := vb.r1; r <= vb.r2; r++ {
				for g := vb.g1; g <= vb.g2; g++ {
					sum += vb.histo[getColorIndex(r, g, b)]
				}
			}
			total += sum
			partialSum[b-vb.b1] = total
		}
	}

	// 找到切割点
	doCut := func(dim int, vb1Min, vb1Max, vb2Min, vb2Max *int, d1, d2 int) {
		for i := 0; i < len(partialSum); i++ {
			if partialSum[i] > total/2 {
				left := i
				right := len(partialSum) - 1 - i
				cut := d1 + min(left, right)
				if cut < d1 {
					cut = d1
				}
				if cut > d2 {
					cut = d2
				}
				// 避免 0 宽度的盒子
				for partialSum[cut-d1] == 0 && cut < d2 {
					cut++
				}
				*vb1Max = cut
				*vb2Min = cut + 1
				return
			}
		}
	}

	vb1 := vb.copy()
	vb2 := vb.copy()

	switch maxw {
	case rw:
		doCut(0, &vb1.r1, &vb1.r2, &vb2.r1, &vb2.r2, vb.r1, vb.r2)
	case gw:
		doCut(1, &vb1.g1, &vb1.g2, &vb2.g1, &vb2.g2, vb.g1, vb.g2)
	default:
		doCut(2, &vb1.b1, &vb1.b2, &vb2.b1, &vb2.b2, vb.b1, vb.b2)
	}

	return vb1, vb2
}

// extractPalette 从图像提取调色板
// img: 输入图像 (建议使用缩略图以提高性能)
// colorCount: 目标颜色数量
func extractPalette(img image.Image, colorCount int) []Palette {
	if colorCount < 2 {
		colorCount = 8
	}
	if colorCount > 256 {
		colorCount = 256
	}

	bounds := img.Bounds()
	histoSize := 1 << (3 * sigBits)
	histo := make([]int, histoSize)

	var rMin, rMax, gMin, gMax, bMin, bMax int = 1 << sigBits, 0, 1 << sigBits, 0, 1 << sigBits, 0
	var totalPixels int

	// 构建直方图
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			c := img.At(x, y)
			r, g, b, a := c.RGBA()
			// 跳过透明像素
			if a < 0x8000 {
				continue
			}
			// 转换为 8 位并量化
			ri := int(r>>8) >> rShift
			gi := int(g>>8) >> rShift
			bi := int(b>>8) >> rShift

			histo[getColorIndex(ri, gi, bi)]++
			totalPixels++

			// 更新范围
			if ri < rMin {
				rMin = ri
			}
			if ri > rMax {
				rMax = ri
			}
			if gi < gMin {
				gMin = gi
			}
			if gi > gMax {
				gMax = gi
			}
			if bi < bMin {
				bMin = bi
			}
			if bi > bMax {
				bMax = bi
			}
		}
	}

	if totalPixels == 0 {
		return nil
	}

	// 创建初始 VBox
	vb := newVBox(rMin, rMax, gMin, gMax, bMin, bMax, histo)

	// 优先队列 (按像素数量排序)
	pq := []*vbox{vb}
	pushPQ := func(v *vbox) {
		if v != nil && v.countPixels() > 0 {
			pq = append(pq, v)
		}
	}

	// 第一阶段：按像素数量切割
	target := int(fracByPopulation * float64(colorCount))
	for iter := 0; len(pq) < target && iter < maxIterations; iter++ {
		// 找到像素最多的盒子
		sort.Slice(pq, func(i, j int) bool {
			return pq[i].countPixels() > pq[j].countPixels()
		})

		vb := pq[0]
		pq = pq[1:]

		if vb.countPixels() == 0 {
			continue
		}

		vb1, vb2 := medianCutApply(vb)
		pushPQ(vb1)
		pushPQ(vb2)
	}

	// 第二阶段：按体积×像素数切割
	for iter := 0; len(pq) < colorCount && iter < maxIterations; iter++ {
		sort.Slice(pq, func(i, j int) bool {
			return pq[i].countPixels()*pq[i].getVolume() > pq[j].countPixels()*pq[j].getVolume()
		})

		vb := pq[0]
		pq = pq[1:]

		if vb.countPixels() == 0 {
			continue
		}

		vb1, vb2 := medianCutApply(vb)
		pushPQ(vb1)
		pushPQ(vb2)
	}

	// 提取颜色并计算比例
	var palettes []Palette
	for _, vb := range pq {
		avg := vb.getAverage()
		count := vb.countPixels()
		if count == 0 {
			continue
		}

		h, s, l := rgbToHSL(avg[0], avg[1], avg[2])
		palettes = append(palettes, Palette{
			Color: avg,
			Ratio: float64(count) / float64(totalPixels),
			H:     h,
			S:     s,
			L:     l,
		})
	}

	// 按比例降序排序
	sort.Slice(palettes, func(i, j int) bool {
		return palettes[i].Ratio > palettes[j].Ratio
	})

	return palettes
}

// rgbToHSL 将 RGB 转换为 HSL
func rgbToHSL(r, g, b int) (h, s, l int) {
	rf := float64(r) / 255.0
	gf := float64(g) / 255.0
	bf := float64(b) / 255.0

	maxC := math.Max(rf, math.Max(gf, bf))
	minC := math.Min(rf, math.Min(gf, bf))
	lf := (maxC + minC) / 2

	if maxC == minC {
		return 0, 0, int(lf * 100)
	}

	d := maxC - minC
	var sf float64
	if lf > 0.5 {
		sf = d / (2 - maxC - minC)
	} else {
		sf = d / (maxC + minC)
	}

	var hf float64
	switch maxC {
	case rf:
		hf = (gf - bf) / d
		if gf < bf {
			hf += 6
		}
	case gf:
		hf = (bf-rf)/d + 2
	case bf:
		hf = (rf-gf)/d + 4
	}
	hf /= 6

	return int(hf * 360), int(sf * 100), int(lf * 100)
}

// clamp 限制值在 0-255 范围
func clamp(v int) int {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return v
}

// ExtractPaletteFromDecodedImage 从已解码的内存图像提取调色板。
// 文件打开和解码由绑定根文件系统模块负责，本函数只保留纯色彩计算。
func ExtractPaletteFromDecodedImage(img image.Image, colorCount int) []Palette {
	// 如果图片太大，进行降采样
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// 目标最大边长 64px，用于颜色分析足够了
	const maxDim = 64
	if width > maxDim || height > maxDim {
		img = downsampleImage(img, maxDim)
	}

	return extractPalette(img, colorCount)
}

// ExtractPaletteFromRGBA 直接从 RGBA 图像提取调色板
func ExtractPaletteFromRGBA(img *image.RGBA, colorCount int) []Palette {
	return extractPalette(img, colorCount)
}

// downsampleImage 降采样图像
func downsampleImage(src image.Image, maxDim int) image.Image {
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// 计算缩放比例
	scale := 1.0
	if width > height {
		scale = float64(maxDim) / float64(width)
	} else {
		scale = float64(maxDim) / float64(height)
	}

	newWidth := int(float64(width) * scale)
	newHeight := int(float64(height) * scale)
	if newWidth < 1 {
		newWidth = 1
	}
	if newHeight < 1 {
		newHeight = 1
	}

	// 简单的最近邻采样
	dst := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))
	for y := 0; y < newHeight; y++ {
		srcY := int(float64(y) / scale)
		for x := 0; x < newWidth; x++ {
			srcX := int(float64(x) / scale)
			dst.Set(x, y, src.At(bounds.Min.X+srcX, bounds.Min.Y+srcY))
		}
	}

	return dst
}
