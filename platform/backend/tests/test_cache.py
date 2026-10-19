"""The TTL cache computes once per key even under concurrent misses."""

from __future__ import annotations

import threading
import time

from app.core.cache import cached, invalidate_prefix


def test_concurrent_misses_compute_once():
    invalidate_prefix("test:stampede")
    calls = []

    def slow():
        calls.append(1)
        time.sleep(0.05)
        return 42

    results = []
    threads = [threading.Thread(target=lambda: results.append(cached("test:stampede", slow))) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results == [42] * 8
    assert len(calls) == 1
