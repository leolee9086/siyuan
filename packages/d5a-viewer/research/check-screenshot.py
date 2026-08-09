import argparse
import json
from pathlib import Path

from PIL import Image, ImageStat


def main() -> None:
    parser = argparse.ArgumentParser(description="Check that a rendered viewport crop contains visible content.")
    parser.add_argument("image", type=Path)
    parser.add_argument("--crop", required=True, help="left,top,right,bottom")
    args = parser.parse_args()

    bounds = tuple(int(value) for value in args.crop.split(","))
    if len(bounds) != 4:
        raise ValueError("crop must contain left,top,right,bottom")

    with Image.open(args.image) as image:
        crop = image.convert("RGB").crop(bounds)
        sample = crop.resize((max(1, crop.width // 4), max(1, crop.height // 4)))
        colors = sample.getcolors(maxcolors=sample.width * sample.height) or []
        colors.sort(reverse=True)
        dominant_count, dominant = colors[0]
        pixels = sample.width * sample.height
        foreground = sum(
            count
            for count, color in colors
            if sum((color[index] - dominant[index]) ** 2 for index in range(3)) > 18 ** 2
        )
        stats = ImageStat.Stat(sample)
        result = {
            "image": str(args.image),
            "crop": [crop.width, crop.height],
            "unique_colors": len(colors),
            "mean_rgb": [round(value, 2) for value in stats.mean],
            "stddev_rgb": [round(value, 2) for value in stats.stddev],
            "dominant_ratio": round(dominant_count / pixels, 4),
            "foreground_ratio": round(foreground / pixels, 4),
        }
        print(json.dumps(result, ensure_ascii=False))
        if len(colors) < 32 or max(stats.stddev) < 6 or foreground / pixels < 0.01:
            raise SystemExit("viewport crop appears blank or visually uniform")


if __name__ == "__main__":
    main()
