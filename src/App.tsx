/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HomeTab from './components/HomeTab';
import StudentSearchTab from './components/StudentSearchTab';
import AdminPanel from './components/AdminPanel';
import AcademicTrackingTab from './components/AcademicTrackingTab';
import ExamResultsTab from './components/ExamResultsTab';
import AboutSchoolTab from './components/AboutSchoolTab';
import StudyScheduleTab from './components/StudyScheduleTab';
import { DBState, Student, ActivityPost, AcademicPost, ExamPost } from './types';
import { Home, Search, GraduationCap, Calendar, ClipboardCopy, School, Settings, Monitor, Minimize2, ZoomIn, Download, ExternalLink, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { getDriveFileId } from './utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('isAdminLoggedIn') === 'true';
  });
  const [isEditingEnabled, setIsEditingEnabled] = useState<boolean>(false);

  // Lightbox Zoom state
  const [viewerZoomSrc, setViewerZoomSrc] = useState<string | null>(null);
  const [viewerImagesList, setViewerImagesList] = useState<string[]>([]);

  const [isOriginalSize, setIsOriginalSize] = useState<boolean>(false);

  const handleZoomImage = (src: string, allImages?: string[]) => {
    setViewerZoomSrc(src);
    setIsOriginalSize(false);
    if (allImages && allImages.length > 0) {
      setViewerImagesList(allImages);
    } else {
      setViewerImagesList([src]);
    }
  };

  const handlePrevImage = () => {
    if (viewerImagesList.length <= 1 || !viewerZoomSrc) return;
    setIsOriginalSize(false);
    const idx = viewerImagesList.indexOf(viewerZoomSrc);
    if (idx !== -1) {
      const prevIdx = (idx - 1 + viewerImagesList.length) % viewerImagesList.length;
      setViewerZoomSrc(viewerImagesList[prevIdx]);
    }
  };

  const handleNextImage = () => {
    if (viewerImagesList.length <= 1 || !viewerZoomSrc) return;
    setIsOriginalSize(false);
    const idx = viewerImagesList.indexOf(viewerZoomSrc);
    if (idx !== -1) {
      const nextIdx = (idx + 1) % viewerImagesList.length;
      setViewerZoomSrc(viewerImagesList[nextIdx]);
    }
  };

  const handleDownloadImage = async (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        const extMatch = url.match(/^data:image\/(\w+);base64,/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        link.download = `image-${Date.now()}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const fileName = url.substring(url.lastIndexOf('/') + 1) || 'image.jpg';
      link.download = fileName.includes('.') ? fileName : `${fileName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback: open in new tab
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = 'image.jpg';
      link.click();
    }
  };

  // PDF Internal In-App Iframe displayer
  const [pdfViewUrl, setPdfViewUrl] = useState<string | null>(null);
  const [pdfViewTitle, setPdfViewTitle] = useState<string>('');
  const [pdfViewerType, setPdfViewerType] = useState<'google' | 'direct' | 'drive_preview'>('drive_preview');

  // Primary database consolidated states
  const [dbState, setDbState] = useState<DBState | null>(null);
  const [searchedStudent, setSearchedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch full state from express server database on mount
  const fetchState = async (silent = false) => {
    try {
      const res = await fetch('/api/database');
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setDbState(json.data);
      }
    } catch (err) {
      if (!silent) console.error('Error loading API database', err);
    }
  };

  // Synchronize state on mount
  useEffect(() => {
    fetchState();

    // Set up rapid concurrent pooling: automatically synchronize state from other devices every 5 seconds
    const interval = setInterval(() => {
      fetchState(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync state back to the Express endpoint
  const pushState = async (incomingPartial: Partial<DBState>) => {
    if (!dbState) return;
    const newState = { ...dbState, ...incomingPartial };
    setDbState(newState);

    try {
      const res = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomingPartial),
      });
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setDbState(json.data);
      }
    } catch (err) {
      console.error('Error synchronizing database', err);
    }
  };

  // Authenticate Admin
  const handleAdminLogin = (usernameField: string, passwordField: string) => {
    if (!dbState) return false;
    const admin = dbState.admin_credentials;
    if (usernameField === admin.username && passwordField === admin.password) {
      sessionStorage.setItem('isAdminLoggedIn', 'true');
      setIsAdminLoggedIn(true);
      return true;
    }
    return false;
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('isAdminLoggedIn');
    setIsAdminLoggedIn(false);
    setIsEditingEnabled(false);
    if (activeTab === 'admin') {
      setActiveTab('home');
    }
  };

  // Searching sId or sName out of DBState
  const handleStudentSearch = (q: string) => {
    setSearchQuery(q);
    if (!dbState) return;
    if (!q.trim()) {
      setSearchedStudent(null);
      return;
    }

    const cleaned = q.trim().toLowerCase();
    const found = dbState.students.find((s) => {
      return (
        s.id.toLowerCase() === cleaned ||
        s.id.toLowerCase().includes(cleaned) ||
        s.name.toLowerCase().includes(cleaned)
      );
    });

    if (found) {
      setSearchedStudent(found);
    } else {
      setSearchedStudent(null);
    }
  };

  // Custom action parameters passed down
  const handlePostStudent = async (student: Student) => {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error posting student', err);
    }
  };

  const handlePostStudentsBulk = async (students: Student[]) => {
    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(students),
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error posting bulk students', err);
    }
  };

  const handleDeleteStudent = async (sId: string) => {
    try {
      const res = await fetch(`/api/students/${sId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error deleting student', err);
    }
  };

  const handleBulkDeleteStudents = async (ids?: string[]) => {
    try {
      const res = await fetch('/api/students/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error bulk deleting students', err);
    }
  };

  const handlePostActivity = async (act: ActivityPost) => {
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(act),
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error posting activity', err);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error deleting activity', err);
    }
  };

  const handlePostAcademic = async (p: AcademicPost) => {
    try {
      const res = await fetch('/api/academic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error posting academic post', err);
    }
  };

  const handleDeleteAcademic = async (id: string) => {
    try {
      const res = await fetch(`/api/academic/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error deleting academic post', err);
    }
  };

  const handlePostSchedule = async (p: AcademicPost) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error posting schedule post', err);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error deleting schedule post', err);
    }
  };

  const handlePostExam = async (p: ExamPost) => {
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error posting exam post', err);
    }
  };

  const handleDeleteExam = async (id: string) => {
    try {
      const res = await fetch(`/api/exams/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.status === 'success') {
        await fetchState(true);
      }
    } catch (err) {
      console.error('Error deleting exam post', err);
    }
  };

  // Google Drive synchronization endpoints
  const handleBackupToDrive = async () => {
    const scriptUrl = localStorage.getItem('drive_script_url');
    if (!scriptUrl) {
      alert('សូមកំណត់និងរក្សាទុក URL គម្រោង App Script ជាមុនសិន!');
      return;
    }

    try {
      alert('កំពុងចតឡើយទិន្នន័យដើម្បីបម្រុងទុក...' );
      const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(dbState),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert('បម្រុងទុកទិន្នន័យទៅកាន់ Google Drive ដោយជោគជ័យ!');
      } else {
        alert('បរាជ័យក្នុងការបម្រុងទុក!');
      }
    } catch (err) {
      alert('កំហុសក្នុងការតភ្ជាប់ Google Drive!');
    }
  };

  const handleRestoreFromDrive = async () => {
    const scriptUrl = localStorage.getItem('drive_script_url');
    if (!scriptUrl) {
      alert('សូមកំណត់និងរក្សាទុក URL គម្រោង App Script ជាមុនសិន!');
      return;
    }

    try {
      alert('កំពុងទាញយកទិន្នន័យពី Google Drive...');
      const res = await fetch(scriptUrl);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        await pushState(json.data);
        alert('បានសង្គ្រោះទិន្នន័យពី Google Drive រួចរាល់!');
      } else {
        alert('មិនរកឃើញឯកសាសាបម្រុងទុកនៅក្នុង Drive!');
      }
    } catch (err) {
      alert('កំហុសទាញយកទិន្នន័យពី Google Drive!');
    }
  };

  // Tab View Toggler
  const handleTabSelection = (tab: string) => {
    setActiveTab(tab);
    // Auto reset searching state when tab changes
    setSearchedStudent(null);
    setSearchQuery('');
  };

  if (!dbState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-600 font-battambang gap-3">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-t-[#0f2c59] border-r-transparent border-b-[#0f2c59] border-l-transparent animate-spin"></div>
        </div>
        <p className="text-xs font-bold font-moul animate-pulse text-[#0f2c59]">វិទ្យាល័យបឹងព្រះ</p>
        <p className="text-[10px]">កំពុងទាញយកទិន្នន័យ... សូមមេត្តារង់ចាំ</p>
      </div>
    );
  }

  // Build Tab Renderings
  const renderSelectedTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeTab
            dbState={dbState}
            isAdminLoggedIn={isAdminLoggedIn && isEditingEnabled}
            onUpdateDB={pushState}
            onZoomImage={handleZoomImage}
            onPostActivity={handlePostActivity}
            onDeleteActivity={handleDeleteActivity}
          />
        );
      case 'student-search':
        return (
          <StudentSearchTab
            dbState={dbState}
            onZoomImage={handleZoomImage}
            publicSearchInput={searchQuery}
            setPublicSearchInput={setSearchQuery}
            searchedStudent={searchedStudent}
            onSearch={handleStudentSearch}
            isAdmin={isAdminLoggedIn}
          />
        );
      case 'academic-tracking':
        return (
          <AcademicTrackingTab
            dbState={dbState}
            isAdminLoggedIn={isAdminLoggedIn && isEditingEnabled}
            onPostAcademic={handlePostAcademic}
            onDeleteAcademic={handleDeleteAcademic}
            onZoomImage={handleZoomImage}
            onViewPdf={(url, title) => {
              setPdfViewUrl(url);
              setPdfViewTitle(title);
            }}
          />
        );
      case 'study-schedule':
        return (
          <StudyScheduleTab
            dbState={dbState}
            isAdminLoggedIn={isAdminLoggedIn && isEditingEnabled}
            onPostSchedule={handlePostSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onZoomImage={handleZoomImage}
            onViewPdf={(url, title) => {
              setPdfViewUrl(url);
              setPdfViewTitle(title);
            }}
          />
        );
      case 'exam-results':
        return (
          <ExamResultsTab
            dbState={dbState}
            isAdminLoggedIn={isAdminLoggedIn && isEditingEnabled}
            onPostExam={handlePostExam}
            onDeleteExam={handleDeleteExam}
            onZoomImage={handleZoomImage}
            onViewPdf={(url, title) => {
              setPdfViewUrl(url);
              setPdfViewTitle(title);
            }}
          />
        );
      case 'about-school':
        return (
          <AboutSchoolTab
            dbState={dbState}
            isAdminLoggedIn={isAdminLoggedIn && isEditingEnabled}
            onUpdateDB={pushState}
            onZoomImage={handleZoomImage}
          />
        );
      case 'admin':
        return (
          <AdminPanel
            dbState={dbState}
            onUpdateDB={pushState}
            onPostStudent={handlePostStudent}
            onPostStudentsBulk={handlePostStudentsBulk}
            onDeleteStudent={handleDeleteStudent}
            onBulkDeleteStudents={handleBulkDeleteStudents}
            onBackupToDrive={handleBackupToDrive}
            onRestoreFromDrive={handleRestoreFromDrive}
            onViewStudentCard={(id) => {
              handleTabSelection('student-search');
              handleStudentSearch(id);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-50 font-kantumruy min-h-screen flex flex-col justify-between">
      {/* TOP HEADER */}
      <Header
        dbState={dbState}
        isAdminLoggedIn={isAdminLoggedIn}
        isEditingEnabled={isEditingEnabled}
        onStartEditing={() => setIsEditingEnabled(true)}
        onLogin={handleAdminLogin}
        onLogout={handleAdminLogout}
        onTabChange={handleTabSelection}
      />

      {/* STICKY MAIN TAB NAVIGATION BAR */}
      <div className="bg-[#0b2244] sticky top-0 z-40 shadow-sm overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex">
          {[
            { id: 'home', label: 'ទំព័រដើម', icon: <Home className="w-4 h-4" /> },
            { id: 'student-search', label: 'ស្វែងរកព័ត៌មានសិស្ស', icon: <Search className="w-4 h-4" /> },
            { id: 'academic-tracking', label: 'តាមដានការសិក្សាសិស្ស', icon: <GraduationCap className="w-4 h-4" /> },
            { id: 'study-schedule', label: 'កាលវិភាគសិក្សា', icon: <Calendar className="w-4 h-4" /> },
            { id: 'exam-results', label: 'លទ្ធផលប្រឡងសញ្ញាបត្រ', icon: <ClipboardCopy className="w-4 h-4" /> },
            { id: 'about-school', label: 'អំពីសាលា', icon: <School className="w-4 h-4" /> },
            ...(isAdminLoggedIn
              ? [{ id: 'admin', label: 'ទិន្នន័យសិស្ស និងប្លង់កាត', icon: <Settings className="w-4 h-4" /> }]
              : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabSelection(tab.id)}
              className={`px-5 py-3 text-white font-battambang font-bold flex items-center gap-1.5 text-xs md:text-sm whitespace-nowrap cursor-pointer hover:bg-blue-800/40 transition-all ${
                activeTab === tab.id ? 'bg-blue-800 border-b-2 border-amber-400' : 'bg-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN MAIN CONTAINER CONTENT */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 flex flex-col justify-start min-h-[calc(100vh-230px)] animate-in fade-in duration-300">
        {renderSelectedTabContent()}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-white/50 text-[10px] text-center py-4 border-t border-slate-800 font-battambang">
        <p>© ឆ្នាំ ២០២៦ - គេហទំព័រផ្លូវការ {dbState?.about_school?.title || 'វិទ្យាល័យបឹងព្រះ'}</p>
      </footer>

      {/* LIGHTBOX PHOTO ZOOM Lightbox */}
      {viewerZoomSrc && (
        <div
          className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center animate-in fade-in duration-200 select-none"
          onClick={() => {
            setViewerZoomSrc(null);
            setViewerImagesList([]);
          }}

        >
          {/* រូបភាព — ពេញអេក្រង់ទាំងស្រុង */}
          <div
            className="absolute inset-0 flex overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              className={`transition-all duration-200 m-auto ${
                isOriginalSize
                  ? 'max-w-none max-h-none h-auto w-auto object-none cursor-zoom-out'
                  : 'max-w-full max-h-full w-auto h-auto object-contain cursor-zoom-in'
              }`}
              src={viewerZoomSrc}
              alt="Zoom Lightbox"
              referrerPolicy="no-referrer"
              onClick={(e) => {
                e.stopPropagation();
                setIsOriginalSize(!isOriginalSize);
              }}
            />
          </div>

          {/* ប៊ូតុង X — អណ្ដែតខាងលើស្ដាំ */}
          <button
            className="absolute top-4 right-4 z-50 bg-black/60 hover:bg-red-600 text-white p-2 rounded-full transition-all duration-200 cursor-pointer shadow-lg border border-white/10"
            onClick={(e) => {
              e.stopPropagation();
              setViewerZoomSrc(null);
              setViewerImagesList([]);
            }}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Counter — អណ្ដែតខាងលើកណ្ដាល */}
          {viewerImagesList.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white text-xs font-battambang bg-black/60 border border-white/10 py-1 px-3 rounded-full pointer-events-none tracking-wide">
              រូបភាពទី {(viewerImagesList.indexOf(viewerZoomSrc) !== -1 ? viewerImagesList.indexOf(viewerZoomSrc) : 0) + 1} នៃ {viewerImagesList.length}
            </div>
          )}

          {/* ប៊ូតុង ← — អណ្ដែតខាងឆ្វេងកណ្ដាល */}
          {viewerImagesList.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-50 bg-black/70 hover:bg-amber-600 hover:text-black hover:scale-115 active:scale-95 text-white p-2.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shadow-lg border border-white/10"
              title="រូបភាពមុន"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* ប៊ូតុង → — អណ្ដែតខាងស្ដាំកណ្ដាល */}
          {viewerImagesList.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-50 bg-black/70 hover:bg-amber-600 hover:text-black hover:scale-115 active:scale-95 text-white p-2.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shadow-lg border border-white/10"
              title="រូបភាពបន្ទាប់"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* ប៊ូតុង Download + បិទ — អណ្ដែតខាងក្រោមកណ្ដាល */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => handleDownloadImage(viewerZoomSrc, e)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition font-battambang cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" /> ទាញយករូបភាព
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewerZoomSrc(null);
                setViewerImagesList([]);
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold rounded-lg cursor-pointer font-battambang"
            >
              បិទ
            </button>
          </div>
        </div>
      )}

      {/* PDF IN-APP VIEWER POPUP MODAL */}
      {pdfViewUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[999] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[92vh] flex flex-col overflow-hidden border border-slate-200/50">
            {/* Header / Config Bar */}
            <div className="bg-[#0f2c59] text-white p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="font-bold text-xs sm:text-sm font-moul truncate max-w-full">
                  {pdfViewTitle || 'មើលឯកសារ PDF'}
                </h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 select-none">
                <div className="flex items-center gap-1.5 font-battambang">
                  <a
                    href={pdfViewUrl}
                    download="score_sheet.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 px-3 bg-white/10 hover:bg-amber-600 text-white hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> បើកមើលក្រៅ
                  </a>
                  <button
                    onClick={() => setPdfViewUrl(null)}
                    className="text-white/80 hover:text-red-400 font-bold p-1 hover:scale-110 transition cursor-pointer"
                  >
                    <X className="w-5.5 h-5.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* IFrame Area Container */}
            <div className="flex-grow bg-slate-100 p-2.5 relative flex items-center justify-center">
              {/* Background elegant loading placeholder back of iframe */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none select-none z-0">
                <div className="w-10 h-10 rounded-full border-4 border-t-[#0f2c59] border-r-transparent border-b-[#0f2c59] border-l-transparent animate-spin mb-2"></div>
                <p className="text-xs font-battambang">កំពុងអានទំព័រឯកសារ PDF... សូមរង់ចាំ</p>
              </div>

              <iframe
                key={pdfViewerType + '-' + pdfViewUrl}
                src={
                  (() => {
                    const driveId = getDriveFileId(pdfViewUrl);
                    if (pdfViewerType === 'google') {
                      if (driveId) {
                        return `https://docs.google.com/viewer?srcid=${driveId}&embedded=true`;
                      } else {
                        // Make local URL absolute so Google Docs Viewer can crawl/render it
                        const absoluteUrl = pdfViewUrl.startsWith('http') ? pdfViewUrl : (window.location.origin + pdfViewUrl);
                        return `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;
                      }
                    } else if (pdfViewerType === 'direct') {
                      return pdfViewUrl;
                    } else {
                      // drive_preview
                      return driveId ? `https://drive.google.com/file/d/${driveId}/preview` : pdfViewUrl;
                    }
                  })()
                }
                className="w-full h-full border-0 rounded-xl bg-white shadow-xs relative z-10"
                title="PDF Displayer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
