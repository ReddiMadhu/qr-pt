"""
ml.py — JSON-based ML prediction endpoints for the two-pass pipeline.

POST /api/ml/submissions  → Run 1: preliminary propensity scoring (no property vulnerability weight)
POST /api/ml/final_score  → Run 2: vulnerability API + 60/40 weighted final propensity

Both endpoints accept:
    { "rows": [ {...}, ... ], "rules": {...}, "weights": {...} }

and return:
    { "row_count": N, "predictions": [...], "shap_global": [...], "shap_local": [...] }

When the real ML model is unavailable the fallback returns the deterministic
mock data from MOCK_PREDICTIONS / MOCK_SHAP_VALUES (sourced from results.py),
keyed by submission_id so ordering is always stable.
"""

import os
import json
import io
import requests as http_requests
import numpy as np
import pandas as pd
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Import mock data from existing routers so we never duplicate it
from routers.properties import MOCK_PROPERTIES
from routers.results import MOCK_PREDICTIONS, MOCK_SHAP_VALUES

router = APIRouter()

# ─── Constants ────────────────────────────────────────────────────────────────

LOW_PROPENSITY_THRESHOLD = 0.30
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY", "")
PROPERTY_API_BASE = os.getenv("PROPERTY_API_BASE", "http://localhost:8000")

# pre-build lookup dicts for O(1) access
_MOCK_PROPERTY_MAP = {m["submission_id"]: m for m in MOCK_PROPERTIES}
_MOCK_PREDICTION_MAP = {p["submission_id"]: p for p in MOCK_PREDICTIONS}

# ─── Mock property metadata fallback (address + property_id per submission) ───
# Used when the Property API / Geoapify calls fail.
_MOCK_PROPERTY_INSIGHTS = {
    "SUB00008": {
        "property_id": "e446ca4d-1231-4da9-bc12-4780e7afccb3",
        "address": "5390 Tara Hill Drive, Dublin, OH 43017, United States of America",
        "latitude": 40.108804,
        "longitude": -83.136119,
        "property_vulnerability_risk": 51,
    },
    "SUB00012": {
        "property_id": "5daeb9db-ca5c-49be-8e9e-24ffe349a1c7",
        "address": "3733 Wendelkin Street, Dallas, TX 75215, United States of America",
        "latitude": 32.75620905,
        "longitude": -96.76893703789453,
        "property_vulnerability_risk": 81,
    },
    "SUB00137": {
        "property_id": "bad38ea1-4973-4142-a1eb-139cd1c4e62e",
        "address": "784 East 31st Street, Minneapolis, MN 55407, United States of America",
        "latitude": 44.946764,
        "longitude": -93.2630013076923,
        "property_vulnerability_risk": 40,
    },
    "SUB07726": {
        "property_id": "47beddf6-4f50-42fe-a087-db79f6a29a59",
        "address": "1409 North Market Street, Jacksonville, FL 32206, United States of America",
        "latitude": 30.340393449573128,
        "longitude": -81.65132263803886,
        "property_vulnerability_risk": 73,
    },
    "SUB09890": {
        "property_id": "042967c1-1bc4-4297-b26e-576a7c0e6fe9",
        "address": "204 Charter Oak Circle, Walnut Creek, CA 94597, United States of America",
        "latitude": 37.919661875920156,
        "longitude": -122.05886738590117,
        "property_vulnerability_risk": 73,
    },
}

# ─── Request schema ───────────────────────────────────────────────────────────

class MLRequest(BaseModel):
    rows: list[dict[str, Any]]
    rules: dict[str, Any] = {}
    weights: dict[str, Any] = {}


# ─── Property API helpers ─────────────────────────────────────────────────────

