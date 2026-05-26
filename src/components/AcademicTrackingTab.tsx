/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Clock, Plus, Trash2, Edit, FileText, Globe } from 'lucide-react';
import { DBState, AcademicPost } from '../types';
import { fileToBase64, compressImage, estimateLinesAndTruncate } from '../utils';

interface AcademicProps {
  dbState: DBState;
  isAdminLoggedIn: boolean;
  onPostAcademic: (post: AcademicPost) => Promise<void>;
  onDeleteAcademic: (id: string) => Promise<void>;
  onZoomImage: (src: string, allImages?: string[]) => void;
  onViewPdf: (url: string, title: string) => void;
}

export default function AcademicTrackingTab({
  dbState,
  isAdminLoggedIn,
  onPostAcademic,
  onDeleteAcademic,
  onZoomImage,
  onViewPdf,
}: AcademicProps) {
  // Filters
  const [gradeFilter, setGradeFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  // Expanded post ID for read-more functionality
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setExpandedPostId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Input states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('12');
  const [year, setYear] = useState('2025-2026');
  const [content, setContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [uploadeBusy, setUploadBusy] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setGrade('12');
    setYear('2025-2026');
    setContent('');
    setFileUrl('');
    setCoverUrl('');
    setDriveUrl('');
    setShowForm(false);
  };

  const editPost = (post: AcademicPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setGrade(post.grade);
    setYear(post.year);
    setContent(post.content);
    setFileUrl(post.file || '');
    setCoverUrl(post.cover || '');
    setDriveUrl(post.driveLink || '');
    setShowForm(true);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadBusy(true);
    try {
      const isPdf = file.type === 'application/pdf';
      const base64 = await fileToBase64(file);
      
      let pFile = base64;
      if (!isPdf) {
        // Compress images but retain high quality and original detail
        pFile = await compressImage(base64, 3000, 3000, 0.9);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: pFile, name: 'bulletin', ext: isPdf ? 'pdf' : 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        setFileUrl(resData.url);
      }
    } catch (err) {
      alert('កំហុសក្នុងការបង្ហោះឯកសារ!');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 600, 420, 0.75); // cover image small
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: compressed, name: 'cover', ext: 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        setCoverUrl(resData.url);
      }
    } catch (err) {
      alert('កំហុសបង្ហោះរូបភាពក្រប!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newPost: AcademicPost = {
      id: editingId || `ac_${Date.now()}`,
      title,
      grade,
      year,
      content,
      file: fileUrl,
      cover: coverUrl,
      driveLink: driveUrl,
      date: editingId
        ? (dbState.academic_posts.find((x) => x.id === editingId)?.date || new Date().toLocaleDateString('km-KH'))
        : new Date().toLocaleDateString('km-KH') + ' ម៉ោង ' + new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };

    await onPostAcademic(newPost);
    resetForm();
  };

  const poolYears = Array.from(new Set(dbState.academic_posts.map((x) => x.year))).sort();

  const filteredPosts = dbState.academic_posts.filter((p) => {
    const matchesGrade = gradeFilter === 'all' || p.grade === gradeFilter;
    const matchesYear = yearFilter === 'all' || p.year === yearFilter;
    return matchesGrade && matchesYear;
  });

  const handleDocumentView = (post: AcademicPost) => {
    const isDocPdf = post.file?.endsWith('.pdf') || post.driveLink?.includes('drive.google.com');
    if (isDocPdf) {
      onViewPdf(post.file || post.driveLink, post.title);
    } else if (post.file) {
      const pictures = [post.cover, post.file].filter(Boolean) as string[];
      onZoomImage(post.file, pictures);
    } else {
      alert('មិនទាន់មានឯកសាររៀបចំឡើងឡើយ!');
    }
  };

  return (
    <div className="space-y-4">
      {/* Grade Selector sub menu sticky */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2.5 rounded border font-battambang shadow-2xs">
        <div className="flex flex-wrap gap-2.5">
          {['all', '7', '8', '9', '10', '11', '12'].map((g) => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-4 py-1.5 rounded-full transition-all text-xs font-bold cursor-pointer ${
                gradeFilter === g
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {g === 'all' ? 'ថ្នាក់ទាំងអស់' : `ថ្នាក់ទី${g}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-700 font-bold">
          <span>ឆ្នាំសិក្សា៖</span>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-2.5 py-1.5 border rounded-lg bg-white text-black font-semibold text-xs"
          >
            <option value="all">ទាំងអស់</option>
            {poolYears.map((y, i) => (
              <option key={i} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Admin Post editor panel (Admin only) */}
      {isAdminLoggedIn && (
        <div className="bg-white p-3.5 rounded border border-amber-200 bg-amber-50/15 space-y-3 animate-in fade-in duration-200 text-xs font-battambang text-gray-700">
          <div className="flex justify-between items-center border-b border-amber-200 pb-2">
            <h4 className="font-bold text-amber-800 flex items-center gap-1 font-moul">
              <BookOpen className="w-4 h-4 text-amber-500 animate-bounce" />
              {editingId ? 'កែសម្រួលលទ្ធផលសិក្សា' : 'បង្ហោះព័ត៌មានលទ្ធផលសិក្សាថ្មី'}
            </h4>
            {editingId && (
              <button onClick={resetForm} className="text-red-500 hover:underline font-bold">
                បោះបង់
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-gray-500 font-bold mb-1">ចំណងជើងព័ត៌មាន *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ឧ. តារាងពិន្ទុឆមាសទី២ ថ្នាក់ទី១២A"
                  className="w-full px-3 py-2 border rounded-lg bg-white text-black text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-gray-500 font-bold mb-1">កម្រិតថ្នាក់</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-black font-bold"
                >
                  <option value="7">ថ្នាក់ទី៧</option>
                  <option value="8">ថ្នាក់ទី៨</option>
                  <option value="9">ថ្នាក់ទី៩</option>
                  <option value="10">ថ្នាក់ទី១០</option>
                  <option value="11">ថ្នាក់ទី១១</option>
                  <option value="12">ថ្នាក់ទី១២</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 font-bold mb-1">ឆ្នាំសិក្សា *</label>
                <input
                  type="text"
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="ឧ. 2025-2026"
                  className="w-full px-3 py-2 border rounded-lg bg-white text-black text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-500 font-bold mb-1">ខ្លឹមសារពិពណ៌នាលម្អិត</label>
              <textarea
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="រៀបរាប់ព័ត៌មានបន្ថែម..."
                className="w-full px-3 py-2 border rounded-lg bg-white text-black text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-dashed pt-3">
              <div>
                <label className="block font-bold text-gray-500 mb-1">១. រូបភាព ឬ ឯកសារ PDF លទ្ធផល</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleDocumentUpload}
                  className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-blue-50 file:text-blue-700"
                />
                {fileUrl && <span className="text-[10px] text-blue-600 block mt-1 truncate">ឯកសារ៖ {fileUrl}</span>}
              </div>
              <div>
                <label className="block font-bold text-gray-500 mb-1">២. រូបភាពក្រប (Cover Image A4 Horizontal)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-blue-50 file:text-blue-700"
                />
                {coverUrl && <span className="text-[10px] text-green-600 block mt-1 truncate">ក្រប៖ {coverUrl}</span>}
              </div>
              <div>
                <label className="block font-bold text-gray-500 mb-1">៣. តំណលីង Google Drive (បើមាន)</label>
                <input
                  type="text"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-1.5 border rounded-lg bg-white text-black text-[11px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={uploadeBusy}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition font-bold text-xs cursor-pointer"
            >
              {uploadeBusy ? 'កំពុងដំណើរការ...' : 'រក្សាទុកព័ត៌មាន'}
            </button>
          </form>
        </div>
      )}

      {/* Grid of list matching original render template */}
      {filteredPosts.length === 0 ? (
        <div className="text-center p-12 bg-white rounded border border-gray-150 text-gray-400 text-xs font-battambang">
          មិនទាន់មានលទ្ធផលឬសេចក្តីជូនដំណឹងអំពីកម្រិតថ្នាក់នេះនៅឡើយទេ
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {filteredPosts.map((p) => {
            const defaultCover = `data:image/svg+xml;utf8,${encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 297 210' width='297' height='210'><rect width='297' height='210' fill='#f1f5f9'/><text x='148' y='110' font-family="'Kantumruy Pro', sans-serif" font-size='12' font-weight='bold' fill='#1e3a8a' text-anchor='middle'>សេចក្តីជូនដំណឹងលទ្ធផល</text></svg>`
            )}`;

            return (
              <div
                key={p.id}
                onClick={(e) => e.stopPropagation()}
                className="p-3.5 bg-white rounded shadow-md hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Text content details at the top */}
                  <div className="space-y-2 font-battambang text-xs text-gray-700">
                    <h3 className="font-bold text-[#0f2c59] font-battambang text-[15px] line-clamp-1">{p.title}</h3>

                    <div className="flex justify-between items-center text-[10.5px] text-gray-500">
                      <span className="font-mono flex items-center gap-1 text-left">
                        <Clock className="w-3.5 h-3.5" /> {p.date}
                      </span>
                      <div className="flex gap-2 justify-end">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-full font-bold">
                          ថ្នាក់ទី{p.grade}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-full font-bold">
                          {p.year}
                        </span>
                      </div>
                    </div>

                    <hr className="border-black/20 my-1.5" />

                    <p className="text-[13px] text-gray-500 font-battambang leading-relaxed whitespace-pre-line break-words">
                      {(() => {
                        const isLongText = estimateLinesAndTruncate(p.content, 2, 42).hasMore;
                        if (!isLongText) {
                          return p.content;
                        }
                        const oneLineText = estimateLinesAndTruncate(p.content, 1, 42).truncatedText;
                        return (
                          <>
                            {expandedPostId === p.id 
                              ? p.content 
                              : `${oneLineText}...`
                            }
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPostId(expandedPostId === p.id ? null : p.id);
                              }}
                              className="text-amber-600 hover:text-amber-700 font-bold ml-1 hover:underline cursor-pointer focus:outline-none inline-block font-battambang text-[13px]"
                            >
                              {expandedPostId === p.id ? ' (លាក់វិញ)' : ' (អានបន្ថែម)'}
                            </button>
                          </>
                        );
                      })()}
                    </p>
                  </div>

                  {/* Photo or A4 file preview frame at the bottom */}
                  <div
                    className="w-full aspect-[4/3.6] max-h-[360px] overflow-hidden rounded border border-gray-200 relative group cursor-pointer"
                    onClick={() => handleDocumentView(p)}
                  >
                    <img
                      src={p.cover || p.file || defaultCover}
                      className="w-full h-full object-cover group-hover:scale-102 transition"
                      alt="Bulletin Cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold font-battambang">
                      ចុចដើម្បីមើលលម្អិត
                    </div>
                  </div>
                </div>

                {isAdminLoggedIn && (
                  <div className="flex items-center justify-end border-t pt-3 mt-4 text-[10px] font-bold font-battambang text-gray-500">
                    <div className="flex gap-2">
                      <button
                        onClick={() => editPost(p)}
                        className="text-amber-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" /> កែប្រែ
                      </button>
                      <button
                        onClick={() => onDeleteAcademic(p.id)}
                        className="text-red-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> លុប
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
