/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, IdCard, Users, User, Phone, MapPin, School, Download, Printer, Save, X } from 'lucide-react';
import { DBState, Student } from '../types';
import { jsPDF } from 'jspdf';

interface StudentSearchProps {
  dbState: DBState;
  onZoomImage: (src: string) => void;
  publicSearchInput: string;
  setPublicSearchInput: (val: string) => void;
  searchedStudent: Student | null;
  onSearch: (q: string) => void;
  isAdmin?: boolean;
}

// Helper functions for Khmer Date generation and School keyword extraction
const getSchoolKeyword = (title: string = 'វិទ្យាល័យបឹងព្រះ') => {
  if (!title) return 'បឹងព្រះ';
  let clean = title;
  const prefixes = ['វិទ្យាល័យ', 'អនុវិទ្យាល័យ', 'សាលាបឋមសិក្សា', 'សាលា'];
  for (const prefix of prefixes) {
    if (clean.startsWith(prefix)) {
      clean = clean.substring(prefix.length).trim();
      break;
    }
  }
  return clean || 'បឹងព្រះ';
};

const toKhmerNumber = (numStr: string) => {
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return numStr.split('').map(char => {
    const d = parseInt(char);
    return isNaN(d) ? char : khmerDigits[d];
  }).join('');
};

const getKhmerMonth = (monthIndex: number) => {
  const months = [
    'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
    'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
  ];
  return months[monthIndex] || 'មករា';
};

const formatKhmerIssueDate = (schoolTitle: string = 'វិទ្យាល័យបឹងព្រះ', dateObj: Date = new Date()) => {
  const keyword = getSchoolKeyword(schoolTitle);
  const day = dateObj.getDate();
  const month = dateObj.getMonth();
  const year = dateObj.getFullYear();
  
  const khmerDay = toKhmerNumber(day < 10 ? `0${day}` : `${day}`);
  const khmerMonth = getKhmerMonth(month);
  const khmerYear = toKhmerNumber(`${year}`);
  
  return `${keyword} ថ្ងៃទី${khmerDay} ខែ${khmerMonth} ឆ្នាំ${khmerYear}`;
};

