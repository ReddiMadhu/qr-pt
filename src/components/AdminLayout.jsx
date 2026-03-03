import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const AdminLayout = ({ children }) => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const hasPropensityParam = !!searchParams.get('propensity');

    const adminLinks = [
        { name: 'Admin Panel', path: '/' },
        { name: 'Data Upload', path: '/upload' },
    ];

    return (
        <div className="min-h-screen flex bg-gray-50 text-gray-900 font-sans">
            {/* Sidebar */}
            {!hasPropensityParam && (
                <div className="w-56 bg-white border-r border-gray-200 flex flex-col pt-8 pb-4 px-4 shadow-sm z-10 transition-all">
                    <div className="mb-2">
                        <h2 className="text-gray-400 font-semibold text-xs tracking-wider uppercase mb-4 pl-2">Menu</h2>
                    </div>
                    <div>
                        <ul className="space-y-1">
                            {adminLinks.map((link) => {
                                // If we are on /upload, /processing, /triage, or /property, keep 'Data Upload' active.
                                // If we are on exactly '/', keep 'Admin Panel' active.
                                let isActive = false;
                                const pathname = location.pathname;

                                if (link.path === '/') {
                                    isActive = pathname === '/';
                                } else if (link.path === '/upload') {
                                    isActive = pathname.startsWith('/upload') ||
                                        pathname.startsWith('/processing') ||
                                        pathname.startsWith('/triage') ||
                                        pathname.startsWith('/property');
                                }

                                return (
                                    <li key={link.name}>
                                        <NavLink
                                            to={link.path}
                                            className={`flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${isActive
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                                }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full mr-3 ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}></span>
                                            {link.name}
                                        </NavLink>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col max-h-screen overflow-y-auto bg-gray-100">
                {/* Page Content */}
                <div className="flex-1 w-full bg-gray-50 h-[100vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AdminLayout;
