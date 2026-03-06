import os
import math
import smtplib
import pandas as pd
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# ── Property data (inlined from properties.py) ───────────────────────────────

PROPERTY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

MOCK_PROPERTIES = [
    {
        "id": 1,
        "propertyId": "A",
        "submission_id": "SUB00008",
        "imageUrl": "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop",
        "roofImageUrl": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
        "submission_channel": "Online",
        "occupancy_type": "Rental Property",
        "property_age": 50,
        "property_value": 4819756,
        "property_county": "San Francisco (County)",
        "cover_type": "Both",
        "building_coverage_limit": 4617581.93,
        "contents_coverage_limit": 2009177.54,
        "broker_company": "",
        "broker_email": "broker@uwt.org",
        "construction_risk": "High",
        "state": "CA",
    },
    {
        "id": 2,
        "propertyId": "B",
        "submission_id": "SUB00012",
        "imageUrl": "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop",
        "roofImageUrl": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop",
        "submission_channel": "Broker",
        "occupancy_type": "Secondary Home",
        "property_age": 61,
        "property_value": 4909344,
        "property_county": "Franklin (County)",
        "cover_type": "Building Only",
        "building_coverage_limit": 4441112.02,
        "contents_coverage_limit": 0,
        "broker_company": "Coastal Risk Advisors",
        "broker_email": "submissions@coastalriskadvisors.com",
        "construction_risk": "High",
        "state": "OH",
    },
    {
        "id": 3,
        "propertyId": "C",
        "submission_id": "SUB00137",
        "imageUrl": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop",
        "roofImageUrl": "https://images.unsplash.com/photo-1622021142947-da7dedc7c39a?w=800&h=600&fit=crop",
        "submission_channel": "Broker",
        "occupancy_type": "Secondary Home",
        "property_age": 73,
        "property_value": 537749,
        "property_county": "Harris (County)",
        "cover_type": "Building Only",
        "building_coverage_limit": 534885.53,
        "contents_coverage_limit": 0,
        "broker_company": "National Brokers",
        "broker_email": "uwt@nationalbrokers.com",
        "construction_risk": "High",
        "state": "TX",
    },
    {
        "id": 4,
        "propertyId": "D",
        "submission_id": "SUB00164",
        "imageUrl": "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop",
        "roofImageUrl": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop",
        "submission_channel": "Online",
        "occupancy_type": "Rental Property",
        "property_age": 3,
        "property_value": 169435,
        "property_county": "Minnesota (County)",
        "cover_type": "Contents Only",
        "building_coverage_limit": 0,
        "contents_coverage_limit": 57901.45,
        "broker_company": "",
        "broker_email": "broker@uwt.org",
        "construction_risk": "Low",
        "state": "MN",
    },
    {
        "id": 5,
        "propertyId": "E",
        "submission_id": "SUB07726",
        "imageUrl": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop",
        "roofImageUrl": "https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800&h=600&fit=crop",
        "submission_channel": "Broker",
        "occupancy_type": "Primary Residence",
        "property_age": 29,
        "property_value": 2219072,
        "property_county": "Kiowa (County)",
        "cover_type": "Contents Only",
        "building_coverage_limit": 0,
        "contents_coverage_limit": 464806.04,
        "broker_company": "National Brokers",
        "broker_email": "uwt@nationalbrokers.com",
        "construction_risk": "Medium",
        "state": "CO",
    },
    {
        "id": 6,
        "propertyId": "F",
        "submission_id": "SUB09890",
        "imageUrl": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
        "roofImageUrl": "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=800&h=600&fit=crop",
        "submission_channel": "Broker",
        "occupancy_type": "Primary Residence",
        "property_age": 41,
        "property_value": 734100,
        "property_county": "Miami-Dade (County)",
        "cover_type": "Contents Only",
        "building_coverage_limit": 0,
        "contents_coverage_limit": 231875.83,
        "broker_company": "Metro Risk Solutions",
        "broker_email": "submissions@metrorisksolutions.com",
        "construction_risk": "Medium",
        "state": "FL",
    },
]

_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_csv_path = os.path.join(_base_dir, "Test", "Property_data - AI.csv")


