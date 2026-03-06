import React, { createContext, useContext, useState, useEffect } from 'react';

const PropensityContext = createContext();

export const PropensityProvider = ({ children }) => {
    // Ephemeral state for Propensity Engine - Clears on page reload
    const [csvRows, setCsvRows] = useState([]);
    const [uploaded, setUploaded] = useState(false);
    const [fileName, setFileName] = useState(null);
    const [fileObj, setFileObj] = useState(null);
    const [properties, setProperties] = useState([]);
    const [smartAssignResults, setSmartAssignResults] = useState(null);

    const clearPropensityState = () => {
        setCsvRows([]);
        setUploaded(false);
        setFileName(null);
        setFileObj(null);
        setProperties([]);
        setSmartAssignResults(null);
    };

    return (
        <PropensityContext.Provider value={{
            csvRows, setCsvRows,
            uploaded, setUploaded,
            fileObj, setFileObj,
            fileName, setFileName,
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
