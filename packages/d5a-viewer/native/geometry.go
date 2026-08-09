package d5a

import (
	"fmt"
	"math"
)

type matrix4 [16]float64

type point3 [3]float64

func identityMatrix4() matrix4 {
	return matrix4{1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1}
}

func multiplyMatrix4(left, right matrix4) matrix4 {
	var result matrix4
	for column := 0; column < 4; column++ {
		for row := 0; row < 4; row++ {
			value := 0.0
			for inner := 0; inner < 4; inner++ {
				value += left[inner*4+row] * right[column*4+inner]
			}
			result[column*4+row] = value
		}
	}
	return result
}

func transformPoint3(matrix matrix4, point point3) (point3, error) {
	x, y, z := point[0], point[1], point[2]
	w := matrix[3]*x + matrix[7]*y + matrix[11]*z + matrix[15]
	if w == 0 {
		w = 1
	}
	result := point3{
		(matrix[0]*x + matrix[4]*y + matrix[8]*z + matrix[12]) / w,
		(matrix[1]*x + matrix[5]*y + matrix[9]*z + matrix[13]) / w,
		(matrix[2]*x + matrix[6]*y + matrix[10]*z + matrix[14]) / w,
	}
	for _, value := range result {
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return point3{}, fmt.Errorf("变换后的顶点坐标不是有限数值")
		}
	}
	return result, nil
}

func composeMatrix4(translation point3, rotation [4]float64, scale point3) matrix4 {
	x, y, z, w := rotation[0], rotation[1], rotation[2], rotation[3]
	length := math.Sqrt(x*x + y*y + z*z + w*w)
	if length == 0 {
		x, y, z, w = 0, 0, 0, 1
	} else {
		x, y, z, w = x/length, y/length, z/length, w/length
	}
	x2, y2, z2 := x+x, y+y, z+z
	xx, xy, xz := x*x2, x*y2, x*z2
	yy, yz, zz := y*y2, y*z2, z*z2
	wx, wy, wz := w*x2, w*y2, w*z2
	sx, sy, sz := scale[0], scale[1], scale[2]
	return matrix4{
		(1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
		(xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
		(xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
		translation[0], translation[1], translation[2], 1,
	}
}

func legacyTRSMatrix(values []float64) matrix4 {
	if len(values) != 9 {
		return identityMatrix4()
	}
	tx, ty, tz := values[0], values[1], values[2]
	pitch := values[3] * math.Pi / 180
	yaw := values[4] * math.Pi / 180
	roll := values[5] * math.Pi / 180
	sx, sy, sz := values[6], values[7], values[8]
	sp, cp := math.Sin(pitch), math.Cos(pitch)
	syaw, cyaw := math.Sin(yaw), math.Cos(yaw)
	sr, cr := math.Sin(roll), math.Cos(roll)
	return matrix4{
		cp * cyaw * sx, cp * syaw * sx, sp * sx, 0,
		(sr*sp*cyaw - cr*syaw) * sy, (sr*sp*syaw + cr*cyaw) * sy, -sr * cp * sy, 0,
		-(cr*sp*cyaw + sr*syaw) * sz, (cyaw*sr - cr*sp*syaw) * sz, cr * cp * sz, 0,
		tx, ty, tz, 1,
	}
}

func d5RootToYUpMatrix() matrix4 {
	return matrix4{1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1}
}

func yUpToDxfPoint(point point3) point3 {
	return point3{point[0], -point[2], point[1]}
}
