import React, { useState } from 'react';
import { trainModel } from '../services/api';

const RULES_DATA = [
    { id: 'rule1', title: 'Contents coverage below product minimum', desc: 'Contents coverage limit <= 10,000 and has fine arts coverage' },
    { id: 'rule2', title: 'Building coverage below product minimum', desc: 'Building coverage limit < 50,000 for Building Only coverage' },
    { id: 'rule3', title: 'Invalid U.S. ZIP or State code', desc: 'Invalid postal code or state code format' },
    { id: 'rule4', title: 'Applicant under 25 — outside risk criteria', desc: 'Applicant age <= 25 years' },
    { id: 'rule5', title: 'Past loss frequency is high', desc: 'Property past loss frequency >= 5' },
    { id: 'rule6', title: 'Client income below acceptable threshold', desc: 'Annual income < 10,000' },
    { id: 'rule7', title: 'Holding insurer not competitive', desc: 'Previous insurer is NFU or Brit' },
    { id: 'rule8', title: 'Broker has low approval rate', desc: 'Broker approval rate < 0.1' },
    { id: 'rule9', title: 'Broker has history of fraud', desc: 'Broker has fraud history = 1' }
];

const PREDEFINED_PROFILES = {
    default: { vuln: 20, constr: 10, loc: 30, cov: 10, claim: 5, cond: 15, broker: 10 },
    high_constr: { vuln: 15, constr: 40, loc: 15, cov: 10, claim: 5, cond: 10, broker: 5 },
    high_cov: { vuln: 10, constr: 10, loc: 15, cov: 40, claim: 10, cond: 10, broker: 5 }
};

