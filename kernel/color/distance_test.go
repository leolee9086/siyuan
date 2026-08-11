package color

import "testing"

func TestCIEDE2000PublishedLabPairs(t *testing.T) {
	tests := []struct {
		name     string
		left     Lab
		right    Lab
		expected float64
	}{
		{"pair 1", Lab{L: 50, A: 2.6772, B: -79.7751}, Lab{L: 50, A: 0, B: -82.7485}, 2.0425},
		{"pair 2", Lab{L: 50, A: 3.1571, B: -77.2803}, Lab{L: 50, A: 0, B: -82.7485}, 2.8615},
		{"pair 3", Lab{L: 50, A: 2.8361, B: -74.0200}, Lab{L: 50, A: 0, B: -82.7485}, 3.4412},
		{"pair 4", Lab{L: 50, A: -1.3802, B: -84.2814}, Lab{L: 50, A: 0, B: -82.7485}, 1.0000},
		{"pair 5", Lab{L: 50, A: -1.1848, B: -84.8006}, Lab{L: 50, A: 0, B: -82.7485}, 1.0000},
		{"pair 6", Lab{L: 50, A: -0.9009, B: -85.5211}, Lab{L: 50, A: 0, B: -82.7485}, 1.0000},
		{"pair 7", Lab{L: 50, A: 0, B: 0}, Lab{L: 50, A: -1, B: 2}, 2.3669},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual := CIEDE2000Lab(test.left, test.right)
			if diff := actual - test.expected; diff < -0.0001 || diff > 0.0001 {
				t.Fatalf("CIEDE2000 = %.6f, want %.4f", actual, test.expected)
			}
		})
	}
}

func TestRGBToLabClampsOutOfRangeChannels(t *testing.T) {
	if got, want := RGBToLab([3]int{-20, 260, 0}), RGBToLab([3]int{0, 255, 0}); got != want {
		t.Fatalf("clamped conversion differs: got=%+v want=%+v", got, want)
	}
}
