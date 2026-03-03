import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictTriage } from '../services/api';

const MOCK_DATA = [
    { sub: 'SUB00012', ch: 'Broker', date: '1/24/2025', app: 'APP00034', prop: 'PR00034', pol: 'PO00034', bro: 'BR00898', desc: 'She either entire l...' },
    { sub: 'SUB00137', ch: 'Broker', date: '11/1/2025', app: 'APP00137', prop: 'PR00137', pol: 'PO00137', bro: 'BR01554', desc: 'Building piece close c...' },
    { sub: 'SUB00164', ch: 'Online', date: '5/10/2025', app: 'APP00164', prop: 'PR00164', pol: 'PO00164', bro: '-', desc: 'Possible collection gove...' },
    { sub: 'SUB07726', ch: 'Broker', date: '10/30/2025', app: 'APP07726', prop: 'PR07726', pol: 'PO07726', bro: 'BR01768', desc: 'Knowledge result opti...' },
    { sub: 'SUB09890', ch: 'Broker', date: '11/5/2025', app: 'APP09890', prop: 'PR00890', pol: 'PO09890', bro: 'BR03118', desc: 'Base fish address tend a...' },
    { sub: 'SUB00244', ch: 'Broker', date: '1/5/2025', app: 'APP00244', prop: 'PR00244', pol: 'PO00244', bro: 'BR03044', desc: 'Final nati...' }
];

const DataUploadPage = () => {
    const navigate = useNavigate();
    const [inputType, setInputType] = useState('csv');
    const [uploaded, setUploaded] = useState(false);
    const [fileObj, setFileObj] = useState(null);
    const [isRunning, setIsRunning] = useState(false);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileObj(file);
            setUploaded(true);
        }
    };

    const handleRunPredictions = async () => {
        if (!fileObj) return;
        setIsRunning(true);
        try {
            const rules = JSON.parse(localStorage.getItem('quote_rules') || '[]');
            const weights = JSON.parse(localStorage.getItem('quote_weights') || '{}');

            const formData = new FormData();
            formData.append('file', fileObj);
            formData.append('rules', JSON.stringify(rules));
            formData.append('weights', JSON.stringify(weights));

            const res = await predictTriage(formData);

            navigate('/processing', { state: { submissionId: res?.submissionId || 'latest' } });
        } catch (error) {
            console.error('Prediction API Error:', error);
            // Fallback for demo UX if backend is not fully ready
            navigate('/processing');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-8">

            {/* SECTION 1: Data Upload */}
            <section>
                <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Property - Data Upload</h2>

                <div className="flex items-center justify-center gap-3 mb-6">
                    <span className="text-sm font-medium text-gray-600">Select Input Type</span>
                    <button
                        onClick={() => setInputType('csv')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${inputType === 'csv' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'
                            }`}
                    >
                        CSV File
                    </button>
                    <button
                        onClick={() => setInputType('acord')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${inputType === 'acord' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200'
                            }`}
                    >
                        ACORD Forms
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-2 text-center">Upload Property data for inference</p>

                {/* Drag and Drop Zone */}
                <div className="border border-dashed border-gray-300 rounded-xl bg-white p-8 text-center relative overflow-hidden group shadow-md transition-colors hover:border-blue-400">
                    <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                    {/* Hidden actual file input */}
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

                            {uploaded && fileObj && (
                                <div className="flex items-center gap-2 text-green-600 text-sm mt-4 font-medium">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Successfully uploaded '{fileObj.name}'
                                </div>
                            )}
                        </div>

                        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg shadow-md transition-all text-sm whitespace-nowrap pointer-events-auto">
                            Browse Files
                        </button>
                    </div>
                </div>
            </section>

            {uploaded && (
                <>
                    {/* SECTION 2: Data Preview */}
                    <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-md">
                        <h2 className="text-lg font-bold text-gray-800 text-center mb-6">Data Preview</h2>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                            <StatBox label="Total Records" value="6" />
                            <StatBox label="Total Columns" value="78" />
                            <StatBox label="Numerical Columns" value="36" />
                            <StatBox label="Categorical Columns" value="42" />
                            <StatBox label="Duplicate Rows" value="0" />
                        </div>

                        {/* Table View */}
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

                    {/* SECTION 3: Property - Excluded Submissions */}
                    <section id="excluded">
                        <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Property - Excluded Submissions</h2>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                            <StatBox label="Total Excluded Submissions" value={<span className="text-blue-600">6</span>} />
                            <StatBox label="Building Only" value={<span className="text-blue-600">3</span>} />
                            <StatBox label="Content Only" value={<span className="text-blue-600">2</span>} />
                            <StatBox label="Both Coverage" value={<span className="text-blue-600">1</span>} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
                            {/* Excluded Summary Table */}
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
                                            <tr className="bg-white hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-gray-700">More than one reason</td>
                                                <td className="px-4 py-3 text-center font-medium text-gray-700">6</td>
                                            </tr>
                                            <tr className="bg-blue-50/30 border-t border-gray-200 font-bold">
                                                <td className="px-4 py-3 text-gray-800">Total</td>
                                                <td className="px-4 py-3 text-center text-gray-800">6</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-8">
                                    <div className="flex items-center gap-2 cursor-pointer text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium">
                                        <span>Show detailed excluded submissions:</span>
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5 7l5 5 5-5H5z" /></svg>
                                    </div>

                                    <button className="mt-4 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-6 rounded-lg border border-gray-300 shadow-sm transition-colors text-sm">
                                        Download Excluded Submissions CSV
                                    </button>
                                </div>
                            </div>

                            {/* Pie Chart */}
                            <div className="flex flex-col items-center bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
                                <h3 className="text-center font-bold text-gray-800 mb-4">Channel-wise Distribution</h3>

                                <div className="relative w-48 h-48 my-4">
                                    {/* Simple CSS-based pie chart matching screenshot #4 */}
                                    <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90 rounded-full drop-shadow-md">
                                        <circle r="16" cx="16" cy="16" fill="#1e3a8a" /> {/* Dark blue bg */}
                                        <circle
                                            r="16" cx="16" cy="16"
                                            fill="transparent"
                                            stroke="#3b82f6" /* Light blue stroke for 83% */
                                            strokeWidth="32"
                                            strokeDasharray="83 100"
                                        />
                                    </svg>
                                    {/* Labels on pie chart */}
                                    <div className="absolute top-8 -left-4 text-blue-600 font-bold text-xs">83%</div>
                                    <div className="absolute bottom-8 -right-4 text-blue-800 font-bold text-xs">17%</div>
                                </div>

                                <div className="flex items-center gap-4 mt-6">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                                        <span className="w-3 h-3 bg-blue-500 rounded-sm shadow-sm"></span>
                                        Broker
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                                        <span className="w-3 h-3 bg-[#1e3a8a] rounded-sm shadow-sm"></span>
                                        Online
                                    </div>
                                </div>
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
