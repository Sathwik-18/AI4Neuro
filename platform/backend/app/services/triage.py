"""Review priority: a triage aid for ordering the clinician worklist.

Adapted from ManasMitra's urgency tiers. It is derived from the model output
only (prediction + confidence) and is never a diagnosis.
"""

from __future__ import annotations

# Below this, the model is unsure enough that the case deserves a closer look
# whatever it predicted.
CONFIDENCE_THRESHOLD = 0.6

ROUTINE = "routine"
PRIORITY = "priority"
URGENT = "urgent"
TIERS = (ROUTINE, PRIORITY, URGENT)

_AD_LABELS = {"AD", "ALZHEIMER'S", "ALZHEIMERS", "DEMENTIA"}
_CN_LABELS = {"CN", "NORMAL"}

# Legacy rows (old EEG binary model / old upload form) use other names.
_ANALYSIS_TYPE_ALIASES = {"multi-disease": "multiclass", "ad-only": "binary"}


def canonical_prediction(prediction: str | None) -> str | None:
    """Map legacy labels ("Alzheimer's", "Normal") onto CN / MCI / AD."""
    if not prediction:
        return None
    label = prediction.strip().upper()
    if label in _AD_LABELS:
        return "AD"
    if label in _CN_LABELS:
        return "CN"
    return prediction.strip()


def canonical_analysis_type(analysis_type: str | None) -> str | None:
    return _ANALYSIS_TYPE_ALIASES.get(analysis_type or "", analysis_type)


def review_priority(prediction: str | None, confidence: float | None) -> str | None:
    """routine (confident CN) · priority (MCI or any low-confidence result) ·
    urgent (confident AD). None when there is no result yet."""
    if not prediction:
        return None
    label = prediction.strip().upper()
    confident = (confidence or 0.0) >= CONFIDENCE_THRESHOLD
    if label in _AD_LABELS:
        return URGENT if confident else PRIORITY
    if label in _CN_LABELS:
        return ROUTINE if confident else PRIORITY
    return PRIORITY
