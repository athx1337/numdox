import json
from cli.numlookup_tool import resolve_number_intel, sanitize_text

def test_resolve_number_intel():
    output = resolve_number_intel("9810012345")
    assert output is not None
    data = json.loads(output)
    assert "data" in data
    assert len(data["data"]) > 0
    item = data["data"][0]
    assert "+919810012345" in item["target"]
    assert "Airtel" in item.get("carrier", "") or "Indian" in item.get("carrier", "")

def test_sanitize_text():
    raw = '{"notice": "clean", "join_main": "https://old.link"}'
    cleaned = sanitize_text(raw)
    assert "https://t.me/ExploitsAbout" in cleaned
