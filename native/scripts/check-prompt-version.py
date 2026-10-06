"""Lingyu / TryWorld2026 / GPL-3.0.

@file check-prompt-version.py
@description 校验原生提示词、README 与构建版本一致，防止把过期能力描述带进发布。
@author 灵屿
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
props = root / "native/Directory.Build.props"
match = re.search(r"<Version>([^<]+)</Version>", props.read_text(encoding="utf-8-sig"))
assert match, "native/Directory.Build.props is missing <Version>"
version = match.group(1).strip()

# 只覆盖对外说明当前能力的位置；docs/ 是历史验收记录，保留当时的版本号。
targets = ["README.md", "README.zh-CN.md", "native/README.md", "native/Lingyu.Core/NativePrompt.cs"]
stale = []
for rel in targets:
    path = root / rel
    for number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        for found in re.findall(r"1\.0\.0-preview\.\d+|preview\.\d+", line):
            # 提示词写简写 preview.N，README 写完整 1.0.0-preview.N；两者都归一到同一版本。
            if found.startswith("preview."):
                found = "1.0.0-" + found
            if found != version:
                stale.append(f"{rel}:{number} -> {found}")

assert not stale, "Native preview version drift, expected " + version + ": " + "; ".join(stale)
print(f"PASS native prompt and README declare {version}")
