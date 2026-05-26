/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LogIn, LogOut, Phone, ShieldAlert, X, Edit } from 'lucide-react';
import { DBState } from '../types';

interface HeaderProps {
  dbState: DBState;
  isAdminLoggedIn: boolean;
  isEditingEnabled: boolean;
  onStartEditing: () => void;
  onLogin: (u: string, p: string) => boolean;
  onLogout: () => void;
  onTabChange: (tab: string) => void;
}

export default function Header({
  dbState,
  isAdminLoggedIn,
  isEditingEnabled,
  onStartEditing,
  onLogin,
  onLogout,
  onTabChange,
}: HeaderProps) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(username, password);
    if (success) {
      setShowLoginModal(false);
      setUsername('');
      setPassword('');
    }
  };

  const handleForgotPassword = () => {
    const recoveryGmail = dbState.admin_credentials.confirmGmail;
    if (!recoveryGmail) {
      alert('គណនីរបស់អ្នកមិនទាន់បានកំណត់ Gmail សម្រាប់សង្គ្រោះឡើយ!');
      return;
    }
    const entered = prompt('សូមបញ្ចូលអាសយដ្ឋាន Gmail សង្គ្រោះរបស់អ្នក៖');
    if (entered && entered.trim().toLowerCase() === recoveryGmail.trim().toLowerCase()) {
      const subject = encodeURIComponent("សង្គ្រោះគណនី Admin - ប្រព័ន្ធសាលារៀន");
      const body = encodeURIComponent(
        `Username៖ ${dbState.admin_credentials.username}\nPassword៖ ${dbState.admin_credentials.password}`
      );
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=${recoveryGmail}&su=${subject}&body=${body}`,
        '_blank'
      );
    } else if (entered) {
      alert('អាសយដ្ឋាន Gmail មិនត្រូវគ្នាទេ!');
    }
  };

  // Safe logo and header fallbacks
  const logoSrc = dbState.school_logo || 'https://cdn-icons-png.flaticon.com/512/5087/5087579.png';
  const headerBgStyle = dbState.header_bg
    ? { backgroundImage: `url(${dbState.header_bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <>
      <header
        id="main-header"
        className="bg-[#0f2c59] text-white shadow-lg relative transition-all duration-300 min-h-[140px] flex items-center"
        style={headerBgStyle}
      >
        <div className="absolute inset-0 bg-black/60 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-10 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 w-full">
          <div
            className="flex items-center space-x-4 cursor-pointer select-none"
            onClick={() => onTabChange('home')}
          >
            <div className="w-16 h-16 md:w-20 md:h-20 bg-transparent overflow-hidden flex items-center justify-center">
              <img
                id="app-school-logo"
                src={logoSrc}
                alt="School Logo"
                className="w-full h-full object-contain filter drop-shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1
                id="app-school-name"
                className="font-moul text-lg md:text-2xl text-amber-300 tracking-wider drop-shadow-lg leading-snug"
              >
                {dbState.about_school.title || 'វិទ្យាល័យបឹងព្រះ'}
              </h1>
              <p className="text-xs md:text-sm font-battambang text-gray-200 drop-shadow mt-1">
                ប្រព័ន្ធព័ត៌មានសាលារៀន និងតាមដានការសិក្សារបស់សិស្ស
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm font-semibold text-gray-200">
            {isAdminLoggedIn && !isEditingEnabled && (
              <button
                id="btn-start-editing"
                onClick={onStartEditing}
                className="hover:text-amber-300 text-amber-200 bg-amber-600/40 hover:bg-amber-600/65 transition cursor-pointer flex items-center gap-1.5 py-1.5 px-4 rounded-full border border-amber-500/40 font-battambang"
              >
                <Edit className="w-4 h-4 text-amber-400 animate-pulse" /> កែព័ត៌មាន
              </button>
            )}

            <a
              id="btn-contact-link"
              href={`tel:${dbState.about_school.phone || '0966187972'}`}
              className="hover:text-amber-400 transition cursor-pointer flex items-center gap-1.5 py-1.5 px-4 bg-white/10 hover:bg-white/15 rounded-full border border-white/20"
            >
              <Phone className="w-4 h-4 text-amber-400" /> ទំនាក់ទំនង
            </a>
            <span className="text-white/20 hidden md:inline">|</span>

            {!isAdminLoggedIn ? (
              <button
                id="btn-admin-login-header"
                onClick={() => setShowLoginModal(true)}
                className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center gap-2 shadow-md cursor-pointer transform hover:scale-105 active:scale-95 duration-150"
              >
                <LogIn className="w-4 h-4" />
                <span>គណនី Admin</span>
              </button>
            ) : (
              <div id="admin-session-indicator" className="text-amber-400 flex items-center gap-2 font-battambang">
                <button
                  onClick={onLogout}
                  className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 rounded-full border border-red-500/30 text-xs text-red-300 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3 h-3" /> ចាកចេញ
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-2xl border border-gray-150 relative text-black animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-md font-bold text-center text-gray-800 mb-5 font-moul border-b pb-2">
              ផ្ទៀងផ្ទាត់សិទ្ធិជា Admin
            </h2>
            <form onSubmit={handleLoginSubmit} className="space-y-4 font-battambang text-xs">
              <div>
                <label className="block text-gray-600 font-bold mb-1">Username គណនី</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0f2c59] text-sm text-black bg-white"
                  placeholder="ឧ. SengVa"
                />
              </div>
              <div>
                <label className="block text-gray-600 font-bold mb-1">លេខសម្ងាត់ (Password)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0f2c59] text-sm text-black bg-white"
                  placeholder="..."
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#0f2c59] hover:bg-blue-800 text-white rounded-lg transition font-bold text-xs shadow-sm cursor-pointer"
              >
                ចូលទៅកាន់ផ្ទាំងគ្រប់គ្រង
              </button>
              <div className="flex justify-between pt-1 font-semibold text-[11px]">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-blue-600 hover:text-blue-500 hover:underline transition font-bold"
                >
                  ភ្លេចលេខសម្ងាត់?
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
