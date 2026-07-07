import React, { useState, useMemo, useRef, useEffect } from 'react';
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

const parseCSV = (text) => {
    const rows = [];
    let curVal = '';
    let inQuotes = false;
    let row = [];
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    curVal += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                curVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(curVal.trim());
                curVal = '';
            } else if (char === '\r') {
                // Ignore carriage return
            } else if (char === '\n') {
                row.push(curVal.trim());
                if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
                    rows.push(row);
                }
                row = [];
                curVal = '';
            } else {
                curVal += char;
            }
        }
    }
    row.push(curVal.trim());
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
        rows.push(row);
    }
    return rows;
};

const DataUploadPage = () => {
    const navigate = useNavigate();
    const {
        csvRows, setCsvRows,
        uploaded, setUploaded,
        fileObj, setFileObj,
        fileName, setFileName
    } = usePropensity();

    const [inputType, setInputType] = useState('upload');
    const [isRunning, setIsRunning] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState('All');
    const [isDragOver, setIsDragOver] = useState(false);
    const [schema, setSchema] = useState(null);
    const [validationError, setValidationError] = useState(null);

    // Fetch expected schema on mount
    useEffect(() => {
        fetch('/sample/schema.json')
            .then(res => {
                if (!res.ok) throw new Error('Schema not found');
                return res.json();
            })
            .then(data => setSchema(data))
            .catch(err => console.error('Failed to load schema:', err));
    }, []);

    // State for file handling and processing
    const [acordFiles, setAcordFiles] = useState([]);
    const [processingAcord, setProcessingAcord] = useState(false);
    const [progress, setProgress] = useState(0);

    // Ref to trigger hidden file input
    const fileInputRef = useRef(null);

    // ── Derive column headers from csvRows ──────────────────────────────────
    const csvHeaders = useMemo(() => {
        if (!csvRows.length) return [];
        return Object.keys(csvRows[0]);
    }, [csvRows]);

    // ── Dynamic stat computation ────────────────────────────────────────────
    const dataStats = useMemo(() => {
        if (!csvRows.length) return null;
        const totalRecords = csvRows.length;
        const totalColumns = csvHeaders.length;
        let numerical = 0;
        let categorical = 0;
        csvHeaders.forEach(h => {
            const vals = csvRows.map(r => r[h]).filter(v => v !== '' && v !== undefined && v !== null);
            const numCount = vals.filter(v => !isNaN(Number(v))).length;
            if (vals.length > 0 && numCount / vals.length > 0.5) numerical++;
            else categorical++;
        });
        const seen = new Set();
        let duplicates = 0;
        csvRows.forEach(row => {
            const key = JSON.stringify(row);
            if (seen.has(key)) duplicates++;
            else seen.add(key);
        });
        return { totalRecords, totalColumns, numerical, categorical, duplicates };
    }, [csvRows, csvHeaders]);

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

    // Validation function
    const validateCSV = (parsedData, schemaObj) => {
        if (!schemaObj) return { isValid: true };
        if (parsedData.length < 1) {
            return { isValid: false, error: 'The CSV file is empty.' };
        }
        
        const headers = parsedData[0];
        
        // 1. Column Count Validation
        if (headers.length !== schemaObj.expectedColumnCount) {
            return {
                isValid: false,
                error: `Column count mismatch. Expected exactly ${schemaObj.expectedColumnCount} columns, but found ${headers.length}.`
            };
        }
        
        // 2. Column Name Validation (case insensitive)
        const expectedColumns = schemaObj.columns;
        const mismatches = [];
        expectedColumns.forEach((col, idx) => {
            const uploadedColName = headers[idx];
            if (!uploadedColName) {
                mismatches.push(`Column ${idx + 1} is missing (expected "${col.name}")`);
            } else if (uploadedColName.toLowerCase() !== col.name.toLowerCase()) {
                mismatches.push(`Column ${idx + 1} is named "${uploadedColName}" (expected "${col.name}")`);
            }
        });
        
        if (mismatches.length > 0) {
            return {
                isValid: false,
                error: `Header columns do not match expected format:\n` + mismatches.join('\n')
            };
        }
        
        // 3. Datatype Validation per Row
        const dataRows = parsedData.slice(1);
        for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
            const row = dataRows[rIdx];
            for (let cIdx = 0; cIdx < expectedColumns.length; cIdx++) {
                const colSpec = expectedColumns[cIdx];
                const rawVal = (row[cIdx] ?? '').trim();
                
                if (rawVal !== '') {
                    if (colSpec.type === 'integer') {
                        const num = Number(rawVal);
                        if (isNaN(num) || !Number.isInteger(num)) {
                            return {
                                isValid: false,
                                error: `Datatype mismatch at row ${rIdx + 1}, column "${colSpec.name}": Expected integer, but found "${rawVal}".`
                            };
                        }
                    } else if (colSpec.type === 'number') {
                        const num = Number(rawVal);
                        if (isNaN(num)) {
                            return {
                                isValid: false,
                                error: `Datatype mismatch at row ${rIdx + 1}, column "${colSpec.name}": Expected decimal number, but found "${rawVal}".`
                            };
                        }
                    }
                }
            }
        }
        
        return { isValid: true };
    };

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setValidationError(null);
            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target.result;
                const parsedData = parseCSV(text);
                if (parsedData.length < 2) {
                    setValidationError('The uploaded file must contain a header and at least one row of data.');
                    setCsvRows([]);
                    setUploaded(false);
                    setFileName('');
                    setFileObj(null);
                    return;
                }
                
                // Perform validation
                const check = validateCSV(parsedData, schema);
                if (!check.isValid) {
                    setValidationError(check.error);
                    setCsvRows([]);
                    setUploaded(false);
                    setFileName('');
                    setFileObj(null);
                    return;
                }
                
                setFileObj(file);
                setFileName(file.name);
                setUploaded(true);
                setShowDetails(false);
                setSelectedChannel('All');
                
                const headers = parsedData[0];
                const rows = parsedData.slice(1).map(rowVals => {
                    return Object.fromEntries(headers.map((h, i) => [h, rowVals[i] ?? '']));
                });
                setCsvRows(rows);
            };
            reader.readAsText(file);
        }
    };

    const [loadingSample, setLoadingSample] = useState(false);

    const handleUseSampleFile = async () => {
        setLoadingSample(true);
        setValidationError(null);
        try {
            const response = await fetch('/sample/Property_data_sample.csv');
            const text = await response.text();
            const parsedData = parseCSV(text);
            if (parsedData.length < 2) return;
            const headers = parsedData[0];
            const rows = parsedData.slice(1).map(rowVals =>
                Object.fromEntries(headers.map((h, i) => [h, rowVals[i] ?? '']))
            );
            setCsvRows(rows);
            setUploaded(true);
            setFileName('Property_data_sample.csv (Sample)');
            setShowDetails(false);
            setSelectedChannel('All');
        } catch (err) {
            console.error('Failed to load sample file:', err);
            alert('Could not load the sample file. Please try uploading manually.');
        } finally {
            setLoadingSample(false);
        }
    };

    const handleRunPredictions = async () => {
        if (!csvRows.length) return;
        setIsRunning(true);
        try {
            navigate('/prediction-loading');
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

                {/* ── Toggle: Use Sample File / Upload ──────────────────── */}
                <div className="flex items-center justify-center gap-1 mb-6 bg-gray-100 rounded-xl p-1 max-w-sm mx-auto">
                    <button
                        onClick={() => {
                            setInputType('upload');
                            setCsvRows([]);
                            setUploaded(false);
                            setFileName('');
                            setFileObj(null);
                            setValidationError(null);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            inputType === 'upload'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Upload
                    </button>
                    <button
                        onClick={() => {
                            setInputType('sample');
                            handleUseSampleFile();
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            inputType === 'sample'
                                ? 'bg-white text-blue-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Use Sample File
                    </button>
                </div>



                {/* ── Sample File feedback ─────────────────────────────── */}
                {inputType === 'sample' && (
                    <div className="text-center">
                        {loadingSample ? (
                            <div className="flex items-center justify-center gap-2 text-blue-600 text-sm font-medium py-4">
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Loading sample data…
                            </div>
                        ) : uploaded && fileName ? (
                            <div className="inline-flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 px-5 py-2.5 rounded-lg border border-green-200">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Sample file loaded — {fileName}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 py-2">Click "Use Sample File" to load demo property data</p>
                        )}
                    </div>
                )}

                {/* ── Upload / Drop zone ──────────────────────────────── */}
                {inputType === 'upload' && (
                    <div className="space-y-4">
                        <div
                            className={`border-2 border-dashed rounded-2xl bg-white p-10 text-center relative overflow-hidden group shadow-md transition-all ${
                                isDragOver ? 'border-blue-500 bg-blue-50/60 scale-[1.01]' : 'border-gray-300 hover:border-blue-400'
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragOver(false);
                                const file = e.dataTransfer.files?.[0];
                                if (file) handleFileUpload({ target: { files: [file] } });
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 to-indigo-50/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                            <div className="flex flex-col items-center gap-4 relative z-10">
                                {/* Upload cloud icon */}
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                                    isDragOver ? 'bg-blue-200 scale-110' : 'bg-blue-100'
                                }`}>
                                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">
                                        {isDragOver ? 'Drop your file here' : 'Drag & drop files here'}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">Limit: 200MB per file • CSV, Excel, PDF</p>
                                </div>

                                {/* Action buttons row */}
                                <div className="flex items-center gap-3 mt-2">
                                    <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg shadow-md transition-all text-sm cursor-pointer hover:-translate-y-0.5 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        Upload Files
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                            accept=".csv,.xlsx,.xls,.pdf"
                                        />
                                    </label>

                                    <a
                                        href="/sample/Property_data_sample.csv"
                                        download="Property_data_template.csv"
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-blue-300 transition-all shadow-sm hover:-translate-y-0.5"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Download Template
                                    </a>
                                </div>

                                {/* Upload success indicator */}
                                {uploaded && fileName && (
                                    <div className="flex items-center gap-2 text-green-600 text-sm mt-2 font-medium bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Successfully uploaded '{fileName}'
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Validation error display */}
                        {validationError && (
                            <div className="w-full max-w-4xl mx-auto mt-4 text-left bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 flex items-start gap-3">
                                <svg className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <h4 className="font-bold text-sm text-rose-900">Upload Validation Failed</h4>
                                    <p className="text-xs mt-1 whitespace-pre-wrap leading-relaxed">{validationError}</p>
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
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-800">Data Preview</h2>
                            <span className="text-xs text-gray-400 font-medium bg-gray-100 px-3 py-1 rounded-full">
                                {fileName}
                            </span>
                        </div>
                        {dataStats && (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                                <StatBox label="Total Records" value={dataStats.totalRecords} />
                                <StatBox label="Total Columns" value={dataStats.totalColumns} />
                                <StatBox label="Numerical Columns" value={dataStats.numerical} />
                                <StatBox label="Categorical Columns" value={dataStats.categorical} />
                                <StatBox label="Duplicate Rows" value={dataStats.duplicates} />
                            </div>
                        )}
                        <div className="border border-gray-200 rounded-lg overflow-x-auto overflow-y-auto shadow-sm" style={{ maxHeight: '420px' }}>
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 bg-gray-50 text-gray-400 font-medium text-center border-r border-gray-200 w-12">#</th>
                                        {csvHeaders.map((header) => (
                                            <th key={header} className="px-4 py-3 bg-gray-50">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {csvRows.map((row, i) => (
                                        <tr key={i} className="bg-white hover:bg-blue-50/40 transition-colors">
                                            <td className="px-4 py-2.5 text-gray-400 text-center border-r border-gray-100 text-xs font-mono">{i + 1}</td>
                                            {csvHeaders.map((header, j) => (
                                                <td key={j} className={`px-4 py-2.5 max-w-[220px] truncate ${
                                                    j === 0 ? 'text-gray-800 font-medium' : 'text-gray-600'
                                                }`}>
                                                    {row[header] ?? ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-right">
                            Showing {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} × {csvHeaders.length} column{csvHeaders.length !== 1 ? 's' : ''}
                        </p>
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
