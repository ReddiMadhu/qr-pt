import React from 'react';

const ShapDrivers = ({ drivers }) => {
  const maxContribution = Math.max(...drivers.map(d => Math.abs(d.contribution)), 0.001);

  return (
    <div className="bg-white rounded-lg shadow-card p-3">
      <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
        Key Drivers
      </h3>
      <p className="text-xs text-gray-500 mb-2">
        Top factors influencing AI risk assessment
      </p>

      <div className="space-y-1.5">
        {drivers.map((driver, index) => {
          const val = driver.contribution;
          const isNegative = val < 0;
          const absoluteValue = Math.abs(val);
          const percentage = (absoluteValue / maxContribution) * 100;

          return (
            <div key={index} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span
                  className="text-gray-600 block text-left"
                  title={driver.feature.replace(/_/g, ' ')}
                >
                  {driver.feature.replace(/_/g, ' ')} <span className={`font-semibold text-[11px] ${isNegative ? 'text-red-500' : 'text-green-600'}`}>({isNegative ? '' : '+'}{val.toFixed(1)})</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative h-3 bg-gray-100 flex-1 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${isNegative ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 w-6 text-right">
                  {driver.value || ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShapDrivers;