def _clean(value, fallback=None):
    if value is None:
        return fallback
    try:
        if math.isnan(float(value)):
            return fallback
    except (TypeError, ValueError):
        pass
    return value


def _normalize_sub_id(value, fallback=None):
    return _clean(value, fallback)


def _get_properties():
    try:
        if not os.path.exists(_csv_path):
            return MOCK_PROPERTIES
        df = pd.read_csv(_csv_path)
        excel_records = df.to_dict(orient="records")
        merged_records = []
        for i, record in enumerate(excel_records[:6]):
            mock = MOCK_PROPERTIES[i % len(MOCK_PROPERTIES)]
            merged_record = {
                "id": i + 1,
                "propertyId": PROPERTY_LETTERS[i],
                "submission_id": _normalize_sub_id(record.get("submission_id"), mock.get("submission_id")),
                "submission_channel": _clean(record.get("submission_channel"), mock.get("submission_channel")),
                "occupancy_type": _clean(record.get("occupancy_type"), mock.get("occupancy_type")),
                "property_age": _clean(record.get("property_age"), mock.get("property_age")),
                "property_value": _clean(record.get("property_value"), mock.get("property_value")),
                "property_county": _clean(record.get("Property_county"), mock.get("property_county")),
                "cover_type": _clean(record.get("cover_type"), mock.get("cover_type")),
                "building_coverage_limit": _clean(record.get("building_coverage_limit"), mock.get("building_coverage_limit")),
                "contents_coverage_limit": _clean(record.get("contents_coverage_limit"), mock.get("contents_coverage_limit")),
                "broker_company": _clean(record.get("broker_company"), mock.get("broker_company")),
                "broker_email": _clean(record.get("broker_email"), mock.get("broker_email", "broker@uwt.org")),
                "applicant_email": _clean(record.get("Applicant_Email"), ""),
                "income": _clean(record.get("income"), mock.get("income", 150000)),
                "property_past_loss_freq": _clean(record.get("property_past_loss_freq"), mock.get("property_past_loss_freq", 0)),
                "property_past_claim_amount": _clean(record.get("property_past_claim_amount"), mock.get("property_past_claim_amount", 0)),
                "construction_risk": mock.get("construction_risk"),
                "state": mock.get("state"),
                "imageUrl": mock.get("imageUrl"),
                "roofImageUrl": mock.get("roofImageUrl"),
            }
            merged_records.append(merged_record)
        return merged_records
    except Exception as e:
        print("Error:", e)
        return MOCK_PROPERTIES


# ── Mock ML prediction data (inlined from results.py) ────────────────────────

