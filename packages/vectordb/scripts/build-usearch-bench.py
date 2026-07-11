import argparse
import pathlib
import shutil
import subprocess
import sys


USEARCH_VERSION = "v2.22.0"
USEARCH_COMMIT = "5fd2d3a7d340cc93b1de2b47d489d27e9dfe4958"


def run(arguments: list[str], cwd: pathlib.Path | None = None) -> None:
    subprocess.run(arguments, cwd=cwd, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="构建 ANN benchmark 使用的固定版本 USearch C ABI")
    parser.add_argument("--force", action="store_true", help="删除并重新下载已有源码")
    args = parser.parse_args()

    module_dir = pathlib.Path(__file__).resolve().parents[1]
    repo_dir = module_dir.parents[1]
    test_data = repo_dir / "test_data"
    source_dir = test_data / "usearch-src-v2.22.0"
    output_dir = test_data / "usearch-v2.22.0"

    if args.force and source_dir.exists():
        shutil.rmtree(source_dir)
    if not source_dir.exists():
        run([
            "git", "clone", "--depth", "1", "--branch", USEARCH_VERSION,
            "--recurse-submodules", "--shallow-submodules",
            "https://github.com/unum-cloud/usearch.git", str(source_dir),
        ])

    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source_dir, text=True).strip()
    if commit != USEARCH_COMMIT:
        raise RuntimeError(f"USearch 提交不匹配：期望 {USEARCH_COMMIT}，实际 {commit}")

    output_dir.mkdir(parents=True, exist_ok=True)
    if sys.platform == "win32":
        compiler = shutil.which("g++")
        if compiler is None:
            raise RuntimeError("未找到 g++，需要 MinGW-w64 C++ 编译器")
        run([
            compiler, "-std=c++11", "-O3", "-DNDEBUG",
            "-I", str(source_dir / "include"),
            "-I", str(source_dir / "c"),
            "-I", str(source_dir / "fp16" / "include"),
            "-I", str(source_dir / "simsimd" / "include"),
            "-shared", str(source_dir / "c" / "lib.cpp"),
            "-o", str(output_dir / "libusearch_c.dll"),
            "-static-libstdc++", "-static-libgcc",
            f"-Wl,--out-implib,{output_dir / 'libusearch_c.a'}",
        ])
    else:
        raise RuntimeError("当前脚本先支持 Windows；其他平台应使用 USearch 官方 CMake 构建")

    print(f"USearch {USEARCH_VERSION} C ABI 已构建到 {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
