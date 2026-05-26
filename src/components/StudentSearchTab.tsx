/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { Search, IdCard, Users, User, Phone, MapPin, School, Download, Printer, Save, X } from 'lucide-react';
import { DBState, Student } from '../types';
import html2canvas from 'html2canvas';

interface StudentSearchProps {
  dbState: DBState;
  onZoomImage: (src: string) => void;
  publicSearchInput: string;
  setPublicSearchInput: (val: string) => void;
  searchedStudent: Student | null;
  onSearch: (q: string) => void;
}

export default function StudentSearchTab({
  dbState,
  onZoomImage,
  publicSearchInput,
  setPublicSearchInput,
  searchedStudent,
  onSearch,
}: StudentSearchProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleSearchTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(publicSearchInput);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(publicSearchInput);
    }
  };

  const layout = dbState.card_layout;
  const wm = dbState.watermark;

  // Render Card with strict styles matching the original draft exactly (7.5cm x 10cm / 375px x 500px)
  const cardBgStyle: React.CSSProperties = layout.bgImage
    ? {
        backgroundImage: `url(${layout.bgImage})`,
        backgroundSize: `${layout.bgSizeWidth || '100'}% ${layout.bgSizeHeight || '100'}%`,
        backgroundPosition: `${layout.bgPositionX || '0'}px ${layout.bgPositionY || '0'}px`,
        backgroundRepeat: 'no-repeat',
      }
    : { backgroundColor: '#ffffff' };

  const handlePrintCard = () => {
    if (!searchedStudent) return;
    const printContent = document.getElementById('public-card-render');
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = `Print_${uniqueName}`;
    const printWindow = window.open(windowUrl, windowName, 'left=50,top=50,width=500,height=600');
    if (printWindow && printContent) {
      printWindow.document.write(`
        <html>
          <head>
            <title>បោះពុម្ភកាតសិស្ស - ${searchedStudent.name}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Moul&family=Battambang&display=swap');
              body {
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background-color: #ffffff;
              }
              .font-moul { font-family: 'Moul', cursive; }
              .font-battambang { font-family: 'Battambang', sans-serif; }
              .student-card-size {
                width: 375px !important;
                height: 500px !important;
                box-sizing: border-box;
                position: relative;
                overflow: hidden;
                box-shadow: none;
                border: 0.5px solid #ccc;
              }
              ${Array.from(document.styleSheets)
                .map((styleSheet) => {
                  try {
                    return Array.from(styleSheet.cssRules)
                      .map((rule) => rule.cssText)
                      .join('\n');
                  } catch (e) {
                    return '';
                  }
                })
                .join('\n')}
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div id="print-root">
              ${printContent.outerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form
        onSubmit={handleSearchTrigger}
        className="flex justify-center items-center bg-transparent border-0 shadow-none p-2 w-full gap-4"
      >
        <div className="relative flex items-center w-full max-w-md">
          <span className="absolute left-4 text-gray-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={publicSearchInput}
            onChange={(e) => {
              setPublicSearchInput(e.target.value);
              if (e.target.value.trim() === '') {
                onSearch('');
              }
            }}
            onKeyPress={handleSearchKeyPress}
            placeholder="ស្វែងរកតាមអត្តលេខគ្រួសារ ឬឈ្មោះសិស្ស..."
            className="w-full pl-10 pr-24 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-800 text-xs text-black bg-white shadow-xs font-battambang"
          />
          <button
            type="submit"
            className="absolute right-1.5 px-5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-[11px] rounded-full transition font-bold cursor-pointer font-battambang"
          >
            ស្វែងរក
          </button>
        </div>
      </form>

      {/* Main Results or welcome cards */}
      {!searchedStudent ? (
        <div id="public-welcome-banner" className="bg-white p-5 rounded shadow-xs max-w-2xl mx-auto text-center space-y-3 animate-in fade-in duration-200">
          <h2 className="text-xl md:text-2xl font-bold text-blue-900 font-moul">
            សូមស្វាគមន៍មកកាន់ប្រព័ន្ធស្វែងរកទិន្នន័យសិស្ស
          </h2>
          <p className="text-xs md:text-sm text-gray-600 font-battambang leading-relaxed">
            សូមប្រើប្រាស់របារស្វែងរកខាងលើដើម្បីឆែកមើលកាតសម្គាល់ និងកំណត់ព័ត៌មានលម្អិតរបស់សិស្សគ្រប់កម្រិតថ្នាក់។
          </p>
          <div className="flex justify-center text-blue-800/15 py-4">
            <IdCard className="w-32 h-32 stroke-1 animate-pulse" />
          </div>
        </div>
      ) : (
        <div id="public-card-result" className="w-full animate-in fade-in zoom-in-95 duration-200">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 bg-white p-4.5 rounded-2xl shadow-xl w-full border-0">
            {/* Left Side: ID Student Card Frame */}
            <div className="flex flex-col items-center">
              <div className="responsive-card-container relative bg-transparent shadow-xl">
                {/* Overlay blocker preventing clicking on content directly in view */}
                <div className="absolute inset-0 z-50 bg-transparent no-select" onContextMenu={(e) => e.preventDefault()} />
                
                <div className="responsive-card-scale">
                  <div
                    id="public-card-render"
                    ref={cardRef}
                    className="student-card-size bg-white relative no-select overflow-hidden"
                    style={cardBgStyle}
                  >
                  {/* Photo Field */}
                  <div
                    className="absolute draggable-field font-battambang select-none z-10 overflow-hidden"
                    style={{
                      left: layout.photo.left,
                      top: layout.photo.top,
                      width: layout.photo.width || '120px',
                      height: layout.photo.height || '160px',
                    }}
                  >
                    <div className="w-full h-full bg-transparent flex items-center justify-center relative rounded-none">
                      {searchedStudent.photo ? (
                        <img
                          id="card-photo"
                          src={searchedStudent.photo}
                          alt="Student"
                          className="w-full h-full object-cover rounded-none"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="text-gray-400 text-center flex flex-col items-center">
                          <User className="w-8 h-8 opacity-60" />
                          <span className="text-[9px] mt-1 font-bold">3 x 4</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ID Field */}
                  <div
                    className="absolute draggable-field font-battambang select-none z-10 font-bold whitespace-nowrap"
                    style={{
                      left: layout.id.left,
                      top: layout.id.top,
                      fontSize: `${layout.id.fontSize || '14'}px`,
                      lineHeight: 1.2,
                    }}
                  >
                    អត្តលេខ: <span className="text-blue-800">{searchedStudent.id}</span>
                  </div>

                  {/* Name Field */}
                  <div
                    className="absolute draggable-field font-battambang select-none z-10 font-bold whitespace-nowrap"
                    style={{
                      left: layout.name.left,
                      top: layout.name.top,
                      fontSize: `${layout.name.fontSize || '14'}px`,
                      lineHeight: 1.2,
                    }}
                  >
                    ឈ្មោះ: <span className="text-blue-800">{searchedStudent.name}</span>
                  </div>

                  {/* Gender Field */}
                  <div
                    className="absolute draggable-field font-battambang select-none z-10 whitespace-nowrap font-bold"
                    style={{
                      left: layout.gender.left,
                      top: layout.gender.top,
                      fontSize: `${layout.gender.fontSize || '14'}px`,
                      lineHeight: 1.2,
                    }}
                  >
                    ភេទ: <span className="text-blue-800">{searchedStudent.gender}</span>
                  </div>

                  {/* Nationality */}
                  <div
                    className="absolute draggable-field font-battambang select-none z-10 whitespace-nowrap font-bold"
                    style={{
                      left: layout.nationality.left,
                      top: layout.nationality.top,
                      fontSize: `${layout.nationality.fontSize || '14'}px`,
                      lineHeight: 1.2,
                    }}
                  >
                    សញ្ជាតិ: <span className="text-blue-800">ខ្មែរ</span>
                  </div>

                  {/* DOB Field */}
                  <div
                    className="absolute draggable-field font-battambang select-none z-10 whitespace-nowrap font-bold"
                    style={{
                      left: layout.dob.left,
                      top: layout.dob.top,
                      fontSize: `${layout.dob.fontSize || '13'}px`,
                      lineHeight: 1.2,
                    }}
                  >
                    ថ្ងៃខែឆ្នាំកំណើត: <span className="text-blue-800">{searchedStudent.dob}</span>
                  </div>

                  {/* Grade Field */}
                  <div
                    className="absolute draggable-field font-battambang select-none z-10 whitespace-nowrap font-bold"
                    style={{
                      left: layout.grade.left,
                      top: layout.grade.top,
                      fontSize: `${layout.grade.fontSize || '14'}px`,
                      lineHeight: 1.2,
                    }}
                  >
                    ថ្នាក់ទី: <span className="text-blue-800">{searchedStudent.grade}</span>
                  </div>

                  {/* Academic Year Field */}
                  <div
                    className="absolute draggable-field font-battambang select-none z-10 whitespace-nowrap font-bold"
                    style={{
                      left: layout.year.left,
                      top: layout.year.top,
                      fontSize: `${layout.year.fontSize || '14'}px`,
                      lineHeight: 1.2,
                    }}
                  >
                    ឆ្នាំសិក្សា: <span className="text-blue-800">{layout.academicYear || '2025-2026'}</span>
                  </div>

                  {/* Anti-copy Watermark Overlay (Standard matching exactly) */}
                  {wm.text && (
                    <div
                      id="card-watermark-overlay"
                      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden font-moul text-center"
                      style={{
                        transform: `rotate(${wm.angle || '-45'}deg)`,
                        fontSize: `${wm.size || '28'}px`,
                        color: `rgba(${wm.color_r || '107'}, ${wm.color_g || '114'}, ${wm.color_b || '128'}, ${(Number(wm.opacity) || 20) / 100})`,
                        whiteSpace: 'nowrap',
                        zIndex: 49,
                      }}
                    >
                      {wm.text}
                    </div>
                  )}
                  </div>
                </div>
              </div>


            </div>

            {/* Right Side: Family Profiles details list */}
            <div className="flex-grow w-full space-y-4 font-battambang text-xs text-gray-700">
              <h3 className="font-moul text-[#0f2c59] text-sm border-b pb-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-500" /> ព័ត៌មានលម្អិត និងប្រវត្តិរូបសិស្ស
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                <div className="border-b border-gray-100 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-gray-400">អត្តលេខសិស្ស</span>
                  <span className="font-bold text-[#0f2c59] text-sm">{searchedStudent.id}</span>
                </div>
                <div className="border-b border-gray-100 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-gray-400">គោត្តនាម-នាម</span>
                  <span className="font-bold text-gray-800 text-sm">{searchedStudent.name}</span>
                </div>
                <div className="border-b border-gray-100 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-gray-400">ភេទ</span>
                  <span className="font-bold text-gray-800">{searchedStudent.gender}</span>
                </div>
                <div className="border-b border-gray-100 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-gray-400">ថ្នាក់រៀន</span>
                  <span className="font-bold text-[#0f2c59]">{searchedStudent.grade}</span>
                </div>
                <div className="border-b border-gray-100 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-gray-400">ថ្ងៃខែឆ្នាំកំណើត</span>
                  <span className="font-bold text-gray-800">{searchedStudent.dob}</span>
                </div>
                
                <div className="md:col-span-2 border-b border-gray-100 py-2.5 space-y-2">
                  <span className="font-bold text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" /> ទីកន្លែងកំណើត
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-gray-700 font-bold bg-slate-50/70 p-2.5 rounded-lg border border-slate-100/50">
                    <div>ភូមិ : <span className="text-[#0f2c59] ml-1">{searchedStudent.village || '-'}</span></div>
                    <div>ឃុំ/សង្កាត់ : <span className="text-[#0f2c59] ml-1">{searchedStudent.commune || '-'}</span></div>
                    <div>ស្រុក/ខណ្ឌ : <span className="text-[#0f2c59] ml-1">{searchedStudent.district || '-'}</span></div>
                    <div>ខេត្ត/ក្រុង : <span className="text-[#0f2c59] ml-1">{searchedStudent.province || '-'}</span></div>
                  </div>
                </div>

                <div className="border-b border-gray-100 py-2.5 flex flex-col justify-center">
                  <span className="font-bold text-gray-400 mb-0.5">ឈ្មោះឪពុក</span>
                  <span className="font-bold text-gray-850">{searchedStudent.fatherName || '-'}</span>
                </div>
                <div className="border-b border-gray-100 py-2.5 flex flex-col justify-center">
                  <span className="font-bold text-gray-400 mb-0.5">មុខរបរឪពុក</span>
                  <span className="font-bold text-gray-850">{searchedStudent.fatherJob || '-'}</span>
                </div>
                <div className="border-b border-gray-100 py-2.5 flex flex-col justify-center">
                  <span className="font-bold text-gray-400 mb-0.5">ឈ្មោះម្តាយ</span>
                  <span className="font-bold text-gray-850">{searchedStudent.motherName || '-'}</span>
                </div>
                <div className="border-b border-gray-100 py-2.5 flex flex-col justify-center">
                  <span className="font-bold text-gray-400 mb-0.5">មុខរបរម្តាយ</span>
                  <span className="font-bold text-gray-850">{searchedStudent.motherJob || '-'}</span>
                </div>
                <div className="border-b border-gray-100 py-2.5 flex items-center justify-between md:col-span-2">
                  <span className="font-bold text-gray-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    លេខទូរស័ព្ទអាណាព្យាបាល
                  </span>
                  <span className="text-sm font-bold text-blue-800">{searchedStudent.phone || '-'}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