def _geocode_address(address: str) -> dict:
    """Call Geoapify geocoding API, return structured location payload."""
    url = "https://api.geoapify.com/v1/geocode/search"
    params = {"text": address, "apiKey": GEOAPIFY_API_KEY, "limit": 1}
    resp = http_requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    features = resp.json().get("features", [])
    if not features:
        raise ValueError(f"Geoapify returned no results for address: {address}")
    props = features[0]["properties"]
    geo = features[0]["geometry"]["coordinates"]  # [lon, lat]
    return {
        "address": address,
        "latitude": geo[1],
        "longitude": geo[0],
        "country": props.get("country"),
        "state": props.get("state"),
        "city": props.get("city"),
        "zipcode": props.get("postcode"),
        "images": [],
        "property_type": "residential",
    }


def _add_property(payload: dict) -> str:
    """POST to Property API /add_property, return property_id string."""
    url = f"{PROPERTY_API_BASE}/add_property"
    resp = http_requests.post(url, json=payload, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    property_id = data.get("property_id")
    if not property_id:
        raise ValueError(f"/add_property response missing property_id: {data}")
    return str(property_id)


def _get_vulnerability_score(property_id: str) -> float:
    """GET vulnerability score for a registered property_id."""
    url = f"{PROPERTY_API_BASE}/get_vulnerability_score"
    resp = http_requests.get(url, params={"property_id": property_id}, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    score = data.get("property_vulnerability_score") or data.get("vulnerability_score")
    if score is None:
        raise ValueError(f"get_vulnerability_score response missing score: {data}")
    return float(score)


def _fetch_vulnerability_via_api(address: str, property_type: str = "residential"):
    """
    Full pipeline: address → Geoapify → /add_property → /get_vulnerability_score.
    Returns (property_id, vulnerability_score).
    Raises on any failure (caller handles fallback).
    """
    geo_payload = _geocode_address(address)
    geo_payload["property_type"] = property_type
    property_id = _add_property(geo_payload)
    vuln_score = _get_vulnerability_score(property_id)
    return property_id, vuln_score


def _build_address_from_row(row: dict) -> str:
    """Try to compose an address string from available row fields."""
    for col in ["address", "street_address", "Property_address"]:
        if row.get(col):
            return str(row[col])
    parts = []
    for col in ["city", "Property_city", "City"]:
        if row.get(col):
            parts.append(str(row[col]))
            break
    for col in ["state", "Property_state", "property_state", "State"]:
        if row.get(col):
            parts.append(str(row[col]))
            break
    if parts:
        return ", ".join(parts)
    return ""


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _enrich_from_mock(row: dict, mock_pred: dict, mock_prop: dict) -> dict:
    """Merge model output with mock property/image metadata."""
    quote_propensity = round(float(row.get("Quote_propensity_probability", 0)), 3)
    return {
        **row,
        "propertyId":   mock_prop.get("propertyId"),
        "imageUrl":     mock_prop.get("imageUrl"),
        "roofImageUrl": mock_prop.get("roofImageUrl"),
        "broker_email": mock_prop.get("broker_email"),
        "state":                  row.get("Property_state_code", mock_prop.get("state")),
        "quote_propensity":       quote_propensity,
        "quote_propensity_label": row.get("Quote_propensity", mock_pred.get("quote_propensity", "Mid Propensity")),
        "is_below_threshold":     quote_propensity < LOW_PROPENSITY_THRESHOLD,
    }


def _run_real_pipeline(df: pd.DataFrame, include_vulnerability: bool) -> tuple:
    from ml_pipeline.clean import clean_table
    from ml_pipeline.rules import apply_evaluation
    from ml_pipeline.features import engineer_features
    from ml_pipeline.preprocess import preprocess_submission_data
    from ml_pipeline.shap_utils import prop_shap
    from ml_pipeline.model import predict_xgboost_model

    df_clean = clean_table(df)
    df_rules = apply_evaluation(df_clean, {})
    vul_weight = 0.6 if include_vulnerability else 0.0
    df_feat  = engineer_features(df_rules, {}, vul_weight)
    df_proc  = preprocess_submission_data(df_feat)
    df_shap_local, df_shap_global = prop_shap(df_proc)
    preds_raw = predict_xgboost_model(df_feat, df_proc)

    if isinstance(preds_raw, pd.DataFrame):
        preds_raw = preds_raw.to_dict(orient="records")
    elif isinstance(preds_raw, (pd.Series, np.ndarray)):
        preds_raw = preds_raw.tolist()
    elif isinstance(preds_raw, np.generic):
        preds_raw = [preds_raw.item()]

    return preds_raw, df_shap_global, df_shap_local


def _build_predictions(preds_raw: list, is_final: bool) -> list:
    """Match raw model rows against MOCK_PROPERTIES for image/metadata enrichment."""
    predictions = []
    for row in (preds_raw if isinstance(preds_raw, list) else []):
        if isinstance(row, (int, float)):
            continue
        sid = row.get("submission_id") or row.get("Submission_id", "")
        mock_pred = _MOCK_PREDICTION_MAP.get(sid)
        mock_prop = _MOCK_PROPERTY_MAP.get(sid)
        qp = row.get("Quote_propensity_probability")
        if qp is not None and mock_pred is None:
            predictions.append({
                **row,
                "quote_propensity": qp,
                "quote_propensity_label": row.get("Quote_propensity", "Mid Propensity"),
                "is_below_threshold": qp < LOW_PROPENSITY_THRESHOLD,
            })
            continue
        predictions.append(_enrich_from_mock(row, mock_pred or {}, mock_prop))
    return predictions


# ─── Label helper ─────────────────────────────────────────────────────────────

def _propensity_label(score: float) -> str:
    """Return tier label based on calculated propensity score."""
    if score >= 0.70:
        return "High Propensity"
    elif score >= LOW_PROPENSITY_THRESHOLD:
        return "Mid Propensity"
    return "Low Propensity"


# ─── Mock fallback (Run 1) ───────────────────────────────────────────────────

def _mock_fallback(rows: list[dict], is_final: bool) -> dict:
    """
    Return deterministic mock predictions keyed by submission_id.
    For Run 1 only — Run 2 uses _final_score_pipeline instead.
    """
    predictions = []
    for row in rows:
        sid = row.get("submission_id") or row.get("Submission_id", "")
        mock_pred = _MOCK_PREDICTION_MAP.get(sid)
        mock_prop = _MOCK_PROPERTY_MAP.get(sid)

        if mock_pred:
            base_prob = round(mock_pred["quote_propensity_probability"], 3)
            label = mock_pred["quote_propensity"]
            entry = {
                **row,
                **(mock_prop or {}),
                "submission_id":         sid,
                "property_id":           mock_prop.get("propertyId") if mock_prop else "",
                "quote_propensity":      base_prob,
                "quote_propensity_label": label,
                "is_below_threshold":    base_prob < LOW_PROPENSITY_THRESHOLD,
                "property_vulnerability_risk": mock_pred.get("property_vulnerability_risk"),
                "construction_risk_score":     mock_pred.get("construction_risk"),
                "locality_risk":               mock_pred.get("locality_risk"),
                "coverage_risk":               mock_pred.get("coverage_risk"),
                "claim_history_risk":          mock_pred.get("claim_history_risk"),
                "property_condition_risk":     mock_pred.get("property_condition_risk"),
                "total_risk_score":            mock_pred.get("total_risk_score"),
            }
        else:
            entry = {
                **row,
                "submission_id":          sid,
                "quote_propensity":       0.5,
                "quote_propensity_label": "Mid Propensity",
                "is_below_threshold":     False,
            }
        predictions.append(entry)

    return {
        "row_count":   len(predictions),
        "predictions": predictions,
        "shap_global": MOCK_SHAP_VALUES,
        "shap_local":  [],
    }


# ─── Final score pipeline (Run 2) ────────────────────────────────────────────

def _final_score_pipeline(rows: list[dict]) -> dict:
    """
    Run 2 — No ML modelling.
    For each row:
      1. Try Property API (Geoapify → /add_property → /get_vulnerability_score)
      2. On failure, fall back to mock vulnerability score + mock property_id
      3. Apply formula: final = ((100 - vuln)/100)*0.6 + prelim*0.4
    Returns property_id so the frontend View button can link to PropertyInsights.
    """
    predictions = []
    for row in rows:
        sid = row.get("submission_id") or row.get("Submission_id", "")
        mock_pred = _MOCK_PREDICTION_MAP.get(sid)
        mock_prop = _MOCK_PROPERTY_MAP.get(sid)
        mock_insights = _MOCK_PROPERTY_INSIGHTS.get(sid, {})

        prelim_score = row.get("quote_propensity") or (
            mock_pred["quote_propensity_probability"] if mock_pred else 0.5
        )

        vuln_risk = None
        property_id = None
        try:
            address = _build_address_from_row(row) or mock_insights.get("address", "")
            if address:
                property_id, vuln_risk = _fetch_vulnerability_via_api(address)
                print(f"[final_score] API success for {sid}: property_id={property_id}, vuln={vuln_risk}")
        except Exception as api_err:
            print(f"[final_score] API failed for {sid}: {api_err} — using mock fallback")

        if vuln_risk is None:
            vuln_risk = mock_insights.get("property_vulnerability_risk", 50)
        if property_id is None:
            property_id = mock_insights.get("property_id", mock_prop.get("propertyId", "") if mock_prop else "")

        vuln_normalized = (100 - vuln_risk) / 100.0
        final_prob = round((vuln_normalized * 0.6) + (float(prelim_score) * 0.4), 3)
        final_label = _propensity_label(final_prob)

        entry = {
            "submission_id":              sid,
            "property_insight_id":        property_id,
            "property_vulnerability_risk": vuln_risk,
            "quote_propensity":          final_prob,
            "quote_propensity_label":    final_label,
        }
        predictions.append(entry)

    return {
        "row_count":   len(predictions),
        "predictions": predictions,
        "shap_global": MOCK_SHAP_VALUES,
        "shap_local":  [],
    }


# ─── Core dispatcher ──────────────────────────────────────────────────────────

def _run_pipeline(rows: list[dict], is_final: bool) -> dict:
    """Try real ML pipeline; fall back to mock on any error."""
    try:
        df = pd.DataFrame(rows)
        preds_raw, df_shap_global, df_shap_local = _run_real_pipeline(df, include_vulnerability=is_final)
        predictions = _build_predictions(preds_raw, is_final)
        shap_global = df_shap_global.to_dict(orient="records") if isinstance(df_shap_global, pd.DataFrame) else (df_shap_global or MOCK_SHAP_VALUES)
        shap_local  = df_shap_local.to_dict(orient="records")  if isinstance(df_shap_local,  pd.DataFrame) else []
        return {
            "row_count":   len(predictions),
            "predictions": predictions,
            "shap_global": shap_global,
            "shap_local":  shap_local,
        }
    except Exception as exc:
        print(f"[ml.py] Real pipeline unavailable ({exc!r}), using mock fallback.")
        return _mock_fallback(rows, is_final)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/submissions")
async def run_preliminary_predictions(payload: MLRequest):
    """
    Run 1 — Preliminary propensity scoring (no property vulnerability weight).
    """
    if not payload.rows:
        raise HTTPException(status_code=400, detail="No rows provided in request body.")
    return _run_pipeline(payload.rows, is_final=False)


@router.post("/final_score")
async def run_final_predictions(payload: MLRequest):
    """
    Run 2 — Final propensity scoring.

    Bypasses ML pipeline. Calls the Property API (Geoapify → /add_property →
    /get_vulnerability_score) for each property. On failure, falls back to mock
    vulnerability scores.

    Applies: final = ((100 - vulnerability) / 100) * 0.6 + preliminary * 0.4

    Returns property_id so the frontend View button can link to PropertyInsights.
    """
    if not payload.rows:
        raise HTTPException(
            status_code=400,
            detail="No rows provided. BPO-excluded properties must be filtered before calling /final_score."
        )
    return _final_score_pipeline(payload.rows)
