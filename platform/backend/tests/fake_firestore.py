"""In-memory stand-in for the google-cloud-firestore client + a storage bucket.

Implements only what ``app.services.firebase_client`` calls, and enforces the
Firestore rule that bites in practice: arrays may not directly contain arrays.
Lets the whole API suite run through the real Firebase adapter with no
credentials or emulator.
"""

from __future__ import annotations

import copy
import uuid
from typing import Any


def _reject_nested_arrays(value: Any, in_array: bool = False) -> None:
    if isinstance(value, (list, tuple)):
        if in_array:
            raise ValueError("Firestore: nested arrays are not supported.")
        for v in value:
            _reject_nested_arrays(v, True)
    elif isinstance(value, dict):
        for v in value.values():
            _reject_nested_arrays(v)


class _Snap:
    def __init__(self, ref: "_Doc", data: dict | None) -> None:
        self.reference = ref
        self.exists = data is not None
        self._data = data

    def to_dict(self) -> dict | None:
        return copy.deepcopy(self._data)


class _Doc:
    def __init__(self, docs: dict[str, dict], doc_id: str) -> None:
        self._docs = docs
        self.id = doc_id

    def get(self) -> _Snap:
        return _Snap(self, self._docs.get(self.id))

    def set(self, data: dict) -> None:
        _reject_nested_arrays(data)
        self._docs[self.id] = copy.deepcopy(data)

    def update(self, patch: dict) -> None:
        _reject_nested_arrays(patch)
        if self.id not in self._docs:
            raise KeyError(f"No document to update: {self.id}")
        self._docs[self.id].update(copy.deepcopy(patch))

    def delete(self) -> None:
        self._docs.pop(self.id, None)


class _Query:
    def __init__(self, docs: dict[str, dict], filters: list | None = None, fields: list | None = None) -> None:
        self._docs = docs
        self._filters = filters or []
        self._fields = fields

    def document(self, doc_id: str) -> _Doc:
        return _Doc(self._docs, doc_id)

    def where(self, *, filter: Any) -> "_Query":
        return _Query(self._docs, [*self._filters, filter], self._fields)

    def select(self, fields: list[str]) -> "_Query":
        return _Query(self._docs, self._filters, list(fields))

    def stream(self):
        for doc_id, data in list(self._docs.items()):
            if all(self._match(data, f) for f in self._filters):
                shown = data if self._fields is None else {k: data.get(k) for k in self._fields}
                yield _Snap(_Doc(self._docs, doc_id), shown)

    @staticmethod
    def _match(data: dict, f: Any) -> bool:
        value = data.get(f.field_path)
        if f.op_string == "==":
            return value == f.value
        if f.op_string == "in":
            return value in f.value
        raise NotImplementedError(f.op_string)


class _Batch:
    def __init__(self) -> None:
        self._ops: list = []

    def update(self, ref: _Doc, patch: dict) -> None:
        self._ops.append(lambda: ref.update(patch))

    def delete(self, ref: _Doc) -> None:
        self._ops.append(ref.delete)

    def commit(self) -> None:
        assert len(self._ops) <= 500, "Firestore batch limit exceeded"
        for op in self._ops:
            op()
        self._ops = []


class FakeFirestore:
    def __init__(self) -> None:
        self.collections: dict[str, dict[str, dict]] = {}

    def collection(self, name: str) -> _Query:
        return _Query(self.collections.setdefault(name, {}))

    def get_all(self, refs: list[_Doc]):
        return [ref.get() for ref in refs]

    def batch(self) -> _Batch:
        return _Batch()


class _Blob:
    def __init__(self, store: dict[str, bytes], name: str) -> None:
        self._store = store
        self.name = name

    def upload_from_string(self, data: bytes, content_type: str | None = None) -> None:
        self._store[self.name] = bytes(data)

    def download_as_bytes(self) -> bytes:
        try:
            return self._store[self.name]
        except KeyError:
            raise FileNotFoundError(self.name) from None

    def generate_signed_url(self, **_: Any) -> str:
        # Same shape as a real v4 signed URL: /{bucket}/{object path}?X-Goog-...
        return f"https://storage.googleapis.com/fake-bucket/{self.name}?X-Goog-Signature={uuid.uuid4().hex[:8]}"


class FakeBucket:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def blob(self, name: str) -> _Blob:
        return _Blob(self.objects, name)