MOCK_PREDICTIONS = [
    {
        "submission_id": "SUB00008",
        "submission_channel": "Online",
        "property_state": "CA",
        "occupancy_type": "Rental Property",
        "cover_type": "Both",
        "property_vulnerability_risk": 75,
        "construction_risk": 49,
        "locality_risk": 39,
        "coverage_risk": 61,
        "claim_history_risk": 11,
        "property_condition_risk": 33,
        "broker_performance": 38,
        "total_risk_score": 46,
        "quote_propensity_probability": 0.8980314635,
        "quote_propensity": "High Propensity",
    },
    {
        "submission_id": "SUB00012",
        "submission_channel": "Broker",
        "property_state": "OH",
        "occupancy_type": "Secondary Home",
        "cover_type": "Building Only",
        "property_vulnerability_risk": 60,
        "construction_risk": 44,
        "locality_risk": 23,
        "coverage_risk": 64,
        "claim_history_risk": 34,
        "property_condition_risk": 19,
        "broker_performance": 46,
        "total_risk_score": 38,
        "quote_propensity_probability": 0.9307270536,
        "quote_propensity": "High Propensity",
    },
    {
        "submission_id": "SUB00137",
        "submission_channel": "Broker",
        "property_state": "TX",
        "occupancy_type": "Secondary Home",
        "cover_type": "Building Only",
        "property_vulnerability_risk": 85,
        "construction_risk": 45,
        "locality_risk": 18,
        "coverage_risk": 70,
        "claim_history_risk": 47,
        "property_condition_risk": 31,
        "broker_performance": 50,
        "total_risk_score": 45,
        "quote_propensity_probability": 0.8465048576,
        "quote_propensity": "High Propensity",
    },
    {
        "submission_id": "SUB00164",
        "submission_channel": "Online",
        "property_state": "MN",
        "occupancy_type": "Rental Property",
        "cover_type": "Contents Only",
        "property_vulnerability_risk": 95,
        "construction_risk": 39,
        "locality_risk": 43,
        "coverage_risk": 78,
        "claim_history_risk": 34,
        "property_condition_risk": 31,
        "broker_performance": 50,
        "total_risk_score": 54,
        "quote_propensity_probability": 0.4319356302,
        "quote_propensity": "Mid Propensity",
        "excluded": True,
        "exclusion_reason": "Contents coverage of $9,000 is below the product minimum of $10,000. Annual income of $8,000 falls below the acceptable underwriting threshold of $10,000.",
        "exclusion_parameters": [
            {
                "label": "Contents coverage below product minimum",
                "description": "Contents coverage limit <= 10,000 and has fine arts coverage",
                "value": "$9,000",
            },
            {
                "label": "Client income below acceptable threshold",
                "description": "Annual income < 10,000",
                "value": "$8,000",
            },
        ],
    },
    {
        "submission_id": "SUB07726",
        "submission_channel": "Broker",
        "property_state": "CO",
        "occupancy_type": "Primary Residence",
        "cover_type": "Contents Only",
        "property_vulnerability_risk": 85,
        "construction_risk": 44,
        "locality_risk": 14,
        "coverage_risk": 61,
        "claim_history_risk": 11,
        "property_condition_risk": 23,
        "broker_performance": 31,
        "total_risk_score": 38,
        "quote_propensity_probability": 0.4516881039,
        "quote_propensity": "Mid Propensity",
    },
    {
        "submission_id": "SUB09890",
        "submission_channel": "Broker",
        "property_state": "FL",
        "occupancy_type": "Primary Residence",
        "cover_type": "Contents Only",
        "property_vulnerability_risk": 95,
        "construction_risk": 45,
        "locality_risk": 30,
        "coverage_risk": 64,
        "claim_history_risk": 22,
        "property_condition_risk": 27,
        "broker_performance": 35,
        "total_risk_score": 47,
        "quote_propensity_probability": 0.0357155295,
        "quote_propensity": "Low Propensity",
    },
]

