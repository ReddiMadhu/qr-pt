import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePropensity } from '../context/PropensityContext';

// ─── Exclusion rule ID → applyEvaluation boolean key mapping ──────────────────
const RULE_KEY_MAP = {
    rule1: 'contents_coverage_minimum',
    rule2: 'building_coverage_minimum',
    rule3: 'invalid_zip_state',
    rule4: 'applicant_age',
    rule5: 'high_loss_frequency',
    rule6: 'low_income',
    rule7: 'non_competitive_insurer',
    rule8: 'low_broker_approval',
    rule9: 'broker_fraud_history',
};

const VALID_STATE_CODES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

// ─── Evaluation logic (adapted from ExcludedDashboard reference code) ─────────
const applyEvaluation = (df, exclusionRules) => {
    if (!Array.isArray(df)) return [];

    const getNum = (val) => parseFloat(val) || 0;
    const getBool = (val) => Boolean(val) && val !== '0' && val !== 0 && val !== 'false';

    const evaluateRow = (row) => {
        const reasons = [];

        if (exclusionRules.contents_coverage_minimum && row.cover_type?.toLowerCase() === 'contents only') {
            if (getNum(row.contents_coverage_limit) < 50000)
                reasons.push('Contents coverage below product minimum');
        }
        if (exclusionRules.building_coverage_minimum && row.cover_type?.toLowerCase() === 'building only') {
            if (getNum(row.building_coverage_limit) < 50000)
                reasons.push('Building coverage below product minimum');
        }
        if (exclusionRules.invalid_zip_state &&
            (!String(row.postal_code).match(/^\d{4,5}$/) || !VALID_STATE_CODES.includes(row.state_code))) {
            reasons.push('Invalid U.S. ZIP or State code');
        }
        if (exclusionRules.applicant_age && getNum(row.age) < 21)
            reasons.push('Applicant under 21 - outside risk criteria');
        if (exclusionRules.high_loss_frequency && getNum(row.property_past_loss_freq) >= 3)
            reasons.push('Past loss frequency is high');
        if (exclusionRules.low_income && getNum(row.annual_income) < 30000)
            reasons.push("Client's income is below the acceptable risk threshold");
        if (exclusionRules.non_competitive_insurer && ['NFU', 'Britt'].includes(row.Property_previous_insurer))
            reasons.push('Holding insurer not competitive');
        if (exclusionRules.low_broker_approval && getNum(row.broker_approval_rate) < 0.1)
            reasons.push('Broker has a low approval rate');
        if (exclusionRules.broker_fraud_history && getBool(row.broker_fraud_history))
            reasons.push('Broker has a history of fraud');

        return reasons.length > 0
            ? { Decision: 'UW Review', Reasons: reasons.join(', ') }
            : { Decision: 'Accepted', Reasons: 'Accepted for Prediction' };
    };

    return df.map(row => ({ ...row, ...evaluateRow(row) }));
};

// ─── Pie chart colours per channel ────────────────────────────────────────────
const CHANNEL_COLORS = ['#3b82f6', '#1e3a8a', '#06b6d4', '#6366f1', '#f59e0b'];

const MOCK_DATA = [
    { sub: 'SUB00012', ch: 'Broker', date: '1/24/2025', app: 'APP00034', prop: 'PR00034', pol: 'PO00034', bro: 'BR00898', desc: 'She either entire l...' },
    { sub: 'SUB00137', ch: 'Broker', date: '11/1/2025', app: 'APP00137', prop: 'PR00137', pol: 'PO00137', bro: 'BR01554', desc: 'Building piece close c...' },
    { sub: 'SUB00164', ch: 'Online', date: '5/10/2025', app: 'APP00164', prop: 'PR00164', pol: 'PO00164', bro: '-', desc: 'Possible collection gove...' },
    { sub: 'SUB07726', ch: 'Broker', date: '10/30/2025', app: 'APP07726', prop: 'PR07726', pol: 'PO07726', bro: 'BR01768', desc: 'Knowledge result opti...' },
    { sub: 'SUB09890', ch: 'Broker', date: '11/5/2025', app: 'APP09890', prop: 'PR00890', pol: 'PO09890', bro: 'BR03118', desc: 'Base fish address tend a...' },
    { sub: 'SUB00244', ch: 'Broker', date: '1/5/2025', app: 'APP00244', prop: 'PR00244', pol: 'PO00244', bro: 'BR03044', desc: 'Final nati...' },
];

