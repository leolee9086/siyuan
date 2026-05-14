package damerau_levenshtein

import "strings"

type Options struct {
	CaseSensitive bool
}

func ComputeDistance(s1, s2 string, opts ...Options) int {
	caseSensitive := true
	if len(opts) > 0 {
		caseSensitive = opts[0].CaseSensitive
	}
	if !caseSensitive {
		s1 = strings.ToLower(s1)
		s2 = strings.ToLower(s2)
	}
	return computeOptimized(s1, s2)
}

func ComputeDistanceClassic(s1, s2 string, opts ...Options) int {
	caseSensitive := true
	if len(opts) > 0 {
		caseSensitive = opts[0].CaseSensitive
	}
	if !caseSensitive {
		s1 = strings.ToLower(s1)
		s2 = strings.ToLower(s2)
	}
	return computeClassic(s1, s2)
}

func computeOptimized(a, b string) int {
	r1, r2 := []rune(a), []rune(b)
	l1, l2 := len(r1), len(r2)
	if l1 == 0 {
		return l2
	}
	if l2 == 0 {
		return l1
	}

	if l1 > l2 {
		r1, r2 = r2, r1
		l1, l2 = l2, l1
	}

	current := make([]int, l2+1)
	previous := make([]int, l2+1)
	previous2 := make([]int, l2+1)

	for j := 0; j <= l2; j++ {
		current[j] = j
	}

	for i := 1; i <= l1; i++ {
		previous2, previous, current = previous, current, previous2
		current[0] = i

		for j := 1; j <= l2; j++ {
			cost := 0
			if r1[i-1] != r2[j-1] {
				cost = 1
			}

			del := previous[j] + 1
			ins := current[j-1] + 1
			sub := previous[j-1] + cost
			min := del
			if ins < min {
				min = ins
			}
			if sub < min {
				min = sub
			}

			if i > 1 && j > 1 && r1[i-1] == r2[j-2] && r1[i-2] == r2[j-1] {
				trans := previous2[j-2] + 1
				if trans < min {
					min = trans
				}
			}

			current[j] = min
		}
	}

	return current[l2]
}

func computeClassic(a, b string) int {
	r1, r2 := []rune(a), []rune(b)
	l1, l2 := len(r1), len(r2)
	if l1 == 0 {
		return l2
	}
	if l2 == 0 {
		return l1
	}

	matrix := make([][]int, l1+1)
	for i := range matrix {
		matrix[i] = make([]int, l2+1)
		matrix[i][0] = i
	}
	for j := 0; j <= l2; j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= l1; i++ {
		for j := 1; j <= l2; j++ {
			cost := 0
			if r1[i-1] != r2[j-1] {
				cost = 1
			}

			del := matrix[i-1][j] + 1
			ins := matrix[i][j-1] + 1
			sub := matrix[i-1][j-1] + cost
			min := del
			if ins < min {
				min = ins
			}
			if sub < min {
				min = sub
			}

			if i > 1 && j > 1 && r1[i-1] == r2[j-2] && r1[i-2] == r2[j-1] {
				trans := matrix[i-2][j-2] + 1
				if trans < min {
					min = trans
				}
			}

			matrix[i][j] = min
		}
	}

	return matrix[l1][l2]
}