MOCK_LOCAL_SHAP = [
    [
        {"feature": "annual_income",              "mean_abs_shap": 1.2841},
        {"feature": "building_coverage_limit",    "mean_abs_shap": 0.9103},
        {"feature": "Property_past_loss_freq",    "mean_abs_shap": 0.7812},
        {"feature": "cover_type_Building Only",   "mean_abs_shap": 0.6124},
        {"feature": "total_risk_score",           "mean_abs_shap": 0.4903},
        {"feature": "property_age",               "mean_abs_shap": 0.3571},
        {"feature": "roof_material_Wood",         "mean_abs_shap": 0.3214},
        {"feature": "Local_Fire_Incident_Rate",   "mean_abs_shap": 0.2987},
        {"feature": "construction_permit_Valid",  "mean_abs_shap": 0.2415},
        {"feature": "Local_Crime_Rate",           "mean_abs_shap": 0.1932},
    ],
    [
        {"feature": "annual_income",              "mean_abs_shap": 1.1674},
        {"feature": "cover_type_Building Only",   "mean_abs_shap": 0.8920},
        {"feature": "building_coverage_limit",    "mean_abs_shap": 0.7543},
        {"feature": "Local_Fire_Incident_Rate",   "mean_abs_shap": 0.6218},
        {"feature": "Property_past_loss_freq",    "mean_abs_shap": 0.5431},
        {"feature": "roof_material_Wood",         "mean_abs_shap": 0.4867},
        {"feature": "total_risk_score",           "mean_abs_shap": 0.3102},
        {"feature": "property_age",               "mean_abs_shap": 0.2784},
        {"feature": "Local_Crime_Rate",           "mean_abs_shap": 0.2341},
        {"feature": "construction_permit_Valid",  "mean_abs_shap": 0.1893},
    ],
    [
        {"feature": "building_coverage_limit",    "mean_abs_shap": 1.0231},
        {"feature": "annual_income",              "mean_abs_shap": 0.9872},
        {"feature": "cover_type_Building Only",   "mean_abs_shap": 0.7614},
        {"feature": "Property_past_loss_freq",    "mean_abs_shap": 0.6043},
        {"feature": "construction_permit_Valid",  "mean_abs_shap": 0.4312},
        {"feature": "total_risk_score",           "mean_abs_shap": 0.3187},
        {"feature": "property_age",               "mean_abs_shap": 0.2543},
        {"feature": "Local_Crime_Rate",           "mean_abs_shap": 0.2198},
        {"feature": "roof_material_Wood",         "mean_abs_shap": 0.1874},
        {"feature": "Local_Fire_Incident_Rate",   "mean_abs_shap": 0.1521},
    ],
    [
        {"feature": "total_risk_score",           "mean_abs_shap": 1.1043},
        {"feature": "Property_past_loss_freq",    "mean_abs_shap": 0.8762},
        {"feature": "annual_income",              "mean_abs_shap": 0.7981},
        {"feature": "Local_Fire_Incident_Rate",   "mean_abs_shap": 0.6534},
        {"feature": "building_coverage_limit",    "mean_abs_shap": 0.5217},
        {"feature": "cover_type_Building Only",   "mean_abs_shap": 0.4389},
        {"feature": "Local_Crime_Rate",           "mean_abs_shap": 0.3812},
        {"feature": "roof_material_Wood",         "mean_abs_shap": 0.3104},
        {"feature": "construction_permit_Valid",  "mean_abs_shap": 0.2673},
        {"feature": "property_age",               "mean_abs_shap": 0.2241},
    ],
    [
        {"feature": "annual_income",              "mean_abs_shap": 0.9812},
        {"feature": "building_coverage_limit",    "mean_abs_shap": 0.8134},
        {"feature": "construction_permit_Valid",  "mean_abs_shap": 0.6743},
        {"feature": "Property_past_loss_freq",    "mean_abs_shap": 0.4921},
        {"feature": "cover_type_Building Only",   "mean_abs_shap": 0.4103},
        {"feature": "property_age",               "mean_abs_shap": 0.3487},
        {"feature": "total_risk_score",           "mean_abs_shap": 0.2934},
        {"feature": "Local_Crime_Rate",           "mean_abs_shap": 0.2512},
        {"feature": "roof_material_Wood",         "mean_abs_shap": 0.2087},
        {"feature": "Local_Fire_Incident_Rate",   "mean_abs_shap": 0.1743},
    ],
    [
        {"feature": "cover_type_Building Only",   "mean_abs_shap": 0.8934},
        {"feature": "annual_income",              "mean_abs_shap": 0.7821},
        {"feature": "building_coverage_limit",    "mean_abs_shap": 0.6312},
        {"feature": "construction_permit_Valid",  "mean_abs_shap": 0.5187},
        {"feature": "property_age",               "mean_abs_shap": 0.3924},
        {"feature": "Property_past_loss_freq",    "mean_abs_shap": 0.3214},
        {"feature": "Local_Crime_Rate",           "mean_abs_shap": 0.2743},
        {"feature": "total_risk_score",           "mean_abs_shap": 0.2187},
        {"feature": "roof_material_Wood",         "mean_abs_shap": 0.1893},
        {"feature": "Local_Fire_Incident_Rate",   "mean_abs_shap": 0.1432},
    ],
]

