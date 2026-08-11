package assetmeta

import "testing"

func TestPaletteMatchesUsesPerceptualDistanceAndSharedConditions(t *testing.T) {
	red := Palette{Color: [3]int{250, 10, 10}, Ratio: 0.8, H: 0, S: 96, L: 51}
	color := [3]int{255, 0, 0}
	minimumHue, maximumHue := 350, 10
	minimumRatio := 0.5
	if !PaletteMatches([]Palette{red}, &PaletteSearch{
		Color: &color, Tolerance: 20, MinRatio: minimumRatio, MinH: &minimumHue, MaxH: &maximumHue,
	}) {
		t.Fatal("palette should satisfy perceptual, ratio, and circular hue conditions")
	}
	if PaletteMatches([]Palette{red}, &PaletteSearch{Color: &color, Tolerance: 1}) {
		t.Fatal("palette outside Delta-E tolerance matched")
	}
}

func TestPaletteMatchesEmptyConditionsAndMissingPalette(t *testing.T) {
	if !PaletteMatches(nil, &PaletteSearch{}) {
		t.Fatal("empty palette search must preserve SQL no-condition semantics")
	}
	minimumSaturation := 80
	if PaletteMatches(nil, &PaletteSearch{MinS: &minimumSaturation}) {
		t.Fatal("constrained search matched an asset without palettes")
	}
}
