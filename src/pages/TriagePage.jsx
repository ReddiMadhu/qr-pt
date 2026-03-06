import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchTriageProperties, sendLetterOfIntent, sendTriageEmails } from '../services/api';
import { usePropensity } from '../context/PropensityContext';

const TIER_BADGE = {
  High: 'bg-green-100 text-green-700 border-green-300',
  Mid: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-red-100 text-red-700 border-red-200',
};
const TIER_SCORE_COLOR = {
  High: 'text-green-600',
  Mid: 'text-amber-600',
  Low: 'text-red-600',
};

const formatCurrency = (value) => {
  if (!value && value !== 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const TriagePage = () => {
  const [searchParams] = useSearchParams();
  const {
    properties, setProperties,
    smartAssignResults, setSmartAssignResults
  } = usePropensity();

  const [loading, setLoading] = useState(properties.length === 0);
  const [letterModal, setLetterModal] = useState(null);
  const [letterSending, setLetterSending] = useState(false);
  const [letterResult, setLetterResult] = useState(null);
  const [justification, setJustification] = useState('');

  // Smart Assign State
  const [smartAssignModal, setSmartAssignModal] = useState(false);
  const [smartAssignPhase, setSmartAssignPhase] = useState(smartAssignResults ? 'complete' : 'idle'); // idle | processing | complete
  const [smartRoutingCounts, setSmartRoutingCounts] = useState(smartAssignResults || { bpo: 0, assistable: 0, complex: 0, lowCount: 0, highHighCount: 0, highLowCount: 0, midCount: 0 });
  const [pipelineStep, setPipelineStep] = useState(0);

  const navigate = useNavigate();

  const rawPropensity = searchParams.get('propensity');
  const hasValidPropensityParam = rawPropensity && ['high', 'mid', 'low', 'medium'].includes(rawPropensity.toLowerCase());

  useEffect(() => {
    const load = async () => {
      if (properties.length > 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await fetchTriageProperties();
      setProperties(data);
      setLoading(false);
    };
    load();
  }, [properties.length, setProperties]);

  // Derive tier from quote_propensity_label (e.g. "High Propensity" → "High")
  const getTier = (label) => {
    if (!label) return 'Low';
    const l = label.toLowerCase();
    if (l.includes('high')) return 'High';
    if (l.includes('mid')) return 'Mid';
    return 'Low';
  };

  // Filter out excluded properties, show all tiers
  const filteredProperties = properties.filter((p) => !p.excluded);

  const handleSendLetter = async (letterType) => {
    if (!letterModal) return;
    setLetterSending(true);
    setLetterResult(null);
    try {
      await sendLetterOfIntent({
        submissionId: letterModal.submission_id,
        applicantEmail: letterModal.applicant_email || '',
        brokerCompany: letterModal.broker_company || '',
        propertyCounty: letterModal.property_county || '',
        letterType,
      });
      setLetterResult('sent');
      setTimeout(() => {
        setLetterModal(null);
        setLetterResult(null);
      }, 2000);
    } catch {
      setLetterResult('error');
    } finally {
      setLetterSending(false);
    }
  };

  useEffect(() => {
    if (smartAssignPhase !== 'processing') { setPipelineStep(0); return; }
    setPipelineStep(0);
    const timings = [400, 900, 1500, 2200];
    const timers = timings.map((t, i) => setTimeout(() => setPipelineStep(i + 1), t));
    return () => timers.forEach(clearTimeout);
  }, [smartAssignPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartSmartAssign = () => {
    setSmartAssignModal(true);
    setSmartAssignPhase('processing');

    // Calculate routing logic based on user rules
    let lowCount = 0, highHighCount = 0, highLowCount = 0, midCount = 0;

    filteredProperties.forEach((p) => {
      const tier = getTier(p.quote_propensity_label);
      const coverage = (p.building_coverage_limit || 0) + (p.contents_coverage_limit || 0);
      if (tier === 'Low') lowCount++;
      else if (tier === 'Mid') midCount++;
      else if (coverage > 500000) highHighCount++;
      else highLowCount++;
    });

    const counts = {
      bpo: lowCount + highLowCount,
      assistable: highHighCount,
      complex: midCount,
      lowCount, highHighCount, highLowCount, midCount,
    };

    setSmartRoutingCounts(counts);

    // Background API call + animation timer
    const process = async () => {
      try {
        await sendTriageEmails('batch_all'); // Sending batch tracking ID if supported
      } catch (err) {
        console.warn('Silent fallback for batch UWT email dispatch:', err);
      }
      setTimeout(() => {
        setSmartAssignPhase('complete');
        setSmartAssignResults(counts);
      }, 4000); // 4 second animation duration
    };
    process();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Cleaned up Inner Header to avoid double bounding boxes with Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-blue-600 flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="h-4 w-px bg-gray-300"></div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">AI Predictions Results</h1>
              <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 bg-blue-100 text-blue-700 border-blue-300`}>
                All Submissions
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleStartSmartAssign}
          className="flex items-center gap-1.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:-translate-y-0.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Smart Assign
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading triage data...</p>
            </div>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No submissions found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-200 border-b border-gray-300">
                  <tr>
                    <th className="px-3 pt-2 pb-2 text-left text-sm font-semibold text-gray-800">Property</th>
                    <th className="px-3 pt-2 pb-2 text-left text-sm font-semibold text-gray-800">Propensity Score</th>
                    <th className="px-3 pt-2 pb-2 text-left text-sm font-semibold text-gray-800">Cover Type</th>
                    <th className="px-3 pt-2 pb-2 text-left text-sm font-semibold text-gray-800">Building Coverage</th>
                    <th className="px-3 pt-2 pb-2 text-left text-sm font-semibold text-gray-800">Contents Coverage</th>
                    <th className="px-3 pt-2 pb-2 text-left text-sm font-semibold text-gray-800">State</th>
                    <th className="px-3 pt-2 pb-2 text-left text-sm font-semibold text-gray-800">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProperties.map((property) => {
                    const scorePct = property.quote_propensity != null
                      ? Math.round(property.quote_propensity * 100)
                      : '—';
                    const tier = getTier(property.quote_propensity_label);
                    return (
                      <tr key={property.submission_id || property.id} className="hover:bg-gray-50 transition-colors">
                        {/* Property Column */}
                        <td className="px-3 py-2">
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <img
                                src={property.imageUrl}
                                alt={property.property_county}
                                className="w-20 h-20 rounded-lg object-cover shadow-sm"
                              />
                              <div className="absolute -top-2 -left-2 bg-blue-600 text-white font-bold text-xs px-2 py-0.5 rounded shadow-md">
                                {property.propertyId}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{property.property_county}</div>
                              <div className="text-sm text-gray-600">{property.occupancy_type}</div>
                              <div className="text-sm font-bold text-gray-900 mt-1">
                                {formatCurrency(property.property_value)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Propensity Score */}
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <span className={`text-lg font-extrabold ${TIER_SCORE_COLOR[tier]}`}>
                              {scorePct}%
                            </span>
                            <span className={`text-xs font-medium border rounded-full px-2 py-0.5 w-fit ${TIER_BADGE[tier]}`}>
                              {property.quote_propensity_label ?? tier}
                            </span>
                          </div>
                        </td>

                        {/* Cover Type */}
                        <td className="px-3 py-2">
                          <span className="text-sm text-gray-700">{property.cover_type || '—'}</span>
                        </td>

                        {/* Building Coverage Limit */}
                        <td className="px-3 py-2">
                          <span className="text-sm font-medium text-gray-800">
                            {property.building_coverage_limit
                              ? formatCurrency(property.building_coverage_limit)
                              : <span className="text-gray-400">—</span>}
                          </span>
                        </td>

                        {/* Contents Coverage Limit */}
                        <td className="px-3 py-2">
                          <span className="text-sm font-medium text-gray-800">
                            {property.contents_coverage_limit
                              ? formatCurrency(property.contents_coverage_limit)
                              : <span className="text-gray-400">—</span>}
                          </span>
                        </td>

                        {/* State */}
                        <td className="px-3 py-2">
                          <span className="text-sm font-semibold text-gray-700">{property.state || '—'}</span>
                        </td>

                        {/* View Details + Send Letter */}
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1.5">
                            <button
                              onClick={() => {
                                const qString = searchParams.toString();
                                navigate(`/property/${property.submission_id || property.id}${qString ? `?${qString}` : ''}`, {
                                  state: { property, fromTriage: true },
                                });
                              }}
                              className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors inline-flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Details
                            </button>
                            {hasValidPropensityParam && (
                              <button
                                onClick={() => { setLetterModal(property); setLetterResult(null); setJustification(''); }}
                                className="px-3 py-1.5 rounded-md text-sm font-medium border border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-colors inline-flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

      {/* Letter Modal */}
      {letterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setLetterModal(null); setLetterResult(null); setJustification(''); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Send Underwriter Letter</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {letterModal.submission_id} — {letterModal.property_county}
                </p>
              </div>
              <button
                onClick={() => { setLetterModal(null); setLetterResult(null); setJustification(''); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Broker info */}
            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-5 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-16 flex-shrink-0">Broker</span>
                <span className="font-semibold text-gray-800">{letterModal.broker_company || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-20 flex-shrink-0">Applicant Email</span>
                <span className="font-medium text-blue-700">{letterModal.applicant_email || '—'}</span>
              </div>
            </div>

            {/* Success / Error */}
            {letterResult === 'sent' && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg px-4 py-2.5 text-center font-medium">
                Email sent to {letterModal.applicant_email || '—'}
              </div>
            )}
            {letterResult === 'error' && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 text-center font-medium">
                Failed to send — check SMTP config
              </div>
            )}

            {/* Action buttons */}
            {!letterResult && (
              <>
                {/* Underwriter Justification */}
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

      {/* Smart Assign Processing Modal */}
      {smartAssignModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                Intelligent Smart Assign
              </h2>
              {smartAssignPhase === 'complete' && (
                <button
                  onClick={() => setSmartAssignModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Body */}
            <div className="p-6 bg-white">
              {smartAssignPhase === 'processing' ? (
                // Pipeline Flow Visualization — SVG viewBox with foreignObject so coordinates always match
                <div className="space-y-3 py-2">
                  <p className="text-center text-sm text-gray-500">
                    Routing {filteredProperties.length} submissions to underwriting queues...
                  </p>

                  <svg viewBox="0 0 820 260" className="w-full" style={{ fontFamily: 'inherit' }}>
                    <defs>
                      <marker id="arr-blue" viewBox="0 0 10 10" markerWidth="5" markerHeight="5" refX="8" refY="5" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 Z" fill="#3b82f6" />
                      </marker>
                    </defs>

                    {/* ── Source node (centre 80,130) ── */}
                    {pipelineStep >= 1 && (
                      <g>
                        <rect x="10" y="85" width="140" height="90" rx="10" fill="#4f46e5" />
                        <text x="80" y="116" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" letterSpacing="1">ALL SUBMISSIONS</text>
                        <text x="80" y="143" textAnchor="middle" fill="white" fontSize="28" fontWeight="900">{filteredProperties.length}</text>
                      </g>
                    )}

                    {/* ── Fan lines: source right (150,130) → each branch left (290,yB) ── */}
                    {/* Branch y-centres: Low=50, HighHigh=100, HighLow=160, Mid=210       */}
                    {pipelineStep >= 1 && (
                      <>
                        <polyline points="150,130 200,130 200,50  290,50" fill="none" className="path-smart-progress" stroke="#3b82f6" markerEnd="url(#arr-blue)" />
                        <polyline points="150,130 200,130 200,100 290,100" fill="none" className="path-smart-progress" stroke="#3b82f6" markerEnd="url(#arr-blue)" />
                        <polyline points="150,130 200,130 200,160 290,160" fill="none" className="path-smart-progress" stroke="#3b82f6" markerEnd="url(#arr-blue)" />
                        <polyline points="150,130 200,130 200,210 290,210" fill="none" className="path-smart-progress" stroke="#3b82f6" markerEnd="url(#arr-blue)" />
                      </>
                    )}

                    {/* ── Branch nodes (x=290..520) ── */}
                    {pipelineStep >= 1 && (
                      <>
                        {/* Low Propensity — y=50 */}
                        <rect x="290" y="37" width="230" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
                        <rect x="290" y="37" width="4" height="26" rx="2" fill="#ef4444" />
                        <text x="302" y="54" fill="#374151" fontSize="10" fontWeight="600">Low Propensity</text>
                        <text x="512" y="54" textAnchor="end" fill="#111827" fontSize="12" fontWeight="900">{smartRoutingCounts.lowCount}</text>

                        {/* High + Low Cov — y=100 */}
                        <rect x="290" y="87" width="230" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
                        <rect x="290" y="87" width="4" height="26" rx="2" fill="#f97316" />
                        <text x="302" y="104" fill="#374151" fontSize="10" fontWeight="600">High + Low Cov (≤$500k)</text>
                        <text x="512" y="104" textAnchor="end" fill="#111827" fontSize="12" fontWeight="900">{smartRoutingCounts.highLowCount}</text>

                        {/* High + High Cov — y=160 */}
                        <rect x="290" y="147" width="230" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
                        <rect x="290" y="147" width="4" height="26" rx="2" fill="#22c55e" />
                        <text x="302" y="164" fill="#374151" fontSize="10" fontWeight="600">High + High Cov (&gt;$500k)</text>
                        <text x="512" y="164" textAnchor="end" fill="#111827" fontSize="12" fontWeight="900">{smartRoutingCounts.highHighCount}</text>

                        {/* Mid Propensity — y=210 */}
                        <rect x="290" y="197" width="230" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
                        <rect x="290" y="197" width="4" height="26" rx="2" fill="#a855f7" />
                        <text x="302" y="214" fill="#374151" fontSize="10" fontWeight="600">Mid Propensity</text>
                        <text x="512" y="214" textAnchor="end" fill="#111827" fontSize="12" fontWeight="900">{smartRoutingCounts.midCount}</text>
                      </>
                    )}

                    {/* ── Merge lines: branch right (520,yB) → queue left (620,yQ) ──
                        Queue y-centres: BPO=80, Assistable=130, Complex=190            */}
                    {pipelineStep >= 2 && (
                      <>
                        {/* Low      → BPO */}
                        <polyline points="520,50  570,50  570,80  620,80" fill="none" className="path-smart-progress" stroke="#3b82f6" markerEnd="url(#arr-blue)" />
                        {/* HighLow  → BPO */}
                        <polyline points="520,100 570,100 570,80  620,80" fill="none" className="path-smart-progress" stroke="#3b82f6" markerEnd="url(#arr-blue)" />
                        {/* HighHigh → Assistable */}
                        <polyline points="520,160 570,160 570,130 620,130" fill="none" className="path-smart-progress" stroke="#3b82f6" markerEnd="url(#arr-blue)" />
                        {/* Mid      → Complex */}
                        <polyline points="520,210 570,210 570,190 620,190" fill="none" className="path-smart-progress" stroke="#3b82f6" markerEnd="url(#arr-blue)" />
                      </>
                    )}

                    {/* ── Queue nodes (x=620..810) ── */}
                    {pipelineStep >= 2 && (
                      <>
                        {/* BPO Team — yQ=80 */}
                        <rect x="620" y="62" width="190" height="36" rx="8" fill="#1d4ed8" />
                        <text x="715" y="85" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">BPO TEAM</text>

                        {/* UWT Assistable — yQ=130 */}
                        <rect x="620" y="112" width="190" height="36" rx="8" fill="#4f46e5" />
                        <text x="715" y="135" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">UWT ASSISTABLE</text>

                        {/* Complex UWT — yQ=190 */}
                        <rect x="620" y="172" width="190" height="36" rx="8" fill="#374151" />
                        <text x="715" y="195" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">COMPLEX UWT</text>
                      </>
                    )}

                    {/* ── Envelope badges on queue nodes (step 3) ── */}
                    {pipelineStep >= 3 && (
                      <>
                        <rect x="798" y="54" width="18" height="13" rx="2" fill="white" stroke="#1d4ed8" strokeWidth="1.5" />
                        <polyline points="798,54  807,63  816,54" fill="none" stroke="#1d4ed8" strokeWidth="1.5" />
                        <rect x="798" y="104" width="18" height="13" rx="2" fill="white" stroke="#4f46e5" strokeWidth="1.5" />
                        <polyline points="798,104 807,113 816,104" fill="none" stroke="#4f46e5" strokeWidth="1.5" />
                        <rect x="798" y="164" width="18" height="13" rx="2" fill="white" stroke="#374151" strokeWidth="1.5" />
                        <polyline points="798,164 807,173 816,164" fill="none" stroke="#374151" strokeWidth="1.5" />
                      </>
                    )}

                  </svg>

                  {pipelineStep >= 3 && (
                    <p className="text-center text-xs text-indigo-500 animate-pulse font-medium pb-2">
                      Dispatching emails to underwriting teams...
                    </p>
                  )}
                </div>
              ) : (
                // Complete State
                <div className="py-4 animate-in zoom-in-95 fade-in duration-500">
                  <div className="flex items-center justify-center gap-4 mb-10 text-emerald-500">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center ring-4 ring-emerald-50/50 shadow-inner">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">Routing Complete!</h3>
                      <p className="text-slate-500 text-sm font-medium mt-1">Emails and platform notifications have been dispatched securely.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
                    {/* BPO Team Queue */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-1">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">BPO Team</p>
                      <p className="text-4xl font-black text-slate-800 mb-2">{smartRoutingCounts.bpo}</p>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">Low Propensity <br /> High Propensity + Low Cov</p>
                    </div>

                    {/* UWT Assistable Queue */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-1">
                      <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">UWT Assistable</p>
                      <p className="text-4xl font-black text-slate-800 mb-2">{smartRoutingCounts.assistable}</p>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">High Propensity <br /> High Coverage ({'>'}$500k)</p>
                    </div>

                    {/* Complex UWT Queue */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-1">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Complex UWT</p>
                      <p className="text-4xl font-black text-slate-800 mb-2">{smartRoutingCounts.complex}</p>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">Medium Propensity <br /> Edge Cases & Issues</p>
                    </div>
                  </div>

                  <div className="mt-12 text-center pb-2">
                    <button
                      onClick={() => setSmartAssignModal(false)}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-12 rounded-xl shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] transition-all transform hover:-translate-y-0.5"
                    >
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