MOCK_VULNERABILITY = [
    {
        "roof_detection": {"condition": "Fair", "damage_areas": ["NW corner wear", "Flashing separation at chimney"], "material": "Asphalt Shingle", "age_estimate": "16-20 years", "confidence": 0.87},
        "proximity": {"wildfire_zone": "Moderate (2.8 mi to WUI boundary)", "hurricane_zone": "Category 1 exposure", "fault_line": "4.2 mi to nearest active fault", "flood_zone": "Zone X (minimal risk)"},
        "object_detection": {"findings": [{"label": "Roof surface wear", "confidence": 0.91, "risk": "Medium"}, {"label": "Overhanging tree", "confidence": 0.84, "risk": "Low"}], "model": "YOLOv8-property-v2"},
        "insight_image": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
    },
    {
        "roof_detection": {"condition": "Poor", "damage_areas": ["Missing shingles (east section)", "Visible granule loss", "Moss growth"], "material": "Wood Shake", "age_estimate": "22-28 years", "confidence": 0.92},
        "proximity": {"wildfire_zone": "High (0.9 mi to WUI boundary)", "hurricane_zone": "Category 2-3 exposure", "fault_line": "1.8 mi to active fault", "flood_zone": "Zone AE (high risk)"},
        "object_detection": {"findings": [{"label": "Missing shingles", "confidence": 0.95, "risk": "High"}, {"label": "Dense vegetation", "confidence": 0.89, "risk": "High"}, {"label": "Cracked chimney cap", "confidence": 0.83, "risk": "Medium"}], "model": "YOLOv8-property-v2"},
        "insight_image": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop",
    },
    {
        "roof_detection": {"condition": "Excellent", "damage_areas": [], "material": "Metal Standing Seam", "age_estimate": "3-6 years", "confidence": 0.96},
        "proximity": {"wildfire_zone": "Low (6.1 mi to WUI boundary)", "hurricane_zone": "Category 1 exposure (coastal setback met)", "fault_line": "12.4 mi to nearest fault", "flood_zone": "Zone X (minimal risk)"},
        "object_detection": {"findings": [{"label": "Solar panel installation", "confidence": 0.93, "risk": "Low"}, {"label": "New guttering system", "confidence": 0.88, "risk": "Low"}], "model": "YOLOv8-property-v2"},
        "insight_image": "https://images.unsplash.com/photo-1622021142947-da7dedc7c39a?w=800&h=600&fit=crop",
    },
    {
        "roof_detection": {"condition": "Critical", "damage_areas": ["Sagging ridge line", "Multiple missing tiles", "Water staining visible"], "material": "Clay Tile", "age_estimate": "32-40 years", "confidence": 0.94},
        "proximity": {"wildfire_zone": "Very High (0.3 mi to WUI boundary)", "hurricane_zone": "Category 3-4 exposure", "fault_line": "0.9 mi to active fault", "flood_zone": "Zone A (high risk, no BFE)"},
        "object_detection": {"findings": [{"label": "Severe roof damage", "confidence": 0.97, "risk": "High"}, {"label": "Foundation cracks", "confidence": 0.88, "risk": "High"}, {"label": "Dead trees (3)", "confidence": 0.92, "risk": "High"}], "model": "YOLOv8-property-v2"},
        "insight_image": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
    },
    {
        "roof_detection": {"condition": "Good", "damage_areas": ["Minor granule loss (south slope)"], "material": "Asphalt Shingle", "age_estimate": "10-14 years", "confidence": 0.89},
        "proximity": {"wildfire_zone": "Low-Moderate (3.5 mi to WUI boundary)", "hurricane_zone": "Category 1 exposure", "fault_line": "7.2 mi to nearest fault", "flood_zone": "Zone X (minimal risk)"},
        "object_detection": {"findings": [{"label": "Minor shingle wear", "confidence": 0.86, "risk": "Low"}, {"label": "Pool proximity", "confidence": 0.91, "risk": "Low"}], "model": "YOLOv8-property-v2"},
        "insight_image": "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop",
    },
    {
        "roof_detection": {"condition": "Good", "damage_areas": [], "material": "Composite Shingle", "age_estimate": "6-9 years", "confidence": 0.91},
        "proximity": {"wildfire_zone": "Low (5.2 mi to WUI boundary)", "hurricane_zone": "Category 1 exposure", "fault_line": "9.8 mi to nearest fault", "flood_zone": "Zone X (minimal risk)"},
        "object_detection": {"findings": [{"label": "Clean roof surface", "confidence": 0.94, "risk": "Low"}, {"label": "Well-maintained yard", "confidence": 0.87, "risk": "Low"}], "model": "YOLOv8-property-v2"},
        "insight_image": "https://images.unsplash.com/photo-1449844908441-8829872d2607?w=800&h=600&fit=crop",
    },
]

# ── Email config ─────────────────────────────────────────────────────────────

