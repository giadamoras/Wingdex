import gzip
import importlib.util
from pathlib import Path
from typing import Any

from app.aircraft_types import DEFAULT_PATH, load_aircraft_types

BACKEND = Path(__file__).resolve().parent.parent


def load_build_script() -> Any:
    spec = importlib.util.spec_from_file_location(
        "build_aircraft_types", BACKEND / "scripts" / "build_aircraft_types.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_missing_file_gives_an_empty_table(tmp_path: Path) -> None:
    assert load_aircraft_types(tmp_path / "nope.csv.gz") == {}


def test_damaged_files_give_an_empty_table(tmp_path: Path) -> None:
    not_gzip = tmp_path / "a.csv.gz"
    not_gzip.write_bytes(b"this is not gzip")
    cut_short = tmp_path / "b.csv.gz"
    cut_short.write_bytes(gzip.compress(b"4ca7b5,B738\n" * 1000)[:-20])
    bad_text = tmp_path / "c.csv.gz"
    bad_text.write_bytes(gzip.compress(b"\xff\xfe,B738\n"))
    for path in (not_gzip, cut_short, bad_text):
        assert load_aircraft_types(path) == {}


def test_a_failed_load_is_not_remembered(tmp_path: Path) -> None:
    path = tmp_path / "types.csv.gz"
    assert load_aircraft_types(path) == {}  # missing now
    path.write_bytes(gzip.compress(b"4ca7b5,B738\n"))
    assert load_aircraft_types(path) == {"4ca7b5": "B738"}  # found on the next call


def test_loads_icao24_to_type(tmp_path: Path) -> None:
    path = tmp_path / "types.csv.gz"
    path.write_bytes(gzip.compress(b"4ca7b5,B738\n000001,AN2\nbroken line\n"))
    assert load_aircraft_types(path) == {"4ca7b5": "B738", "000001": "AN2"}


def test_build_script_keeps_only_aircraft_with_a_type(tmp_path: Path) -> None:
    source = tmp_path / "db.csv"
    source.write_text(
        "'icao24','model','typecode'\n"
        "'4CA7B5','737-8AS','b738'\n"  # upper-case address, lower-case type
        "'000001','Antonov 2',''\n"  # no type: dropped
        "'','Ghost','A320'\n"  # no address: dropped
        "'a835af','Gulfstream','GLF6'\n",
        encoding="utf-8",
    )
    output = tmp_path / "out" / "types.csv.gz"
    build = load_build_script().build
    assert build(source, output) == 2
    assert load_aircraft_types(output) == {"4ca7b5": "B738", "a835af": "GLF6"}


def test_bundled_file_is_present_and_looks_right() -> None:
    types = load_aircraft_types()
    assert DEFAULT_PATH.exists()
    assert len(types) > 400_000  # about 500,000 aircraft in the January 2025 snapshot
    assert all(len(code) <= 4 for code in list(types.values())[:1000])
