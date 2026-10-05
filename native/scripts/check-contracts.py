"""Lingyu / TryWorld2026 / GPL-3.0.

@file check-contracts.py
@description 验证原生双语、资源和两个客户端的提示词边界。
@author 灵屿
"""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
app = root / "native/Lingyu.App"
zh = json.loads((app / "i18n/zh-CN.json").read_text(encoding="utf-8-sig"))
en = json.loads((app / "i18n/en-US.json").read_text(encoding="utf-8-sig"))
assert zh.keys() == en.keys(), "Translation keys differ"
keys = set()
for file in list(app.rglob("*.cs")) + list(app.rglob("*.xaml")):
    if "bin" in file.parts or "obj" in file.parts:
        continue
    text = file.read_text(encoding="utf-8-sig")
    keys.update(re.findall(r'TextCatalog.T\("([^"\n]+)"\)', text))
    keys.update(re.findall(r'\{l:L (\w+)\}', text))
    keys.update(re.findall(r'Ui\.(?:Label|Input)\("([^"\n]+)"', text))
assert not keys - zh.keys(), f"Missing translations: {keys - zh.keys()}"
for asset in ("lingyu.ico", "Fonts/Manrope400.ttf", "Fonts/NotoSansSC400.ttf", "Fonts/Manrope-OFL.txt", "Fonts/NotoSansSC-OFL.txt", "ThirdParty/Markdig-LICENSE.txt"):
    assert (app / "Assets" / asset).is_file(), f"Missing resource: {asset}"
legacy = (root / "src/main/ai/systemPrompt.ts").read_text(encoding="utf-8-sig")
assert "legacy Electron client" in legacy and "no tools" in legacy, "Legacy prompt boundary is stale"
print(f"PASS {len(zh)} bilingual keys, literal UI keys, resources and legacy prompt boundary")