TEAM_EMAILS = {
    "High": "madhu269reddi@gmail.com",
    "Mid": "madhu269reddi@gmail.com",
    "Low": "madhu269reddi@gmail.com",
}

SENDER_EMAIL = "madhu269reddi@gmail.com"
BASE_URL = os.getenv("TRIAGE_BASE_URL", "http://localhost:5173")

POSITION_PROPENSITY = [
    {"tier": "High", "label": "High Propensity", "score": 0.8980},
    {"tier": "High", "label": "High Propensity", "score": 0.9307},
    {"tier": "High", "label": "High Propensity", "score": 0.8465},
    {"tier": "Mid",  "label": "Mid Propensity",  "score": 0.4319},
    {"tier": "Mid",  "label": "Mid Propensity",  "score": 0.4517},
    {"tier": "Low",  "label": "Low Propensity",  "score": 0.0357},
]


class TriageRequest(BaseModel):
    submissionId: Optional[int] = None


class LetterRequest(BaseModel):
    submissionId: str
    applicantEmail: str
    brokerCompany: Optional[str] = ""
    propertyCounty: Optional[str] = ""
    letterType: str  # "intent" or "not_interested"


def _build_email(tier: str, submission_ids: list[str], today_str: str) -> MIMEMultipart:
    propensity_param = tier.lower()
    triage_url = f"{BASE_URL}/triage?propensity={propensity_param}"
    ids_str = ", ".join(submission_ids)
    count = len(submission_ids)

    subject = f"Submissions for {today_str} – {tier} Propensity"

    plain = (
        f"Dear {tier} Propensity UWT Team,\n\n"
        f"The AI underwriting agent has identified {count} submission(s) classified as "
        f"{tier} Propensity that require your review.\n\n"
        f"Submission IDs: {ids_str}\n\n"
        f"Please review the details at:\n{triage_url}\n\n"
        f"This email was sent automatically by the UWT AI Agent ({SENDER_EMAIL})."
    )

    color_map = {"High": "#16a34a", "Mid": "#d97706", "Low": "#dc2626"}
    badge_color = color_map.get(tier, "#6b7280")

    html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#111827;max-width:600px;margin:auto;padding:24px">
      <h2 style="color:{badge_color}">UWT AI Agent — {tier} Propensity Triage</h2>
      <p>Dear <strong>{tier} Propensity UWT Team</strong>,</p>
      <p>The AI underwriting agent has identified <strong>{count} submission(s)</strong>
         classified as <strong>{tier} Propensity</strong> that require your review.</p>
      <p><strong>Submission IDs:</strong> {ids_str}</p>
      <p>
        <a href="{triage_url}"
           style="display:inline-block;background:{badge_color};color:#fff;padding:10px 20px;
                  border-radius:6px;text-decoration:none;font-weight:bold">
          Review {tier} Propensity Submissions
        </a>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="font-size:12px;color:#6b7280">
        This email was sent automatically by the UWT AI Agent ({SENDER_EMAIL}).
      </p>
    </body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SENDER_EMAIL
    msg["To"] = TEAM_EMAILS[tier]
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))
    return msg


@router.post("/send-emails")
def send_triage_emails(request: TriageRequest):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")

    today_str = date.today().strftime("%b %d, %Y")

    properties = _get_properties()
    tiers: dict[str, list[str]] = {"High": [], "Mid": [], "Low": []}
    for i, prop in enumerate(properties[:6]):
        if i < len(POSITION_PROPENSITY):
            pred = MOCK_PREDICTIONS[i]
            if pred.get("excluded", False):
                continue
            tier = POSITION_PROPENSITY[i]["tier"]
            tiers[tier].append(prop["submission_id"])

    tier_counts = {k: len(v) for k, v in tiers.items()}

    if not smtp_host or not smtp_user or not smtp_pass:
        return {
            "status": "skipped",
            "reason": "SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS env vars",
            "tiers": tier_counts,
        }

    emails = [_build_email(tier, ids, today_str) for tier, ids in tiers.items() if ids]

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            for msg in emails:
                server.sendmail(SENDER_EMAIL, msg["To"], msg.as_string())
    except Exception as exc:
        return {"status": "error", "reason": str(exc), "tiers": tier_counts}

    return {"status": "sent", "tiers": tier_counts}


