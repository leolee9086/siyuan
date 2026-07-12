import argparse
import pathlib

import h5py
import numpy


EXPECTED_BASE_SHAPE = (1_000_000, 128)
EXPECTED_QUERY_SHAPE = (10_000, 128)
CHUNK_ROWS = 8192


def write_fvecs(dataset: h5py.Dataset, path: pathlib.Path) -> None:
    dimension = dataset.shape[1]
    dimension_bits = numpy.array([dimension], dtype=numpy.int32).view(numpy.float32)[0]
    with path.open("wb") as output:
        for start in range(0, dataset.shape[0], CHUNK_ROWS):
            values = numpy.asarray(dataset[start : start + CHUNK_ROWS], dtype=numpy.float32)
            records = numpy.empty((len(values), dimension + 1), dtype=numpy.float32)
            records[:, 0] = dimension_bits
            records[:, 1:] = values
            records.tofile(output)


def write_ivecs(dataset: h5py.Dataset, path: pathlib.Path) -> None:
    dimension = dataset.shape[1]
    with path.open("wb") as output:
        for start in range(0, dataset.shape[0], CHUNK_ROWS):
            values = numpy.asarray(dataset[start : start + CHUNK_ROWS], dtype=numpy.int32)
            records = numpy.empty((len(values), dimension + 1), dtype=numpy.int32)
            records[:, 0] = dimension
            records[:, 1:] = values
            records.tofile(output)


def require_shape(dataset: h5py.Dataset, expected: tuple[int, int], name: str) -> None:
    if dataset.shape != expected:
        raise ValueError(f"{name} shape mismatch: expected {expected}, got {dataset.shape}")


def main() -> int:
    parser = argparse.ArgumentParser(description="将 ANN-Benchmarks SIFT HDF5 转换为 TexMex 向量文件")
    parser.add_argument("input", type=pathlib.Path)
    parser.add_argument("output", type=pathlib.Path)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    with h5py.File(args.input, "r") as source:
        base = source["train"]
        queries = source["test"]
        neighbors = source["neighbors"]
        require_shape(base, EXPECTED_BASE_SHAPE, "train")
        require_shape(queries, EXPECTED_QUERY_SHAPE, "test")
        if neighbors.shape[0] != EXPECTED_QUERY_SHAPE[0] or neighbors.shape[1] < 10:
            raise ValueError(f"neighbors shape mismatch: got {neighbors.shape}")
        write_fvecs(base, args.output / "sift_base.fvecs")
        write_fvecs(queries, args.output / "sift_query.fvecs")
        write_ivecs(neighbors, args.output / "sift_groundtruth.ivecs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