const DataUploadPage = () => {
    const navigate = useNavigate();
    const {
        csvRows, setCsvRows,
        uploaded, setUploaded,
        fileObj, setFileObj,
        fileName, setFileName
    } = usePropensity();

    const [inputType, setInputType] = useState('csv');
    const [isRunning, setIsRunning] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState('All');

    // State for file handling and processing
    const [acordFiles, setAcordFiles] = useState([]);
    const [processingAcord, setProcessingAcord] = useState(false);
    const [progress, setProgress] = useState(0);

    // Ref to trigger hidden file input
    const fileInputRef = useRef(null);

    // --- Logic Functions ---

    const processAcordForms = async () => {
        if (acordFiles.length === 0) return;

        setProcessingAcord(true);
        setProgress(0);
        const allResults = [];

        try {
            for (let i = 0; i < acordFiles.length; i++) {
                const file = acordFiles[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('json_dir', './jsons');

                const response = await fetch('http://localhost:5000/process_acord', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API call failed: ${response.status} - ${errorText}`);
                }

                const results = await response.json();
                allResults.push(...results);
                setProgress((i + 1) / acordFiles.length);
            }

            if (allResults.length > 0) {
                setCsvRows(allResults);
                setUploaded(true);
                setFileName(`${acordFiles.length} ACORD Form(s)`);
                setShowDetails(false);
                setSelectedChannel('All');
            } else {
                alert('No data extracted from the uploaded files.');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            setProcessingAcord(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileObj(file);
            setFileName(file.name);
            setUploaded(true);
            setShowDetails(false);
            setSelectedChannel('All');
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target.result;
                const lines = text.split('\n').filter(Boolean);
                if (lines.length < 2) return;
                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const rows = lines.slice(1).map(line => {
                    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
                });
                setCsvRows(rows);
            };
            reader.readAsText(file);
        }
    };

    const handleRunPredictions = async () => {
        if (!csvRows.length) return;
        setIsRunning(true);
        try {
            navigate('/processing');
        } finally {
            setIsRunning(false);
        }
    };

    // ── Apply evaluation rules to CSV rows ──────────────────────────────────
    const processedData = useMemo(() => {
        if (!csvRows.length) return [];
        const activeRuleIds = (() => {
            try { return JSON.parse(localStorage.getItem('quote_rules') || '[]'); } catch { return []; }
        })();
        const ruleIds = activeRuleIds.length ? activeRuleIds : Object.keys(RULE_KEY_MAP);
        const exclusionRules = Object.fromEntries(
            Object.entries(RULE_KEY_MAP).map(([id, key]) => [key, ruleIds.includes(id)])
        );
        return applyEvaluation(csvRows, exclusionRules);
    }, [csvRows]);

    // ── Derive excluded-row metrics ──────────────────────────────────────────
    const declinedRows = useMemo(
        () => processedData.filter(r => r.Decision === 'UW Review'),
        [processedData]
    );

    const totalExcluded = declinedRows.length;
    const buildingOnly = declinedRows.filter(r => r.cover_type?.toLowerCase().includes('building')).length;
    const contentsOnly = declinedRows.filter(r => r.cover_type?.toLowerCase().includes('contents')).length;
    const bothCoverage = declinedRows.filter(r => r.cover_type?.toLowerCase().includes('both')).length;

    const reasonCounts = useMemo(() => declinedRows.reduce((acc, row) => {
        const key = row.Reasons?.includes(',') ? 'More than one reason' : (row.Reasons?.trim() || 'Unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {}), [declinedRows]);

    const channelEntries = useMemo(() => {
        const counts = declinedRows.reduce((acc, row) => {
            const ch = row.submission_channel || 'Unknown';
            acc[ch] = (acc[ch] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts);
    }, [declinedRows]);

    const uniqueChannels = useMemo(
        () => [...new Set(declinedRows.map(r => r.submission_channel).filter(Boolean))],
        [declinedRows]
    );

    // ── Download excluded CSV ────────────────────────────────────────────────
    const downloadExcludedCSV = () => {
        const cols = ['submission_id', 'submission_channel', 'cover_type', 'Decision', 'Reasons'];
        const csv = [
            cols.join(','),
            ...declinedRows.map(r => cols.map(c => `"${(r[c] ?? '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'Excluded_Submissions.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    // ── Dynamic SVG pie chart segments ───────────────────────────────────────
    const pieSegments = useMemo(() => {
        const total = declinedRows.length || 1;
        let offset = 25; // start at top (SVG circle starts at 3 o'clock, -90° = offset of 25 out of 100)
        return channelEntries.map(([ch, count], i) => {
            const pct = (count / total) * 100;
            const seg = { ch, count, pct: Math.round(pct), color: CHANNEL_COLORS[i % CHANNEL_COLORS.length], offset };
            offset += pct;
            return seg;
        });
    }, [channelEntries, declinedRows.length]);

    const filteredDeclined = selectedChannel === 'All'
        ? declinedRows
        : declinedRows.filter(r => r.submission_channel === selectedChannel);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-8">

            {/* SECTION 1: Data Upload */}
            <section>
                <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Property - Data Upload</h2>

                <div className="flex items-center justify-center gap-3 mb-6">
                    <span className="text-sm font-medium text-gray-600">Select Input Type</span>
                    <button
                        onClick={() => setInputType('csv')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${inputType === 'csv' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'}`}
                    >
                        CSV File
                    </button>
                    <button
                        onClick={() => setInputType('acord')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${inputType === 'acord' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'}`}
                    >
                        ACORD Forms
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-2 text-center">Upload Property data for inference</p>

                {inputType === 'csv' ? (
                    <div className="border border-dashed border-gray-300 rounded-xl bg-white p-8 text-center relative overflow-hidden group shadow-md transition-colors hover:border-blue-400">
                        <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            onChange={handleFileUpload}
                            accept=".csv,.xlsx,.xls,.pdf"
                        />
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 w-full max-w-4xl mx-auto pointer-events-none">
                            <div className="text-left">
                                <h3 className="text-lg font-bold text-gray-800">Drag and drop file here</h3>
                                <p className="text-sm text-gray-500 mt-1">Limit: 200MB per file • CSV, Excel, PDF</p>
                                {uploaded && fileName && (
                                    <div className="flex items-center gap-2 text-green-600 text-sm mt-4 font-medium">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Successfully uploaded '{fileName}'
                                    </div>
                                )}
                            </div>
                            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg shadow-md transition-all text-sm whitespace-nowrap pointer-events-auto">
                                Browse Files
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="border border-dashed border-gray-300 rounded-xl bg-white p-8 text-center relative overflow-hidden group shadow-md transition-colors hover:border-blue-400">
                            <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                onChange={(e) => setAcordFiles(Array.from(e.target.files))}
                                accept=".pdf"
                                multiple
                            />
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 w-full max-w-4xl mx-auto pointer-events-none">
                                <div className="text-left">
                                    <h3 className="text-lg font-bold text-gray-800">Drag and drop ACORD PDFs here</h3>
                                    <p className="text-sm text-gray-500 mt-1">Supports multiple .pdf files for extraction</p>
                                    {acordFiles.length > 0 && !uploaded && (
                                        <div className="flex items-center gap-2 text-blue-600 text-sm mt-4 font-medium">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            {acordFiles.length} file(s) selected ready for extraction
                                        </div>
                                    )}
                                </div>
                                <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg shadow-md transition-all text-sm whitespace-nowrap pointer-events-auto">
                                    Select PDFs
                                </button>
                            </div>
                        </div>

                        {acordFiles.length > 0 && !uploaded && (
                            <div className="flex flex-col items-center gap-3 mt-6 relative z-30">
                                <button
                                    onClick={processAcordForms}
                                    disabled={processingAcord}
                                    className={`px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-md ${processingAcord ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:-translate-y-0.5'}`}
                                >
                                    {processingAcord ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Extracting Form Data...
                                        </span>
                                    ) : (
                                        'Extract Data from ACORD Forms'
                                    )}
                                </button>

                                {processingAcord && (
                                    <div className="w-full max-w-md mt-2">
                                        <div className="bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
                                            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }}></div>
                                        </div>
                                        <p className="text-xs text-center text-gray-500 mt-2">{Math.round(progress * 100)}% complete</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {uploaded && fileName && inputType === 'acord' && (
                            <div className="flex justify-center mt-4 relative z-30">
                                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg text-sm font-medium border border-green-200">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Successfully processed and evaluated {fileName}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {uploaded && (
                <>
                    {/* SECTION 2: Data Preview */}
                    <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-md">
                        <h2 className="text-lg font-bold text-gray-800 text-center mb-6">Data Preview</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                            <StatBox label="Total Records" value="6" />
                            <StatBox label="Total Columns" value="78" />
                            <StatBox label="Numerical Columns" value="36" />
                            <StatBox label="Categorical Columns" value="42" />
                            <StatBox label="Duplicate Rows" value="0" />
                        </div>
                        <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3">submission_id</th>
                                        <th className="px-4 py-3">submission_channel</th>
                                        <th className="px-4 py-3">submission_date</th>
                                        <th className="px-4 py-3">applicant_id</th>
                                        <th className="px-4 py-3">property_id</th>
                                        <th className="px-4 py-3">policy_id</th>
                                        <th className="px-4 py-3">broker_id</th>
                                        <th className="px-4 py-3">description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {MOCK_DATA.map((row, i) => (
                                        <tr key={i} className="bg-white hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-2.5 text-gray-800 font-medium">{row.sub}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{row.ch}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{row.date}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{row.app}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{row.prop}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{row.pol}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{row.bro}</td>
                                            <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{row.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <hr className="border-gray-200" />

                    {/* SECTION 3: Property - Excluded Submissions (dynamic) */}
                    <section id="excluded">
                        <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Property - Excluded Submissions</h2>

                        {/* KPI boxes */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                            <StatBox label="Total Excluded Submissions" value={<span className="text-blue-600">{totalExcluded}</span>} />
                            <StatBox label="Building Only" value={<span className="text-blue-600">{buildingOnly}</span>} />
                            <StatBox label="Content Only" value={<span className="text-blue-600">{contentsOnly}</span>} />
                            <StatBox label="Both Coverage" value={<span className="text-blue-600">{bothCoverage}</span>} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
                            {/* Reason summary table + controls */}
                            <div className="md:col-span-2">
                                <h3 className="text-center font-bold text-gray-800 mb-4">Excluded Submissions Summary</h3>
                                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold">Reason Type</th>
                                                <th className="px-4 py-3 font-semibold text-center w-32">Count</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {totalExcluded === 0 ? (
                                                <tr>
                                                    <td colSpan={2} className="px-4 py-6 text-center text-gray-400 text-sm">
                                                        No rows excluded — all submissions pass the active rules.
                                                    </td>
                                                </tr>
                                            ) : (
                                                <>
                                                    {Object.entries(reasonCounts).map(([reason, count], idx) => (
                                                        <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
                                                            <td className="px-4 py-3 text-gray-700">{reason}</td>
                                                            <td className="px-4 py-3 text-center font-medium text-gray-700">{count}</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-blue-50/30 border-t border-gray-200 font-bold">
                                                        <td className="px-4 py-3 text-gray-800">Total</td>
                                                        <td className="px-4 py-3 text-center text-gray-800">{totalExcluded}</td>
                                                    </tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-6 space-y-3">
                                    {/* Toggle detail table */}
                                    <button
                                        onClick={() => setShowDetails(v => !v)}
                                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium"
                                    >
                                        <span>{showDetails ? 'Hide' : 'Show'} detailed excluded submissions</span>
                                        <svg
                                            className={`w-4 h-4 fill-current transition-transform ${showDetails ? 'rotate-180' : ''}`}
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M5 7l5 5 5-5H5z" />
                                        </svg>
                                    </button>

                                    <button
                                        onClick={downloadExcludedCSV}
                                        disabled={totalExcluded === 0}
                                        className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-6 rounded-lg border border-gray-300 shadow-sm transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Download Excluded Submissions CSV
                                    </button>
                                </div>

                                {/* Expandable detail table */}
                                {showDetails && totalExcluded > 0 && (
                                    <div className="mt-5">
                                        {uniqueChannels.length > 0 && (
                                            <div className="flex items-center gap-3 mb-3">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter by Channel</label>
                                                <select
                                                    value={selectedChannel}
                                                    onChange={e => setSelectedChannel(e.target.value)}
                                                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                >
                                                    <option value="All">All Channels</option>
                                                    {uniqueChannels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm overflow-x-auto max-h-72 overflow-y-auto">
                                            <table className="w-full text-sm text-left whitespace-nowrap">
                                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-3">Submission ID</th>
                                                        <th className="px-4 py-3">Channel</th>
                                                        <th className="px-4 py-3">Cover Type</th>
                                                        <th className="px-4 py-3">Reason(s)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filteredDeclined.map((row, idx) => (
                                                        <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
                                                            <td className="px-4 py-2.5 text-gray-800 font-medium">{row.submission_id || '—'}</td>
                                                            <td className="px-4 py-2.5 text-gray-600">{row.submission_channel || '—'}</td>
                                                            <td className="px-4 py-2.5 text-gray-600">{row.cover_type || '—'}</td>
                                                            <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs">{row.Reasons}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dynamic CSS pie chart */}
                            <div className="flex flex-col items-center bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
                                <h3 className="text-center font-bold text-gray-800 mb-4">Channel-wise Distribution</h3>

                                {totalExcluded === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm text-center py-8">
                                        No excluded submissions to display
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative w-44 h-44 my-4">
                                            <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90 rounded-full drop-shadow-md">
                                                <circle r="16" cx="16" cy="16" fill="#e5e7eb" />
                                                {pieSegments.map((seg, i) => (
                                                    <circle
                                                        key={i}
                                                        r="16" cx="16" cy="16"
                                                        fill="transparent"
                                                        stroke={seg.color}
                                                        strokeWidth="32"
                                                        strokeDasharray={`${seg.pct} 100`}
                                                        strokeDashoffset={-seg.offset + 25}
                                                    />
                                                ))}
                                            </svg>
                                            {/* Center label */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-xs font-bold text-gray-700">{totalExcluded}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                                            {pieSegments.map((seg, i) => (
                                                <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                                                    <span className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0" style={{ backgroundColor: seg.color }}></span>
                                                    {seg.ch} ({seg.pct}%)
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </section>
                </>
            )}

            {/* FINAL ACTION: Run Predictions */}
            <div className="border-t border-gray-200 pt-8 mt-8 flex justify-center">
                <button
                    onClick={handleRunPredictions}
                    disabled={!uploaded || isRunning}
                    className={`flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-sm ${uploaded && !isRunning
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md hover:-translate-y-1'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        }`}
                >
                    {isRunning ? (
                        <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    {isRunning ? 'Processing...' : 'Run Predictions'}
                </button>
            </div>

        </div>
    );
};

// Reusable Stat Box
const StatBox = ({ label, value }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm pt-4 pb-4 transition-all hover:border-blue-200 hover:shadow-md">
        <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">{label}</div>
        <div className="text-xl font-bold text-gray-800">{value}</div>
    </div>
);

export default DataUploadPage;