// ======================================================
// drawCardToCanvas — គូរកាតសិស្សដោយផ្ទាល់ទៅ Canvas
// ប្រើ naturalWidth/naturalHeight ដើម → 100% original resolution
// ======================================================
function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function drawCardToCanvas(
  student: Student,
  layout: any,
  watermark?: { text?: string; size?: string; opacity?: string; angle?: string; color_r?: string; color_g?: string; color_b?: string },
  showWatermark = false
): Promise<HTMLCanvasElement> {
  const bgImg    = layout.bgImage ? await loadImg(layout.bgImage) : null;
  const photoImg = student.photo  ? await loadImg(student.photo)  : null;

  let cW: number, cH: number;
  if (bgImg && bgImg.naturalWidth > 0) {
    cW = bgImg.naturalWidth;
    cH = bgImg.naturalHeight;
  } else {
    cW = 375 * 6;
    cH = 500 * 6;
  }
  const scaleX = cW / 375;
  const scaleY = cH / 500;

  const canvas = document.createElement('canvas');
  canvas.width  = cW;
  canvas.height = cH;
  const ctx = canvas.getContext('2d')!;

  // ១. Background
  if (bgImg) {
    const bx = parseFloat(layout.bgPositionX || '0') * scaleX;
    const by = parseFloat(layout.bgPositionY || '0') * scaleY;
    const bw = cW * (parseFloat(layout.bgSizeWidth  || '100') / 100);
    const bh = cH * (parseFloat(layout.bgSizeHeight || '100') / 100);
    ctx.drawImage(bgImg, bx, by, bw, bh);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cW, cH);
  }

  // ២. Student Photo (cover, matching layout designer aspect preservation)
  const visibleFields = layout.visibleFields || [
    'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
    'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
  ];
  
  if (photoImg && visibleFields.includes('photo')) {
    const pl = parseFloat(layout.photo?.left   || '25px');
    const pt = parseFloat(layout.photo?.top    || '115px');
    const pw = parseFloat(layout.photo?.width  || '120px');
    const ph = parseFloat(layout.photo?.height || '160px');
    const slotX = pl * scaleX;
    const slotY = pt * scaleY;
    const slotW = pw * scaleX;
    const slotH = ph * scaleY;

    const imageRatio = photoImg.naturalWidth / photoImg.naturalHeight;
    const slotRatio = slotH > 0 ? (slotW / slotH) : 0.75;
    let sx = 0, sy = 0, sWidth = photoImg.naturalWidth, sHeight = photoImg.naturalHeight;

    if (imageRatio > slotRatio) {
      sWidth = photoImg.naturalHeight * slotRatio;
      sx = (photoImg.naturalWidth - sWidth) / 2;
    } else {
      sHeight = photoImg.naturalWidth / slotRatio;
      sy = (photoImg.naturalHeight - sHeight) / 2;
    }

    ctx.drawImage(photoImg, sx, sy, sWidth, sHeight, slotX, slotY, slotW, slotH);
  }

  // ៣. Text fields - raw values only, NO labels
  ctx.textBaseline = 'top';
  const fields = [
    { key: 'id',            value: student.id,                                                                         cfg: layout.id            },
    { key: 'name',          value: student.name,                                                                       cfg: layout.name          },
    { key: 'gender',        value: student.gender,                                                                     cfg: layout.gender        },
    { key: 'nationality',   value: 'ខ្មែរ',                                                                           cfg: layout.nationality   },
    { key: 'dob',           value: student.dob,                                                                        cfg: layout.dob           },
    { key: 'grade',         value: student.grade,                                                                      cfg: layout.grade         },
    { key: 'year',          value: layout.academicYear || '2025-2026',                                                 cfg: layout.year          },
    { key: 'addressLocal',  value: student.village && student.commune ? `${student.village} ${student.commune}` : 'ភូមិដីថុយ ឃុំបឹងព្រះ',       cfg: layout.addressLocal  },
    { key: 'addressRegion', value: student.district && student.province ? `${student.district} ${student.province}` : 'ស្រុកបាភ្នំ ខេត្តព្រៃវែង', cfg: layout.addressRegion },
    { key: 'fatherName',    value: student.fatherName || 'យាប ឆាន',                                                  cfg: layout.fatherName    },
    { key: 'motherName',    value: student.motherName || 'ញិល នាប',                                                  cfg: layout.motherName    },
    { key: 'issueDate',     value: formatKhmerIssueDate('វិទ្យាល័យបឹងព្រះ'),                                             cfg: layout.issueDate     },
  ];

  fields.forEach((f) => {
    if (!visibleFields.includes(f.key)) return;
    const fCfg = f.cfg || { left: '165px', top: '150px', fontSize: '14' };
    const fs = parseFloat(fCfg.fontSize || '14') * scaleX;
    const fx = parseFloat(fCfg.left     || '165px') * scaleX;
    const fy = parseFloat(fCfg.top      || '150px') * scaleY;
    
    ctx.font      = `bold ${fs}px Battambang, sans-serif`;
    ctx.fillStyle = '#1e40af';
    ctx.fillText(f.value || '', fx, fy);
  });

  // ៤. Watermark
  if (showWatermark && watermark?.text) {
    const wmSize    = parseFloat(watermark.size    || '28') * scaleX;
    const wmOpacity = (parseFloat(watermark.opacity || '20') / 100);
    const wmAngle   = parseFloat(watermark.angle   || '-45') * (Math.PI / 180);
    const r = watermark.color_r || '107';
    const g = watermark.color_g || '114';
    const b = watermark.color_b || '128';
    ctx.save();
    ctx.translate(cW / 2, cH / 2);
    ctx.rotate(wmAngle);
    ctx.font      = `${wmSize}px Moul, cursive`;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${wmOpacity})`;
    ctx.textAlign = 'center';
    ctx.fillText(watermark.text, 0, 0);
    ctx.restore();
  }

  return canvas;
}

interface StudentSearchProps {
  dbState: DBState;
  onZoomImage: (src: string) => void;
  publicSearchInput: string;
  setPublicSearchInput: (val: string) => void;
  searchedStudent: Student | null;
  onSearch: (q: string) => void;
  isAdmin?: boolean;
}

export default function StudentSearchTab({
  dbState,
  onZoomImage,
  publicSearchInput,
  setPublicSearchInput,
  searchedStudent,
  onSearch,
  isAdmin,
}: StudentSearchProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadCard = async () => {
    if (!searchedStudent) return;
    setIsDownloading(true);
    try {
      // គូរ Canvas ដោយផ្ទាល់ — original bg & photo resolution, PNG lossless
      // watermark បង្ហាញតែចំពោះ public (isAdmin=false)
      const canvas  = await drawCardToCanvas(
        searchedStudent,
        layout,
        wm,
        !isAdmin // show watermark for public users only
      );
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [75, 100] });
      doc.addImage(imgData, 'PNG', 0, 0, 75, 100);
      doc.save(`កាតសិស្ស_${searchedStudent.id}_${searchedStudent.name}.pdf`);
    } catch (err) {
      console.error('Download card error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

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
            placeholder="វាយបញ្ចូល អត្តលេខ ឬឈ្មោះសិស្ស..."
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
                    className="student-card-size bg-white relative no-select overflow-hidden"
                    style={cardBgStyle}
                  >
                  {/* Photo Field */}
                  {(() => {
                    const visibleFields = layout.visibleFields || [
                      'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
                      'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
                    ];
                    if (!visibleFields.includes('photo')) return null;
                    return (
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
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Text fields - raw values only, NO labels */}
                  {['id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year', 'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'].map((key) => {
                    const visibleFields = layout.visibleFields || [
                      'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
                      'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
                    ];
                    if (!visibleFields.includes(key)) return null;

                    const fConfig = layout[key] || { left: '165px', top: '150px', fontSize: '14' };
                    
                    const value = {
                      id: searchedStudent.id,
                      name: searchedStudent.name,
                      gender: searchedStudent.gender,
                      nationality: 'ខ្មែរ',
                      dob: searchedStudent.dob,
                      grade: searchedStudent.grade,
                      year: layout.academicYear || '2025-2026',
                      addressLocal: searchedStudent.village && searchedStudent.commune ? `${searchedStudent.village} ${searchedStudent.commune}` : 'ភូមិដីថុយ ឃុំបឹងព្រះ',
                      addressRegion: searchedStudent.district && searchedStudent.province ? `${searchedStudent.district} ${searchedStudent.province}` : 'ស្រុកបាភ្នំ ខេត្តព្រៃវែង',
                      fatherName: searchedStudent.fatherName || 'យាប ឆាន',
                      motherName: searchedStudent.motherName || 'ញិល នាប',
                      issueDate: formatKhmerIssueDate('វិទ្យាល័យបឹងព្រះ')
                    }[key];

                    return (
                      <div
                        key={key}
                        className="absolute draggable-field font-battambang select-none z-10 font-bold whitespace-nowrap text-blue-800"
                        style={{
                          left: fConfig.left || '165px',
                          top: fConfig.top || '150px',
                          fontSize: `${fConfig.fontSize || '14'}px`,
                          lineHeight: 1.2,
                        }}
                      >
                        {value}
                      </div>
                    );
                  })}

                  {/* Anti-copy Watermark Overlay (Standard matching exactly) */}
                  {wm.text && !isAdmin && (
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

              {/* Download button below card - Only shown to Admin, hidden for general Guests / Visitors */}
              {isAdmin && (
                <div className="mt-4 flex gap-3 w-full justify-center">
                  <button
                    onClick={handleDownloadCard}
                    disabled={isDownloading}
                    className={`px-4 py-2 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition font-battambang cursor-pointer shadow-md ${
                      isDownloading ? 'bg-amber-400 cursor-not-allowed opacity-75 animate-pulse' : 'bg-amber-600 hover:bg-amber-500 active:scale-95'
                    }`}
                    title="ទាញយកកាតសិស្សជាឯកសារ PDF កម្រិតច្បាស់ដើម"
                  >
                    <Download className="w-4 h-4" /> {isDownloading ? 'កំពុងទាញយក...' : 'ទាញយកកាតជា PDF'}
                  </button>
                </div>
              )}

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
                  {searchedStudent.phone ? (
                    <a
                      id="btn-parent-phone-link"
                      href={`tel:${searchedStudent.phone}`}
                      className="text-sm font-bold text-blue-600 hover:text-amber-600 hover:underline transition-all duration-150 flex items-center gap-1.5 bg-blue-50/50 hover:bg-amber-50 px-3.5 py-1.5 rounded-full border border-blue-100 hover:border-amber-200 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" /> {searchedStudent.phone}
                    </a>
                  ) : (
                    <span className="text-sm font-bold text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
