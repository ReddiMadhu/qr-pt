import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePropensity } from '../context/PropensityContext';
import ShapDrivers from '../components/ShapDrivers';

const PROPENSITY_COLORS = {
  'High Propensity': {
    gradientBar: 'from-green-400 to-green-600',
    bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200',
    ring: 'ring-green-300', dot: 'bg-green-500',
  },
  'Mid Propensity': {
    gradientBar: 'from-amber-400 to-amber-500',
    bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
    ring: 'ring-amber-300', dot: 'bg-amber-400',
  },
  'Low Propensity': {
    gradientBar: 'from-red-400 to-red-600',
    bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200',
    ring: 'ring-red-300', dot: 'bg-red-500',
  },
};

const formatCurrencyShort = (v) => {
  if (!v) return '—';
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000)    return `$${(v / 1000).toFixed(0)}K`;
  return `$${v}`;
};

export default function PredictionResultsPage() {
  const navigate = useNavigate();
  const {
    run1Properties, run1ShapGlobal,
    submission, properties,
    excludedIds, setExcludedIds, lowThreshold,
    excludedRows,
  } = usePropensity();

  useEffect(() => {
    if (!run1Properties.length) return;
    const ids = run1Properties
      .filter(p => p.is_below_threshold || (p.quote_propensity ?? 0) < lowThreshold)
      .map(p => p.submission_id).filter(Boolean);
    setExcludedIds(ids);
  }, [run1Properties]); // eslint-disable-line



  const mergedProperties = properties.map(base => {
    const pred = run1Properties.find(p => p.submission_id === base.submission_id);
    const excl = excludedRows.find(e => e.submission_id === base.submission_id);
    const isMlExcluded = !pred;
    return { ...base, ...(excl || {}), ...(pred || {}), isMlExcluded };
  });

  const bpoCount     = excludedIds.length;
  const mlExcludedCount = mergedProperties.filter(p => p.isMlExcluded).length;
  const eligibleCount = mergedProperties.length - bpoCount - mlExcludedCount;

  const isBPO = (id) => excludedIds.includes(id);



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} title="Home" className="text-gray-400 hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </button>
            <div className="h-6 w-px bg-gray-200"/>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">Preliminary Results</h1>
                {/* Step indicator — score counts, no progress bar */}
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                  Step 2 of 4
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Initial scoring complete — review before running the full vulnerability assessment pipeline</p>
            </div>
          </div>

          {/* Count chips — no emojis */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
              {eligibleCount} Eligible for further assessment
            </span>
            {bpoCount > 0 && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
                {bpoCount} Triage to BPO
              </span>
            )}
          </div>
        </div>
      </div>


      {/* ── Main layout: table + SHAP sidebar ────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex gap-4">

        {/* LEFT — Results table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-sm font-semibold text-gray-800">Preliminary Propensity Scores</h2>
              <span className="text-xs text-gray-400">{mergedProperties.length} properties</span>
            </div>

            {run1Properties.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"/>
                Loading preliminary results…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-3 text-left font-semibold">Property</th>
                      <th className="px-4 py-3 text-left font-semibold">Preliminary Score</th>
                      <th className="px-4 py-3 text-left font-semibold">Cover Type</th>
                      <th className="px-4 py-3 text-left font-semibold">Building Cov</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedProperties.map((prop, idx) => {
                      const score = prop.quote_propensity ?? 0;
                      const label = prop.quote_propensity_label ?? '—';
                      const colors = PROPENSITY_COLORS[label] ?? PROPENSITY_COLORS['Mid Propensity'];
                      const bpo    = isBPO(prop.submission_id);

                      return (
                        <tr
                          key={prop.submission_id ?? idx}
                          className={`border-b border-gray-100 border-l-2 transition-all duration-150
                            ${bpo ? 'bg-orange-50/30 border-l-orange-300' : 'border-l-transparent hover:bg-indigo-50/30 hover:border-l-indigo-400'}
                            ${idx % 2 === 1 && !bpo ? 'bg-slate-50/40' : ''}`}
                        >
                          {/* Property */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {prop.imageUrl ? (
                                <div className={`ring-2 ${colors.ring} rounded-lg overflow-hidden flex-shrink-0`}>
                                  <img src={prop.imageUrl} alt="" className="w-12 h-12 object-cover"/>
                                </div>
                              ) : (
                                <div className={`w-12 h-12 rounded-lg ${colors.bg} flex items-center justify-center ring-2 ${colors.ring} flex-shrink-0`}>
                                  <span className={`text-sm font-bold ${colors.text}`}>{prop.propertyId?.charAt(0) ?? 'P'}</span>
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-gray-900 text-xs">{prop.propertyId ?? `P${idx+1}`}</p>
                                <p className="text-gray-500 text-[11px]">{prop.property_county ?? '—'}</p>
                                <p className="text-gray-300 text-[10px]">{prop.submission_id}</p>
                              </div>
                            </div>
                          </td>



                          {/* Preliminary Score */}
                          <td className="px-4 py-3">
                            {prop.isMlExcluded ? (
                              <span className="text-xs font-semibold text-gray-400">—</span>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full bg-gradient-to-r ${colors.gradientBar} rounded-full`} style={{ width: `${Math.round(score * 100)}%` }}/>
                                </div>
                                <span className={`text-sm font-extrabold ${colors.text}`}>{Math.round(score * 100)}%</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                                  {label.replace(' Propensity','').replace('Mid', 'Medium')}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Cover Type */}
                          <td className="px-4 py-3 text-xs text-gray-600">{prop.cover_type ?? '—'}</td>

                          {/* Building Coverage */}
                          <td className="px-4 py-3 text-xs font-medium text-gray-700">{formatCurrencyShort(prop.building_coverage_limit)}</td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {prop.isMlExcluded ? (
                              <div className="group relative inline-block">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                                  ML Excluded
                                </span>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 whitespace-normal text-center">
                                  {prop.Reasons || 'Excluded by underwriting rules'}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                </div>
                              </div>
                            ) : bpo ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"/>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"/>
                                </span>
                                To BPO
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"/>
                                Eligible
                              </span>
                            )}
                          </td>

                          {/* View Details */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => navigate(`/property/${prop.submission_id}`, {
                                state: {
                                  property: prop,
                                  propertyResult: {
                                    submission_id: prop.submission_id,
                                    property_index: idx,
                                    quote_propensity: score,
                                    quote_propensity_label: label,
                                    total_risk_score: prop.total_risk_score,
                                    shap_values: prop.shap_values ?? [],
                                    vulnerability_data: {},
                                    property_state: prop.property_state ?? prop.state,
                                    submission_channel: prop.submission_channel,
                                    occupancy_type: prop.occupancy_type,
                                    cover_type: prop.cover_type,
                                  },
                                  fromTriage: false,
                                  fromPreliminary: true,
                                }
                              })}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-all"
                            >
                              Details
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CTA — full-width gradient */}
          <div className="mt-4">
            <button
              onClick={() => navigate('/prediction-loading?mode=rerun')}
              disabled={run1Properties.length === 0}
              className={`w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                run1Properties.length > 0
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-100 hover:-translate-y-0.5'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
              </svg>
              Run Property Insights &amp; Final Triage
              {bpoCount > 0 && (
                <span className="bg-white/20 border border-white/30 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  {eligibleCount} properties
                </span>
              )}
              <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
          </div>
        </div>

        {/* RIGHT — SHAP sidebar */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden sticky top-4">
            {/* Gradient top accent */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"/>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
                <h3 className="text-sm font-semibold text-gray-800">Key Risk Drivers</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">Global SHAP — top factors influencing preliminary scores</p>
              {run1ShapGlobal.length > 0 ? (
                <ShapDrivers drivers={run1ShapGlobal}/>
              ) : (
                <div className="space-y-2">
                  {[80, 65, 50, 40, 30].map((w, i) => (
                    <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${w}%` }}/>
                  ))}
                  <p className="text-[11px] text-gray-400 mt-2">Loading SHAP data…</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
