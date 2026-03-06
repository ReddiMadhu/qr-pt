import React, { createContext, useContext, useState, useEffect } from 'react';

const PropensityContext = createContext();

export const PropensityProvider = ({ children }) => {
    // Persistent state for Propensity Engine
    const [csvRows, setCsvRows] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('broker_csv_data') || '[]');
        } catch {
            return [];
        }
    });

    const [uploaded, setUploaded] = useState(csvRows.length > 0);
    const [fileObj, setFileObj] = useState(null);
    const [properties, setProperties] = useState([]);
    const [smartAssignResults, setSmartAssignResults] = useState(null);

    // Sync csvRows to localStorage when it changes
    useEffect(() => {
        if (csvRows.length > 0) {
            localStorage.setItem('broker_csv_data', JSON.stringify(csvRows));
            setUploaded(true);
        } else {
            // We keep it in localStorage unless explicitly cleared, 
            // but let's just make sure state stays in sync.
        }
    }, [csvRows]);

    const clearPropensityState = () => {
        setCsvRows([]);
        setUploaded(false);
        setFileObj(null);
        setProperties([]);
        setSmartAssignResults(null);
        localStorage.removeItem('broker_csv_data');
    };

    return (
        <PropensityContext.Provider value={{
            csvRows, setCsvRows,
            uploaded, setUploaded,
            fileObj, setFileObj,
            properties, setProperties,
            smartAssignResults, setSmartAssignResults,
            clearPropensityState
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
