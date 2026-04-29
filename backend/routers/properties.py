import os
import math
import pandas as pd
from fastapi import APIRouter

router = APIRouter()

# Letter labels A–F mapped to index
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

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
csv_path = os.path.join(base_dir, "Test", "Property_data - AI.csv")


def _clean(value, fallback=None):
    """Return fallback if value is NaN/None, else return value."""
    if value is None:
        return fallback
    try:
        if math.isnan(float(value)):
            return fallback
    except (TypeError, ValueError):
        pass
    return value


def _normalize_sub_id(value, fallback=None):
    """Return submission_id from CSV, fall back to mock value."""
    return _clean(value, fallback)


@router.get("")
def get_properties():
    try:
        if not os.path.exists(csv_path):
            return MOCK_PROPERTIES

        df = pd.read_csv(csv_path)
        excel_records = df.to_dict(orient="records")

        merged_records = []
        for i, record in enumerate(excel_records[:6]):   # only first 6
            mock = MOCK_PROPERTIES[i % len(MOCK_PROPERTIES)]
            merged_record = {
                "id": i + 1,
                "propertyId": PROPERTY_LETTERS[i],       # always A–F
                "submission_id": _normalize_sub_id(mock.get("submission_id")),
                "submission_channel": _clean(mock.get("submission_channel")),
                "occupancy_type": _clean(mock.get("occupancy_type")),
                "property_age": _clean(mock.get("property_age")),
                "property_value": _clean(mock.get("property_value")),
                "property_county": _clean(mock.get("Property_county")),
                "cover_type": _clean(mock.get("cover_type")),
                "building_coverage_limit": _clean(mock.get("building_coverage_limit")),
                "contents_coverage_limit": _clean(mock.get("contents_coverage_limit")),
                "broker_company": _clean(mock.get("broker_company")),
                "broker_email": _clean(mock.get("broker_email")),
                "applicant_email": _clean(mock.get("Applicant_Email")),
                "income": _clean(mock.get("income"), mock.get("income", 150000)),
                "property_past_loss_freq": _clean(mock.get("property_past_loss_freq", 0)),
                "property_past_claim_amount": _clean(mock.get("property_past_claim_amount", 0)),
                # Visual/risk fields always from mock
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
