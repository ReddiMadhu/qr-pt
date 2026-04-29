import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { mockProperties, mockResultsNew } from '../data/mockData';
import { fetchPropertyResult, sendLetterOfIntent } from '../services/api';


const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatCurrencyShort = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

// Section header bar — light theme, no number badge
const SectionBar = ({ title, right }) => (
  <div className="flex items-center justify-between bg-gray-100 border-b border-gray-200 px-4 py-2.5">
    <span className="text-sm font-semibold text-gray-800">{title}</span>
    {right && <div>{right}</div>}
  </div>
);

// Vulnerability Popup — shows insight image, or opens link in new tab
const VulnerabilityPopup = ({ data, onClose, insightImage, link }) => {
  if (!data) return null;

  // If there's a link, open it in a new tab and close the popup
  if (link) {
    window.open(link, '_blank', 'noopener,noreferrer');
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200" style={{ width: '70vw', maxWidth: '70vw' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-bold text-gray-900">Property Vulnerability Risk</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Insight image */}
        {insightImage ? (
          <img src={insightImage} alt="Vulnerability insight" className="w-full rounded-b-xl object-cover" style={{ maxHeight: '70vh' }} />
        ) : (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No insight image available.</div>
        )}
      </div>
    </div>
  );
};

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [showVulnerabilityPopup, setShowVulnerabilityPopup] = useState(false);
  const [triageResult, setTriageResult] = useState(null);
  const [letterModal, setLetterModal] = useState(false);
  const [letterSending, setLetterSending] = useState(false);
  const [letterResult, setLetterResult] = useState(null);
  const [justification, setJustification] = useState('');

  // Data passed from DecisionComparison / PredictionResultsPage via router state
  const passedProperty = location.state?.property;
  const passedPropertyResult = location.state?.propertyResult;
  const passedResults = location.state?.results;
  const fromTriage = location.state?.fromTriage ?? false;
  // When navigated from PredictionResultsPage, hide roof image + risk breakdown
  const fromPreliminary = location.state?.fromPreliminary ?? false;

  // When navigated from triage, passedProperty contains the full context including SHAP and Run 1 scores
  const results = passedResults || mockResultsNew;
  const propertiesList = mockProperties;

  const propertyResult = fromTriage
    ? passedProperty
    : (passedPropertyResult
      || results?.results?.find((r) => r.submission_id === id)
      || results?.results?.[0]);

  const propIndex = propertyResult?.property_index ?? 0;
  const property = passedProperty || propertiesList[propIndex] || propertiesList[0];

  if (!property || !propertyResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Property not found.</p>
          <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline text-sm">Go Back</button>
        </div>
      </div>
    );
  }

  const {
    quote_propensity, quote_propensity_label,
    total_risk_score, property_insight_id,
    property_vulnerability_risk, construction_risk_score,
    locality_risk, coverage_risk, claim_history_risk, property_condition_risk,
    shap_values = [], vulnerability_data = {}, user_selection,
    property_state, submission_channel: res_channel, occupancy_type: res_occupancy, cover_type: res_cover,
  } = propertyResult;

  // Build PropertyInsights link from property_id (opens external Property API portal)
  const propertyInsightsLink = property_insight_id
    ? `${import.meta.env.VITE_PROPERTY_API_BASE || 'http://localhost:8000'}/get_address?property_id=${property_insight_id}`
    : null;

  // Color based purely on quote_propensity_label — no ai_risk
  const propensityColorMap = {
    'High Propensity': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    'Mid Propensity': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
    'Low Propensity': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  };
  const propColor = propensityColorMap[fromTriage ? (propertyResult.finalLabel ?? quote_propensity_label) : quote_propensity_label] || propensityColorMap['Mid Propensity'];

  // Real risk breakdown from prediction data (scores out of 100)
  const riskBreakdown = propertyResult.risk_breakdown || [
    { label: 'Construction Risk', score: construction_risk_score, tooltipText: "Building Material (40%), Code compliance (25%), Construction permit (10%), Foundation (25%)" },
    { label: 'Locality Risk', score: locality_risk, tooltipText: "Fire Rate (30%), Crime Rate (40%), Industrial Distance (15%), Fire Station Distance (15%)" },
    { label: 'Coverage Risk', score: coverage_risk, tooltipText: "Coverage Type (30%), Property Category (40%), Policy Type (30%)" },
    { label: 'Claim History Risk', score: claim_history_risk, tooltipText: "Property past loss frequency (40%), Claim Amount (40%), Declined Insurance (20%)" },
    { label: 'Property Condition Risk', score: property_condition_risk, tooltipText: "Occupancy (45%), Age Penalty (35%), Safety Deduction (20%)" },
  ];

  // Separate top 6 positive and top 6 negative SHAP drivers, rounded to 3 decimals
  const shapList = shap_values.map(s => {
    const rawVal = s.val ?? s.mean_abs_shap ?? s.contribution ?? 0;
    return {
      feature: (s.feature || '').replace(/_/g, ' '),
      val: parseFloat(rawVal.toFixed(3)),
      value: s.value
    };
  });

  const posDrivers = shapList.filter(s => s.val > 0)
    .sort((a, b) => b.val - a.val)
    .slice(0, 6);
  const negDrivers = shapList.filter(s => s.val < 0)
    .sort((a, b) => a.val - b.val)
    .slice(0, 6);

  const displayShap = [...posDrivers, ...negDrivers];
  const maxShap = Math.max(...displayShap.map((s) => Math.abs(s.val)), 0.001);

  const selectionIcon = user_selection === 'prioritized' ? '🟢' : user_selection === 'discarded' ? '🔴' : '⚪';
  const selectionLabel = user_selection === 'prioritized' ? 'Prioritized' : user_selection === 'discarded' ? 'Discarded' : 'Not Selected';
  const selectionCls = user_selection === 'prioritized'
    ? 'bg-green-50 text-green-700 border-green-300'
    : user_selection === 'discarded'
      ? 'bg-red-50 text-red-600 border-red-300'
      : 'bg-gray-100 text-gray-500 border-gray-300';

  // Use result data where richer; fall back to property static fields
  const displayOccupancy = res_occupancy || property.occupancy_type;
  const displayChannel = res_channel || property.submission_channel;
  const displayCover = res_cover || property.cover_type;
  const displayState = property_state || property.state;

  // Property params for table (2 rows) — mix static + result fields
  const paramRow1 = [
    { label: 'Sub ID', value: propertyResult.submission_id },
    { label: 'Channel', value: displayChannel },
    { label: 'Occupancy', value: displayOccupancy },
    { label: 'County', value: property.property_county },
    { label: 'State', value: displayState },
    { label: 'Age', value: `${property.property_age} yrs` },
    { label: 'Value', value: formatCurrency(property.property_value) },
  ];
  const paramRow2 = [
    { label: 'Cover', value: displayCover },
    { label: 'Building', value: formatCurrencyShort(property.building_coverage_limit) },
    { label: 'Contents', value: formatCurrencyShort(property.contents_coverage_limit) },
    { label: 'Broker', value: property.broker_company },
    { label: 'Risk Score', value: total_risk_score },
  ];

  const riskEmoji = quote_propensity_label?.includes('High') ? '🟢' : quote_propensity_label?.includes('Low') ? '🔴' : '🟠';

  const handleSendLetter = async (letterType) => {
    setLetterSending(true);
    setLetterResult(null);
    try {
      await sendLetterOfIntent({
        submissionId: property.submission_id,
        applicantEmail: property.applicant_email || '',
        brokerCompany: property.broker_company || '',
        propertyCounty: property.property_county || '',
        letterType,
      });
      setLetterResult('sent');
      setTimeout(() => { setLetterModal(false); setLetterResult(null); }, 2000);
    } catch {
      setLetterResult('error');
    } finally {
      setLetterSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showVulnerabilityPopup && (
        <VulnerabilityPopup
          data={vulnerability_data}
          onClose={() => setShowVulnerabilityPopup(false)}
          insightImage={vulnerability_data?.insight_image || property.roofImageUrl}
          link={propertyInsightsLink || vulnerability_data?.link}
        />
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            title="Home"
            className="text-gray-400 hover:text-blue-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-lg font-bold text-gray-900">Property Risk Evaluation Page</h1>
          {fromTriage && (
            <button
              onClick={() => { setLetterModal(true); setLetterResult(null); setJustification(''); }}
              className="ml-auto flex items-center gap-1.5 text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Letter
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">

        {/* ── 1. Submission Overview ── */}
        <div className="rounded-lg overflow-hidden border border-gray-300 bg-white shadow-sm">
          <SectionBar title="Submission Overview" />
          <div className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-gray-600">
              Submission ID: <span className="font-semibold text-gray-900">{propertyResult.submission_id}</span>
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 flex items-center gap-1.5">
              Property Vulnerability Risk: 
              <span className={`font-semibold ${property_vulnerability_risk >= 70 ? 'text-red-600' : property_vulnerability_risk >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                {property_vulnerability_risk}
              </span>
              <span className="text-gray-400 text-xs">/ 100</span>
              {(!fromPreliminary && propertyInsightsLink) && (
                <button
                  onClick={() => window.open(propertyInsightsLink, '_blank', 'noopener,noreferrer')}
                  className="text-[10px] px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium shadow-sm transition-colors ml-1"
                >
                  View
                </button>
              )}
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">
              {fromTriage ? 'Final Propensity' : 'Propensity'}:{' '}
              <span className={`font-semibold ${propColor.text}`}>
                {Math.round((fromTriage ? (propertyResult.finalScore ?? quote_propensity) : quote_propensity) * 100)}%
              </span>
              {(() => {
                const displayLabel = fromTriage ? (propertyResult.finalLabel ?? quote_propensity_label) : quote_propensity_label;
                return displayLabel && <span className={`ml-1.5 text-xs font-semibold px-2 py-0.5 rounded border ${propColor.bg} ${propColor.text} ${propColor.border}`}>{riskEmoji} {displayLabel}</span>;
              })()}
            </span>
            <div className="ml-auto">
              {!fromTriage && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${selectionCls}`}>
                  {selectionIcon} Your Selection: {selectionLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. Images Section ── */}
        <div className="rounded-lg overflow-hidden border border-gray-300 bg-white shadow-sm">
          <SectionBar title={fromPreliminary ? "Images Section (Property)" : "Images Section (Property + Roof)"} />
          <div className={`p-3 bg-gray-200 ${fromPreliminary ? 'flex justify-center' : 'grid grid-cols-2'} gap-3`}>
            <div className={`relative ${fromPreliminary ? 'max-w-md w-full' : ''}`}>
              <img
                src={property.imageUrl}
                alt="Property front"
                className={fromPreliminary ? 'w-full rounded object-contain' : 'w-full h-48 object-cover'}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1.5">
                Front Property Image
              </div>
            </div>
            {!fromPreliminary && (
              <div className="relative">
                <img
                  src={property.roofImageUrl}
                  alt="Roof"
                  className="w-full h-48 object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1.5">
                  Roof Image
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Property Parameter Values ── */}
        <div className="rounded-lg overflow-hidden border border-gray-300 bg-white shadow-sm">
          <SectionBar title="Property Parameter Values" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-b border-gray-200">
                  {paramRow1.map(({ label, value }) => (
                    <td key={label} className="px-3 py-2.5 border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide">{label}</p>
                      <p className="font-semibold text-gray-800 text-xs mt-0.5">{value}</p>
                    </td>
                  ))}
                </tr>
                <tr>
                  {paramRow2.map(({ label, value, render }) => (
                    <td key={label} className="px-3 py-2.5 border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide">{label}</p>
                      {render ? render() : <p className="font-semibold text-gray-800 text-xs mt-0.5">{value}</p>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 4 & 5 side by side ── */}
        <div className="grid grid-cols-2 gap-3">

          {/* ── 4. Key Driver Analysis (SHAP) ── */}
          <div className="rounded-lg overflow-hidden border border-gray-300 bg-white shadow-sm flex flex-col">
            <SectionBar title="Key Driver Analysis (Local SHAP Values)" />
            <div className="p-4 flex-1">
              <div className="flex items-end justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700">What Influenced the AI Prediction</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase w-20 text-right">Value</p>
              </div>
              <div className="space-y-1.5">
                {displayShap.map((shap, i) => {
                  const val = shap.val;
                  const isNeg = val < 0;
                  const absVal = Math.abs(val);
                  const pct = (absVal / maxShap) * 100;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="text-[10px] text-gray-500 w-56 truncate text-right flex-shrink-0"
                        title={shap.feature.replace(/_/g, ' ')}
                      >
                        {shap.feature.replace(/_/g, ' ')} <span className={`font-semibold ${isNeg ? 'text-red-500' : 'text-green-600'}`}>({isNeg ? '' : '+'}{val.toFixed(1)})</span>
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-sm overflow-hidden flex">
                          <div
                            className={`h-full rounded-sm transition-all duration-500 ${isNeg ? 'bg-red-500' : 'bg-green-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 w-20 flex-shrink-0 text-right">
                          {shap.value || Math.floor(Math.random() * 50) + 10}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 flex gap-4">
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <div className="w-6 h-2.5 rounded-sm bg-green-600 flex-shrink-0"></div>
                  <span>Green → Positive Driver</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <div className="w-6 h-2.5 rounded-sm bg-red-500 flex-shrink-0"></div>
                  <span>Red → Negative Driver</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 5. Property Risk Breakdown — Property Vulnerability Risk row hidden when from preliminary results ── */}
          <div className="rounded-lg overflow-hidden border border-gray-300 bg-white shadow-sm flex flex-col">
            <SectionBar
              title="Property Risk Breakdown (Structured Risks)"

            />
            <div className="p-4 flex-1">
              <p className="text-sm font-bold text-gray-800 mb-3">
                Total Risk Score: <span className={total_risk_score >= 70 ? 'text-red-600' : total_risk_score >= 40 ? 'text-amber-600' : 'text-green-600'}>{total_risk_score}</span>
                <span className="text-xs text-gray-400 font-normal ml-1">/ 100</span>
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-[10px] text-gray-400 font-medium pb-1.5 uppercase tracking-wide">Risk Factor</th>
                    <th className="text-left text-[10px] text-gray-400 font-medium pb-1.5 uppercase tracking-wide w-16">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {riskBreakdown
                    .filter(({ hasView }) => !(fromPreliminary && hasView))
                    .map(({ label, score, tooltipText }) => {
                    const scoreColor = (score ?? 0) >= 70 ? 'text-red-600' : (score ?? 0) >= 40 ? 'text-amber-600' : 'text-green-600';

                    return (
                      <tr
                        key={label}
                        className="hover:bg-gray-50 transition-colors cursor-help"
                        title={tooltipText}
                      >
                        <td className="py-2 text-gray-700 font-medium">{label}</td>
                        <td className="py-2 w-16">
                          <span className={`font-mono font-semibold text-sm ${scoreColor}`}>{score ?? '—'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Quote Propensity inline at bottom */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">AI Quote Propensity</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-blue-600">{Math.round(quote_propensity * 100)}%</span>
                  <div className="flex-1">
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                        style={{ width: `${Math.round(quote_propensity * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${propColor.bg} ${propColor.text} ${propColor.border}`}>
                    {quote_propensity_label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {letterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setLetterModal(false); setLetterResult(null); setJustification(''); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Send Underwriter Letter</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {property.submission_id} — {property.property_county}
                </p>
              </div>
              <button
                onClick={() => { setLetterModal(false); setLetterResult(null); setJustification(''); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-5 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-16 flex-shrink-0">Broker</span>
                <span className="font-semibold text-gray-800">{property.broker_company || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-20 flex-shrink-0">Applicant Email</span>
                <span className="font-medium text-blue-700">{property.applicant_email || '—'}</span>
              </div>
            </div>
            {letterResult === 'sent' && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-2.5 text-center font-medium">
                Email sent to {property.applicant_email || '—'}
              </div>
            )}
            {letterResult === 'error' && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 text-center font-medium">
                Failed to send — check SMTP config
              </div>
            )}
            {!letterResult && (
              <>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Justification for Override Decision
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Enter underwriter justification..."
                    rows={3}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSendLetter('intent')}
                    disabled={letterSending}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {letterSending ? 'Sending...' : 'Risk Cleared'}
                  </button>
                  <button
                    onClick={() => handleSendLetter('not_interested')}
                    disabled={letterSending}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {letterSending ? 'Sending...' : 'Risk Denied'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      )}
    </div>


  );
};

export default PropertyDetail;
