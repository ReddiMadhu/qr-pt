import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        {/* Main Card */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 overflow-hidden">
          <div className="flex flex-col lg:flex-row">

            {/* LEFT: Content */}
            <div className="flex-1 p-10 lg:p-14 flex flex-col justify-center">
              {/* Logo / Brand */}
              <div className="flex items-center gap-2 mb-8">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-500 tracking-widest uppercase">Underwriting Intelligence</span>
              </div>

              {/* Heading */}
              <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
                AI-Powered<br />
                <span className="text-blue-600">Underwriting</span><br />
                Intelligence
              </h1>

              {/* Solution Overview */}
              <div className="mb-8">
                <p className="text-gray-600 text-lg leading-relaxed mb-4">
                  An end-to-end AI underwriting system that combines computer vision, geospatial risk analysis, and behavioral ML to generate intelligent property risk scores and quote propensity predictions.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                  {[
                    { icon: "🛰", label: "Computer Vision", desc: "Roof & property analysis" },
                    { icon: "📍", label: "Geospatial Risk", desc: "Proximity hazard scoring" },
                    { icon: "🧠", label: "Propensity ML", desc: "Quote likelihood prediction" },
                    { icon: "📧", label: "Email Triage", desc: "Auto-emails to UWT teams" },
                  ].map((item) => (
                    <div key={item.label} className="bg-blue-50 rounded-xl p-2 border border-blue-100 flex flex-col justify-center">
                      <div className="text-lg mb-0.5">{item.icon}</div>
                      <div className="text-[11px] font-semibold text-blue-800 whitespace-nowrap">{item.label}</div>
                      <div className="text-[10px] text-blue-600 whitespace-nowrap">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={() => navigate('/admin')}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg shadow-blue-200 transition-all duration-200 hover:shadow-blue-300 hover:-translate-y-0.5 self-start"
              >
                Start
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>

            {/* RIGHT: QR Code */}
            <div className="lg:w-80 bg-gradient-to-b from-blue-600 to-blue-800 p-10 flex flex-col items-center justify-center text-white">
              <div className="text-center mb-6">
                <div className="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-2">Underwriter Access</div>
                <h2 className="text-2xl font-bold">Scan to Begin</h2>
                <p className="text-blue-200 text-sm mt-1">Open on your device to submit decisions</p>
              </div>

              {/* Feature bullets */}
              <div className="mt-8 space-y-2 w-full">
                {[
                  "Review 6 property submissions",
                  "Select priorities & discards",
                  "AI comparison in real-time",
                ].map((text) => (
                  <div key={text} className="flex items-center gap-2 text-sm text-blue-100">
                    <svg className="w-4 h-4 text-blue-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {text}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-6">
          AI Underwriting Intelligence Platform · Demo Environment
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
