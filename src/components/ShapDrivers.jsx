import React from 'react';

const ShapDrivers = ({ drivers, mode = "shap" }) => {
  const isRiskScore = mode === "risk_score";
  const maxContribution = isRiskScore ? 100 : Math.max(...drivers.map(d => Math.abs(d.contribution)), 0.001);

  return (
    <div className="bg-white rounded-lg shadow-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
        {isRiskScore ? "Risk Score Breakdown" : "Key Drivers"}
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        {isRiskScore ? "Component scores out of 100" : "Top factors influencing AI risk assessment"}
      </p>

      <div className="space-y-1.5">
        {drivers.map((driver, index) => {
          const val = driver.contribution;
          
          let percentage = 0;
          let colorClass = "";
          let labelExt = "";
          
          if (isRiskScore) {
              percentage = val; // val is already 0-100
              if (val < 30) colorClass = 'bg-gradient-to-r from-green-400 to-green-600';
              else if (val <= 60) colorClass = 'bg-gradient-to-r from-amber-400 to-amber-600';
              else colorClass = 'bg-gradient-to-r from-red-400 to-red-600';
              labelExt = `(${val}/100)`;
          } else {
              const isNegative = val < 0;
              const absoluteValue = Math.abs(val);
              percentage = (absoluteValue / maxContribution) * 100;
              colorClass = isNegative ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-blue-400 to-blue-600';
              labelExt = `(${isNegative ? '' : '+'}${val.toFixed(1)})`;
          }

          return (
            <div key={index} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span
                  className="text-gray-600 block text-left"
                  title={driver.feature.replace(/_/g, ' ')}
                >
                  {driver.feature.replace(/_/g, ' ')} <span className="font-semibold text-[11px] text-gray-500">{labelExt}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative h-3 bg-gray-100 flex-1 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {!isRiskScore && (
                  <span className="text-[10px] text-gray-400 w-6 text-right">
                    {driver.value || ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShapDrivers;
