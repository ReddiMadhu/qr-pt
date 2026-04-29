import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTriageProperties, sendLetterOfIntent } from '../services/api';
import { usePropensity } from '../context/PropensityContext';
import ShapDrivers from '../components/ShapDrivers';

/* ── Design tokens ──────────────────────────────────────────────────────── */
const TIER_BADGE = {
  High: 'bg-green-100 text-green-700 border-green-300',
  Mid:  'bg-amber-100 text-amber-700 border-amber-200',
  Low:  'bg-red-100   text-red-700   border-red-200',
  BPO:  'bg-orange-100 text-orange-700 border-orange-300',
};
const TIER_SCORE_COLOR = {
  High: 'text-green-600',
  Mid:  'text-amber-600',
  Low:  'text-red-600',
  BPO:  'text-orange-600',
};

const getTier = (label) => {
  if (!label) return 'Low';
  const l = label.toLowerCase();
  if (l.includes('high')) return 'High';
  if (l.includes('mid'))  return 'Mid';
  return 'Low';
};

const formatCurrencyShort = (v) => {
  if (!v) return '—';
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000)    return `$${(v / 1000).toFixed(0)}K`;
  return `$${v}`;
};



/* ════════════════════════════════════════════════════════════════════════ */
const TriagePage = () => {
  const navigate = useNavigate();
  const {
    run1Properties, run2Properties,
    excludedIds, properties: ctxProperties,
    submission, run1ShapGlobal,
    smartAssignResults, setSmartAssignResults,
  } = usePropensity();

  const [fallbackProperties, setFallbackProperties] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [letterModal, setLetterModal] = useState(null);
  const [letterSending, setLetterSending] = useState(false);
  const [letterResult, setLetterResult]   = useState(null);
  const [justification, setJustification] = useState('');

  /* ── SmartAssign state ──────────────────────────────────────────────── */
  const [smartAssignModal, setSmartAssignModal] = useState(false);
  const [smartAssignPhase, setSmartAssignPhase] = useState(smartAssignResults ? 'complete' : 'idle');
  const [smartRoutingCounts, setSmartRoutingCounts] = useState(
    smartAssignResults || { bpo: 0, assistable: 0, complex: 0, uw_review: 0, lowCount: 0, highHighCount: 0, highLowCount: 0, midCount: 0 }
  );
  const [pipelineStep, setPipelineStep] = useState(0);

  const hasContextData = run1Properties.length > 0;

  useEffect(() => {
    if (hasContextData) return;
    setLoading(true);
    fetchTriageProperties().then(data => setFallbackProperties(data)).finally(() => setLoading(false));
  }, [hasContextData]);

  /* Build merged rows from context */
  const buildContextRows = () => {
    const priIds = [];
    const disIds = [];

    return ctxProperties.map(base => {
      const pred = run1Properties.find(p => p.submission_id === base.submission_id);
      const isMlExcluded = !pred;
      const isBPO = excludedIds.includes(base.submission_id);

      const prelimScore = pred?.quote_propensity ?? 0;
      const prelimLabel = pred?.quote_propensity_label ?? '—';
      let finalScore = prelimScore, finalLabel = 'BPO Triage';

      if (!isBPO && !isMlExcluded) {
        const r2 = run2Properties.find(r => r.submission_id === base.submission_id);
        finalScore = r2?.quote_propensity ?? prelimScore;
        finalLabel = r2?.quote_propensity_label ?? prelimLabel;
        // Merge Run 2 fields (property_id, property_vulnerability_risk, etc.)
        if (r2) Object.assign(base, r2);
      }
      return { ...base, ...(pred || {}), prelimScore, prelimLabel, finalScore, finalLabel, isBPO, isMlExcluded };
    });
  };

  const rows = hasContextData ? buildContextRows() : fallbackProperties.map(p => ({
    ...p,
    prelimScore: p.quote_propensity ?? 0, prelimLabel: p.quote_propensity_label ?? '—',
    finalScore: p.quote_propensity ?? 0,  finalLabel: p.quote_propensity_label ?? '—',
    isBPO: false,
  }));



  /* ── SmartAssign timing animation ──────────────────────────────────── */
  useEffect(() => {
    if (smartAssignPhase !== 'processing') { setPipelineStep(0); return; }
    setPipelineStep(0);
    const timings = [400, 900, 1500, 2200];
    const timers = timings.map((t, i) => setTimeout(() => setPipelineStep(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [smartAssignPhase]);

  const handleStartSmartAssign = () => {
    setSmartAssignModal(true);
    setSmartAssignPhase('processing');
    let lowCount = 0, highHighCount = 0, highLowCount = 0, midCount = 0;
    rows.forEach(r => {
      const tier = r.isBPO ? 'Low' : getTier(r.finalLabel);
      const coverage = (r.building_coverage_limit || 0) + (r.contents_coverage_limit || 0);
      if (tier === 'Low')  lowCount++;
      else if (tier === 'Mid') midCount++;
      else if (coverage > 500000) highHighCount++;
      else highLowCount++;
    });
    const counts = { uw_review: lowCount, bpo: highLowCount, assistable: highHighCount, complex: midCount, lowCount, highHighCount, highLowCount, midCount };
    setSmartRoutingCounts(counts);
    setTimeout(() => { setSmartAssignPhase('complete'); setSmartAssignResults(counts); }, 4000);
  };

  /* ── Letter send ────────────────────────────────────────────────────── */
  const handleSendLetter = async (letterType) => {
    if (!letterModal) return;
    setLetterSending(true); setLetterResult(null);
    try {
      await sendLetterOfIntent({ submissionId: letterModal.submission_id, applicantEmail: letterModal.applicant_email || '', brokerCompany: letterModal.broker_company || '', propertyCounty: letterModal.property_county || '', letterType });
      setLetterResult('sent');
      setTimeout(() => { setLetterModal(null); setLetterResult(null); }, 2000);
    } catch { setLetterResult('error'); }
    finally { setLetterSending(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"/>
        <p className="text-gray-600">Loading triage data…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Compact white header ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} title="Home" className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </button>
            <div className="h-5 w-px bg-gray-200"/>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">UWT Triage — Final Results</h1>
              <p className="text-[11px] text-gray-400 leading-tight">
                {hasContextData
                  ? `${excludedIds.length} BPO · ${run1Properties.length - excludedIds.length} scored by full pipeline`
                  : 'All triage submissions'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">


            {/* Smart Assign button */}
            <button
              onClick={handleStartSmartAssign}
              className="flex items-center gap-1.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:-translate-y-0.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Smart Assign
            </button>
          </div>

        </div>
      </div>

      {/* ── Main layout: table + SHAP sidebar ────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex gap-4">

        {/* LEFT — Table */}
        <div className="flex-1 min-w-0">
          {rows.length === 0 ? (
            <div className="text-center py-20"><p className="text-gray-500">No triage submissions found.</p></div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-200 border-b border-gray-300">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-800">Property</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-800">Preliminary <span className="font-normal text-gray-500">(Run 1)</span></th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-800">Final Propensity <span className="font-normal text-gray-500">(Run 2)</span></th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-800">Cover Type</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-800">Building Cov</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-800">Contents Cov</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-800">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row, idx) => {
                      const tier1 = getTier(row.prelimLabel);
                      const tier2 = row.isBPO ? 'BPO' : getTier(row.finalLabel);
                      const score1Pct = Math.round(row.prelimScore * 100);
                      const score2Pct = Math.round(row.finalScore * 100);

                      return (
                        <tr
                          key={row.submission_id ?? idx}
                          className={`hover:bg-gray-50 transition-colors border-l-2
                            ${row.isBPO ? 'bg-orange-50/30 border-l-orange-400' : 'border-l-transparent hover:border-l-indigo-300'}`}
                        >
                          {/* Property */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-3">
                              {row.imageUrl && (
                                <div className="relative shrink-0">
                                  <img src={row.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shadow-sm"/>
                                  {row.propertyId && (
                                    <div className="absolute -top-1.5 -left-1.5 bg-blue-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded shadow">
                                      {row.propertyId}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-gray-900 truncate">{row.property_county ?? '—'}</p>
                                <p className="text-xs text-gray-500 truncate">{row.occupancy_type ?? '—'}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{row.submission_id}</p>
                              </div>
                            </div>
                          </td>



                          {/* Preliminary — muted, no bar */}
                          <td className="px-3 py-2 text-center border-l border-gray-100 bg-gray-50/50">
                            {row.isMlExcluded ? (
                              <span className="text-xs font-semibold text-gray-400">—</span>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5 opacity-60">
                                <span className={`text-xs font-bold ${TIER_SCORE_COLOR[tier1]}`}>{score1Pct}%</span>
                                <span className={`text-[9px] font-medium border rounded-full px-1.5 py-0.5 w-fit ${TIER_BADGE[tier1]}`}>
                                  {row.prelimLabel.replace('Mid', 'Medium')}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Final Propensity — vivid, no bar */}
                          <td className="px-3 py-2 text-center border-r border-gray-100 bg-indigo-50/20">
                            {row.isMlExcluded ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                                ML Excluded
                              </span>
                            ) : row.isBPO ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"/>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"/>
                                  </span>
                                  BPO Triage
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-base font-extrabold ${TIER_SCORE_COLOR[tier2]}`}>{score2Pct}%</span>
                                <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 w-fit ${TIER_BADGE[tier2]}`}>
                                  {row.finalLabel.replace('Mid', 'Medium')}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Cover Type */}
                          <td className="px-3 py-2 text-xs text-gray-700">{row.cover_type ?? '—'}</td>

                          {/* Building Coverage */}
                          <td className="px-3 py-2 text-xs font-medium text-gray-800">{formatCurrencyShort(row.building_coverage_limit)}</td>

                          {/* Contents Coverage */}
                          <td className="px-3 py-2 text-xs font-medium text-gray-800">{formatCurrencyShort(row.contents_coverage_limit)}</td>

                          {/* Actions */}
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <button
                                onClick={() => navigate(`/property/${row.submission_id || row.id}`, { state: { property: row, fromTriage: true } })}
                                className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors inline-flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                                View Details
                              </button>
                              {!hasContextData && (
                              <button
                                onClick={() => { setLetterModal(row); setLetterResult(null); setJustification(''); }}
                                className="px-3 py-1.5 rounded-md text-xs font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors inline-flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                </svg>
                                Send Letter
                              </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — SHAP sidebar */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden sticky top-4">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"/>
            <div className="p-4">
              <div className="mb-3 pb-3 border-b border-gray-100">
                <h3 className="text-[13px] font-bold text-gray-800 mb-2">Final Propensity Calculation</h3>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded">
                    <span className="text-gray-600 font-medium">Property Vulnerability</span>
                    <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">60%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded">
                    <span className="text-gray-600 font-medium">Preliminary Score</span>
                    <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">40%</span>
                  </div>
                </div>
              </div>
              {run1ShapGlobal?.length > 0 ? (
                <ShapDrivers drivers={run1ShapGlobal}/>
              ) : (
                <div className="space-y-2">
                  {[80, 65, 50, 40, 30].map((w, i) => (
                    <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${w}%` }}/>
                  ))}
                  <p className="text-[11px] text-gray-400 mt-2">No SHAP data available.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Letter Modal ──────────────────────────────────────────────── */}
      {letterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
             onClick={() => { setLetterModal(null); setLetterResult(null); setJustification(''); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Send Underwriter Letter</h2>
                <p className="text-xs text-gray-500 mt-0.5">{letterModal.submission_id} — {letterModal.property_county}</p>
              </div>
              <button onClick={() => { setLetterModal(null); setLetterResult(null); setJustification(''); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-5 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-16 flex-shrink-0">Broker</span>
                <span className="font-semibold text-gray-800">{letterModal.broker_company || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-20 flex-shrink-0">Email</span>
                <span className="font-medium text-blue-700">{letterModal.applicant_email || '—'}</span>
              </div>
            </div>
            {letterResult === 'sent' && <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-2.5 text-center font-medium">Email sent to {letterModal.applicant_email || '—'}</div>}
            {letterResult === 'error' && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 text-center font-medium">Failed to send — check SMTP config</div>}
            {!letterResult && (
              <>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Justification for Override Decision</label>
                  <textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="Enter underwriter justification..." rows={3}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"/>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleSendLetter('intent')} disabled={letterSending} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                    {letterSending ? 'Sending...' : 'Risk Cleared'}
                  </button>
                  <button onClick={() => handleSendLetter('not_interested')} disabled={letterSending} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                    {letterSending ? 'Sending...' : 'Risk Denied'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Smart Assign Modal (ported from quote) ────────────────────── */}
      {smartAssignModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-5xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                Intelligent Smart Assign
              </h2>
              {smartAssignPhase === 'complete' && (
                <button onClick={() => setSmartAssignModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            {/* Body */}
            <div className="p-6 bg-white">
              {smartAssignPhase === 'processing' ? (
                <div className="space-y-3 py-2">
                  <p className="text-center text-sm text-gray-500">Routing {rows.length} submissions to underwriting queues...</p>
                  <svg viewBox="0 0 820 260" className="w-full" style={{ fontFamily: 'inherit' }}>
                    <defs>
                      <marker id="arr-blue" viewBox="0 0 10 10" markerWidth="5" markerHeight="5" refX="8" refY="5" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 Z" fill="#3b82f6"/>
                      </marker>
                    </defs>

                    {pipelineStep >= 1 && (
                      <g>
                        <rect x="10" y="85" width="140" height="90" rx="10" fill="#4f46e5"/>
                        <text x="80" y="116" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" letterSpacing="1">ALL SUBMISSIONS</text>
                        <text x="80" y="143" textAnchor="middle" fill="white" fontSize="28" fontWeight="900">{rows.length}</text>
                      </g>
                    )}

                    {pipelineStep >= 1 && (
                      <>
                        <polyline points="150,130 200,130 200,50  290,50"  fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr-blue)"/>
                        <polyline points="150,130 200,130 200,100 290,100" fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr-blue)"/>
                        <polyline points="150,130 200,130 200,160 290,160" fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr-blue)"/>
                        <polyline points="150,130 200,130 200,210 290,210" fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr-blue)"/>
                      </>
                    )}

                    {pipelineStep >= 1 && (
                      <>
                        <rect x="290" y="37"  width="230" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1"/>
                        <rect x="290" y="37"  width="4"   height="26" rx="2" fill="#ef4444"/>
                        <text x="302" y="54" fill="#374151" fontSize="10" fontWeight="600">Low Propensity</text>
                        <text x="512" y="54" textAnchor="end" fill="#111827" fontSize="12" fontWeight="900">{smartRoutingCounts.lowCount}</text>

                        <rect x="290" y="87"  width="230" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1"/>
                        <rect x="290" y="87"  width="4"   height="26" rx="2" fill="#f97316"/>
                        <text x="302" y="104" fill="#374151" fontSize="10" fontWeight="600">High + Low Cov (≤$500k)</text>
                        <text x="512" y="104" textAnchor="end" fill="#111827" fontSize="12" fontWeight="900">{smartRoutingCounts.highLowCount}</text>

                        <rect x="290" y="147" width="230" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1"/>
                        <rect x="290" y="147" width="4"   height="26" rx="2" fill="#22c55e"/>
                        <text x="302" y="164" fill="#374151" fontSize="10" fontWeight="600">High + High Cov (&gt;$500k)</text>
                        <text x="512" y="164" textAnchor="end" fill="#111827" fontSize="12" fontWeight="900">{smartRoutingCounts.highHighCount}</text>

                        <rect x="290" y="197" width="230" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1"/>
                        <rect x="290" y="197" width="4"   height="26" rx="2" fill="#a855f7"/>
                        <text x="302" y="214" fill="#374151" fontSize="10" fontWeight="600">Mid Propensity</text>
                        <text x="512" y="214" textAnchor="end" fill="#111827" fontSize="12" fontWeight="900">{smartRoutingCounts.midCount}</text>
                      </>
                    )}

                    {pipelineStep >= 2 && (
                      <>
                        <polyline points="520,50  570,50  570,80  620,80"  fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr-blue)"/>
                        <polyline points="520,100 570,100 570,80  620,80"  fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr-blue)"/>
                        <polyline points="520,160 570,160 570,130 620,130" fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr-blue)"/>
                        <polyline points="520,210 570,210 570,190 620,190" fill="none" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr-blue)"/>

                        <rect x="620" y="62"  width="190" height="36" rx="8" fill="#1d4ed8"/>
                        <text x="715" y="85"  textAnchor="middle" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">BPO TEAM</text>
                        <rect x="620" y="112" width="190" height="36" rx="8" fill="#4f46e5"/>
                        <text x="715" y="135" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">UWT ASSISTABLE</text>
                        <rect x="620" y="172" width="190" height="36" rx="8" fill="#374151"/>
                        <text x="715" y="195" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">COMPLEX UWT</text>
                      </>
                    )}

                    {pipelineStep >= 3 && (
                      <>
                        <rect x="798" y="54"  width="18" height="13" rx="2" fill="white" stroke="#1d4ed8" strokeWidth="1.5"/>
                        <polyline points="798,54  807,63  816,54" fill="none" stroke="#1d4ed8" strokeWidth="1.5"/>
                        <rect x="798" y="104" width="18" height="13" rx="2" fill="white" stroke="#4f46e5" strokeWidth="1.5"/>
                        <polyline points="798,104 807,113 816,104" fill="none" stroke="#4f46e5" strokeWidth="1.5"/>
                        <rect x="798" y="164" width="18" height="13" rx="2" fill="white" stroke="#374151" strokeWidth="1.5"/>
                        <polyline points="798,164 807,173 816,164" fill="none" stroke="#374151" strokeWidth="1.5"/>
                      </>
                    )}
                  </svg>
                  {pipelineStep >= 3 && (
                    <p className="text-center text-xs text-indigo-500 animate-pulse font-medium pb-2">Dispatching emails to underwriting teams...</p>
                  )}
                </div>
              ) : (
                /* Complete state */
                <div className="py-4">
                  <div className="flex items-center justify-center gap-4 mb-8 text-emerald-500">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center ring-4 ring-emerald-50/50 shadow-inner">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">Routing Complete!</h3>
                      <p className="text-slate-500 text-sm font-medium mt-1">Emails and platform notifications have been dispatched securely.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4">
                    {[
                      { key: 'uw_review', label: 'UW Review', sub: 'Low Propensity\nManual Audit Required', color: 'bg-red-50 text-red-600', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
                      { key: 'bpo', label: 'BPO Team', sub: 'High Propensity + Low Cov', color: 'bg-blue-50 text-blue-600', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
                      { key: 'assistable', label: 'UWT Assistable', sub: 'High Propensity\nHigh Cov (>$500k)', color: 'bg-green-50 text-green-600', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                      { key: 'complex', label: 'Complex UWT', sub: 'Medium Propensity\nEdge Cases & Issues', color: 'bg-purple-50 text-purple-600', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
                    ].map(({ key, label, sub, color, icon }) => (
                      <div key={key} className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-1">
                        <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon}/></svg>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-3xl font-black text-slate-800 mb-1.5">{smartRoutingCounts[key] || 0}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium whitespace-pre-line">{sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 text-center pb-2">
                    <button onClick={() => setSmartAssignModal(false)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-12 rounded-xl shadow-lg transition-all hover:-translate-y-0.5">
                      Close Report
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TriagePage;
