import React, { createContext, useContext, useState } from 'react';

const PropensityContext = createContext();

export const PropensityProvider = ({ children }) => {
    // Underwriter submission object from ResponseReceived
    // { id, underwriter_name, prioritized_ids, discarded_ids, created_at }
    const [submission, setSubmission] = useState(null);

    // Upload data states
    const [csvRows, setCsvRows] = useState([]);
    const [uploaded, setUploaded] = useState(false);
    const [fileObj, setFileObj] = useState(null);
    const [fileName, setFileName] = useState('');

    // All 6 property objects (from /api/properties) — used as rows for ML API calls
    const [properties, setProperties] = useState([]);

    // Run 1 API results — ALL 6 preliminary propensity predictions
    // Stored in full because final_score API won't return BPO-excluded properties
    const [run1Properties, setRun1Properties] = useState([]);

    // Run 1 global SHAP values for the SHAP sidebar on PredictionResultsPage
    const [run1ShapGlobal, setRun1ShapGlobal] = useState([]);

    // Run 2 API results — only non-excluded (non-BPO) property predictions
    const [run2Properties, setRun2Properties] = useState([]);

    // submission_ids of properties with is_below_threshold === true
    // These are excluded from Run 2 and shown as "BPO Triage" in the final TriagePage
    const [excludedIds, setExcludedIds] = useState([]);

    // Rows excluded by evaluation rules (from /api/ml/submissions response)
    // Each object has submission_id, imageUrl, Reasons, Decision, and original fields
    const [excludedRows, setExcludedRows] = useState([]);

    // SmartAssign routing results — persisted so modal can be reopened
    const [smartAssignResults, setSmartAssignResults] = useState(null);

    // Low propensity threshold (configurable via env)
    const [lowThreshold] = useState(
        parseFloat(import.meta.env.VITE_LOW_PROPENSITY_THRESHOLD || '0.30')
    );

    const clearPropensityState = () => {
        setSubmission(null);
        setProperties([]);
        setRun1Properties([]);
        setRun1ShapGlobal([]);
        setRun2Properties([]);
        setExcludedIds([]);
        setSmartAssignResults(null);
        setExcludedRows([]);
        setCsvRows([]);
        setUploaded(false);
        setFileObj(null);
        setFileName('');
    };

    return (
        <PropensityContext.Provider value={{
            submission, setSubmission,
            properties, setProperties,
            run1Properties, setRun1Properties,
            run1ShapGlobal, setRun1ShapGlobal,
            run2Properties, setRun2Properties,
            excludedIds, setExcludedIds,
            smartAssignResults, setSmartAssignResults,
            excludedRows, setExcludedRows,
            csvRows, setCsvRows,
            uploaded, setUploaded,
            fileObj, setFileObj,
            fileName, setFileName,
            lowThreshold,
            clearPropensityState,
        }}>
            {children}
        </PropensityContext.Provider>
    );
};

export const usePropensity = () => {
    const context = useContext(PropensityContext);
    if (!context) {
        throw new Error('usePropensity must be used within a PropensityProvider');
    }
    return context;
};
