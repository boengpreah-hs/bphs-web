/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileDown,
  Trash2,
  Edit2,
  Plus,
  Eye,
  Settings,
  Crop,
  Layers,
  Sparkles,
  CloudLightning,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Download,
  Upload,
  X,
  AlignLeft,
  ShieldAlert,
  Save,
  Sliders,
  AlignJustify
} from 'lucide-react';
import { DBState, Student, CardLayout, WatermarkSettings } from '../types';
import { fileToBase64, compressImage } from '../utils';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const DEFAULT_AVATAR_DATA_URI = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 160' width='120' height='160'></svg>";

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
  student: any,
  layout: any,
  watermark?: { text?: string; size?: string; opacity?: string; angle?: string; color_r?: string; color_g?: string; color_b?: string },
  showWatermark = false,
  schoolTitle = 'វិទ្យាល័យបឹងព្រះ'
): Promise<HTMLCanvasElement> {
  const bgImg    = layout.bgImage ? await loadImg(layout.bgImage) : null;
  const photoImg = student.photo  ? await loadImg(student.photo)  : null;

  // Canvas size - locked to a perfect high-resolution 3:4 aspect ratio matching the 375x500 HTML card designer!
  let cW: number, cH: number;
  if (bgImg && bgImg.naturalWidth > 0) {
    cW = Math.max(bgImg.naturalWidth, 2250); // Minimum 2250px for high definition output (6x of 375px)
    cH = Math.round((cW * 500) / 375);
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

  const visibleFields = layout.visibleFields || [
    'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
    'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
  ];

  // ២. Student Photo (cover, matching layout designer aspect preservation)
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

  // ៣. Text fields (Draw only the data value text directly)
  ctx.textBaseline = 'top';
  
  const fields = [
    { key: 'id',          value: student.id,                                                                           cfg: layout.id          },
    { key: 'name',        value: student.name,                                                                         cfg: layout.name        },
    { key: 'gender',      value: student.gender,                                                                       cfg: layout.gender      },
    { key: 'nationality', value: 'ខ្មែរ',                                                                              cfg: layout.nationality },
    { key: 'dob',         value: student.dob,                                                                          cfg: layout.dob         },
    { key: 'grade',       value: student.grade,                                                                        cfg: layout.grade       },
    { key: 'year',        value: layout.academicYear || '2025-2026',                                                   cfg: layout.year        },
    { key: 'addressLocal',  value: student.village && student.commune ? `${student.village} ${student.commune}` : 'ភូមិដីថុយ ឃុំបឹងព្រះ',               cfg: layout.addressLocal   },
    { key: 'addressRegion', value: student.district && student.province ? `${student.district} ${student.province}` : 'ស្រុកបាភ្នំ ខេត្តព្រៃវែង',         cfg: layout.addressRegion  },
    { key: 'fatherName',  value: student.fatherName || 'យាប ឆាន',                                                   cfg: layout.fatherName   },
    { key: 'motherName',  value: student.motherName || 'ញិល នាប',                                                   cfg: layout.motherName   },
    { key: 'issueDate',   value: formatKhmerIssueDate(schoolTitle),                                                    cfg: layout.issueDate    },
  ];

  fields.forEach((f) => {
    if (!visibleFields.includes(f.key)) return;
    const fCfg = f.cfg || { left: '165px', top: '150px', fontSize: '14' };
    const fs = parseFloat(fCfg.fontSize || '14') * scaleX;
    
    // Add 4px to left (matching px-1 browser offset) and 2px to top (matching CSS leading offset)
    const fx = (parseFloat(fCfg.left || '165px') + 4) * scaleX;
    const fy = (parseFloat(fCfg.top  || '150px') + 2) * scaleY;

    ctx.font      = `bold ${fs}px Battambang, sans-serif`;
    ctx.fillStyle = '#1e40af';
    ctx.fillText(f.value || '', fx, fy);
  });

  // ៤. Watermark (optional)
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

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

function convertOklchToRgbInString(str: string): string {
  if (!str || typeof str !== 'string' || !str.includes('oklch')) {
    return str;
  }
  
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
    sharedCanvas.width = 1;
    sharedCanvas.height = 1;
    sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
  }
  
  return str.replace(/oklch\([^)]+\)/g, (match) => {
    try {
      if (!sharedCtx) return match;
      sharedCtx.clearRect(0, 0, 1, 1);
      sharedCtx.fillStyle = match;
      sharedCtx.fillRect(0, 0, 1, 1);
      const data = sharedCtx.getImageData(0, 0, 1, 1).data;
      const alpha = (data[3] / 255).toFixed(3);
      return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${alpha})`;
    } catch (e) {
      return match;
    }
  });
}

async function html2canvasSafe(element: HTMLElement, options: any = {}): Promise<HTMLCanvasElement> {
  const originalGetComputedStyle = window.getComputedStyle;
  
  window.getComputedStyle = function (elt, pseudoElt) {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop, receiver) {
        const val = target[prop as any];
        if (typeof val === 'function') {
          if (prop === 'getPropertyValue') {
            return function(propertyName: string) {
              const raw = target.getPropertyValue(propertyName);
              return convertOklchToRgbInString(raw);
            };
          }
          return (val as any).bind(target);
        }
        if (typeof val === 'string') {
          return convertOklchToRgbInString(val);
        }
        return val;
      }
    });
  };
  
  try {
    return await html2canvas(element, options);
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
}

const khmerMonths = [
  "មករា", "កុម្ភៈ", "មីនា", "មេសា", "ឧសភា", "មិថុនា",
  "កក្កដា", "សីហា", "កញ្ញា", "តុលា", "វិច្ឆិកា", "ធ្នូ"
];

const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

function convertToKhmerDigit(numStr: string): string {
  return numStr.split('').map(char => {
    const d = parseInt(char, 10);
    return isNaN(d) ? char : khmerDigits[d];
  }).join('');
}

function convertFromKhmerDigit(khmerStr: string): string {
  const mapping: { [key: string]: string } = {
    '០':'0', '១':'1', '២':'2', '៣':'3', '៤':'4',
    '៥':'5', '៦':'6', '៧':'7', '៨':'8', '៩':'9'
  };
  return khmerStr.split('').map(char => mapping[char] || char).join('');
}

function formatDobToKhmer(dobStr: string): string {
  if (!dobStr) return '';
  if (/[\u1780-\u17F9]/.test(dobStr)) {
    return dobStr;
  }

  let day = '';
  let month = '';
  let year = '';

  const cleaned = dobStr.replace(/\s+/g, '');
  const matchSlash = cleaned.split(/[\/-]/);
  
  if (matchSlash.length === 3) {
    if (matchSlash[0].length === 4) {
      year = matchSlash[0];
      month = matchSlash[1];
      day = matchSlash[2];
    } else {
      day = matchSlash[0];
      month = matchSlash[1];
      year = matchSlash[2];
    }
  } else {
    return dobStr;
  }

  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
    return dobStr;
  }

  const khmerDay = convertToKhmerDigit(String(dayNum).padStart(2, '0'));
  const khmerMonth = khmerMonths[monthNum - 1];
  const khmerYear = convertToKhmerDigit(String(yearNum));

  return `${khmerDay}-${khmerMonth}-${khmerYear}`;
}

function formatDobToEnglish(khmerDob: string): string {
  if (!khmerDob) return '';
  if (/\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(khmerDob)) {
    return khmerDob;
  }
  
  const parts = khmerDob.replace(/\s+/g, '').split('-');
  if (parts.length === 3) {
    const [khmerDay, khmerMonth, khmerYear] = parts;
    const engDay = convertFromKhmerDigit(khmerDay);
    const engYear = convertFromKhmerDigit(khmerYear);
    
    const monthIndex = khmerMonths.indexOf(khmerMonth.trim());
    if (monthIndex !== -1) {
      const engMonth = String(monthIndex + 1).padStart(2, '0');
      return `${engDay.padStart(2, '0')}/${engMonth}/${engYear}`;
    }
  }
  return khmerDob;
}

interface EditableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}

function EditableSelect({
  value,
  onChange,
  options,
  placeholder = '',
  className = '',
  required = false
}: EditableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-0 top-0 bottom-0 px-2.5 text-gray-500 hover:text-gray-700 select-none cursor-pointer"
        >
          <svg className="w-4 h-4 text-gray-450" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {isOpen && options.length > 0 && (
        <div className="absolute left-0 right-0 z-[100] mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-800 hover:bg-slate-100 font-battambang font-bold cursor-pointer block"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface AdminPanelProps {
  dbState: DBState;
  onUpdateDB: (data: Partial<DBState>) => Promise<void>;
  onPostStudent: (student: Student) => Promise<void>;
  onPostStudentsBulk?: (students: Student[]) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onBulkDeleteStudents: (ids?: string[]) => Promise<void>;
  onBackupToDrive: () => Promise<void>;
  onRestoreFromDrive: () => Promise<void>;
  onViewStudentCard: (id: string) => void;
}

export default function AdminPanel({
  dbState,
  onUpdateDB,
  onPostStudent,
  onPostStudentsBulk,
  onDeleteStudent,
  onBulkDeleteStudents,
  onBackupToDrive,
  onRestoreFromDrive,
  onViewStudentCard,
}: AdminPanelProps) {
  // Tabs and forms togglers
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDesigner, setShowDesigner] = useState(false);
  const [showWatermark, setShowWatermark] = useState(false);
  const [showExcelExport, setShowExcelExport] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [isExportingBak, setIsExportingBak] = useState(false);
  const [isImportingBak, setIsImportingBak] = useState(false);

  // Download export snapshot file
  const handleExportFullBackup = async () => {
    setIsExportingBak(true);
    try {
      const res = await fetch('/api/backup-full');
      const json = await res.json();
      if (json.status === 'success' && json.backup) {
        const payloadStr = JSON.stringify(json.backup, null, 2);
        const fileName = `វិទ្យាល័យបឹងព្រះ_Backup_សរុបរួម_${new Date().toISOString().split('T')[0]}.schoolbak`;
        
        const blob = new Blob([payloadStr], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        
        alert('ជោគជ័យ៖ ឯកសារបម្រុងទុកទិន្នន័យ និងរូបភាពសរុបរួមត្រូវបានទាញយកដោយជោគជ័យ!');
      } else {
        alert('បរាជ័យ៖ មិនអាចបង្កើតឯកសារបម្រុងទុកទិន្នន័យបានទេ៖ ' + (json.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error(err);
      alert('បរាជ័យ៖ កំហុសបណ្តាញ ឬប្រព័ន្ធ៖ ' + (err.message || err));
    } finally {
      setIsExportingBak(false);
    }
  };

  // Import snapshot backup file
  const handleImportFullBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      "ព្រមាន៖ ការនាំចូលឯកសារបម្រុងទុក (Backup) នេះ នឹងជំនួសទិន្នន័យសិស្សានុសិស្ស ប្លង់ការចនា រូបភាព និងការបង្ហោះទាំងអស់នៅក្នុងប្រព័ន្ធបច្ចុប្បន្នទាំងស្រុង! តើអ្នកពិតជាចង់បន្តមែនទេ?"
    );
    if (!confirmRestore) {
      e.target.value = '';
      return;
    }

    setIsImportingBak(true);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          
          if (!parsed.backupVersion || !parsed.db) {
            alert('បរាជ័យ៖ ទម្រង់ឯកសារបម្រុងទុកមិនត្រឹមត្រូវទេ!');
            setIsImportingBak(false);
            return;
          }

          const res = await fetch('/api/restore-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backup: parsed })
          });
          
          const json = await res.json();
          if (json.status === 'success') {
            alert('ជោគជ័យ៖ ទិន្នន័យ និងរូបភាពទាំងអស់ត្រូវបានស្តារឡើងវិញដោយជោគជ័យ! ប្រព័ន្ធនឹងរៀបចំដំណើរការឡើងវិញភ្លាមៗ។');
            window.location.reload();
          } else {
            alert('បរាជ័យ៖ មិនអាចបញ្ចូលទិន្នន័យបានទេ៖ ' + (json.error || 'Unknown error'));
          }
        } catch (err: any) {
          console.error(err);
          alert('បរាជ័យ៖ មិនអាចអាន ឬបំប្លែងព័ត៌មាននៅក្នុងឯកសារបានទេ។ ' + (err.message || err));
        } finally {
          setIsImportingBak(false);
        }
      };
      
      fileReader.readAsText(file);
    } catch (err: any) {
      console.error(err);
      alert('បរាជ័យ៖ មានកំហុសក្នុងការអានឯកសារ៖ ' + (err.message || err));
      setIsImportingBak(false);
    }
  };

  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminGmail, setAdminGmail] = useState('');

  useEffect(() => {
    if (dbState?.admin_credentials && !showAdminSettings) {
      setAdminUser(dbState.admin_credentials.username || '');
      setAdminPass(dbState.admin_credentials.password || '');
      setAdminGmail(dbState.admin_credentials.confirmGmail || '');
    }
  }, [dbState, showAdminSettings]);

  const handleSaveAdminCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateDB({
      admin_credentials: {
        username: adminUser.trim(),
        password: adminPass.trim(),
        confirmGmail: adminGmail.trim()
      }
    });
    alert('ការកំណត់គណនី Admin ត្រូវបានរក្សាទុកដោយជោគជ័យ!');
    setShowAdminSettings(false);
  };

  // Layout Design selection state
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [localLayout, setLocalLayout] = useState<any>(null);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(false);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState<boolean>(false);

  // Student form inputs
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'ប្រុស' | 'ស្រី'>('ប្រុស');
  const [dob, setDob] = useState('');
  const [grade, setGrade] = useState('');
  const [village, setVillage] = useState('');
  const [commune, setCommune] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherJob, setFatherJob] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherJob, setMotherJob] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Helper lists collected from previous students
  const studentsList = dbState?.students || [];
  const existingGrades = Array.from(new Set(studentsList.map(s => s.grade).filter(Boolean))).sort();
  const existingVillages = Array.from(new Set(studentsList.map(s => s.village).filter(Boolean))).sort();
  const existingCommunes = Array.from(new Set(studentsList.map(s => s.commune).filter(Boolean))).sort();
  const existingDistricts = Array.from(new Set(studentsList.map(s => s.district).filter(Boolean))).sort();
  const existingProvinces = Array.from(new Set(studentsList.map(s => s.province).filter(Boolean))).sort();
  const allJobs = Array.from(new Set([
    ...studentsList.map(s => s.fatherJob).filter(Boolean),
    ...studentsList.map(s => s.motherJob).filter(Boolean),
    'កសិករ'
  ])).sort();

  const getNextStudentId = () => {
    if (studentsList.length === 0) {
      return '001';
    }
    let maxId = 0;
    let padLength = 3;
    for (const s of studentsList) {
      const parsed = parseInt(s.id, 10);
      if (!isNaN(parsed) && parsed > maxId) {
        maxId = parsed;
        padLength = s.id.length;
      }
    }
    const nextId = maxId + 1;
    return String(nextId).padStart(padLength, '0');
  };

  // Real-time camera states for rapid mobile photo acquisition (Android & iOS)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  // Table search & filter values
  const [filterSearch, setFilterSearch] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterProv, setFilterProv] = useState('');

  // PDF bulk generation progress
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStatusMsg, setPdfStatusMsg] = useState('');
  const [pdfScope, setPdfScope] = useState<'all' | 'class'>('all');
  const [pdfClass, setPdfClass] = useState('');

  // Watermark temp config
  const [wmText, setWmText] = useState(dbState.watermark.text || 'ថតចម្លង');
  const [wmSize, setWmSize] = useState(dbState.watermark.size || '28');
  const [wmOpacity, setWmOpacity] = useState(dbState.watermark.opacity || '20');
  const [wmAngle, setWmAngle] = useState(dbState.watermark.angle || '-45');
  const [wmR, setWmR] = useState(dbState.watermark.color_r || '107');
  const [wmG, setWmG] = useState(dbState.watermark.color_g || '114');
  const [wmB, setWmB] = useState(dbState.watermark.color_b || '128');

  // Modern custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: 'delete-all' | 'delete-filtered' | 'delete-single';
    targetId?: string;
    requireInputWord?: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionType: 'delete-all'
  });
  const [deleteInputText, setDeleteInputText] = useState('');

  // Predefined standard watermarking colors
  const standardColors = [
    { name: 'ពណ៌ប្រផេះ (Classic Gray)', r: '107', g: '114', b: '128', hex: '#6b7280' },
    { name: 'ពណ៌ខៀវស្រាល (Soft Blue)', r: '59', g: '130', b: '246', hex: '#3b82f6' },
    { name: 'ពណ៌ក្រហមស្រាល (Soft Red)', r: '239', g: '68', b: '68', hex: '#ef4444' },
    { name: 'ពណ៌ទឹកមាស (Gold)', r: '234', g: '179', b: '8', hex: '#eab308' },
    { name: 'ពណ៌បៃតងខ្ចី (Soft Green)', r: '34', g: '197', b: '94', hex: '#22c55e' },
    { name: 'ពណ៌ស្វាយស្រាល (Soft Purple)', r: '168', g: '85', b: '247', hex: '#a855f7' },
  ];

  // Global verification confirmation dispatcher
  const handleConfirmAction = async () => {
    if (confirmModal.requireInputWord && deleteInputText !== confirmModal.requireInputWord) {
      alert(`សូមវាយពាក្យ "${confirmModal.requireInputWord}" ឱ្យបានត្រឹមត្រូវដើម្បីបញ្ជាក់ការលុប!`);
      return;
    }

    if (confirmModal.actionType === 'delete-all') {
      await onBulkDeleteStudents();
    } else if (confirmModal.actionType === 'delete-filtered') {
      const filteredIds = filteredStudents.map((s) => s.id);
      await onBulkDeleteStudents(filteredIds);
    } else if (confirmModal.actionType === 'delete-single') {
      if (confirmModal.targetId) {
        await onDeleteStudent(confirmModal.targetId);
      }
    }

    setConfirmModal({
      isOpen: false,
      title: '',
      description: '',
      actionType: 'delete-all'
    });
    setDeleteInputText('');
  };

  // Multi device connection script url
  const [driveUrl, setDriveUrl] = useState(localStorage.getItem('drive_script_url') || '');

  // Form Reset helper
  const resetForm = () => {
    setId(getNextStudentId());
    setName('');
    setGender('ប្រុស');
    setDob('');
    setGrade('');
    setVillage('');
    setCommune('');
    setDistrict('');
    setProvince('');
    setFatherName('');
    setFatherJob('កសិករ');
    setMotherName('');
    setMotherJob('កសិករ');
    setPhone('');
    setPhoto('');
    setIsEditing(false);
  };

  // Form Student Submit
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !name.trim() || !grade.trim()) {
      alert('សូមបំពេញអត្តលេខ ឈ្មោះ និងថ្នាក់!');
      return;
    }

    const studentData: Student = {
      id: id.trim(),
      name: name.trim(),
      gender,
      dob: formatDobToKhmer(dob.trim()),
      grade: grade.trim(),
      village: village.trim(),
      commune: commune.trim(),
      district: district.trim(),
      province: province.trim(),
      fatherName: fatherName.trim(),
      fatherJob: fatherJob.trim(),
      motherName: motherName.trim(),
      motherJob: motherJob.trim(),
      phone: phone.trim(),
      photo,
    };

    await onPostStudent(studentData);
    resetForm();
    setShowAddForm(false);
  };

  // Edit action
  const editStudent = (student: Student) => {
    setId(student.id);
    setName(student.name);
    setGender(student.gender);
    setDob(formatDobToEnglish(student.dob));
    setGrade(student.grade);
    setVillage(student.village || '');
    setCommune(student.commune || '');
    setDistrict(student.district || '');
    setProvince(student.province || '');
    setFatherName(student.fatherName || '');
    setFatherJob(student.fatherJob || 'កសិករ');
    setMotherName(student.motherName || '');
    setMotherJob(student.motherJob || 'កសិករ');
    setPhone(student.phone || '');
    setPhoto(student.photo || '');
    setIsEditing(true);
    setShowAddForm(true);
  };

  // Photo upload - preserve original resolution & quality (no compression)
  const handleFormPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      // Determine extension from file type
      const ext = file.type.split('/')[1] || 'jpg';

      // Upload to server at original quality - no compression applied
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, name: `student_photo_${id}`, ext })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        setPhoto(resData.url);
      } else {
        setPhoto(base64); // Fallback to original base64 (no compression)
      }
    } catch (err) {
      alert('កំហុសក្នុងការកែច្នៃរូបថត!');
    }
  };

  // Real-time camera acquisition methods for Android, iOS, tablets, and webcams
  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsCameraOpen(true);
      setCameraMode(mode);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('កំហុស៖ មិនអាចបើកកាមេរ៉ាឧបករណ៍បានទេ! ' + err);
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const toggleCamera = () => {
    const targetMode = cameraMode === 'user' ? 'environment' : 'user';
    startCamera(targetMode);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (cameraMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        // Preserve original camera resolution - no downscaling
        const base64 = canvas.toDataURL('image/jpeg', 1.0);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64, name: `student_photo_${id || 'new'}`, ext: 'jpg' })
        });
        const resData = await response.json();
        if (resData.status === 'success') {
          setPhoto(resData.url);
        } else {
          setPhoto(base64); // Fallback to original base64
        }
      }
    } catch (err) {
      alert('កំហុសក្នុងការចាប់យករូបថត៖ ' + err);
    } finally {
      stopCamera();
    }
  };

  // Drag and design settings handlers
  const adjustFieldPos = (dir: 'up' | 'down' | 'left' | 'right', amt = 5) => {
    const targets = selectedFields.length > 0 ? selectedFields : (selectedField ? [selectedField] : []);
    if (targets.length === 0) return;
    const currentLayout = { ...dbState.card_layout };
    
    targets.forEach(fKey => {
      let fieldObj = (currentLayout as any)[fKey];
      if (!fieldObj) {
        fieldObj = { left: '165px', top: '150px', fontSize: '14' };
        (currentLayout as any)[fKey] = fieldObj;
      }
      const leftVal = parseInt(fieldObj.left || '10px');
      const topVal = parseInt(fieldObj.top || '10px');

      if (dir === 'up') fieldObj.top = `${topVal - amt}px`;
      if (dir === 'down') fieldObj.top = `${topVal + amt}px`;
      if (dir === 'left') fieldObj.left = `${leftVal - amt}px`;
      if (dir === 'right') fieldObj.left = `${leftVal + amt}px`;
    });

    onUpdateDB({ card_layout: currentLayout });
  };

  const adjustFontSize = (size: string) => {
    const targets = selectedFields.length > 0 ? selectedFields : (selectedField ? [selectedField] : []);
    if (targets.length === 0) return;
    const currentLayout = { ...dbState.card_layout };
    
    targets.forEach(fKey => {
      if (fKey === 'photo') return;
      let fieldObj = (currentLayout as any)[fKey];
      if (!fieldObj) {
        fieldObj = { left: '165px', top: '150px', fontSize: '14' };
        (currentLayout as any)[fKey] = fieldObj;
      }
      fieldObj.fontSize = size;
    });

    onUpdateDB({ card_layout: currentLayout });
  };

  // Direct Mouse/Touch dragging functions
  const startDragField = (e: React.MouseEvent | React.TouchEvent, fKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    let targets = [...selectedFields];
    if (!targets.includes(fKey)) {
      targets = [fKey];
      setSelectedFields([fKey]);
      setSelectedField(fKey);
    }

    const startX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const startY = 'clientY' in e ? e.clientY : e.touches[0].clientY;

    const initialPositions: { [key: string]: { left: number; top: number } } = {};
    const baseLayout = JSON.parse(JSON.stringify(dbState.card_layout));

    targets.forEach(key => {
      const fObj = baseLayout[key] || { left: '165px', top: '150px' };
      initialPositions[key] = {
        left: parseInt(fObj.left || '10px'),
        top: parseInt(fObj.top || '10px'),
      };
    });

    // Create custom transient layout for buttery-smooth interaction with deep cloning
    let dynamicLayout = JSON.parse(JSON.stringify(dbState.card_layout));

    const onPointerMove = (moveEv: MouseEvent | TouchEvent) => {
      const curX = 'clientX' in moveEv ? moveEv.clientX : (moveEv.touches?.[0]?.clientX || 0);
      const curY = 'clientY' in moveEv ? moveEv.clientY : (moveEv.touches?.[0]?.clientY || 0);

      const dx = curX - startX;
      const dy = curY - startY;

      const nextLayout = JSON.parse(JSON.stringify(dbState.card_layout));
      targets.forEach(key => {
        const init = initialPositions[key];
        let fObj = nextLayout[key];
        if (!fObj) {
          fObj = { left: '165px', top: '150px' };
          nextLayout[key] = fObj;
        }
        if (init) {
          fObj.left = `${init.left + dx}px`;
          fObj.top = `${init.top + dy}px`;
        }
      });

      dynamicLayout = nextLayout;
      setLocalLayout(dynamicLayout);
    };

    const onPointerUp = () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      onUpdateDB({ card_layout: dynamicLayout });
      setLocalLayout(null);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  };

  const alignLeftByTopmost = () => {
    const targets = selectedFields.length > 0 ? selectedFields : ['photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year', 'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'];
    if (targets.length <= 1) return;
    const currentLayout = JSON.parse(JSON.stringify(dbState.card_layout));
    
    let topmostKey: string | null = null;
    let minTop = Infinity;
    
    targets.forEach(key => {
      const fObj = currentLayout[key];
      if (fObj) {
        const topVal = parseInt(fObj.top || '0');
        if (topVal < minTop) {
          minTop = topVal;
          topmostKey = key;
        }
      }
    });

    if (topmostKey) {
      const targetLeft = currentLayout[topmostKey].left || '165px';
      targets.forEach(key => {
        if (!currentLayout[key]) {
          currentLayout[key] = { left: '165px', top: '150px' };
        }
        currentLayout[key].left = targetLeft;
      });
      onUpdateDB({ card_layout: currentLayout });
    }
  };

  const distributeVerticallyEqually = () => {
    // Spacer for student selectable text fields (filtering photo since image dimension shouldn't spread equally with text)
    const targets = selectedFields.filter(k => k !== 'photo');
    if (targets.length < 3) {
      alert('សូមជ្រើសរើសយ៉ាងហោចណាស់ ៣ ព័ត៌មានអក្សរ (Text Elements) ដើម្បីចែកចាយគម្លាតស្មើគ្នា!');
      return;
    }
    const currentLayout = JSON.parse(JSON.stringify(dbState.card_layout));
    
    // Extract and sort by top position
    const fieldTops = targets
      .map(key => {
        const fObj = currentLayout[key] || { left: '165px', top: '150px' };
        return { key, top: parseInt(fObj.top || '150px') };
      })
      .sort((a, b) => a.top - b.top);
      
    const minTop = fieldTops[0].top;
    const maxTop = fieldTops[fieldTops.length - 1].top;
    const totalSpan = maxTop - minTop;
    const gap = totalSpan / (fieldTops.length - 1);
    
    fieldTops.forEach((item, index) => {
      if (!currentLayout[item.key]) {
        currentLayout[item.key] = { left: '165px', top: '150px' };
      }
      currentLayout[item.key].top = `${Math.round(minTop + index * gap)}px`;
    });
    
    onUpdateDB({ card_layout: currentLayout });
  };

  const startResizePhotoCorner = (e: React.MouseEvent | React.TouchEvent, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault();
    e.stopPropagation();

    const startX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const startY = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    const baseLayout = { ...dbState.card_layout };
    
    const initL = parseInt(baseLayout.photo.left || '25px');
    const initT = parseInt(baseLayout.photo.top || '115px');
    const initW = parseInt(baseLayout.photo.width || '120px');
    const initH = parseInt(baseLayout.photo.height || '160px');
    
    const aspectRatio = 3 / 4; // width / height = 0.75

    let dynamicLayout = { ...dbState.card_layout };

    const onPointerMove = (moveEv: MouseEvent | TouchEvent) => {
      const curX = 'clientX' in moveEv ? moveEv.clientX : (moveEv.touches?.[0]?.clientX || 0);
      const curY = 'clientY' in moveEv ? moveEv.clientY : (moveEv.touches?.[0]?.clientY || 0);

      const dx = curX - startX;

      let newWidth = initW;
      let newLeft = initL;
      let newTop = initT;

      if (corner === 'br') {
        newWidth = initW + dx;
      } else if (corner === 'bl') {
        newWidth = initW - dx;
      } else if (corner === 'tr') {
        newWidth = initW + dx;
      } else if (corner === 'tl') {
        newWidth = initW - dx;
      }

      // Constrain width
      if (newWidth < 40) newWidth = 40;
      if (newWidth > 350) newWidth = 350;

      const newHeight = Math.round(newWidth / aspectRatio);

      // Adjust positioning based on which corners are active
      if (corner === 'bl') {
        newLeft = (initL + initW) - newWidth;
      } else if (corner === 'tr') {
        newTop = (initT + initH) - newHeight;
      } else if (corner === 'tl') {
        newLeft = (initL + initW) - newWidth;
        newTop = (initT + initH) - newHeight;
      }

      dynamicLayout = { ...dbState.card_layout };
      dynamicLayout.photo.left = `${newLeft}px`;
      dynamicLayout.photo.top = `${newTop}px`;
      dynamicLayout.photo.width = `${newWidth}px`;
      dynamicLayout.photo.height = `${newHeight}px`;

      setLocalLayout(dynamicLayout);
    };

    const onPointerUp = () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      onUpdateDB({ card_layout: dynamicLayout });
      setLocalLayout(null);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  };

  // Designing Layout Background upload
  const handleBackgroundLayoutChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const extension = file.name.split('.').pop() || 'jpg';
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, name: 'card_bg', ext: extension })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        const updatedLayout = { ...dbState.card_layout, bgImage: resData.url };
        await onUpdateDB({ card_layout: updatedLayout });
      }
    } catch (err) {
      alert('កំហុសបង្ហោះរូបភាពផ្ទៃក្រោយកាត!');
    }
  };

  // Watermarks Save
  const handleSaveWatermark = async () => {
    const newWm: WatermarkSettings = {
      text: wmText,
      size: wmSize,
      opacity: wmOpacity,
      angle: wmAngle,
      color_r: wmR,
      color_g: wmG,
      color_b: wmB,
    };
    await onUpdateDB({ watermark: newWm });
    setShowWatermark(false);
  };

  // Papa CSV Parsing
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let imported = 0;
        let skipped = 0;
        const studentsList: Student[] = [];

        for (const row of results.data as any[]) {
          const sId = row['អត្តលេខ'] || row['ID'] || row['id'];
          const sName = row['គោត្តនាម-នាម'] || row['ឈ្មោះ'] || row['name'] || row['Name'];
          const sGender = row['ភេទ'] || row['Gender'] || row['gender'];
          const sDob = row['ថ្ងៃខែឆ្នាំកំណើត'] || row['DOB'] || row['dob'];
          const sGrade = row['ថ្នាក់ទី'] || row['ថ្នាក់'] || row['Grade'] || row['grade'];

          const sVillage = row['ភូមិ'] || row['Village'] || row['village'] || '';
          const sCommune = row['ឃុំ_សង្កាត់'] || row['ឃុំ'] || row['Commune'] || row['commune'] || '';
          const sDistrict = row['ស្រុក_ខណ្ឌ'] || row['ស្រុក'] || row['District'] || row['district'] || '';
          const sProvince = row['ខេត្ត_ក្រុង'] || row['ខេត្ត'] || row['Province'] || row['province'] || '';

          const sFatherName = row['ឈ្មោះឪពុក'] || '';
          const sFatherJob = row['មុខរបរឪពុក'] || '';
          const sMotherName = row['ឈ្មោះម្ដាយ'] || '';
          const sMotherJob = row['មុខរបរម្ដាយ'] || '';
          const sPhone = row['លេខទូរស័ព្ទអាណាព្យាបាល'] || row['Phone'] || row['phone'] || '';

          if (sId && sName) {
            const hasDuplicate = dbState.students.some((x) => x.id === sId);
            if (!hasDuplicate) {
              studentsList.push({
                id: String(sId).trim(),
                name: String(sName).trim(),
                gender: sGender === 'ស្រី' ? 'ស្រី' : 'ប្រុស',
                dob: String(sDob || '').trim(),
                grade: String(sGrade || '').trim(),
                village: String(sVillage).trim(),
                commune: String(sCommune).trim(),
                district: String(sDistrict).trim(),
                province: String(sProvince).trim(),
                fatherName: String(sFatherName).trim(),
                fatherJob: String(sFatherJob).trim(),
                motherName: String(sMotherName).trim(),
                motherJob: String(sMotherJob).trim(),
                phone: String(sPhone).trim(),
                photo: '',
              });
              imported++;
            } else {
              skipped++;
            }
          }
        }

        if (studentsList.length > 0) {
          if (onPostStudentsBulk) {
            await onPostStudentsBulk(studentsList);
          } else {
            for (const s of studentsList) {
              await onPostStudent(s);
            }
          }
        }

        alert(`នាំចូលសរុប៖ បានបញ្ជូលសិស្សថ្មីចំនួន ${imported} នាក់ និងរំលងស្ទួន ${skipped} នាក់`);
        e.target.value = '';
      },
    });
  };

  const downloadCSVTemplate = () => {
    const csvContent =
      '\ufeffអត្តលេខ,គោត្តនាម-នាម,ភេទ,ថ្ងៃខែឆ្នាំកំណើត,ថ្នាក់ទី,ភូមិ,ឃុំ_សង្កាត់,ស្រុក_ខណ្ឌ,ខេត្ត_ក្រុង,ឈ្មោះឪពុក,មុខរបរឪពុក,ឈ្មោះម្ដាយ,មុខរបរម្ដាយ,លេខទូរស័ព្ទអាណាព្យាបាល\n002,ជា សុជាតិ,ប្រុស,០១-កុម្ភៈ-២០០៨,១២B,ភូមិ១,ឃុំក,ស្រុកខ,ខេត្តគ,ជា សុខ,កសិករ,កែវ ស៊ីណា,មេផ្ទះ,012345678\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'គំរូបញ្ជីឈ្មោះសិស្ស.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Google Drive url setup
  const saveDriveUrl = () => {
    const trimmed = driveUrl.trim();
    localStorage.setItem('drive_script_url', trimmed);
    alert('រក្សាទុក Google Drive Deploy Script URL រួចរាល់!');
  };

  // PDF Multi-generation — Direct Canvas (original bg + photo resolution, PNG lossless)
  const handlePdfGeneration = async () => {
    setPdfProgress(1);
    setPdfStatusMsg('កំពុងដំណើរការ...');

    let targets = [...dbState.students];
    if (pdfScope === 'class') {
      targets = targets.filter((x) => x.grade === pdfClass);
    }

    if (targets.length === 0) {
      alert('មិនរកឃើញសិស្សដើម្បីបោះពុម្ពទេ!');
      setPdfProgress(0);
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [75, 100] });

    for (let i = 0; i < targets.length; i++) {
      const student = targets[i];
      const prog = Math.round(((i + 1) / targets.length) * 100);
      setPdfStatusMsg(`កំពុងគូររូប៖ ${student.name}`);
      setPdfProgress(prog);

      // គូរ Canvas ដោយផ្ទាល់ — original bg & photo resolution, PNG lossless
      const canvas  = await drawCardToCanvas(student, dbState.card_layout);
      const imgData = canvas.toDataURL('image/png');

      if (i > 0) doc.addPage([75, 100], 'portrait');
      doc.addImage(imgData, 'PNG', 0, 0, 75, 100);
    }

    doc.save(pdfScope === 'all' ? 'កាតសិស្សសរុបរួម.pdf' : `កាតសិស្ស_ថ្នាក់_${pdfClass}.pdf`);
    setShowPdfModal(false);
    setPdfProgress(0);
  };

  // ExcelJS Export list with picture attachment support!
  const handleExcelExport = async () => {
    if (dbState.students.length === 0) {
      alert('មិនមានទិន្នន័យសិស្សសម្រាប់នាំចេញទេ!');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('បញ្ជីឈ្មោះសិស្ស');

    worksheet.columns = [
      { header: 'រូបថត', key: 'photo', width: 15 },
      { header: 'អត្តលេខ', key: 'id', width: 15 },
      { header: 'ឈ្មោះសិស្ស', key: 'name', width: 22 },
      { header: 'ភេទ', key: 'gender', width: 10 },
      { header: 'ថ្នាក់ទី', key: 'grade', width: 12 },
      { header: 'ថ្ងៃខែឆ្នាំកំណើត', key: 'dob', width: 18 },
      { header: 'ភូមិ', key: 'village', width: 15 },
      { header: 'ឃុំ/សង្កាត់', key: 'commune', width: 18 },
      { header: 'ស្រុក/ខណ្ឌ', key: 'district', width: 18 },
      { header: 'ខេត្ត/ក្រុង', key: 'province', width: 18 },
      { header: 'ឈ្មោះឪពុក', key: 'fatherName', width: 22 },
      { header: 'មុខរបរឪពុក', key: 'fatherJob', width: 20 },
      { header: 'ឈ្មោះម្ដាយ', key: 'motherName', width: 22 },
      { header: 'មុខរបរម្ដាយ', key: 'motherJob', width: 20 },
      { header: 'លេខទូរស័ព្ទអាណាព្យាបាល', key: 'phone', width: 24 },
    ];

    // Styled headers
    worksheet.getRow(1).height = 30;
    worksheet.getRow(1).font = { name: 'Kantumruy Pro', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F2C59' },
      };
    });

    for (let i = 0; i < dbState.students.length; i++) {
      const student = dbState.students[i];
      const rowNum = i + 2;

      const row = worksheet.addRow({
        id: student.id,
        name: student.name,
        gender: student.gender,
        grade: student.grade,
        dob: student.dob,
        village: student.village,
        commune: student.commune,
        district: student.district,
        province: student.province,
        fatherName: student.fatherName,
        fatherJob: student.fatherJob,
        motherName: student.motherName,
        motherJob: student.motherJob,
        phone: student.phone,
      });

      row.height = 80;
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      // Embedded Photos support (fetches and embeds photos directly in excel rows if local url/base64 exists)
      if (student.photo) {
        try {
          const isBase64 = student.photo.startsWith('data:image');
          let base64Data = '';
          let mimePart = 'jpeg';

          if (isBase64) {
            const parts = student.photo.split(';base64,');
            base64Data = parts[1];
            mimePart = parts[0].split('image/')[1] || 'jpeg';
          } else {
            // Fetch internal static uploaded photo URL
            const fetchRes = await fetch(student.photo);
            const blob = await fetchRes.blob();
            base64Data = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string).split(';base64,')[1]);
              reader.readAsDataURL(blob);
            });
            mimePart = blob.type.split('/')[1] || 'jpeg';
          }

          const imgId = workbook.addImage({
            base64: base64Data,
            extension: mimePart as any || 'jpeg',
          });

          worksheet.addImage(imgId, {
            tl: { col: 0.1, row: rowNum - 1 + 0.1 },
            ext: { width: 75, height: 95 },
          });
        } catch (err) {
          console.error('Cannot embed photo to Excel', err);
        }
      }
    }

    // Auto fit column width
    worksheet.columns.forEach((column) => {
      if (column.key !== 'photo') {
        let maxLen = 12;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          if (cell.value) {
            const len = cell.value.toString().length;
            if (len > maxLen) maxLen = len;
          }
        });
        column.width = Math.min(maxLen + 4, 30);
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'បញ្ជីឈ្មោះសិស្ស_វិទ្យាល័យបឹងព្រះ.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter students based on queries
  const gradesPool = Array.from(new Set(dbState.students.map((x) => x.grade))).sort();
  const provPool = Array.from(new Set(dbState.students.map((x) => x.province))).sort();

  const filteredStudents = dbState.students.filter((student) => {
    const matchesSearch =
      student.id.toLowerCase().includes(filterSearch.toLowerCase()) ||
      student.name.toLowerCase().includes(filterSearch.toLowerCase());
    const matchesGen = filterGender === '' || student.gender === filterGender;
    const matchesGrade = filterGrade === '' || student.grade === filterGrade;
    const matchesProv = filterProv === '' || student.province === filterProv;
    return matchesSearch && matchesGen && matchesGrade && matchesProv;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Admin Bar Options */}
      <div className="bg-white p-5 rounded-xl shadow-xs border-t-4 border-amber-600 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-2 border-b gap-4">
          <h3 className="text-sm md:text-base font-bold text-gray-800 flex items-center font-moul">
            <Settings className="w-5 h-5 mr-1 text-amber-600 animate-spin" />
            គ្រប់គ្រងទិន្នន័យសិស្ស និងការកំណត់
          </h3>
          <div className="flex flex-wrap gap-2 text-white font-battambang text-xs font-semibold">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                resetForm();
              }}
              className="px-3.5 py-2 bg-blue-900 hover:bg-blue-800 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1"
            >
              <UserPlus className="w-4 h-4" /> បញ្ចូលសិស្សដោយផ្ទាល់
            </button>
            <button
              onClick={() => setShowDesigner(!showDesigner)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1"
            >
              <Crop className="w-4 h-4" /> រៀបចំប្លង់កាតសិស្ស
            </button>
            <button
              onClick={() => setShowWatermark(!showWatermark)}
              className="px-3.5 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1"
            >
              <Layers className="w-4 h-4" /> កំណត់ Watermark
            </button>
            <button
              onClick={() => {
                setShowPdfModal(true);
                if (gradesPool.length > 0) setPdfClass(gradesPool[0]);
              }}
              className="px-3.5 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1"
            >
              <FileDown className="w-4 h-4" /> រក្សាទុកកាត (PDF)
            </button>
            <button
              onClick={handleExcelExport}
              className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1"
            >
              <FileSpreadsheet className="w-4 h-4" /> ទាញយកជា Excel
            </button>
            <button
              onClick={downloadCSVTemplate}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-500 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1"
            >
              <FileSpreadsheet className="w-4 h-4" /> ឯកសារគំរូ CSV
            </button>
            <button
              onClick={() => {
                const totalCount = dbState.students.length;
                const filteredCount = filteredStudents.length;
                const isFilteredActive = filteredCount < totalCount;

                setConfirmModal({
                  isOpen: true,
                  title: isFilteredActive ? 'ជម្រើសលុបទិន្នន័យសិស្ស' : 'លុបទិន្នន័យសិស្សទាំងអស់',
                  description: isFilteredActive 
                    ? `តើអ្នកចង់លុបសិស្សទាំងអស់ពីក្នុងប្រព័ន្ធ (សរុប ${totalCount} នាក់) ឬលុបតែសិស្សដែលកំពុងចម្រោះច្បាស់លាស់ (${filteredCount} នាក់)?`
                    : `តើអ្នកពិតជាចង់លុបទិន្នន័យសិស្សទាំងអស់ចេញពីក្នុងប្រព័ន្ឋចំនួន ${totalCount} នាក់មែនទេ? សកម្មភាពនេះមិនអាចបង្កើតឡើងវិញបានទេ!`,
                  actionType: isFilteredActive ? 'delete-filtered' : 'delete-all',
                  requireInputWord: 'DELETE'
                });
                setDeleteInputText('');
              }}
              className="px-3.5 py-2 bg-red-700 hover:bg-red-650 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1 font-battambang font-bold"
            >
              <Trash2 className="w-4 h-4" /> លុបសិស្ស
            </button>
            <button
              onClick={() => setShowAdminSettings(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition shadow-3xs cursor-pointer flex items-center gap-1 font-battambang font-bold"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" /> គ្រប់គ្រងគណនី Admin
            </button>
          </div>
        </div>
      </div>

      {/* 1.5. BACKUP & IMPORT LOCAL snapshot FILE */}
      <div className="bg-white p-5 rounded-xl shadow-xs border-t-4 border-indigo-600 space-y-4 font-battambang">
        <h3 className="text-sm font-bold text-gray-800 flex items-center font-moul">
          <Upload className="w-5 h-5 mr-1.5 text-indigo-600 animate-bounce" />
          ប្រព័ន្ធរក្សាទុក និងនាំចូលទិន្នន័យសរុបរួម (Full Backup & Import System)
        </h3>
        <p className="text-xs text-gray-500 font-medium leading-relaxed">
          មុខងារការពារការបាត់បង់ទិន្នន័យ៖ អ្នកអាចទាញយក ឬស្តារឡើងវិញនូវរាល់ទិន្នន័យទាំងអស់ រួមមាន៖ បញ្ជីឈ្មោះសិស្ស, រូបថតសិស្ស (3x4), ប្លង់រៀបចំកាតសិស្ស, រូបភាពផ្ទៃក្រោយកាត, Logo សាលា, រូបភាព سلាយ (Home Slides) និងរាល់ការបង្ហោះទាំងអស់ ទៅជាឯកសារតែមួយគត់នៅលើកុំព្យូទ័ររបស់អ្នក ដើម្បីងាយស្រួលផ្ទេរ ឬស្តារឡើងវិញគ្រប់ពេលវេលា!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Backup Button Container */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <span className="font-bold text-[#0f2c59] block text-xs">១. ទាញយកឯកសារបម្រុងទុក (Export Backup File)</span>
            <p className="text-[11px] text-gray-400">
              រក្សាទុកទិន្នន័យសាលា និងរូបភាពទាំងអស់ទៅជាឯកសារគំរូ <code className="bg-white px-1 py-0.5 border rounded text-rose-500 font-mono">.schoolbak</code>។
            </p>
            <button
              type="button"
              onClick={handleExportFullBackup}
              disabled={isExportingBak}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:bg-gray-400"
            >
              <Download className="w-4 h-4" />
              {isExportingBak ? 'កំពុងចងក្រងទិន្នន័យ...' : 'ទាញយក Backup សរុបរួម (.schoolbak)'}
            </button>
          </div>

          {/* Import Button Container */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <span className="font-bold text-emerald-800 block text-xs">២. នាំចូលឯកសារពី Backup (Import / Restore Backup)</span>
            <p className="text-[11px] text-gray-400">
              ជ្រើសរើសឯកសារ <code className="bg-white px-1 py-0.5 border rounded text-rose-500 font-mono">.schoolbak</code> ដែលអ្នកបានទាញយក ដើម្បីស្តារទិន្នន័យឡើងវិញ។ <span className="text-red-500 font-bold">*បញ្ជាក់៖ វានឹងជំនួសទិន្នន័យបច្ចុប្បន្ន!</span>
            </p>
            
            <div className="flex items-center gap-2">
              <label className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer select-none">
                <Upload className="w-4 h-4" />
                <span>ជ្រើសរើសឯកសារដើម្បីស្តារ</span>
                <input
                  type="file"
                  accept=".schoolbak,.json"
                  onChange={handleImportFullBackup}
                  disabled={isImportingBak}
                  className="hidden"
                />
              </label>
              {isImportingBak && (
                <span className="text-xs text-emerald-600 font-bold animate-pulse">
                  កំពុងស្តារឡើងវិញ...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. ADD / EDIT MANUAL STUDENT FORM */}
      {showAddForm && (
        <div className="bg-white p-5 rounded-xl shadow-xs border-t-4 border-blue-600 space-y-4 animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-gray-800 font-moul">
            {isEditing ? 'កែសម្រួលព័ត៌មានសិស្ស' : 'បញ្ចូលព័ត៌មានសិស្សថ្មី'}
          </h3>
          <form onSubmit={handleStudentSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 font-battambang text-xs text-slate-700">
            <div>
              <label className="block text-gray-500 font-bold mb-1">អត្តលេខសិស្ស *</label>
              <input
                type="text"
                required
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="ឧ. 001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white"
              />
            </div>
            <div>
              <label className="block text-gray-500 font-bold mb-1">គោត្តនាម-នាម *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ឧ. ស៊ន សុភ័ក្ត្រ"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white"
              />
            </div>
            <div>
              <label className="block text-gray-500 font-bold mb-1">ភេទ *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white"
              >
                <option value="ប្រុស">ប្រុស</option>
                <option value="ស្រី">ស្រី</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-500 font-bold mb-1">ថ្ងៃខែឆ្នាំកំណើត * <span className="text-[10px] text-blue-800">(dd/mm/yyyy)</span></label>
              <input
                type="text"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="ឧ. ១៥/០១/២០០៨"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white"
              />
            </div>
            <div>
              <label className="block text-[#af5b00] font-bold mb-1">ថ្នាក់ទី * (ជ្រើសរើស/កែបាន)</label>
              <EditableSelect
                required
                value={grade}
                onChange={setGrade}
                options={existingGrades}
                placeholder="ឧ. ១២A"
              />
            </div>

            <div className="md:col-span-3 border-t pt-3 space-y-1">
              <span className="font-bold text-gray-650 block mb-1">ទីកន្លែងកំណើត (ជ្រើសរើស/កែបាន)</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <EditableSelect
                    value={village}
                    onChange={setVillage}
                    options={existingVillages}
                    placeholder="ភូមិ"
                  />
                </div>
                <div>
                  <EditableSelect
                    value={commune}
                    onChange={setCommune}
                    options={existingCommunes}
                    placeholder="ឃុំ/សង្កាត់"
                  />
                </div>
                <div>
                  <EditableSelect
                    value={district}
                    onChange={setDistrict}
                    options={existingDistricts}
                    placeholder="ស្រុក/ខណ្ឌ"
                  />
                </div>
                <div>
                  <EditableSelect
                    value={province}
                    onChange={setProvince}
                    options={existingProvinces}
                    placeholder="ខេត្ត/ក្រុង"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-3 border-t pt-3 space-y-1">
              <span className="font-bold text-gray-650 block mb-2">ព័ត៌មានអាណាព្យាបាល</span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="ឈ្មោះឪពុក"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white h-[38px]"
                />
                <div>
                  <EditableSelect
                    value={fatherJob}
                    onChange={setFatherJob}
                    options={allJobs}
                    placeholder="មុខរបរឪពុក"
                  />
                </div>
                <input
                  type="text"
                  placeholder="ឈ្មោះម្តាយ"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white h-[38px]"
                />
                <div>
                  <EditableSelect
                    value={motherJob}
                    onChange={setMotherJob}
                    options={allJobs}
                    placeholder="មុខរបរម្តាយ"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-500 font-bold mb-1">លេខទូរស័ព្ទអាណាព្យាបាល</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="ឧ. 012345678"
                className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-gray-500 font-bold mb-1">រូបថតសិស្ស (3x4)</label>
              <div className="flex flex-col gap-2 border p-3 rounded-lg bg-gray-50 border-gray-200">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 font-battambang">
                    <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer select-none">
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                      <span>ជ្រើសរូបថត</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFormPhotoChange}
                        className="hidden"
                      />
                    </label>

                    <span className="text-[10px] text-gray-400 font-battambang px-1">ឬ</span>

                    {!isCameraOpen ? (
                      <button
                        type="button"
                        onClick={() => startCamera('environment')}
                        className="px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-900 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-green-600" />
                        <span>បើកកាមេរ៉ា</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 text-red-600" />
                        <span>បិទកាមេរ៉ា</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Viewfinder Overlay inside the form for high-speed student photo snap */}
                {isCameraOpen && (
                  <div className="relative border-2 border-green-500 rounded-lg overflow-hidden bg-black flex flex-col items-center shadow-md animate-in zoom-in-95 duration-200">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-[220px] object-cover"
                    />
                    
                    {/* Grid Overlay for 3x4 photo centering guideline */}
                    <div className="absolute inset-0 border border-white/10 pointer-events-none flex flex-col justify-between p-4">
                      <div className="flex justify-between w-full">
                        <div className="w-4 h-4 border-t-2 border-l-2 border-yellow-400"></div>
                        <div className="w-4 h-4 border-t-2 border-r-2 border-yellow-400"></div>
                      </div>
                      <div className="self-center w-28 h-36 border border-dashed border-yellow-400/50 rounded-md bg-yellow-400/5"></div>
                      <div className="flex justify-between w-full">
                        <div className="w-4 h-4 border-b-2 border-l-2 border-yellow-400"></div>
                        <div className="w-4 h-4 border-b-2 border-r-2 border-yellow-400"></div>
                      </div>
                    </div>

                    <div className="p-2 w-full bg-slate-900 flex justify-between gap-1 select-none z-10">
                      <button
                        type="button"
                        onClick={toggleCamera}
                        className="px-2.5 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 text-white rounded font-bold cursor-pointer font-battambang"
                      >
                        🔄 ប្តូរកាមេរ៉ា
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-3 py-1 text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold rounded-lg animate-pulse cursor-pointer font-battambang flex items-center gap-1"
                      >
                        📸 ថតរូបសិស្ស
                      </button>
                    </div>
                  </div>
                )}

                {photo && (
                  <div className="mt-2 flex items-center gap-2.5 bg-white p-2 border rounded-md border-gray-150 shadow-xs">
                    <img src={photo} className="w-10 h-12 border object-cover rounded shadow-xs" alt="Form preview" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-green-600 font-bold font-battambang">✓ បញ្ចូលរួចរាល់ ( compressed )</span>
                      <button
                        type="button"
                        onClick={() => setPhoto('')}
                        className="text-red-500 hover:text-red-650 text-[10px] font-bold text-left hover:underline mt-0.5 font-battambang cursor-pointer"
                      >
                        លុប
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-3 flex justify-end gap-2.5 border-t pt-3 font-battambang">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg cursor-pointer"
              >
                បិទ
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-black font-semibold rounded-lg cursor-pointer"
              >
                សម្អាត Form
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg cursor-pointer"
              >
                {isEditing ? 'រក្សាទុកការកែសម្រួល' : 'រក្សាទុក'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. CARD LAYOUT DESIGNER SECTION */}
      {showDesigner && (
        <div className="bg-white p-5 rounded-xl shadow-xs border-t-4 border-amber-500 space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-sm font-bold text-gray-800 font-moul">កែសម្រួលប្លង់កាតសិស្ស (Layout Editor)</h3>
            <button
              onClick={() => setShowDesigner(false)}
              className="text-xs text-red-500 hover:underline font-bold font-battambang"
            >
              បិទប្លង់
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-gray-700 font-battambang">
            {/* Controls Side sidebar */}
            <div className="lg:col-span-5 space-y-3 bg-slate-50 p-4 border rounded-xl">
              <div>
                <label className="block font-bold text-gray-600 mb-1">១. រូបភាពផ្ទៃក្រោយកាត (Card JPG/PNG)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundLayoutChange}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border file:text-[10px] file:bg-white"
                />
              </div>

              <div className="border-t pt-2 space-y-2">
                <span className="font-bold text-[#0f2c59] block mb-1">២. ប្ដូរឆ្នាំសិក្សាកាតសម្គាល់</span>
                <input
                  type="text"
                  value={dbState.card_layout.academicYear}
                  onChange={(e) => {
                    const updated = { ...dbState.card_layout, academicYear: e.target.value };
                    onUpdateDB({ card_layout: updated });
                  }}
                  placeholder="2025-2026"
                  className="w-full px-3 py-1.5 border rounded-lg text-xs text-black bg-white"
                />
              </div>

              <div className="border-t pt-2 space-y-2">
                <span className="font-bold text-gray-600 block">៣. ជ្រើសរើសព័ត៌មានដែលត្រូវបង្ហាញលើកាត (Show/Hide)</span>
                <div className="grid grid-cols-2 gap-1 bg-white p-2 border rounded-lg">
                  {[
                    { k: 'photo', n: 'រូបថតសិស្ស' },
                    { k: 'id', n: 'អត្តលេខ' },
                    { k: 'name', n: 'ឈ្មោះសិស្ស' },
                    { k: 'gender', n: 'ភេទ' },
                    { k: 'nationality', n: 'សញ្ជាតិ' },
                    { k: 'dob', n: 'ថ្ងៃកំណើត' },
                    { k: 'grade', n: 'ថ្នាក់ទី' },
                    { k: 'year', n: 'ឆ្នាំសិក្សា' },
                    { k: 'addressLocal', n: 'ភូមិ និងឃុំ' },
                    { k: 'addressRegion', n: 'ស្រុក និងខេត្ត' },
                    { k: 'fatherName', n: 'ឈ្មោះឪពុក' },
                    { k: 'motherName', n: 'ឈ្មោះម្ដាយ' },
                    { k: 'issueDate', n: 'កាលបរិច្ឆេទចេញកាត' }
                  ].map(item => {
                    const currentLayout = dbState.card_layout;
                    const visibleFields = currentLayout.visibleFields || [
                      'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
                      'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
                    ];
                    const isVisible = visibleFields.includes(item.k);
                    
                    return (
                      <label key={`vis-${item.k}`} className="flex items-center gap-1.5 p-1 cursor-pointer select-none text-[10px] hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={(e) => {
                            let updatedFields = [...visibleFields];
                            if (e.target.checked) {
                              if (!updatedFields.includes(item.k)) updatedFields.push(item.k);
                            } else {
                              updatedFields = updatedFields.filter(val => val !== item.k);
                            }
                            const updatedLayout = { ...currentLayout, visibleFields: updatedFields };
                            onUpdateDB({ card_layout: updatedLayout });
                          }}
                          className="accent-green-600 w-3.5 h-3.5"
                        />
                        <span className={isVisible ? "font-bold text-green-700" : "text-gray-400"}>{item.n}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-2 space-y-2">
                <span className="font-bold text-gray-650 block">៤. ជ្រើសរើសចម្រាញ់ធាតុដែលត្រូវកែតម្រឹម (Select element to edit)</span>
                <select
                  value={selectedField || ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setSelectedField(val);
                    setSelectedFields(val ? [val] : []);
                  }}
                  className="w-full p-2 border rounded-xl bg-white text-black text-xs font-semibold"
                >
                  <option value="">-- សូមជ្រើសរើសធាតុមួយ --</option>
                  <option value="photo">រូបថតសិស្ស (3x4)</option>
                  <option value="id">អត្តលេខ</option>
                  <option value="name">ឈ្មោះសិស្ស</option>
                  <option value="gender">ភេទ</option>
                  <option value="nationality">សញ្ជាតិ</option>
                  <option value="dob">ថ្ងៃខែឆ្នាំកំណើត</option>
                  <option value="grade">ថ្នាក់ទី</option>
                  <option value="year">ឆ្នាំសិក្សា</option>
                  <option value="addressLocal">ភូមិ និងឃុំ (រួមគ្នា)</option>
                  <option value="addressRegion">ស្រុក និងខេត្ត (រួមគ្នា)</option>
                  <option value="fatherName">ឈ្មោះឪពុក</option>
                  <option value="motherName">ឈ្មោះម្ដាយ</option>
                  <option value="issueDate">កាលបរិច្ឆេទចេញកាត</option>
                </select>

                <div className="pt-2 space-y-1">
                  <span className="font-bold text-gray-500 block text-[11px] mb-1">ជ្រើសរើសធាតុរួមគ្នា (Multi-select)៖</span>
                  <div className="grid grid-cols-2 gap-1 bg-white p-2 border rounded-lg">
                    {[
                      { k: 'photo', n: 'រូបថតសិស្ស' },
                      { k: 'id', n: 'អត្តលេខ' },
                      { k: 'name', n: 'ឈ្មោះសិស្ស' },
                      { k: 'gender', n: 'ភេទ' },
                      { k: 'nationality', n: 'សញ្ជាតិ' },
                      { k: 'dob', n: 'ថ្ងៃកំណើត' },
                      { k: 'grade', n: 'ថ្នាក់ទី' },
                      { k: 'year', n: 'ឆ្នាំសិក្សា' },
                      { k: 'addressLocal', n: 'ភូមិ និងឃុំ' },
                      { k: 'addressRegion', n: 'ស្រុក និងខេត្ត' },
                      { k: 'fatherName', n: 'ឈ្មោះឪពុក' },
                      { k: 'motherName', n: 'ឈ្មោះម្ដាយ' },
                      { k: 'issueDate', n: 'កាលបរិច្ឆេទចេញកាត' }
                    ].map(item => {
                      const active = selectedFields.includes(item.k);
                      return (
                        <label key={item.k} className="flex items-center gap-1.5 p-1 cursor-pointer select-none text-[10px] hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) => {
                              let updated = [...selectedFields];
                              if (e.target.checked) {
                                if (!updated.includes(item.k)) updated.push(item.k);
                              } else {
                                updated = updated.filter(val => val !== item.k);
                              }
                              setSelectedFields(updated);
                              setSelectedField(updated[0] || null);
                            }}
                            className="accent-amber-500 w-3.5 h-3.5"
                          />
                          <span className={active ? "font-bold text-blue-700" : ""}>{item.n}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-2.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const keys = ['photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year', 'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'];
                        setSelectedFields(keys);
                        setSelectedField(keys[0]);
                      }}
                      className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-bold rounded cursor-pointer font-battambang"
                    >
                      ជ្រើសរើសទាំងអស់
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFields([]);
                        setSelectedField(null);
                      }}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded cursor-pointer font-battambang"
                    >
                      សម្អាតទាំងអស់
                    </button>
                  </div>
                </div>
              </div>

              {(selectedField || selectedFields.length > 0) && (
                <div className="bg-white p-3 rounded-lg border shadow-3xs space-y-3">
                  <div className="text-[11px] font-bold text-blue-700 font-battambang">
                    ធាតុសកម្ម៖ {(() => {
                    const activeList = selectedFields.length > 0 ? selectedFields : [selectedField];
                    return activeList.join(', ').toUpperCase();
                  })()}
                  </div>

                  {/* Positioning directions for Android, iOS mobile touch support! */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-400 block text-center mb-1">
                      ប៊ូតុងចុចតម្រឹមភីកសែល (គាំទ្រទូរស័ព្ទ Android/iOS ទោះគ្មានកណ្ដុរ)
                    </span>
                    <div className="flex justify-center">
                      <button
                        onClick={() => adjustFieldPos('up', 2)}
                        className="p-1.5 bg-slate-100 border rounded hover:bg-slate-200 cursor-pointer"
                      >
                        <ChevronUp className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <div className="flex justify-center gap-5">
                      <button
                        onClick={() => adjustFieldPos('left', 2)}
                        className="p-1.5 bg-slate-100 border rounded hover:bg-slate-200 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => adjustFieldPos('right', 2)}
                        className="p-1.5 bg-slate-100 border rounded hover:bg-slate-200 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => adjustFieldPos('down', 2)}
                        className="p-1.5 bg-slate-100 border rounded hover:bg-slate-200 cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {/* Auto Alignment Actions */}
                  <div className="border-t pt-2.5 space-y-1.5 font-battambang">
                    <span className="text-[10px] text-gray-500 font-bold block">ការតម្រឹមស្វ័យប្រវត្តំ (Auto Alignment)៖</span>
                    <button
                      type="button"
                      onClick={() => alignLeftByTopmost()}
                      className="w-full py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-md text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98] mb-1.5"
                    >
                      <AlignLeft className="w-3.5 h-3.5" /> តម្រឹមខាងឆ្វេង (យកខាងលើជាគោល)
                    </button>
                    <button
                      type="button"
                      onClick={() => distributeVerticallyEqually()}
                      className="w-full py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-md text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98]"
                    >
                      <AlignJustify className="w-3.5 h-3.5" /> ចែកគម្លាតលើក្រោមស្មើគ្នា (Vertical Spacing)
                    </button>
                  </div>

                  {/* Size adjustments */}
                  {selectedField !== 'photo' ? (
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">ទំហំអក្សរ (Font Size px)</label>
                      <input
                        type="range"
                        min="10"
                        max="32"
                        value={((dbState.card_layout as any)[selectedField || 'name'] || { fontSize: '14' }).fontSize || '14'}
                        onChange={(e) => adjustFontSize(e.target.value)}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <label className="block text-[10px] text-gray-500 mb-1 font-bold">ទំហំទទឹងរូបថត (Photo Width) - {parseInt(dbState.card_layout.photo.width || '120')}px</label>
                       <input
                         type="range"
                         min="50"
                         max="250"
                         value={parseInt(dbState.card_layout.photo.width || '120')}
                         onChange={(e) => {
                           const w = parseInt(e.target.value);
                           const h = Math.round(w * (4 / 3)); // 3:4 aspect ratio locked to prevent warping!
                           const updated = { ...dbState.card_layout };
                           updated.photo.width = `${w}px`;
                           updated.photo.height = `${h}px`;
                           onUpdateDB({ card_layout: updated });
                         }}
                         className="w-full accent-amber-500 cursor-pointer"
                       />
                       <span className="block text-[10px] text-emerald-600 font-bold font-battambang">🔒 រក្សាទម្រង់សមាមាត្ររូបថត 3:4 (មិនឲ្យខូចទ្រង់ទ្រាយ) - កម្ពស់ {parseInt(dbState.card_layout.photo.height || '160')}px</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Simulated Live visual preview card frame - 50% Larger Visuals (scaled up) */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center relative" style={{ minHeight: '850px' }}>
              
              <div className="relative overflow-visible flex items-center justify-center" style={{ width: '562.5px', height: '750px' }}>
                <div style={{ transform: 'scale(1.5)', transformOrigin: 'center center' }} className="relative text-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
                  <div
                    id="designer-card-render"
                    className="student-card-size bg-white relative overflow-hidden"
                    style={
                      (() => {
                        const currentLayout = localLayout || dbState.card_layout;
                        return currentLayout.bgImage
                          ? {
                              backgroundImage: `url(${currentLayout.bgImage})`,
                              backgroundSize: `${currentLayout.bgSizeWidth || '100'}% ${
                                currentLayout.bgSizeHeight || '100'
                              }%`,
                              backgroundPosition: `${currentLayout.bgPositionX || '0'}px ${
                                currentLayout.bgPositionY || '0'
                              }px`,
                              backgroundRepeat: 'no-repeat',
                            }
                          : { backgroundColor: '#ffffff' };
                      })()
                    }
                  >
                    {/* Photo mockup */}
                    {(() => {
                      const currentLayout = localLayout || dbState.card_layout;
                      const visibleFields = currentLayout.visibleFields || [
                        'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
                        'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
                      ];
                      if (!visibleFields.includes('photo')) return null;
                      
                      const isSelected = selectedFields.includes('photo') || selectedField === 'photo';
                      return (
                        <div
                          onClick={(e) => {
                            let updated = [...selectedFields];
                            if (updated.includes('photo')) {
                              updated = updated.filter(val => val !== 'photo');
                            } else {
                              updated.push('photo');
                            }
                            setSelectedFields(updated);
                            setSelectedField(updated[0] || null);
                          }}
                          onMouseDown={(e) => startDragField(e, 'photo')}
                          onTouchStart={(e) => startDragField(e, 'photo')}
                          className={`absolute font-battambang select-none overflow-hidden z-20 cursor-grab ${
                            isSelected ? 'ring-2 ring-blue-500 ring-offset-2 border-dashed border-blue-400 bg-blue-50/20' : ''
                          }`}
                          style={{
                            left: currentLayout.photo.left,
                            top: currentLayout.photo.top,
                            width: currentLayout.photo.width || '120px',
                            height: currentLayout.photo.height || '160px',
                          }}
                        >
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center relative">
                            <span className="text-[10px] text-gray-500 font-bold">រូបថត mockup</span>
                            {isSelected && (
                              <>
                                {/* Top-Left */}
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); startResizePhotoCorner(e, 'tl'); }}
                                  onTouchStart={(e) => { e.stopPropagation(); startResizePhotoCorner(e, 'tl'); }}
                                  className="absolute top-0 left-0 w-3.5 h-3.5 bg-blue-600 hover:bg-blue-500 cursor-nwse-resize rounded-full border border-white z-30 shadow-sm transform -translate-x-1/2 -translate-y-1/2"
                                  title="អូសពង្រីក-បង្រួម (ឆ្វេង-លើ)"
                                />
                                {/* Top-Right */}
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); startResizePhotoCorner(e, 'tr'); }}
                                  onTouchStart={(e) => { e.stopPropagation(); startResizePhotoCorner(e, 'tr'); }}
                                  className="absolute top-0 right-0 w-3.5 h-3.5 bg-blue-600 hover:bg-blue-500 cursor-nesw-resize rounded-full border border-white z-30 shadow-sm transform translate-x-1/2 -translate-y-1/2"
                                  title="អូសពង្រីក-បង្រួម (ស្តាំ-លើ)"
                                />
                                {/* Bottom-Left */}
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); startResizePhotoCorner(e, 'bl'); }}
                                  onTouchStart={(e) => { e.stopPropagation(); startResizePhotoCorner(e, 'bl'); }}
                                  className="absolute bottom-0 left-0 w-3.5 h-3.5 bg-blue-600 hover:bg-blue-500 cursor-nesw-resize rounded-full border border-white z-30 shadow-sm transform -translate-x-1/2 translate-y-1/2"
                                  title="អូសពង្រីក-បង្រួម (ឆ្វេង-ក្រោម)"
                                />
                                {/* Bottom-Right */}
                                <div
                                  onMouseDown={(e) => { e.stopPropagation(); startResizePhotoCorner(e, 'br'); }}
                                  onTouchStart={(e) => { e.stopPropagation(); startResizePhotoCorner(e, 'br'); }}
                                  className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-blue-600 hover:bg-blue-500 cursor-nwse-resize rounded-full border border-white z-30 shadow-sm transform translate-x-1/2 translate-y-1/2"
                                  title="អូសពង្រីក-បង្រួម (ស្តាំ-ក្រោម)"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Rest text Mockups - Renders only raw data field values, NO labels at all */}
                    {['id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year', 'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'].map((key) => {
                      const currentLayout = localLayout || dbState.card_layout;
                      const visibleFields = currentLayout.visibleFields || [
                        'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
                        'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
                      ];
                      if (!visibleFields.includes(key)) return null;

                      const fConfig = currentLayout[key] || { left: '165px', top: '150px', fontSize: '14' };
                      
                      const value = {
                        id: '01',
                        name: 'ឆាន កញ្ញា',
                        gender: 'ស្រី',
                        nationality: 'ខ្មែរ',
                        dob: '០១ កញ្ញា 2008',
                        grade: '12A',
                        year: currentLayout.academicYear || '2025-2026',
                        addressLocal: 'ភូមិដីថុយ ឃុំបឹងព្រះ',
                        addressRegion: 'ស្រុកបាភ្នំ ខេត្តព្រៃវែង',
                        fatherName: 'យាប ឆាន',
                        motherName: 'ញិល នាប',
                        issueDate: formatKhmerIssueDate('វិទ្យាល័យបឹងព្រះ', new Date(2026, 10, 2))
                      }[key];

                      const isSelected = selectedFields.includes(key) || selectedField === key;
                      return (
                        <div
                          key={key}
                          onClick={(e) => {
                            e.stopPropagation();
                            let updated = [...selectedFields];
                            if (updated.includes(key)) {
                              updated = updated.filter(val => val !== key);
                            } else {
                              updated.push(key);
                            }
                            setSelectedFields(updated);
                            setSelectedField(updated[0] || null);
                          }}
                          onMouseDown={(e) => startDragField(e, key)}
                          onTouchStart={(e) => startDragField(e, key)}
                          className={`absolute font-battambang select-none z-20 font-bold whitespace-nowrap px-1 rounded border border-transparent cursor-grab ${
                            isSelected ? 'text-blue-700 border-dashed border-blue-400 bg-blue-50/50 scale-102 shadow-xs' : 'hover:bg-slate-50'
                          }`}
                          style={{
                            left: fConfig.left,
                            top: fConfig.top,
                            fontSize: `${fConfig.fontSize || '14'}px`,
                            lineHeight: 1.2,
                          }}
                        >
                          <span className="text-blue-800">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. WATERMARK EDIT PANEL */}
      {showWatermark && (
        <div className="bg-white p-5 rounded-xl shadow-xs border-t-4 border-cyan-600 space-y-4 animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-gray-800 font-moul">កំណត់ Watermark លើកាតសិស្ស</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-battambang text-xs text-gray-700">
            <div className="space-y-3">
              <div>
                <label className="block text-gray-500 font-bold mb-1">អក្សរ Watermark (ឧ. ថតចម្លង)</label>
                <input
                  type="text"
                  value={wmText}
                  onChange={(e) => setWmText(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-sm text-black bg-white"
                />
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1">ទំហំអក្សរ: {wmSize}px</label>
                <input
                  type="range"
                  min="10"
                  max="80"
                  value={wmSize}
                  onChange={(e) => setWmSize(e.target.value)}
                  className="w-full accent-cyan-600"
                />
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1">ភាពច្បាស់ (Opacity): {wmOpacity}%</label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={wmOpacity}
                  onChange={(e) => setWmOpacity(e.target.value)}
                  className="w-full accent-cyan-600"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-gray-500 font-bold mb-1">មុំបង្វិលអក្សរ (Angle): {wmAngle}°</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={wmAngle}
                  onChange={(e) => setWmAngle(e.target.value)}
                  className="w-full accent-cyan-600"
                />
              </div>

              <div className="space-y-2 font-battambang">
                <span className="block font-bold text-gray-500 text-xs">ជ្រើសរើសពណ៌ស្ដង់ដារ (Standard Colors)</span>
                <div className="grid grid-cols-2 gap-2">
                  {standardColors.map((c) => {
                    const isSelected = wmR === c.r && wmG === c.g && wmB === c.b;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          setWmR(c.r);
                          setWmG(c.g);
                          setWmB(c.b);
                        }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition select-none cursor-pointer ${
                          isSelected ? 'border-cyan-600 bg-cyan-50/50 ring-1 ring-cyan-500' : 'border-gray-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                        <span className="text-[10px] font-bold text-gray-700">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                  <span className="text-[10px] text-gray-500">ពណ៌បច្ចុប្បន្ន៖</span>
                  <div
                    className="w-12 h-5 border rounded shadow-3xs"
                    style={{ backgroundColor: `rgb(${wmR},${wmG},${wmB})` }}
                  />
                  <span className="text-[9px] font-mono text-gray-400">RGB({wmR}, {wmG}, {wmB})</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 text-xs font-battambang pt-3 border-t">
            <button
              onClick={() => setShowWatermark(false)}
              className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-black font-semibold rounded-lg cursor-pointer"
            >
              បោះបង់
            </button>
            <button
              onClick={handleSaveWatermark}
              className="px-4 py-2 bg-cyan-700 text-white rounded-lg hover:bg-cyan-600 font-bold cursor-pointer"
            >
              កែប្រែ / រក្សាទុក
            </button>
          </div>
        </div>
      )}

      {/* 5. PDF BULK EXPORT SCOPISTS */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[999] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-2xl border relative text-black animate-in fade-in duration-200 font-battambang text-xs">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h3 className="font-bold text-gray-800 text-sm font-moul">រក្សាទុកកាតសិស្សជា PDF</h3>
              <button
                onClick={() => {
                  if (pdfProgress === 0) setShowPdfModal(false);
                }}
                className="text-gray-500 hover:text-black font-bold"
              >
                X
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="radio"
                    name="pdf-sc"
                    checked={pdfScope === 'all'}
                    onChange={() => setPdfScope('all')}
                    className="w-4 h-4 text-blue-900"
                  />
                  <span>ទាញយកកាតសិស្សទាំងអស់ ({dbState.students.length} នាក់)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="radio"
                    name="pdf-sc"
                    checked={pdfScope === 'class'}
                    onChange={() => setPdfScope('class')}
                    className="w-4 h-4 text-blue-900"
                  />
                  <span>ទាញយកតាមថ្នាក់រៀន</span>
                </label>
              </div>

              {pdfScope === 'class' && (
                <div className="pl-6 animate-in slide-in-from-top-1 duration-150">
                  <span className="block text-gray-500 mb-1 font-semibold">ជ្រើសរើសថ្នាក់រៀន៖</span>
                  <select
                    value={pdfClass}
                    onChange={(e) => setPdfClass(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white text-black font-bold"
                  >
                    {gradesPool.map((g, i) => (
                      <option key={i} value={g}>
                        ថ្នាក់ {g}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {pdfProgress > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg border space-y-2">
                  <div className="flex justify-between font-bold text-gray-600">
                    <span className="truncate max-w-[150px]">{pdfStatusMsg}</span>
                    <span>{pdfProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-600 h-full transition-all duration-200"
                      style={{ width: `${pdfProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t pt-3 mt-4">
              <button
                disabled={pdfProgress > 0}
                onClick={() => setShowPdfModal(false)}
                className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-black font-semibold rounded-lg disabled:opacity-50"
              >
                បោះបង់
              </button>
              <button
                disabled={pdfProgress > 0}
                onClick={handlePdfGeneration}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-lg font-bold disabled:bg-gray-400"
              >
                {pdfProgress > 0 ? 'កំពុងគូរ...' : 'ចាប់ផ្តើម PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADVANCED CSV DROP IMPORT */}
      <div className="bg-white p-5 rounded-xl shadow-xs border-t-4 border-green-600">
        <h3 className="text-sm font-bold text-gray-800 mb-3 font-moul">នាំចូលទិន្នន័យសិស្ស (Import CSV)</h3>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center hover:border-green-500 transition relative bg-slate-50">
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <p className="text-xs text-gray-600 font-battambang font-medium">
            ចុច ឬទាញឯកសារ CSV មកដាក់ទីនេះដើម្បីបន្ថែមសិស្សជាក្រុមភ្លាមៗ
          </p>
        </div>
      </div>

      {/* 7. STUDENT LIST TABLE & FILTER GRIDS */}
      <div className="bg-white p-5 rounded-xl shadow-xs border-t-4 border-blue-900 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-2 border-b gap-4 font-battambang">
          <h3 className="text-sm md:text-base font-bold text-gray-800 font-moul">បញ្ជីរាយនាមសិស្សក្នុងប្រព័ន្ធ</h3>
          
          <div className="flex flex-wrap items-center gap-2 text-black w-full lg:w-auto text-xs font-semibold">
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="ស្វែងរកអត្តលេខ/ឈ្មោះ..."
              className="px-3 py-1.5 border rounded-lg bg-white text-black max-w-[150px]"
            />
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="px-2.5 py-1.5 border rounded-lg bg-white text-black"
            >
              <option value="">ភេទទាំងអស់</option>
              <option value="ប្រុស">ប្រុស</option>
              <option value="ស្រី">ស្រី</option>
            </select>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-2.5 py-1.5 border rounded-lg bg-white text-black"
            >
              <option value="">ថ្នាក់ទាំងអស់</option>
              {gradesPool.map((g, i) => (
                <option key={i} value={g}>
                  ថ្នាក់ {g}
                </option>
              ))}
            </select>
            <select
              value={filterProv}
              onChange={(e) => setFilterProv(e.target.value)}
              className="px-2.5 py-1.5 border rounded-lg bg-white text-black"
            >
              <option value="">ខេត្តទាំងអស់</option>
              {provPool.map((p, i) => (
                <option key={i} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Container for table with floating left/right navigation */}
        <div className="relative group">
          {/* Scrollable table matching the Khmer standard exact columns */}
          <div className="overflow-auto border rounded-xl max-h-[550px] relative scrollbar-thin" id="table-scroll-wrapper" ref={tableScrollRef}>
            <table className="min-w-full text-xs text-left text-gray-500 border-collapse">
              <thead className="bg-[#f9fafb] uppercase font-bold text-[11px] text-gray-700 font-battambang">
                <tr>
                  <th className="text-center py-2.5 px-3 border border-gray-200 w-[95px]">សកម្មភាព</th>
                  <th className="text-center py-2.5 px-3 border border-gray-200">រូបថត</th>
                  <th className="py-2.5 px-3 border border-gray-200">អត្តលេខ</th>
                  <th className="py-2.5 px-3 border border-gray-200">ឈ្មោះសិស្ស</th>
                  <th className="py-2.5 px-3 border border-gray-200 text-center">ភេទ</th>
                  <th className="py-2.5 px-3 border border-gray-200 text-center">ថ្នាក់</th>
                  <th className="px-3 py-2.5 border border-gray-200">ថ្ងៃកំណើត</th>
                  <th className="px-3 py-2.5 border border-gray-200">ភូមិ</th>
                  <th className="px-3 py-2.5 border border-gray-200">ឃុំ/សង្កាត់</th>
                  <th className="px-3 py-2.5 border border-gray-200">ស្រុក/ខណ្ឌ</th>
                  <th className="px-3 py-2.5 border border-gray-200">ខេត្ត/ក្រុង</th>
                  <th className="px-3 py-2.5 border border-gray-200">ឈ្មោះឪពុក</th>
                  <th className="px-3 py-2.5 border border-gray-200">មុខរបរឪពុក</th>
                  <th className="px-3 py-2.5 border border-gray-200">ឈ្មោះម្ដាយ</th>
                  <th className="px-3 py-2.5 border border-gray-200">មុខរបរម្ដាយ</th>
                  <th className="px-3 py-2.5 border border-gray-200">លេខអាណាព្យាបាល</th>
                </tr>
              </thead>
              <tbody id="student-table-body" className="bg-white text-black font-battambang">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center py-8 text-gray-400 font-medium">
                      មិនទាន់មានទិន្នន័យសិស្សនៅក្នុងបញ្ជី ឬជ្រើសរើសចម្រាញ់ត្រូវគ្នាឡើយ
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 border-b border-gray-200">
                      <td className="px-3 py-2 border border-gray-200 text-center whitespace-nowrap min-h-[50px] w-[95px]">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setPreviewStudent(s)}
                            className="p-1 text-blue-700 hover:text-blue-900 transition-all duration-150 active:scale-90 hover:scale-110 cursor-pointer"
                            title="មើលកាតសម្គាល់ខ្លួន"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => editStudent(s)}
                            className="p-1 text-amber-600 hover:text-amber-800 transition-all duration-150 active:scale-90 hover:scale-110 cursor-pointer"
                            title="កែប្រែព័ត៌មានសិស្ស"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: 'លុបព័ត៌មានសិស្សានុសិស្ស',
                                description: `តើអ្នកពិតជាចង់លុបទិន្នន័យរបស់សិស្សឈ្មោះ "${s.name}" (អត្តលេខ៖ ${s.id}) នេះចេញពីក្នុងប្រព័ន្ធមែនទេ? សកម្មភាពនេះមិនអាចបង្កើតឡើងវិញបានទេ!`,
                                actionType: 'delete-single',
                                targetId: s.id
                              });
                              setDeleteInputText('');
                            }}
                            className="p-1 text-red-600 hover:text-red-800 transition-all duration-150 active:scale-90 hover:scale-110 cursor-pointer"
                            title="លុបព័ត៌មានសិស្ស"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="text-center border border-gray-200">
                        <div className="w-10 h-12 bg-transparent select-none overflow-hidden flex items-center justify-center relative mx-auto my-1 rounded-none">
                          {s.photo ? (
                            <img src={s.photo} className="w-full h-full object-cover rounded-none" alt="Student" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                          ) : (
                            <span className="text-[9px] text-gray-400 font-bold">3x4</span>
                          )}
                        </div>
                      </td>
                      <td className="font-bold text-gray-800 border border-gray-200 py-2 px-3">
                        {s.id}
                      </td>
                      <td className="text-blue-800 font-bold py-2 px-3 border border-gray-200 whitespace-nowrap">
                        {s.name}
                      </td>
                      <td className="py-2 px-3 border border-gray-200 text-center whitespace-nowrap">
                        {s.gender}
                      </td>
                      <td className="font-bold text-[#0f2c59] border border-gray-200 py-2 px-3 text-center whitespace-nowrap">
                        {s.grade}
                      </td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.dob}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.village || '-'}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.commune || '-'}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.district || '-'}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.province || '-'}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.fatherName || '-'}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.fatherJob || '-'}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.motherName || '-'}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap">{s.motherJob || '-'}</td>
                      <td className="px-3 py-2 border border-gray-200 whitespace-nowrap font-semibold text-blue-700">{s.phone || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Floating Left and Right smooth visual scrolling bars */}
          {filteredStudents.length > 0 && (
            <>
              <button
                onClick={() => {
                  if (tableScrollRef.current) {
                    tableScrollRef.current.scrollBy({ left: -280, behavior: 'smooth' });
                  }
                }}
                className="absolute top-1/2 left-3 transform -translate-y-1/2 w-10 h-10 bg-white/95 hover:bg-white text-blue-900 rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition active:scale-90 hover:scale-105 z-20 cursor-pointer md:opacity-0 md:group-hover:opacity-100 duration-200"
                title="រំកិលទៅឆ្វេង"
              >
                <ChevronLeft className="w-5 h-5 font-bold" />
              </button>
              <button
                onClick={() => {
                  if (tableScrollRef.current) {
                    tableScrollRef.current.scrollBy({ left: 280, behavior: 'smooth' });
                  }
                }}
                className="absolute top-1/2 right-3 transform -translate-y-1/2 w-10 h-10 bg-white/95 hover:bg-white text-blue-900 rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition active:scale-90 hover:scale-105 z-20 cursor-pointer md:opacity-0 md:group-hover:opacity-100 duration-200"
                title="រំកិលទៅស្តាំ"
              >
                <ChevronRight className="w-5 h-5 font-bold" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 5. PREVIEW SINGLE STUDENT CARD MODAL POPUP */}
      {previewStudent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full flex flex-col items-center gap-4 border border-gray-150 text-slate-800">
            <div className="flex items-center justify-between w-full border-b pb-3.5 font-battambang">
              <h3 className="font-moul text-[#0f2c59] text-xs md:text-sm">
                កាតសម្គាល់ខ្លួនសិស្ស៖ {previewStudent.name}
              </h3>
              <div className="flex items-center gap-2.5">
                <button
                  disabled={isDownloadingSingle}
                  onClick={async () => {
                    const cardEl = document.getElementById('preview-modal-card-render');
                    if (!cardEl) return;
                    setIsDownloadingSingle(true);
                    try {
                      // គូរ Canvas ដោយផ្ទាល់ — original bg & photo resolution
                      const canvas  = await drawCardToCanvas(previewStudent, dbState.card_layout);
                      const imgData = canvas.toDataURL('image/png');
                      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [75, 100] });
                      doc.addImage(imgData, 'PNG', 0, 0, 75, 100);
                      doc.save(`កាតសិស្ស_${previewStudent.id}_${previewStudent.name}.pdf`);
                    } catch (err) {
                      console.error('Download card copy error:', err);
                      alert('កំហុសក្នុងការទាញយកកាត៖ ' + err);
                    } finally {
                      setIsDownloadingSingle(false);
                    }
                  }}
                  className={`p-1.5 px-3.5 text-white rounded-md text-xs font-bold flex items-center gap-1 transition-all duration-150 cursor-pointer select-none ${
                    isDownloadingSingle ? 'bg-amber-400 cursor-not-allowed opacity-75 animate-pulse' : 'bg-amber-600 hover:bg-amber-500 active:scale-95'
                  }`}
                  title="ទាញយកជា PDF កម្រិតច្បាស់ដើម"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isDownloadingSingle ? 'កំពុងទាញយក...' : 'ទាញយកជា PDF'}
                </button>
                <button
                  onClick={() => setPreviewStudent(null)}
                  className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded-full transition cursor-pointer"
                  title="បិទផ្ទាំង"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* High-quality card container rendered dynamically */}
            <div className="flex items-center justify-center overflow-auto w-full py-2">
              <div
                id="preview-modal-card-render"
                className="student-card-size bg-white relative overflow-hidden shrink-0 shadow-lg font-battambang"
                style={
                  dbState.card_layout.bgImage
                    ? {
                        backgroundImage: `url(${dbState.card_layout.bgImage})`,
                        backgroundSize: `${dbState.card_layout.bgSizeWidth || '100'}% ${
                          dbState.card_layout.bgSizeHeight || '100'
                        }%`,
                        backgroundPosition: `${dbState.card_layout.bgPositionX || '0'}px ${
                          dbState.card_layout.bgPositionY || '0'
                        }px`,
                        backgroundRepeat: 'no-repeat',
                      }
                    : { backgroundColor: '#ffffff' }
                }
              >
                {/* Photo */}
                {(() => {
                  const visibleFields = dbState?.card_layout?.visibleFields || [
                    'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
                    'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
                  ];
                  if (!visibleFields.includes('photo')) return null;
                  return (
                    <div
                      className="absolute"
                      style={{
                        left: dbState?.card_layout?.photo?.left || '25px',
                        top: dbState?.card_layout?.photo?.top || '115px',
                        width: dbState?.card_layout?.photo?.width || '120px',
                        height: dbState?.card_layout?.photo?.height || '160px',
                      }}
                    >
                      {previewStudent.photo ? (
                        <img
                          src={previewStudent.photo}
                          alt={previewStudent.name}
                          className="w-full h-full object-cover rounded-none"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                        />
                      ) : null}
                    </div>
                  );
                })()}

                {/* Text fields matching layout rules - raw values only, NO labels */}
                {['id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year', 'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'].map((key) => {
                  const visibleFields = dbState?.card_layout?.visibleFields || [
                    'photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year',
                    'addressLocal', 'addressRegion', 'fatherName', 'motherName', 'issueDate'
                  ];
                  if (!visibleFields.includes(key)) return null;

                  const fConfig = (dbState?.card_layout as any)?.[key] || { left: '165px', top: '150px', fontSize: '14' };
                  
                  const value = {
                    id: previewStudent.id,
                    name: previewStudent.name,
                    gender: previewStudent.gender,
                    nationality: 'ខ្មែរ',
                    dob: previewStudent.dob,
                    grade: previewStudent.grade,
                    year: dbState?.card_layout?.academicYear || '2025-2026',
                    addressLocal: previewStudent.village && previewStudent.commune ? `${previewStudent.village} ${previewStudent.commune}` : 'ភូមិដីថុយ ឃុំបឹងព្រះ',
                    addressRegion: previewStudent.district && previewStudent.province ? `${previewStudent.district} ${previewStudent.province}` : 'ស្រុកបាភ្នំ ខេត្តព្រៃវែង',
                    fatherName: previewStudent.fatherName || 'យាប ឆាន',
                    motherName: previewStudent.motherName || 'ញិល នាប',
                    issueDate: formatKhmerIssueDate('វិទ្យាល័យបឹងព្រះ')
                  }[key];

                  return (
                    <div
                      key={key}
                      className="absolute font-battambang font-bold whitespace-nowrap text-blue-800"
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

                {/* Watermark Overlay hidden for Admin */}
                {dbState.watermark.text && false && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden font-moul text-center"
                    style={{
                      transform: `rotate(${dbState.watermark.angle || '-45'}deg)`,
                      fontSize: `${dbState.watermark.size || '28'}px`,
                      color: `rgba(${dbState.watermark.color_r || '107'}, ${dbState.watermark.color_g || '114'}, ${dbState.watermark.color_b || '128'}, ${(Number(dbState.watermark.opacity) || 20) / 100})`,
                      whiteSpace: 'nowrap',
                      zIndex: 49,
                    }}
                  >
                    {dbState.watermark.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern custom confirmation modal overlay */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border-t-4 border-red-600 animate-in zoom-in-95 duration-150 text-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-full text-red-600 flex-shrink-0 animate-pulse">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-base font-moul text-red-700 truncate">{confirmModal.title}</h4>
                <p className="text-[10px] text-gray-400 font-battambang mt-0.5">ទិន្នន័យដែលលុបហើយមិនអាចស្ដារឡើងវិញបានទេ</p>
              </div>
            </div>

            <p className="text-xs font-battambang leading-relaxed text-gray-600">
              {confirmModal.description}
            </p>

            {/* Selector Option if deleting filtered vs all */}
            {(confirmModal.actionType === 'delete-all' || confirmModal.actionType === 'delete-filtered') && filteredStudents.length < dbState.students.length && (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-[#0f2c59] block font-battambang">ជម្រើសលុបទិន្នន័យ៖</span>
                <div className="grid grid-cols-2 gap-2 font-battambang text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModal(prev => ({
                        ...prev,
                        actionType: 'delete-filtered',
                        description: `តើអ្នកចង់លុបសិស្សដែលស្វែងរកឃើញទាំង ${filteredStudents.length} នាក់ក្នុងបញ្ជីនេះមែនទេ?`
                      }));
                    }}
                    className={`p-2 rounded-lg border text-center font-bold transition cursor-pointer ${
                      confirmModal.actionType === 'delete-filtered'
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    លុបតែសិស្សស្វែងរក ({filteredStudents.length} នាក់)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModal(prev => ({
                        ...prev,
                        actionType: 'delete-all',
                        description: `តើអ្នកចង់លុបទិន្នន័យសិស្សទាំងអស់ពីក្នុងប្រព័ន្ធទាំងស្រុងចំនួន ${dbState.students.length} នាក់មែនទេ?`
                      }));
                    }}
                    className={`p-2 rounded-lg border text-center font-bold transition cursor-pointer ${
                      confirmModal.actionType === 'delete-all'
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    លុបសិស្សទាំងអស់ ({dbState.students.length} នាក់)
                  </button>
                </div>
              </div>
            )}

            {/* Require Typing Word confirm block only for mass deletion */}
            {confirmModal.requireInputWord && (
              <div className="space-y-1.5 font-battambang">
                <label className="block text-[11px] font-bold text-gray-650">
                  សូមវាយពាក្យ <span className="text-red-600 font-mono font-extrabold px-1.5 py-0.5 bg-red-50 rounded border border-red-200">"{confirmModal.requireInputWord}"</span> ដើម្បីបញ្ជាក់ការលុប៖
                </label>
                <input
                  type="text"
                  value={deleteInputText}
                  onChange={(e) => setDeleteInputText(e.target.value)}
                  placeholder={`វាយពាក្យ ${confirmModal.requireInputWord}`}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 text-xs font-battambang pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal({ isOpen: false, title: '', description: '', actionType: 'delete-all' });
                  setDeleteInputText('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-lg cursor-pointer"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={confirmModal.requireInputWord ? deleteInputText !== confirmModal.requireInputWord : false}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> យល់ព្រមលុប
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern custom modal for Admin Account Settings */}
      {showAdminSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border-t-4 border-[#0f2c59] animate-in zoom-in-95 duration-150 text-slate-700 font-battambang">
            <div className="flex items-center gap-3 pb-2 border-b">
              <div className="p-2.5 bg-blue-100 rounded-full text-[#0f2c59] flex-shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h4 className="font-bold text-sm font-moul text-[#0f2c59]">គ្រប់គ្រងគណនី Admin</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">កំណត់ព័ត៌មានសម្ងាត់សម្រាប់ចូលបញ្ជាប្រព័ន្ធ</p>
              </div>
            </div>

            <form onSubmit={handleSaveAdminCredentials} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 font-bold mb-1">Username គណនី *</label>
                <input
                  type="text"
                  required
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="ឧ. SengVa"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-bold mb-1">លេខសម្ងាត់ថ្មី (Password) *</label>
                <input
                  type="password"
                  required
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="លាក់ទុក ឬលេខសម្ងាត់ថ្មី"
                />
              </div>

              <div>
                <label className="block text-[#0f2c59] font-bold mb-1">Gmail សម្រាប់សង្គ្រោះគណនី *</label>
                <input
                  type="email"
                  required
                  value={adminGmail}
                  onChange={(e) => setAdminGmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="ឧ. user@gmail.com"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  * ប្រើសម្រាប់សង្គ្រោះករណីភ្លេចលេខសម្ងាត់ តាមរយៈផ្ទាំងភ្នែកសង្គ្រោះលាក់ទុក
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t font-semibold">
                <button
                  type="button"
                  onClick={() => setShowAdminSettings(false)}
                  className="px-4 py-2 bg-gray-105 hover:bg-gray-200 text-gray-600 rounded-lg cursor-pointer font-bold"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0f2c59] hover:bg-slate-800 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-bold"
                >
                  រក្សាទុក
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
