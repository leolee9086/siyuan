package seraph

import "math"

// ComputeATFStrength 计算ATF强度
// rho: 当前同步率
// rhoDerivative: 同步率变化率（低通滤波后）
// gamma: 趋势敏感度系数，建议2.0
func ComputeATFStrength(rho, rhoDerivative, gamma float64) ATFStrength {
	// 静态分量 F_s = ρ * e^(1-ρ)
	fs := rho * math.Exp(1-rho)

	// 恢复速度 v_rec = -Sign(ρ-1) * dρ/dt
	// 当ρ<1时，Sign(ρ-1)=-1，所以v_rec = dρ/dt
	// 当ρ>1时，Sign(ρ-1)=+1，所以v_rec = -dρ/dt
	sign := -1.0
	if rho > 1.0 {
		sign = 1.0
	}
	vRec := -sign * rhoDerivative

	// 动态分量 F_d = e^(γ * v_rec)
	fd := math.Exp(gamma * vRec)

	// 综合ATF F = F_s * F_d
	f := fs * fd

	return ATFStrength{
		Static:  fs,
		Dynamic: fd,
		Total:   f,
	}
}


