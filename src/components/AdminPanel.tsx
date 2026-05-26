/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
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
  X,
  AlignLeft
} from 'lucide-react';
import { DBState, Student, CardLayout, WatermarkSettings } from '../types';
import { fileToBase64, compressImage } from '../utils';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const DEFAULT_AVATAR_DATA_URI = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 160' width='120' height='160'></svg>";

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

  // Layout Design selection state
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [localLayout, setLocalLayout] = useState<any>(null);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(true);
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
    setId('');
    setName('');
    setGender('ប្រុស');
    setDob('');
    setGrade('');
    setVillage('');
    setCommune('');
    setDistrict('');
    setProvince('');
    setFatherName('');
    setFatherJob('');
    setMotherName('');
    setMotherJob('');
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
      dob: dob.trim(),
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
    setDob(student.dob);
    setGrade(student.grade);
    setVillage(student.village || '');
    setCommune(student.commune || '');
    setDistrict(student.district || '');
    setProvince(student.province || '');
    setFatherName(student.fatherName || '');
    setFatherJob(student.fatherJob || '');
    setMotherName(student.motherName || '');
    setMotherJob(student.motherJob || '');
    setPhone(student.phone || '');
    setPhoto(student.photo || '');
    setIsEditing(true);
    setShowAddForm(true);
  };

  // Canvas Image compression helper for fast upload on mobile
  const handleFormPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      // Compact the image dimensions down heavily (3x4 ratio means 300x400 is plenty high-res, reduces 10MB to 40KB!)
      const compressed = await compressImage(base64, 300, 400, 0.8);
      
      // Upload to server asset directory so it's super fast, and returns relative path URL
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: compressed, name: `student_photo_${id}`, ext: 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        setPhoto(resData.url);
      } else {
        setPhoto(compressed); // Fallback to base64
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
        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        
        const compressed = await compressImage(base64, 300, 400, 0.8);
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: compressed, name: `student_photo_${id || 'new'}`, ext: 'jpg' })
        });
        const resData = await response.json();
        if (resData.status === 'success') {
          setPhoto(resData.url);
        } else {
          setPhoto(compressed);
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
      const fieldObj = (currentLayout as any)[fKey];
      if (fieldObj) {
        const leftVal = parseInt(fieldObj.left || '10px');
        const topVal = parseInt(fieldObj.top || '10px');

        if (dir === 'up') fieldObj.top = `${topVal - amt}px`;
        if (dir === 'down') fieldObj.top = `${topVal + amt}px`;
        if (dir === 'left') fieldObj.left = `${leftVal - amt}px`;
        if (dir === 'right') fieldObj.left = `${leftVal + amt}px`;
      }
    });

    onUpdateDB({ card_layout: currentLayout });
  };

  const adjustFontSize = (size: string) => {
    const targets = selectedFields.length > 0 ? selectedFields : (selectedField ? [selectedField] : []);
    if (targets.length === 0) return;
    const currentLayout = { ...dbState.card_layout };
    
    targets.forEach(fKey => {
      if (fKey === 'photo') return;
      const fieldObj = (currentLayout as any)[fKey];
      if (fieldObj) {
        fieldObj.fontSize = size;
      }
    });

    onUpdateDB({ card_layout: currentLayout });
  };

  // Direct Mouse/Touch dragging functions
  const startDragField = (e: React.MouseEvent | React.TouchEvent, fKey: string) => {
    if (isLayoutLocked) {
      return;
    }
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
    const baseLayout = { ...dbState.card_layout };

    targets.forEach(key => {
      const fObj = (baseLayout as any)[key];
      if (fObj) {
        initialPositions[key] = {
          left: parseInt(fObj.left || '10px'),
          top: parseInt(fObj.top || '10px'),
        };
      }
    });

    // Create custom transient layout for buttery-smooth interaction
    let dynamicLayout = { ...dbState.card_layout };

    const onPointerMove = (moveEv: MouseEvent | TouchEvent) => {
      const curX = 'clientX' in moveEv ? moveEv.clientX : (moveEv.touches?.[0]?.clientX || 0);
      const curY = 'clientY' in moveEv ? moveEv.clientY : (moveEv.touches?.[0]?.clientY || 0);

      const dx = curX - startX;
      const dy = curY - startY;

      dynamicLayout = { ...dbState.card_layout };
      targets.forEach(key => {
        const init = initialPositions[key];
        const fObj = (dynamicLayout as any)[key];
        if (init && fObj) {
          fObj.left = `${init.left + dx}px`;
          fObj.top = `${init.top + dy}px`;
        }
      });

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
    const targets = selectedFields.length > 0 ? selectedFields : ['photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year'];
    if (targets.length <= 1) return;
    const currentLayout = { ...dbState.card_layout };
    
    let topmostKey: string | null = null;
    let minTop = Infinity;
    
    targets.forEach(key => {
      const fObj = (currentLayout as any)[key];
      if (fObj) {
        const topVal = parseInt(fObj.top || '0');
        if (topVal < minTop) {
          minTop = topVal;
          topmostKey = key;
        }
      }
    });

    if (topmostKey) {
      const targetLeft = ((currentLayout as any)[topmostKey]).left;
      targets.forEach(key => {
        const fObj = (currentLayout as any)[key];
        if (fObj) {
          fObj.left = targetLeft;
        }
      });
      onUpdateDB({ card_layout: currentLayout });
    }
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
      // Background should be sharp but webp/jpeg compressed to under 120KB
      const compressed = await compressImage(base64, 800, 1060, 0.8);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: compressed, name: 'card_bg', ext: 'jpg' })
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

  // PDF Multi-generation with canvas
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
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    for (let i = 0; i < targets.length; i++) {
      const student = targets[i];
      const prog = Math.round(((i + 1) / targets.length) * 100);
      setPdfStatusMsg(`កំពុងគូររូប៖ ${student.name}`);
      setPdfProgress(prog);

      // Create a temporary element to render card perfectly
      const cardEl = document.createElement('div');
      cardEl.className = 'student-card-size bg-white relative overflow-hidden';
      cardEl.style.cssText = `
        width: 375px;
        height: 500px;
        position: relative;
        background-image: ${
          dbState.card_layout.bgImage ? `url(${dbState.card_layout.bgImage})` : 'none'
        };
        background-size: ${dbState.card_layout.bgSizeWidth || '100'}% ${
        dbState.card_layout.bgSizeHeight || '100'
      }%;
        background-position: ${dbState.card_layout.bgPositionX || '0'}px ${
        dbState.card_layout.bgPositionY || '0'
      }px;
        background-repeat: no-repeat;
      `;

      // Build text inner layouts
      const fields = [
        { id: 'photo', html: `<div style="width:100%;height:100%;overflow:hidden"><img src="${student.photo || ''}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;${student.photo ? '' : 'display:none'}"></div>`, style: `width: ${dbState?.card_layout?.photo?.width || '120px'}; height: ${dbState?.card_layout?.photo?.height || '160px'};` },
        { id: 'id', html: `អត្តលេខ: <span style="font-weight:bold;color:#1e40af">${student.id}</span>`, style: `font-size:${dbState?.card_layout?.id?.fontSize || '14'}px` },
        { id: 'name', html: `ឈ្មោះ: <span style="font-weight:bold;color:#1e40af">${student.name}</span>`, style: `font-size:${dbState?.card_layout?.name?.fontSize || '14'}px` },
        { id: 'gender', html: `ភេទ: <span style="font-weight:bold;color:#1e40af">${student.gender}</span>`, style: `font-size:${dbState?.card_layout?.gender?.fontSize || '14'}px` },
        { id: 'nationality', html: `សញ្ជាតិ: <span style="font-weight:bold;color:#1e40af">ខ្មែរ</span>`, style: `font-size:${dbState?.card_layout?.nationality?.fontSize || '14'}px` },
        { id: 'dob', html: `ថ្ងៃខែឆ្នាំកំណើត: <span style="font-weight:bold;color:#1e40af">${student.dob}</span>`, style: `font-size:${dbState?.card_layout?.dob?.fontSize || '13'}px` },
        { id: 'grade', html: `ថ្នាក់ទី: <span style="font-weight:bold;color:#1e40af">${student.grade}</span>`, style: `font-size:${dbState?.card_layout?.grade?.fontSize || '14'}px` },
        { id: 'year', html: `ឆ្នាំសិក្សា: <span style="font-weight:bold;color:#1e40af">${dbState?.card_layout?.academicYear || '2025-2026'}</span>`, style: `font-size:${dbState?.card_layout?.year?.fontSize || '14'}px` },
      ];

      fields.forEach((f) => {
        const item = document.createElement('div');
        const fConfig = (dbState?.card_layout as any)?.[f.id] || { left: '165px', top: '150px' };
        item.style.cssText = `position:absolute; font-family:'Battambang',sans-serif; left:${
          fConfig.left || '165px'
        }; top:${fConfig.top || '150px'}; ${f.style}`;
        item.innerHTML = f.html;
        cardEl.appendChild(item);
      });

      // Watermark
      if (dbState.watermark.text) {
        const wmDiv = document.createElement('div');
        wmDiv.style.cssText = `
          position: absolute;
          inset: 0px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          user-select: none;
          font-family: 'Moul', cursive;
          transform: rotate(${dbState.watermark.angle || '-45'}deg);
          font-size: ${dbState.watermark.size || '28'}px;
          color: rgba(${dbState.watermark.color_r}, ${dbState.watermark.color_g}, ${
          dbState.watermark.color_b
        }, ${(Number(dbState.watermark.opacity) || 20) / 100});
          white-space: nowrap;
          z-index: 49;
        `;
        wmDiv.textContent = dbState.watermark.text;
        cardEl.appendChild(wmDiv);
      }

      tempContainer.appendChild(cardEl);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const canvas = await html2canvasSafe(cardEl, { scale: 4, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);

      if (i > 0) doc.addPage([75, 100], 'portrait');
      doc.addImage(imgData, 'JPEG', 0, 0, 75, 100);

      // Remove from pool immediately to save RAM
      cardEl.remove();
    }

    doc.save(pdfScope === 'all' ? 'កាតសិស្សសរុបរួម.pdf' : `កាតសិស្ស_ថ្នាក់_${pdfClass}.pdf`);
    tempContainer.remove();
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
                disabled={isEditing}
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="ឧ. 001"
                className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white disabled:bg-slate-100"
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
                className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white"
              />
            </div>
            <div>
              <label className="block text-gray-500 font-bold mb-1">ភេទ *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white"
              >
                <option value="ប្រុស">ប្រុស</option>
                <option value="ស្រី">ស្រី</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-500 font-bold mb-1">ថ្ងៃខែឆ្នាំកំណើត *</label>
              <input
                type="text"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="ឧ. ១៥-មករា-២០០៨"
                className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white"
              />
            </div>
            <div>
              <label className="block text-gray-500 font-bold mb-1">ថ្នាក់ទី *</label>
              <input
                type="text"
                required
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="ឧ. ១២A"
                className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white"
              />
            </div>

            <div className="md:col-span-3 border-t pt-3 space-y-1">
              <span className="font-bold text-gray-600 block mb-1">ទីកន្លែងកំណើត</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="ភូមិ"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
                <input
                  type="text"
                  placeholder="ឃុំ/សង្កាត់"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
                <input
                  type="text"
                  placeholder="ស្រុក/ខណ្ឌ"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
                <input
                  type="text"
                  placeholder="ខេត្ត/ក្រុង"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
              </div>
            </div>

            <div className="md:col-span-3 border-t pt-3 space-y-1">
              <span className="font-bold text-gray-600 block mb-2">ព័ត៌មានអាណាព្យាបាល</span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="ឈ្មោះឪពុក"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
                <input
                  type="text"
                  placeholder="មុខរបរឪពុក"
                  value={fatherJob}
                  onChange={(e) => setFatherJob(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
                <input
                  type="text"
                  placeholder="ឈ្មោះម្តាយ"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
                <input
                  type="text"
                  placeholder="មុខរបរម្តាយ"
                  value={motherJob}
                  onChange={(e) => setMotherJob(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
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
                <span className="font-bold text-gray-600 block">៣. ជ្រើសរើសចម្រាញ់ធាតុដែលត្រូវកែតម្រឹម</span>
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
                      { k: 'year', n: 'ឆ្នាំសិក្សា' }
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
                        const keys = ['photo', 'id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year'];
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
                      className="w-full py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-md text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition active:scale-[0.98]"
                    >
                      <AlignLeft className="w-3.5 h-3.5" /> តម្រឹមខាងឆ្វេង (យកខាងលើជាគោល)
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
                        value={(dbState.card_layout as any)[selectedField].fontSize || '14'}
                        onChange={(e) => adjustFontSize(e.target.value)}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">ទំហំទទឹង (px)</label>
                        <input
                          type="text"
                          value={dbState.card_layout.photo.width || '120px'}
                          onChange={(e) => {
                            const updated = { ...dbState.card_layout };
                            updated.photo.width = e.target.value;
                            onUpdateDB({ card_layout: updated });
                          }}
                          className="w-full p-1.5 border rounded text-black bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">ទំហំកម្ពស់ (px)</label>
                        <input
                          type="text"
                          value={dbState.card_layout.photo.height || '160px'}
                          onChange={(e) => {
                            const updated = { ...dbState.card_layout };
                            updated.photo.height = e.target.value;
                            onUpdateDB({ card_layout: updated });
                          }}
                          className="w-full p-1.5 border rounded text-black bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Simulated Live visual preview card frame */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-100 py-6 px-2 rounded-2xl border-2 border-dashed border-gray-300">
              {/* Lock Layout Toggler */}
              <div className="w-full max-w-[375px] mb-4 bg-white p-2.5 rounded-xl border flex items-center justify-between gap-3 font-battambang shadow-2xs">
                <div className="flex items-center gap-1.5">
                  {isLayoutLocked ? (
                    <span className="flex items-center gap-1 text-[11px] text-red-600 font-bold bg-red-50 px-2.5 py-1 rounded-md">
                      🔒 បានចាក់សោស្ទួនប្លង់
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-green-600 font-bold bg-green-50 px-2.5 py-1 rounded-md animate-pulse">
                      🔓 បើកសោបង្ខំផ្លាស់ទី
                    </span>
                  )}
                </div>
                {isLayoutLocked ? (
                  <button
                    onClick={() => {
                      setIsLayoutLocked(false);
                    }}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition active:scale-95"
                  >
                    🔓 បើកសោដើម្បីកែប្លង់
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsLayoutLocked(true);
                      alert('រក្សាទុក និងចាក់សោរប្លង់បានជោគជ័យ! ប្លង់ត្រូវបានចាក់សោរដើម្បីការពារការរំកិលរំខានដោយអចេតនា។');
                    }}
                    className="px-3.5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition active:scale-95"
                  >
                    🔒 រក្សាទុក និងចាក់សោរ
                  </button>
                )}
              </div>

              <span className="block text-[10px] text-gray-400 font-bold mb-2 font-battambang uppercase tracking-wider">
                {isLayoutLocked 
                  ? "⚠️ ប្លង់កំពុងជាប់សោរ (សូមបើកសោដើម្បីចាប់អូសទាញទីតាំង)"
                  : "* អាចចុចអូសទាញ (Drag & Drop) លើធាតុនីមួយៗផ្ទាល់ និងអូសជ្រុងរូបថតដើម្បីពង្រីក-បង្រួម"
                }
              </span>
              <div className="relative bg-white p-2.5 rounded shadow-lg border border-gray-150">
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
                        className={`absolute font-battambang select-none overflow-hidden z-20 ${
                          isLayoutLocked ? 'cursor-default' : 'cursor-grab'
                        } ${
                          isSelected && !isLayoutLocked ? 'ring-2 ring-blue-500 ring-offset-2 border-dashed border-blue-400 bg-blue-50/20' : ''
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
                          {!isLayoutLocked && isSelected && (
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

                  {/* Rest text Mockups */}
                  {['id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year'].map((key) => {
                    const currentLayout = localLayout || dbState.card_layout;
                    const fConfig = (currentLayout as any)[key];
                    const labels: any = {
                      id: 'អត្តលេខ: 001',
                      name: 'ឈ្មោះ: ស៊ន សុភ័ក្ត្រ',
                      gender: 'ភេទ: ប្រុស',
                      nationality: 'សញ្ជាតិ: ខ្មែរ',
                      dob: 'ថ្ងៃកំណើត: ១៥-មករា-២០០៨',
                      grade: 'ថ្នាក់ទី: ១២A',
                      year: `ឆ្នាំសិក្សា: ${currentLayout.academicYear}`,
                    };
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
                        className={`absolute font-battambang select-none z-20 font-bold whitespace-nowrap px-1 rounded border border-transparent ${
                          isLayoutLocked ? 'cursor-default' : 'cursor-grab'
                        } ${
                          isSelected && !isLayoutLocked ? 'text-blue-600 border-dashed border-blue-400 bg-blue-50/50 scale-102 shadow-xs' : 'hover:bg-slate-50'
                        }`}
                        style={{
                          left: fConfig.left,
                          top: fConfig.top,
                          fontSize: `${fConfig.fontSize || '14'}px`,
                          lineHeight: 1.2,
                        }}
                      >
                        {labels[key]}
                      </div>
                    );
                  })}
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
                      // Ensure all images are fully loaded before rendering
                      const images = cardEl.getElementsByTagName('img');
                      const promises = Array.from(images).map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise((resolve) => {
                          img.onload = resolve;
                          img.onerror = resolve;
                        });
                      });
                      await Promise.all(promises);

                      const canvas = await html2canvasSafe(cardEl, {
                        scale: 4,
                        useCORS: true,
                        backgroundColor: null,
                        logging: false
                      });
                      const imgData = canvas.toDataURL('image/jpeg', 1.0);
                      const link = document.createElement('a');
                      link.href = imgData;
                      link.download = `កាតសិស្ស_${previewStudent.id}_${previewStudent.name}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
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
                  title="ទាញយកជាជារូបភាពទំហំដើម"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isDownloadingSingle ? 'កំពុងទាញយក...' : 'ទាញយក'}
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

                {/* Text fields */}
                {['id', 'name', 'gender', 'nationality', 'dob', 'grade', 'year'].map((key) => {
                  const fConfig = (dbState?.card_layout as any)?.[key] || { left: '165px', top: '150px', fontSize: '14' };
                  const labels: any = {
                    id: `អត្តលេខ: ${previewStudent.id}`,
                    name: `ឈ្មោះ: ${previewStudent.name}`,
                    gender: `ភេទ: ${previewStudent.gender}`,
                    nationality: 'សញ្ជាតិ: ខ្មែរ',
                    dob: `ថ្ងៃកំណើត: ${previewStudent.dob}`,
                    grade: `ថ្នាក់ទី: ${previewStudent.grade}`,
                    year: `ឆ្នាំសិក្សា: ${dbState?.card_layout?.academicYear || '2025-2026'}`,
                  };
                  return (
                    <div
                      key={key}
                      className="absolute font-battambang font-bold whitespace-nowrap text-gray-900"
                      style={{
                        left: fConfig.left || '165px',
                        top: fConfig.top || '150px',
                        fontSize: `${fConfig.fontSize || '14'}px`,
                        lineHeight: 1.2,
                      }}
                    >
                      {labels[key]}
                    </div>
                  );
                })}

                {/* Watermark Overlay if defined */}
                {dbState.watermark.text && (
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
    </div>
  );
}
