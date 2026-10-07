import os
from collections.abc import Iterator

import pytest

# The app reads CORS_ORIGINS once, when it is imported, so a value in the developer's
# shell must go before that import or the CORS tests would depend on it.
os.environ.pop("CORS_ORIGINS", None)

from app.main import app, get_provider, get_route_service, get_weather_provider  # noqa: E402

SERVICES = (get_provider, get_weather_provider, get_route_service)


@pytest.fixture(autouse=True)
def fresh_services(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Every test starts with mock data sources, whatever the shell has set, and with
    no services left over from another test or any dependency override."""
    monkeypatch.setenv("FLIGHT_SOURCE", "mock")
    monkeypatch.setenv("WEATHER_SOURCE", "mock")
    for factory in SERVICES:
        factory.clear()
    yield
    app.dependency_overrides.clear()
    for factory in SERVICES:
        factory.clear()
