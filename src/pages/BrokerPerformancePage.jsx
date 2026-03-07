import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePropensity } from '../context/PropensityContext';

// ─── helpers ──────────────────────────────────────────────────────────────────

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

const AGG_COLS = {
    broker_total_premium: 'sum',
    broker_claim_payouts: 'sum',
    broker_approved_submissions: 'sum',
    broker_submissions_handled: 'sum',
    broker_experience_years: 'mean',
    broker_approval_rate: 'mean',
    broker_loss_ratio_percent: 'mean',
};

const SORT_OPTIONS = [
    { label: 'Submissions Handled', value: 'broker_submissions_handled' },
    { label: 'Total Premium', value: 'broker_total_premium' },
    { label: 'Total Claim', value: 'broker_claim_payouts' },
    { label: 'Approval Rate', value: 'broker_approval_rate' },
    { label: 'Loss Ratio', value: 'broker_loss_ratio_percent' },
];

const VIEW_MAP = { 'Top/Bottom 5': 5, 'Top/Bottom 10': 10, 'Top/Bottom 15': 15 };

const fmt = (n, prefix = '', suffix = '', decimals = 0) =>
    `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}${suffix}`;

const lossColor = (v) => {
    if (v >= 70) return 'bg-red-50 text-red-600';
    if (v >= 40) return 'bg-amber-50 text-amber-600';
    return 'bg-green-50 text-green-600';
};

// ─── sub-components ───────────────────────────────────────────────────────────

const StatBox = ({ label, value }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-3 pt-4 pb-4 text-center shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
        <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">{label}</div>
        <div className="text-xl font-bold text-gray-800">{value}</div>
    </div>
);

