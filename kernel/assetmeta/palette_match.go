package assetmeta

import (
	assetcolor "github.com/siyuan-note/siyuan/kernel/color"
)

// PaletteMatches applies one shared perceptual color contract to a decoded
// palette. Every condition must be satisfied by the same palette swatch.
func PaletteMatches(palettes []Palette, search *PaletteSearch) bool {
	if search == nil || !paletteSearchHasConditions(search) {
		return true
	}
	for _, palette := range palettes {
		if paletteMatches(palette, search) {
			return true
		}
	}
	return false
}

func paletteSearchHasConditions(search *PaletteSearch) bool {
	return search.MinRatio > 0 || search.Color != nil || search.MinH != nil || search.MaxH != nil ||
		search.MinS != nil || search.MaxS != nil || search.MinL != nil || search.MaxL != nil
}

func paletteMatches(palette Palette, search *PaletteSearch) bool {
	if search.MinRatio > 0 && palette.Ratio < search.MinRatio {
		return false
	}
	if search.Color != nil && assetcolor.CIEDE2000RGB(palette.Color, *search.Color) >
		assetcolor.NormalizeCIEDE2000Tolerance(search.Tolerance) {
		return false
	}
	return hslMatches(palette.H, search.MinH, search.MaxH, true) &&
		hslMatches(palette.S, search.MinS, search.MaxS, false) &&
		hslMatches(palette.L, search.MinL, search.MaxL, false)
}

func hslMatches(value int, minimum, maximum *int, circular bool) bool {
	if minimum != nil && maximum != nil && circular && *minimum > *maximum {
		return value >= *minimum || value <= *maximum
	}
	if minimum != nil && value < *minimum {
		return false
	}
	if maximum != nil && value > *maximum {
		return false
	}
	return true
}
