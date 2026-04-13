import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePropensity } from "../context/PropensityContext";
import { fetchPropertiesRun1 } from "../services/api";
import ShapDrivers from "../components/ShapDrivers";

const formatCurrency = (value) => {
    if (!value && value !== 0) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const PredictionResultsPage = () => {
    const navigate = useNavigate();
    const { 
        run1Properties, setRun1Properties, 
        setExcludedIds, lowThreshold 
    } = usePropensity();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchPropertiesRun1();
                setRun1Properties(data);
                
                // Track auto-exclusions
                const excluded = data.filter(p => p.is_below_threshold).map(p => p.submission_id);
                setExcludedIds(excluded);
            } catch (err) {
                console.error("Error fetching run 1:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [setRun1Properties, setExcludedIds]);

    const numExcluded = run1Properties.filter(p => p.is_below_threshold).length;
    const thresholdPct = Math.round(lowThreshold * 100);

    const computeRiskDrivers = () => {
        if (!run1Properties.length) return [];
        const props = run1Properties;
        const avg = (key) => props.reduce((sum, p) => sum + (p[key] || 0), 0) / props.length;
        
        return [
            { feature: "total_risk_score", contribution: avg("total_risk_score") },
            { feature: "property_vulnerability_risk", contribution: avg("property_vulnerability_risk") },
            { feature: "construction_risk", contribution: avg("construction_risk") },
            { feature: "locality_risk", contribution: avg("locality_risk") },
            { feature: "coverage_risk", contribution: avg("coverage_risk") },
            { feature: "claim_history_risk", contribution: avg("claim_history_risk") },
            { feature: "property_condition_risk", contribution: avg("property_condition_risk") },
            { feature: "broker_performance", contribution: avg("broker_performance") }
        ].sort((a,b) => b.contribution - a.contribution);
    };
    const globalRiskDrivers = computeRiskDrivers();

    const handleRerun = () => {
        navigate("/prediction-loading?mode=rerun");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-h-screen bg-gray-50 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Preliminary Propensity</h1>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded border border-indigo-200 shadow-sm">
                    Run 1
                </span>
            </div>

            {numExcluded > 0 ? (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg shadow-sm">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-amber-800">
                                Action Required
                            </p>
                            <p className="text-sm text-amber-700 mt-1">
                                {numExcluded} properties are below the {thresholdPct}% propensity threshold and will be excluded from the next run.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 mb-6 rounded-lg shadow-sm text-sm font-medium">
                    All current submissions meet minimum propensity standards.
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-4 mb-8 w-full">
                {/* LEFT SIDE - Table */}
                <div className="bg-white rounded-lg shadow-card border border-gray-200 overflow-hidden lg:w-[75%]">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-100 border-b border-gray-300">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Preliminary Score</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Cover Type</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Building Cov</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {run1Properties.map((prop) => {
                                    const scorePct = Math.round(prop.quote_propensity * 100);
                                    const isExcluded = prop.is_below_threshold;
                                    
                                    return (
                                        <tr key={prop.submission_id} className={`transition-colors ${isExcluded ? 'bg-red-50/40 border-l-4 border-red-400' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <img src={prop.imageUrl} alt="Property" className="w-12 h-12 rounded object-cover shadow-sm bg-gray-200" />
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">{prop.property_county}</div>
                                                        <div className="text-xs text-gray-500">{prop.submission_id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={`font-bold ${isExcluded ? 'text-red-600' : 'text-blue-600'} text-lg`}>
                                                        {scorePct}%
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 uppercase">{prop.quote_propensity_label}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-700">
                                                {prop.cover_type}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-700 font-medium">
                                                {prop.building_coverage_limit ? formatCurrency(prop.building_coverage_limit) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {isExcluded ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                        To be Triage
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                        To be Eligible
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT SIDE - Risk Drivers */}
                <div className="lg:w-[25%] flex flex-col gap-3">
                    <ShapDrivers drivers={globalRiskDrivers} mode="risk_score" />
                </div>
            </div>

            <div className="mt-auto pt-6 flex justify-center items-center pb-8 border-t border-gray-200">
                <button
                    onClick={handleRerun}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-md hover:-translate-y-0.5 transition-all focus:ring-4 focus:ring-indigo-100"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Run Property Insights & Final Triage
                </button>
            </div>
            
        </div>
    );
};

export default PredictionResultsPage;