const HBarChart = ({ brokers, metric, metricLabel }) => {
    const maxVal = Math.max(...brokers.map(b => b[metric] || 0), 1);
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-4">Broker {metricLabel}</p>
            <div className="space-y-3">
                {brokers.map((b, i) => {
                    const val = b[metric] || 0;
                    const pct = (val / maxVal) * 100;
                    const id = b.broker_name || b.broker_id || b[Object.keys(b)[0]];
                    return (
                        <div key={i} className="flex items-center gap-3">
                            <span className="w-24 text-xs text-gray-600 truncate text-right shrink-0" title={id}>{id}</span>
                            <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                                <div
                                    className="h-full rounded bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="w-20 text-xs text-gray-700 font-medium shrink-0">
                                {val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const BrokerBubbleChart = ({ brokers }) => {
    if (!brokers || brokers.length === 0) return null;

    const data = brokers.map(b => ({
        id: b.broker_name || b.broker_id || 'Unknown',
        x: b.broker_approval_rate || 0,
        y: b.broker_loss_ratio_percent || 0,
        z: b.broker_total_premium || 0,
    }));

    const maxDataX = Math.max(...data.map(d => d.x));
    const minDataX = Math.min(...data.map(d => d.x));
    const maxX = Math.min(100, Math.ceil(maxDataX / 10) * 10 + 10);
    const minX = Math.max(0, Math.floor(minDataX / 10) * 10 - 10);
    const maxY = Math.max(100, Math.ceil(Math.max(...data.map(d => d.y)) / 20) * 20);
    const maxZ = Math.max(...data.map(d => d.z)) || 1;

    const getX = (val) => `${((val - minX) / (maxX - minX)) * 100}%`;
    const getY = (val) => `${(val / maxY) * 100}%`;

    // Bubble size bounds
    const minSize = 12;
    const maxSize = 48;
    const getSize = (val) => minSize + (val / maxZ) * (maxSize - minSize);

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
            <p className="text-sm font-semibold text-gray-700 mb-4">Approval Rate vs Loss Ratio</p>
            <div className="flex-1 min-h-[300px] bg-gray-50 rounded-xl relative p-4 overflow-hidden border border-gray-100 group">

                {/* Y-axis Labels */}
                <div className="absolute left-2 top-4 bottom-[2.5rem] w-8 flex flex-col justify-between text-[10px] text-gray-500 font-medium z-10">
                    <span>{maxY}</span>
                    <span>{(maxY * 0.75).toFixed(0)}</span>
                    <span>{(maxY * 0.5).toFixed(0)}</span>
                    <span>{(maxY * 0.25).toFixed(0)}</span>
                    <span>0</span>
                </div>

                {/* Y-axis Title */}
                <div className="absolute left-[-2rem] top-1/2 -rotate-90 text-[10px] text-gray-500 font-medium tracking-wider" style={{ transformOrigin: 'center' }}>
                    Loss Ratio (%)
                </div>

                {/* Chart Area */}
                <div className="absolute left-10 right-4 top-4 bottom-[2.5rem] border-l border-b border-gray-300">
                    {/* Horizontal Grid lines */}
                    {[0.25, 0.5, 0.75].map((pct, i) => (
                        <div key={i} className="absolute left-0 right-0 border-t border-gray-200 border-dashed" style={{ bottom: `${pct * 100}%` }}></div>
                    ))}

                    {/* Bubbles */}
                    {data.map((d, i) => {
                        const size = getSize(d.z);
                        return (
                            <div
                                key={i}
                                className="absolute rounded-full bg-blue-500/60 hover:bg-blue-600/80 hover:z-20 transition-all cursor-pointer shadow-sm border border-blue-400 backdrop-blur-sm"
                                style={{
                                    left: getX(d.x),
                                    bottom: getY(d.y),
                                    width: size,
                                    height: size,
                                    transform: 'translate(-50%, 50%)'
                                }}
                                title={`${d.id}\nApproval Rate: ${d.x.toFixed(1)}%\nLoss Ratio: ${d.y.toFixed(1)}%\nPremium: $${d.z.toLocaleString()}`}
                            ></div>
                        );
                    })}
                </div>

                {/* X-axis Labels */}
                <div className="absolute left-10 right-4 bottom-4 flex justify-between text-[10px] text-gray-500 font-medium z-10 transition-opacity">
                    <span style={{ transform: 'translateX(-50%)' }}>{minX}</span>
                    <span style={{ transform: 'translateX(-50%)', position: 'absolute', left: '25%' }}>{minX + (maxX - minX) * 0.25}</span>
                    <span style={{ transform: 'translateX(-50%)', position: 'absolute', left: '50%' }}>{minX + (maxX - minX) * 0.5}</span>
                    <span style={{ transform: 'translateX(-50%)', position: 'absolute', left: '75%' }}>{minX + (maxX - minX) * 0.75}</span>
                    <span style={{ transform: 'translateX(-50%)', position: 'absolute', left: '100%' }}>{maxX}</span>
                </div>

                {/* X-axis Title */}
                <div className="absolute bottom-[2px] right-4 text-[10px] text-gray-500 font-medium tracking-wider">
                    Approval Rate (%)
                </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
                <div className="w-3 h-3 rounded-full bg-blue-500/60 inline-block border border-blue-400"></div>
                <span>Bubble size represents Total Premium</span>
            </div>
        </div>
    );
};

// ─── main page ────────────────────────────────────────────────────────────────

const BrokerPerformancePage = () => {
    const [sortMetric, setSortMetric] = useState('broker_submissions_handled');
    const [sortOrder, setSortOrder] = useState('Descending');
    const [viewOption, setViewOption] = useState('All Brokers');

    // Read CSV rows stored by PropensityContext
    const { csvRows: csvData } = usePropensity();

    // Aggregate per broker
    const brokerData = useMemo(() => {
        if (!csvData.length) return [];

        const keys = Object.keys(csvData[0]);
        const brokerIdCol = keys.find(col =>
            col.toLowerCase().includes('broker') &&
            (col.toLowerCase().includes('id') || col.toLowerCase().includes('name'))
        );
        if (!brokerIdCol) return [];

        // Exclude online brokers
        const validCsvData = csvData.filter(row => row.broker_type?.toLowerCase() !== 'online');

        // Group by broker id
        const grouped = validCsvData.reduce((acc, row) => {
            const key = row[brokerIdCol] || 'Unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(row);
            return acc;
        }, {});

        return Object.entries(grouped).map(([brokerId, rows]) => {
            const agg = { [brokerIdCol]: brokerId };
            if (rows[0].broker_name) agg.broker_name = rows[0].broker_name;
            if (rows[0].broker_company) agg.broker_company = rows[0].broker_company;
            agg.broker_id = brokerId;

            Object.entries(AGG_COLS).forEach(([col, method]) => {
                const vals = rows.map(r => toNum(r[col]));
                agg[col] = method === 'sum' ? sum(vals) : mean(vals);
            });
            return agg;
        });
    }, [csvData]);

    // Sort + filter
    const filteredBrokers = useMemo(() => {
        const data = [...brokerData].sort((a, b) => {
            const vA = a[sortMetric] || 0;
            const vB = b[sortMetric] || 0;
            return sortOrder === 'Ascending' ? vA - vB : vB - vA;
        });
        if (viewOption !== 'All Brokers') {
            return data.slice(0, VIEW_MAP[viewOption]);
        }
        return data;
    }, [brokerData, sortMetric, sortOrder, viewOption]);

    // KPI aggregates
    const totalSubmissions = sum(filteredBrokers.map(b => b.broker_submissions_handled || 0));
    const totalPremium = sum(filteredBrokers.map(b => b.broker_total_premium || 0));
    const avgExperience = mean(filteredBrokers.map(b => b.broker_experience_years || 0));
    const avgApproval = mean(filteredBrokers.map(b => b.broker_approval_rate || 0));
    const avgLoss = mean(filteredBrokers.map(b => b.broker_loss_ratio_percent || 0));

    const metricLabel = SORT_OPTIONS.find(o => o.value === sortMetric)?.label || sortMetric;

    // CSV download
    const downloadCSV = () => {
        const cols = ['broker_id', 'broker_name', 'broker_company', 'broker_experience_years',
            'broker_submissions_handled', 'broker_total_premium', 'broker_claim_payouts',
            'broker_approval_rate', 'broker_loss_ratio_percent'];
        const csvContent = [
            cols.join(','),
            ...filteredBrokers.map(b => cols.map(c => b[c] ?? '').join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'Broker_Data.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const selectStyle = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 w-full focus:outline-none focus:ring-2 focus:ring-blue-300';

    // Empty state
    if (!csvData.length) {
        return (
            <div className="max-w-6xl mx-auto space-y-8 pb-8 px-4 pt-8">
                <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Property - Broker Performance</h2>
                <div className="bg-white border border-gray-200 rounded-xl p-16 shadow-sm text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 text-sm">No data available. Please upload a CSV file on the{' '}
                        <Link to="/upload" className="text-blue-600 underline hover:text-blue-800">Data Upload</Link> page first.
                    </p>
                </div>
            </div>
        );
    }

    // No broker columns found
    if (!brokerData.length) {
        return (
            <div className="max-w-6xl mx-auto space-y-8 pb-8 px-4 pt-8">
                <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Property - Broker Performance</h2>
                <div className="bg-white border border-gray-200 rounded-xl p-16 shadow-sm text-center">
                    <p className="text-gray-500 text-sm">No broker ID or broker name column detected in the uploaded CSV.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-8 px-4 pt-8">
            <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Property - Broker Performance</h2>

            {/* Filter controls */}
            <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Sort Metric</label>
                        <select value={sortMetric} onChange={e => setSortMetric(e.target.value)} className={selectStyle}>
                            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Sort Order</label>
                        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className={selectStyle}>
                            <option value="Descending">Descending</option>
                            <option value="Ascending">Ascending</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">View</label>
                        <select value={viewOption} onChange={e => setViewOption(e.target.value)} className={selectStyle}>
                            {['All Brokers', 'Top/Bottom 5', 'Top/Bottom 10', 'Top/Bottom 15'].map(o => (
                                <option key={o} value={o}>{o}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* KPI boxes */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatBox label="Total Submissions" value={fmt(totalSubmissions)} />
                <StatBox label="Total Premium" value={fmt(totalPremium, '$')} />
                <StatBox label="Avg. Experience" value={`${avgExperience.toFixed(1)} yrs`} />
                <StatBox label="Avg. Approval Rate" value={`${avgApproval.toFixed(1)}%`} />
                <StatBox label="Avg. Loss Rate" value={`${avgLoss.toFixed(1)}%`} />
            </section>

            {/* Bar chart + ratio table side by side */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <HBarChart brokers={filteredBrokers} metric={sortMetric} metricLabel={metricLabel} />
                <BrokerBubbleChart brokers={filteredBrokers} />
            </section>

            {/* Details table */}
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
                    <h3 className="text-sm font-semibold text-gray-700">Broker Performance Details</h3>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                            <tr>
                                {['Broker ID', 'Name', 'Experience', 'Total Premium', 'Claim Payouts', 'Approval Rate', 'Loss Ratio'].map(h => (
                                    <th key={h} className="px-4 py-3 font-semibold text-gray-600">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredBrokers.map((b, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2.5 text-gray-800 font-medium">{b.broker_id || '—'}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{b.broker_name || '—'}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{(b.broker_experience_years || 0).toFixed(1)} yrs</td>
                                    <td className="px-4 py-2.5 text-gray-600">${(b.broker_total_premium || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    <td className="px-4 py-2.5 text-gray-600">${(b.broker_claim_payouts || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${(b.broker_approval_rate || 0) >= 70 ? 'bg-green-50 text-green-600' : (b.broker_approval_rate || 0) >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                                            {(b.broker_approval_rate || 0).toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${lossColor(b.broker_loss_ratio_percent || 0)}`}>
                                            {(b.broker_loss_ratio_percent || 0).toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Download */}
            <div className="flex justify-start">
                <button
                    onClick={downloadCSV}
                    className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-6 rounded-lg border border-gray-300 shadow-sm transition-colors text-sm"
                >
                    Download Broker Data (CSV)
                </button>
            </div>
        </div>
    );
};

export default BrokerPerformancePage;