@router.post("/send-letter")
def send_letter(request: LetterRequest):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")

    broker = request.brokerCompany or "Broker"
    sub_id = request.submissionId
    today_str = date.today().strftime("%b %d, %Y")

    if request.letterType == "intent":
        subject = f"Re: Submission {sub_id} — Risk Cleared"
        plain = (
            f"Dear {broker},\n\n"
            f"Risk Cleared — You will receive a quote shortly. Risk Cleared.\n\n"
            f"Regards,\nUWT Underwriting Team\n{SENDER_EMAIL}"
        )
        html = f"""
        <html><body style="font-family:Arial,sans-serif;color:#111827;max-width:600px;margin:auto;padding:24px">
          <h2 style="color:#16a34a">Risk Cleared</h2>
          <p>Dear <strong>{broker}</strong>,</p>
          <p>Risk Cleared — You will receive a quote shortly. Risk Cleared.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="font-size:12px;color:#6b7280">Regards, UWT Underwriting Team | {SENDER_EMAIL} | {today_str}</p>
        </body></html>
        """
    else:
        subject = f"Re: Submission {sub_id} — Risk Denied"
        plain = (
            f"Dear {broker},\n\n"
            f"Risk Denied — Unfortunately we won't be able to proceed with your submission.\n\n"
            f"Regards,\nUWT Underwriting Team\n{SENDER_EMAIL}"
        )
        html = f"""
        <html><body style="font-family:Arial,sans-serif;color:#111827;max-width:600px;margin:auto;padding:24px">
          <h2 style="color:#dc2626">Risk Denied</h2>
          <p>Dear <strong>{broker}</strong>,</p>
          <p>Risk Denied — Unfortunately we won't be able to proceed with your submission.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="font-size:12px;color:#6b7280">Regards, UWT Underwriting Team | {SENDER_EMAIL} | {today_str}</p>
        </body></html>
        """

    if not smtp_host or not smtp_user or not smtp_pass:
        return {"status": "skipped", "reason": "SMTP not configured"}

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = request.applicantEmail
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, request.applicantEmail, msg.as_string())
    except Exception as exc:
        return {"status": "error", "reason": str(exc)}

    return {"status": "sent"}


@router.get("/properties")
def get_triage_properties():
    properties = _get_properties()
    result = []
    for i, prop in enumerate(properties[:6]):
        if i >= len(MOCK_PREDICTIONS):
            break
        pred = MOCK_PREDICTIONS[i]
        if pred.get("excluded", False):
            continue
        result.append({
            **prop,
            "quote_propensity": pred["quote_propensity_probability"],
            "quote_propensity_label": pred["quote_propensity"],
            "excluded": False,
        })
    return result


@router.get("/property/{submission_id}")
def get_property_result(submission_id: str):
    properties = _get_properties()
    prop_index = None
    for i, prop in enumerate(properties[:6]):
        if prop.get("submission_id") == submission_id:
            prop_index = i
            break

    if prop_index is None:
        raise HTTPException(status_code=404, detail=f"Property '{submission_id}' not found")

    pred = MOCK_PREDICTIONS[prop_index]
    return {
        "submission_id": submission_id,
        "property_index": prop_index,
        "quote_propensity": pred["quote_propensity_probability"],
        "quote_propensity_label": pred["quote_propensity"],
        "total_risk_score": pred["total_risk_score"],
        "property_vulnerability_risk": pred["property_vulnerability_risk"],
        "construction_risk_score": pred["construction_risk"],
        "locality_risk": pred["locality_risk"],
        "coverage_risk": pred["coverage_risk"],
        "claim_history_risk": pred["claim_history_risk"],
        "property_condition_risk": pred["property_condition_risk"],
        "property_state": pred["property_state"],
        "occupancy_type": pred["occupancy_type"],
        "cover_type": pred["cover_type"],
        "submission_channel": pred["submission_channel"],
        "excluded": pred.get("excluded", False),
        "exclusion_reason": pred.get("exclusion_reason", None),
        "shap_values": MOCK_LOCAL_SHAP[prop_index],
        "vulnerability_data": MOCK_VULNERABILITY[prop_index],
    }
