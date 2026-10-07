import subprocess
import sys


def test_the_live_modules_do_not_load_the_mock_data() -> None:
    # In a fresh interpreter: this process has long since imported the mock modules.
    code = (
        "import sys\n"
        "import app.routes, app.opensky, app.awc, app.providers\n"
        "loaded = [m for m in ('app.mock_flights', 'app.mock_weather', 'app.mock_providers')"
        " if m in sys.modules]\n"
        "assert not loaded, loaded\n"
    )
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
