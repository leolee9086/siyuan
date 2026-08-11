// Package color contains deterministic color-space operations shared by
// asset indexing and query layers.
package color

import "math"

// DefaultCIEDE2000Tolerance is the reference gallery's default perceptual
// color distance threshold.
const DefaultCIEDE2000Tolerance = 20.0

// Lab is a CIE L*a*b* color using the D65 reference white.
type Lab struct {
	L float64
	A float64
	B float64
}

// NormalizeCIEDE2000Tolerance keeps the public integer request field
// compatible while expressing the comparison in Delta-E units.
func NormalizeCIEDE2000Tolerance(value int) float64 {
	if value <= 0 {
		return DefaultCIEDE2000Tolerance
	}
	return float64(value)
}

// CIEDE2000RGB returns the perceptual distance between two 8-bit sRGB colors.
func CIEDE2000RGB(left, right [3]int) float64 {
	return CIEDE2000Lab(RGBToLab(left), RGBToLab(right))
}

// RGBToLab converts an 8-bit sRGB color to CIE L*a*b* using D65.
func RGBToLab(rgb [3]int) Lab {
	r := srgbToLinear(float64(clampByte(rgb[0])) / 255)
	g := srgbToLinear(float64(clampByte(rgb[1])) / 255)
	b := srgbToLinear(float64(clampByte(rgb[2])) / 255)

	x := (r*0.4124564 + g*0.3575761 + b*0.1804375) / 0.95047
	y := (r*0.2126729 + g*0.7151522 + b*0.0721750) / 1.00000
	z := (r*0.0193339 + g*0.1191920 + b*0.9503041) / 1.08883

	fx, fy, fz := labF(x), labF(y), labF(z)
	return Lab{L: 116*fy - 16, A: 500 * (fx - fy), B: 200 * (fy - fz)}
}

// CIEDE2000Lab implements Sharma et al.'s CIEDE2000 Delta-E formula.
func CIEDE2000Lab(left, right Lab) float64 {
	const c25To7 = 6103515625.0
	const twoPi = 2 * math.Pi

	c1 := math.Hypot(left.A, left.B)
	c2 := math.Hypot(right.A, right.B)
	cAverage := (c1 + c2) / 2
	cAverage7 := math.Pow(cAverage, 7)
	g := 0.5 * (1 - math.Sqrt(cAverage7/(cAverage7+c25To7)))

	a1Prime := (1 + g) * left.A
	a2Prime := (1 + g) * right.A
	c1Prime := math.Hypot(a1Prime, left.B)
	c2Prime := math.Hypot(a2Prime, right.B)
	h1Prime := hueAngle(a1Prime, left.B, c1Prime)
	h2Prime := hueAngle(a2Prime, right.B, c2Prime)

	deltaL := right.L - left.L
	deltaC := c2Prime - c1Prime
	deltaH := hueDifference(h2Prime, h1Prime, c1Prime*c2Prime)
	deltaBigH := 2 * math.Sqrt(c1Prime*c2Prime) * math.Sin(deltaH/2)

	lAverage := (left.L + right.L) / 2
	cPrimeAverage := (c1Prime + c2Prime) / 2
	hPrimeAverage := averageHue(h1Prime, h2Prime, c1Prime*c2Prime, twoPi)

	t := 1 - 0.17*math.Cos(hPrimeAverage-math.Pi/6) +
		0.24*math.Cos(2*hPrimeAverage) +
		0.32*math.Cos(3*hPrimeAverage+math.Pi/30) -
		0.20*math.Cos(4*hPrimeAverage-63*math.Pi/180)
	deltaTheta := 30 * math.Exp(-math.Pow((degrees(hPrimeAverage)-275)/25, 2))
	rc := 2 * math.Sqrt(math.Pow(cPrimeAverage, 7)/(math.Pow(cPrimeAverage, 7)+c25To7))
	sl := 1 + 0.015*math.Pow(lAverage-50, 2)/math.Sqrt(20+math.Pow(lAverage-50, 2))
	sc := 1 + 0.045*cPrimeAverage
	sh := 1 + 0.015*cPrimeAverage*t
	rt := -math.Sin(2*deltaTheta*math.Pi/180) * rc

	light := deltaL / sl
	chroma := deltaC / sc
	hue := deltaBigH / sh
	return math.Sqrt(light*light + chroma*chroma + hue*hue + rt*chroma*hue)
}

func srgbToLinear(value float64) float64 {
	if value <= 0.04045 {
		return value / 12.92
	}
	return math.Pow((value+0.055)/1.055, 2.4)
}

func labF(value float64) float64 {
	const epsilon = 216.0 / 24389.0
	const kappa = 24389.0 / 27.0
	if value > epsilon {
		return math.Cbrt(value)
	}
	return (kappa*value + 16) / 116
}

func hueAngle(a, b, chroma float64) float64 {
	if chroma == 0 {
		return 0
	}
	angle := math.Atan2(b, a)
	if angle < 0 {
		angle += 2 * math.Pi
	}
	return angle
}

func hueDifference(second, first, chromaProduct float64) float64 {
	if chromaProduct == 0 {
		return 0
	}
	delta := second - first
	if delta > math.Pi {
		delta -= 2 * math.Pi
	} else if delta < -math.Pi {
		delta += 2 * math.Pi
	}
	return delta
}

func averageHue(first, second, chromaProduct, twoPi float64) float64 {
	if chromaProduct == 0 {
		return first + second
	}
	difference := math.Abs(first - second)
	sum := first + second
	if difference <= math.Pi {
		return sum / 2
	}
	if sum < twoPi {
		return sum/2 + math.Pi
	}
	return sum/2 - math.Pi
}

func degrees(radians float64) float64 {
	return radians * 180 / math.Pi
}

func clampByte(value int) int {
	if value < 0 {
		return 0
	}
	if value > 255 {
		return 255
	}
	return value
}