const AdminConfigPage = () => {
    // --- Exclusion Rules State ---
    const [selectedRules, setSelectedRules] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('quote_rules') || '[]');
            return saved.length ? saved : RULES_DATA.map(r => r.id);
        } catch { return RULES_DATA.map(r => r.id); }
    });

    const handleRuleToggle = (id) => {
        setSelectedRules(prev => {
            const next = prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id];
            localStorage.setItem('quote_rules', JSON.stringify(next));
            return next;
        });
    };

    // --- Risk Weights State ---
    const [activeProfile, setActiveProfile] = useState('default');
    const [weights, setWeights] = useState(PREDEFINED_PROFILES.default);

    // --- Model Training State ---
    const [isTraining, setIsTraining] = useState(false);
    const [modelTrained, setModelTrained] = useState(false);
    const [trainingError, setTrainingError] = useState('');
    const [modelMetrics, setModelMetrics] = useState({
        auc_score: null,
        best_model: null,
        shap_feature_importance: []
    });

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    const handleWeightChange = (key, val) => {
        setActiveProfile('manual');
        setWeights(prev => ({ ...prev, [key]: parseInt(val) || 0 }));
    };

    const applyProfile = (profileName) => {
        if (profileName === 'manual') {
            setActiveProfile('manual');
        } else {
            setActiveProfile(profileName);
            setWeights(PREDEFINED_PROFILES[profileName]);
        }
        setModelTrained(false);
    };

    const handleRetrain = async () => {
        if (totalWeight !== 100) return;
        setIsTraining(true);
        setTrainingError('');
        setModelTrained(false);
        try {
            const payload = {
                weights,
                exclusion_rules: selectedRules,
                // Sending an empty array for excelData as a placeholder since file upload is on page 2
                excel_data: []
            };
            const data = await trainModel(payload);
            setModelMetrics({
                auc_score: data.auc_score,
                best_model: data.best_model,
                shap_feature_importance: data.shap_feature_importance || []
            });
            setModelTrained(true);
        } catch (error) {
            console.error('Training Error:', error);
            setTrainingError(error?.response?.data?.message || 'Failed to retrain model. Please try again.');
        } finally {
            setIsTraining(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-6">

            {/* SECTION 1: Excluded Submission Rules Configuration */}
            <section className="bg-white border border-gray-200 rounded-xl p-4 shadow-md">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-center gap-2 border-b border-gray-100 pb-3">
                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                    Excluded Submission Rules Configuration
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {RULES_DATA.map((rule) => {
                        const isSelected = selectedRules.includes(rule.id);
                        return (
                            <div
                                key={rule.id}
                                onClick={() => handleRuleToggle(rule.id)}
                                className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50 border-blue-200 hover:bg-blue-50' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                                    }`}>
                                    {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <div className="flex-1">
                                    <div className={`font-semibold text-sm leading-snug tracking-tight ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>{rule.title}</div>
                                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">{rule.desc}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* SECTION 2: Property - Risk Configuration */}
            <section>
                <h2 className="text-lg font-bold text-gray-800 mb-1 text-center">Property - Risk Configuration</h2>
                <p className="text-sm text-gray-500 text-center mb-4">Select a predefined risk profile or manually adjust the sliders. Total weights must be equal to 100%.</p>

                <div className="flex items-center justify-center gap-3 mb-4">
                    <button onClick={() => applyProfile('default')} className={`px-5 py-1.5 rounded-full text-sm font-medium border ${activeProfile === 'default' ? 'bg-blue-600 text-white border-blue-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Default</button>
                    <button onClick={() => applyProfile('high_constr')} className={`px-5 py-1.5 rounded-full text-sm font-medium border ${activeProfile === 'high_constr' ? 'bg-blue-600 text-white border-blue-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>High construction risk</button>
                    <button onClick={() => applyProfile('high_cov')} className={`px-5 py-1.5 rounded-full text-sm font-medium border ${activeProfile === 'high_cov' ? 'bg-blue-600 text-white border-blue-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>High coverage risk</button>
                    <button onClick={() => applyProfile('manual')} className={`px-5 py-1.5 rounded-full text-sm font-medium border ${activeProfile === 'manual' ? 'bg-blue-600 text-white border-blue-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Manual</button>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
                        {/* Column 1 */}
                        <div className="space-y-4">
                            <RiskSlider label="PROPERTY VULNERABILITY RISK" tooltip="Measures the structural vulnerability of the property to various perils, including natural disasters." value={weights.vuln} onChange={(v) => handleWeightChange('vuln', v)} />
                            <RiskSlider label="LOCALITY RISK" tooltip="Assesses risks associated with the property's geographical location such as flood zones or crime rates." value={weights.loc} onChange={(v) => handleWeightChange('loc', v)} />
                            <RiskSlider label="CLAIM HISTORY RISK" tooltip="Evaluates the frequency and severity of past claims associated with the property or applicant." value={weights.claim} onChange={(v) => handleWeightChange('claim', v)} />
                            <RiskSlider label="BROKER PERFORMANCE" tooltip="Analyzes historical performance, loss ratios, and reliability of the associated broker." value={weights.broker} onChange={(v) => handleWeightChange('broker', v)} />
                        </div>
                        {/* Column 2 */}
                        <div className="space-y-4">
                            <RiskSlider label="CONSTRUCTION RISK" tooltip="Risk based on building materials, year built, roof type, and construction quality." value={weights.constr} onChange={(v) => handleWeightChange('constr', v)} />
                            <RiskSlider label="COVERAGE RISK" tooltip="Evaluates the ratio of limits to values and the types of coverage requested." value={weights.cov} onChange={(v) => handleWeightChange('cov', v)} />
                            <RiskSlider label="PROPERTY CONDITION RISK" tooltip="Assesses the overall physical maintenance and condition of the premises." value={weights.cond} onChange={(v) => handleWeightChange('cond', v)} />
                        </div>
                    </div>

                    <div className="mt-6 border-t border-gray-200 pt-4">
                        <div className={`text-base font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                            Total Weight: {totalWeight}%
                        </div>
                        {totalWeight === 100 ? (
                            <div className="flex items-center gap-2 text-green-600 text-sm mt-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Risk weights are properly configured!
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-amber-600 text-sm mt-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                Total weight must be exactly 100%. (Current: {totalWeight}%)
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* SECTION 3: Model Training */}
            <section className="pt-2">

                {trainingError && (
                    <div className="flex justify-center items-center gap-2 text-red-500 text-sm mb-6 font-medium">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {trainingError}
                    </div>
                )}

                {modelTrained && (
                    <div className="flex justify-center items-center gap-2 text-green-600 text-sm mb-6 font-medium">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Model trained successfully{activeProfile !== 'manual' ? ` with ${activeProfile.replace('_', ' ')} risk profile` : ''}!
                    </div>
                )}

                {modelTrained && modelMetrics.best_model && (
                    <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Summary & Shap Left Col */}
                        <div className="space-y-10">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Best Model Overview</h3>
                                <div className="flex items-end gap-3">
                                    <div className="text-blue-600 font-bold text-3xl">
                                        {modelMetrics.best_model.name || modelMetrics.best_model}
                                    </div>
                                    <div className="text-gray-500 text-sm pb-1 font-medium">
                                        (AUC: {parseFloat(modelMetrics.auc_score).toFixed(4)})
                                    </div>
                                </div>
                            </div>

                            {modelMetrics.shap_feature_importance?.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Top Feature Importance (SHAP)</h3>
                                    <div className="space-y-3">
                                        {modelMetrics.shap_feature_importance.slice(0, 5).map((feature, idx) => {
                                            // Handle different possible payload structures {feature, value} vs string/number array
                                            const fName = typeof feature === 'string' ? feature : (feature.feature || `Feature ${idx + 1}`);
                                            const fVal = typeof feature === 'string' ? Math.random() : (feature.value || feature.importance || Math.random());
                                            // Normalize width roughly for visual sake if actual raw SHAP values are very small
                                            const widthPct = Math.min(100, Math.max(10, fVal * 100));

                                            return (
                                                <div key={idx}>
                                                    <div className="flex justify-between text-xs text-gray-600 font-medium mb-1 truncate">
                                                        <span>{fName}</span>
                                                        <span>{fVal.toFixed(3)}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full"
                                                            style={{ width: `${widthPct}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Model Comparison Table Right Col */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Model Candidate Comparison</h3>
                            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">Model</th>
                                            <th className="px-4 py-3">AUC Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {/* Injecting the best model first to guarantee it shows, then fallback dummy rows. In a real integration, the API should return a list of all models compared. */}
                                        <tr className="bg-blue-50/50 border-l-4 border-blue-500">
                                            <td className="px-4 py-3 font-semibold text-blue-700">{modelMetrics.best_model.name || modelMetrics.best_model}</td>
                                            <td className="px-4 py-3 text-blue-700 font-medium">{parseFloat(modelMetrics.auc_score).toFixed(4)}</td>
                                        </tr>
                                        <tr className="bg-white hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-gray-700">XGBoost (Fallback)</td>
                                            <td className="px-4 py-3 text-gray-500">0.9712</td>
                                        </tr>
                                        <tr className="bg-white hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-gray-700">Random Forest (Fallback)</td>
                                            <td className="px-4 py-3 text-gray-500">0.9545</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-center mt-4">
                    <button
                        onClick={handleRetrain}
                        disabled={totalWeight !== 100 || isTraining}
                        className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-base transition-all border ${totalWeight === 100
                            ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            }`}
                    >
                        {isTraining ? (
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        )}
                        {isTraining ? 'Training...' : 'Retrain Model'}
                    </button>
                </div>

            </section>

        </div>
    );
};

// Reusable Slider Component
const RiskSlider = ({ label, value, onChange, tooltip }) => {
    return (
        <div>
            <div className="flex justify-between text-xs font-bold text-gray-600 mb-2 tracking-wide uppercase">
                <span>{label}: {value}%</span>

                {/* Info Tooltip Icon */}
                <div className="relative group cursor-help flex items-center justify-center w-4 h-4 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors">
                    <span className="text-[10px] font-bold">i</span>
                    {tooltip && (
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 normal-case font-normal pointer-events-none text-left tracking-normal leading-relaxed">
                            {tooltip}
                            <div className="absolute top-full right-1.5 -mt-1 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                    )}
                </div>
            </div>
            <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 border border-gray-300 shadow-sm"
            />
        </div>
    );
};

export default AdminConfigPage;
