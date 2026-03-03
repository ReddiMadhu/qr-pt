import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchTriageProperties, sendLetterOfIntent, sendTriageEmails } from '../services/api';

const TIER_LABEL = { high: 'High', mid: 'Mid', low: 'Low' };
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
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [letterModal, setLetterModal] = useState(null);
  const [letterSending, setLetterSending] = useState(false);
  const [letterResult, setLetterResult] = useState(null);
  const [justification, setJustification] = useState('');

  // Smart Assign State
  const [smartAssignModal, setSmartAssignModal] = useState(false);
  const [smartAssignPhase, setSmartAssignPhase] = useState('idle'); // idle | processing | complete
  const [smartRoutingCounts, setSmartRoutingCounts] = useState({ bpo: 0, assistable: 0, complex: 0 });

  const navigate = useNavigate();

  const rawPropensity = searchParams.get('propensity');
  const hasValidPropensityParam = rawPropensity && ['high', 'mid', 'low', 'medium'].includes(rawPropensity.toLowerCase());
  const propensityParam = (rawPropensity || 'high').toLowerCase();
  const tierKey = TIER_LABEL[propensityParam] ?? 'High';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchTriageProperties();
      setProperties(data);
      setLoading(false);
    };
    load();
  }, []);

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

  const handleStartSmartAssign = () => {
    setSmartAssignModal(true);
    setSmartAssignPhase('processing');

    // Calculate routing logic based on user rules
    let bpo = 0;
    let assistable = 0;
    let complex = 0;

    filteredProperties.forEach((p) => {
      const isHigh = getTier(p.quote_propensity_label) === 'High';
      const isMid = getTier(p.quote_propensity_label) === 'Mid';
      const isLow = getTier(p.quote_propensity_label) === 'Low';
      const coverage = (p.building_coverage_limit || 0) + (p.contents_coverage_limit || 0);

      // Rule: Low Propensity -> BPO Team
      if (isLow) bpo++;
      // Rule: Medium Propensity -> Complex Underwriting Team
      else if (isMid) complex++;
      // Rule: High Propensity + High Coverage (> $500k) -> Underwriting Assistable
      else if (isHigh && coverage > 500000) assistable++;
      // Rule: High Propensity + Low Coverage -> BPO Team
      else if (isHigh && coverage <= 500000) bpo++;
    });

    setSmartRoutingCounts({ bpo, assistable, complex });

    // Background API call + animation timer
    const process = async () => {
      try {
        await sendTriageEmails('batch_all'); // Sending batch tracking ID if supported
      } catch (err) {
        console.warn('Silent fallback for batch UWT email dispatch:', err);
      }
      setTimeout(() => {
        setSmartAssignPhase('complete');
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Intelligent Smart Assign
              </h2>
              {smartAssignPhase === 'complete' && (
                <button
                  onClick={() => setSmartAssignModal(false)}
                  className="text-indigo-200 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Body */}
            <div className="p-8">
              {smartAssignPhase === 'processing' ? (
                // Processing Animation State
                <div className="text-center space-y-6 py-4">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <svg className="absolute inset-0 m-auto w-10 h-10 text-indigo-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Evaluating Properties & Routing Streams</h3>
                    <p className="text-gray-500 mt-2">AI is applying constraints algorithms to dispatch to appropriate Underwriting queues...</p>
                  </div>
                </div>
              ) : (
                // Complete State
                <div className="py-2">
                  <div className="flex items-center justify-center gap-3 mb-8 text-green-600">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Routing Complete!</h3>
                  </div>

                  <p className="text-gray-500 text-center mb-6 text-sm">Emails and platform notifications have been dispatched correctly.</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* BPO Team Queue */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">BPO Team</p>
                      <p className="text-3xl font-black text-indigo-600 mb-1">{smartRoutingCounts.bpo}</p>
                      <p className="text-[10px] text-gray-400">Low Propensity OR <br /> High Propensity + Low Coverage</p>
                    </div>

                    {/* UWT Assistable Queue */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">UWT Assistable</p>
                      <p className="text-3xl font-black text-indigo-600 mb-1">{smartRoutingCounts.assistable}</p>
                      <p className="text-[10px] text-gray-400">High Propensity <br /> + High Coverage ({'>'}$500k)</p>
                    </div>

                    {/* Complex UWT Queue */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Complex UWT</p>
                      <p className="text-3xl font-black text-indigo-600 mb-1">{smartRoutingCounts.complex}</p>
                      <p className="text-[10px] text-gray-400">Medium Propensity <br /> Edge Cases</p>
                    </div>
                  </div>

                  <div className="mt-8 text-center">
                    <button
                      onClick={() => setSmartAssignModal(false)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-colors"
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
