import argparse
import json

import numpy as np
from PIL import Image


def parse_crop(value: str) -> tuple[int, int, int, int]:
    parts = tuple(int(part) for part in value.split(','))
    if len(parts) != 4:
        raise argparse.ArgumentTypeError('crop must be left,top,right,bottom')
    return parts


def main() -> None:
    parser = argparse.ArgumentParser(description='Compare matching RGB regions in two viewport screenshots.')
    parser.add_argument('source')
    parser.add_argument('round_trip')
    parser.add_argument('--crop', type=parse_crop)
    parser.add_argument('--threshold', type=float, default=8.0)
    args = parser.parse_args()

    source_image = Image.open(args.source).convert('RGB')
    round_trip_image = Image.open(args.round_trip).convert('RGB')
    if source_image.size != round_trip_image.size:
        raise ValueError(f'image sizes differ: {source_image.size} != {round_trip_image.size}')
    if args.crop:
        source_image = source_image.crop(args.crop)
        round_trip_image = round_trip_image.crop(args.crop)

    source = np.asarray(source_image, dtype=np.float32)
    round_trip = np.asarray(round_trip_image, dtype=np.float32)
    difference = np.abs(source - round_trip)
    changed = np.max(difference, axis=2) > args.threshold
    result = {
        'size': list(source_image.size),
        'crop': list(args.crop) if args.crop else None,
        'threshold': args.threshold,
        'mae': float(np.mean(difference)),
        'rmse': float(np.sqrt(np.mean(np.square(difference)))),
        'max_error': float(np.max(difference)),
        'changed_pixel_ratio': float(np.mean(changed)),
        'mean_similarity': float(1.0 - np.mean(difference) / 255.0),
    }
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
