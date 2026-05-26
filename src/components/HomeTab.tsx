/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Heart, Share2, Trash2, Edit3, Image as ImageIcon, Sliders, Save, Plus, CloudUpload } from 'lucide-react';
import { DBState, ActivityPost } from '../types';
import { compressImage, fileToBase64, getDriveFileId, estimateLinesAndTruncate } from '../utils';

interface HomeTabProps {
  dbState: DBState;
  isAdminLoggedIn: boolean;
  onUpdateDB: (data: Partial<DBState>) => Promise<void>;
  onZoomImage: (src: string, allImages?: string[]) => void;
  onPostActivity: (post: ActivityPost) => Promise<void>;
  onDeleteActivity: (id: string) => Promise<void>;
}

export default function HomeTab({
  dbState,
  isAdminLoggedIn,
  onUpdateDB,
  onZoomImage,
  onPostActivity,
  onDeleteActivity,
}: HomeTabProps) {
  // Slideshow state
  const [slideIndex, setSlideIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [slideToDeleteIndex, setSlideToDeleteIndex] = useState<number | null>(null);

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

  // Edit states for CMS Activity block
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDesc, setActivityDesc] = useState('');
  const [activityDrive, setActivityDrive] = useState('');
  const [activityUploading, setActivityUploading] = useState(false);
  const [activityPhotos, setActivityPhotos] = useState<string[]>([]);

  // Local state for limit
  const [activityLimit, setActivityLimit] = useState(4);

  // Slideshow timing
  const slides = dbState.home_slides || [];
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [slides]);

  const handleNextSlide = () => {
    setSlideIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrevSlide = () => {
    setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // Upload Logo directly
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 300, 300); // compress logo small
      
      // Upload binary to server
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: compressed, name: 'logo', ext: 'png' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        await onUpdateDB({ school_logo: resData.url });
      }
    } catch (err) {
      alert('កំហុសក្នុងការបង្ហោះរូបភាព Logo!');
    }
  };

  // Upload Header Background directly
  const handleHeaderBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 1600, 800, 0.7); // compress banner slightly compressed
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: compressed, name: 'header_bg', ext: 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        await onUpdateDB({ header_bg: resData.url });
      }
    } catch (err) {
      alert('កំហុសក្នុងការបង្ហោះរូបភាព Banner!');
    }
  };

  // Upload Slideshow Photos directly (multi upload support)
  const handleSlidesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const base64 = await fileToBase64(files[i]);
        const compressed = await compressImage(base64, 3000, 1500, 0.9);
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: compressed, name: `slide_${i}`, ext: 'jpg' })
        });
        const resData = await response.json();
        if (resData.status === 'success') {
          uploadedUrls.push(resData.url);
        }
      }
      if (uploadedUrls.length > 0) {
        await onUpdateDB({ home_slides: [...slides, ...uploadedUrls] });
      }
    } catch (err) {
      alert('កំហុសក្នុងការបង្ហោះរូបភាពគ្រាប់ស្លាយ!');
    }
  };

  // Reset Slideshow to initial
  const resetSlideshow = async () => {
    if (!isResetting) {
      setIsResetting(true);
      setTimeout(() => setIsResetting(false), 4000); // Reset state back after 4s
      return;
    }
    const initialSlides = [
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&q=80"
    ];
    await onUpdateDB({ home_slides: initialSlides });
    setSlideIndex(0);
    setIsResetting(false);
  };

  // Delete individual slide
  const handleDeleteSlide = async (indexToDelete: number) => {
    if (slides.length <= 1) {
      alert('ស្លាយត្រូវតែមានរូបភាពយ៉ាងហោចណាស់មួយសន្លឹក!');
      return;
    }
    if (slideToDeleteIndex !== indexToDelete) {
      setSlideToDeleteIndex(indexToDelete);
      setTimeout(() => setSlideToDeleteIndex(null), 4000); // Reset deletion confirm state after 4s
      return;
    }
    const updated = slides.filter((_, idx) => idx !== indexToDelete);
    await onUpdateDB({ home_slides: updated });
    if (slideIndex >= updated.length) {
      setSlideIndex(0);
    }
    setSlideToDeleteIndex(null);
  };

  // Replace individual slide
  const handleReplaceSlide = async (e: React.ChangeEvent<HTMLInputElement>, indexToReplace: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 3000, 1500, 0.9);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: compressed, name: `slide_replace_${indexToReplace}`, ext: 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        const updated = [...slides];
        updated[indexToReplace] = resData.url;
        await onUpdateDB({ home_slides: updated });
      }
    } catch (err) {
      alert('កំហុសក្នុងការប្ដូររូបភាពស្លាយ!');
    }
  };

  // Activities handlers
  const selectActivityForEdit = (act: ActivityPost | 'new') => {
    if (act === 'new') {
      setEditingActivityId(null);
      setActivityTitle('');
      setActivityDesc('');
      setActivityDrive('');
      setActivityPhotos([]);
    } else {
      setEditingActivityId(act.id);
      setActivityTitle(act.title);
      setActivityDesc(act.desc);
      setActivityDrive(act.driveLink);
      setActivityPhotos(act.images || []);
    }
  };

  // Multi-upload activity images with high performant canvas compression!
  const handleActivityImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setActivityUploading(true);
    const newPhotos: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await fileToBase64(file);
        // Compress photo to maximum 3000px on either dimension, preserving high quality and original detail
        const compressed = await compressImage(base64, 3000, 3000, 0.9);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: compressed, name: `activity_${i}`, ext: 'jpg' })
        });
        const resData = await response.json();
        if (resData.status === 'success') {
          newPhotos.push(resData.url);
        }
      }
      setActivityPhotos((prev) => [...prev, ...newPhotos]);
    } catch (err) {
      alert('កំហុសក្នុងការបង្ហោះរូបភាពសកម្មភាព!');
    } finally {
      setActivityUploading(false);
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim()) {
      alert('សូមបំពេញចំណងជើងសកម្មភាព!');
      return;
    }

    const newPost: ActivityPost = {
      id: editingActivityId || `act_${Date.now()}`,
      title: activityTitle,
      desc: activityDesc,
      images: activityPhotos,
      driveLink: activityDrive,
      likes: editingActivityId
        ? (dbState.activities_posts.find((x) => x.id === editingActivityId)?.likes || 0)
        : 0,
      date: editingActivityId
        ? (dbState.activities_posts.find((x) => x.id === editingActivityId)?.date || new Date().toISOString())
        : new Date().toLocaleDateString('km-KH') + ' ម៉ោង ' + new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };

    await onPostActivity(newPost);
    // Reset inputs
    setEditingActivityId(null);
    setActivityTitle('');
    setActivityDesc('');
    setActivityDrive('');
    setActivityPhotos([]);
  };

  const handleLike = async (act: ActivityPost) => {
    const updatedPost = { ...act, likes: (act.likes || 0) + 1 };
    await onPostActivity(updatedPost);
  };

  const shareActivity = (act: ActivityPost) => {
    if (navigator.share) {
      navigator.share({
        title: act.title,
        text: act.desc,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('បានចម្លងតំណភ្ជាប់ទៅកាន់ Clipboard!');
    }
  };

  // Collage grid markup builder based on image array counts
  const renderCollageGrid = (act: ActivityPost) => {
    const mediaUrls = [...(act.images || [])];
    const driveId = getDriveFileId(act.driveLink);
    if (driveId && mediaUrls.length === 0) {
      mediaUrls.push(`https://lh3.googleusercontent.com/d/${driveId}=w800`);
    }

    if (mediaUrls.length === 0) return null;

    const count = mediaUrls.length;
    if (count === 1) {
      return (
        <div
          className="mt-3 w-full aspect-[4/3.6] h-[230px] sm:h-[307px] md:h-[345px] max-h-[384px] min-h-[216px] overflow-hidden rounded border border-gray-100 bg-black/5 relative group cursor-pointer"
          onClick={() => onZoomImage(mediaUrls[0], mediaUrls)}
        >
          <img src={mediaUrls[0]} className="w-full h-full object-cover transition duration-300 group-hover:scale-105" alt="Activity" referrerPolicy="no-referrer" />
        </div>
      );
    } else if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-1.5 mt-3 w-full aspect-[4/3.6] h-[230px] sm:h-[307px] md:h-[345px] max-h-[384px] min-h-[216px] overflow-hidden rounded border border-gray-100 bg-black/5">
          {mediaUrls.map((src, i) => (
            <div
              key={i}
              className="h-full overflow-hidden relative group cursor-pointer"
              onClick={() => onZoomImage(src, mediaUrls)}
            >
              <img src={src} className="w-full h-full object-cover transition duration-300 group-hover:scale-105" alt="Activity Grid" referrerPolicy="no-referrer" />
            </div>
          ))}
        </div>
      );
    } else {
      const remaining = count - 3;
      return (
        <div className="grid grid-cols-3 gap-1.5 mt-3 w-full aspect-[4/3.6] h-[230px] sm:h-[307px] md:h-[345px] max-h-[384px] min-h-[216px] overflow-hidden rounded border border-gray-100 bg-black/5">
          <div
            className="col-span-2 h-full overflow-hidden relative group cursor-pointer"
            onClick={() => onZoomImage(mediaUrls[0], mediaUrls)}
          >
            <img src={mediaUrls[0]} className="w-full h-full object-cover transition duration-300 group-hover:scale-102" alt="Activity Main" referrerPolicy="no-referrer" />
          </div>
          <div className="grid grid-rows-2 gap-1.5 h-full">
            <div
              className="overflow-hidden relative group cursor-pointer h-full"
              onClick={() => onZoomImage(mediaUrls[1], mediaUrls)}
            >
              <img src={mediaUrls[1]} className="w-full h-full object-cover transition duration-300 group-hover:scale-105" alt="Activity Small" referrerPolicy="no-referrer" />
            </div>
            <div
              className="overflow-hidden relative group cursor-pointer h-full bg-slate-900"
              onClick={() => onZoomImage(mediaUrls[2], mediaUrls)}
            >
              <img src={mediaUrls[2]} className="w-full h-full object-cover transition duration-300 group-hover:scale-105 opacity-80" alt="Activity Grid" referrerPolicy="no-referrer" />
              {remaining > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xs font-battambang">
                  +{remaining} រូប
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. CMS Settings Section (Admin Only) */}
      {isAdminLoggedIn && (
        <div className="bg-white p-3.5 rounded shadow-sm border-t-4 border-amber-600 space-y-3 animate-in fade-in duration-200">
          <h3 className="text-sm md:text-base font-bold text-gray-800 flex items-center gap-2 font-moul mb-2">
            <Sliders className="w-4 h-4 text-amber-600" />
            គ្រប់គ្រងការរចនា និងស្លាយទំព័រដើម (CMS Panel)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-battambang text-xs text-gray-700">
            <div className="bg-slate-50 p-3.5 rounded border border-gray-150 flex flex-col justify-between">
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">១. បង្ហោះ Logo សាលារៀន (PNG/Square)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0f2c59] hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2">បង្ហោះរហ័ស - ប្ដូរភ្លាមៗស្វ័យប្រវត្តលើកាត និងក្បាលទំព័រ</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded border border-gray-150 flex flex-col justify-between">
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">២. បង្ហោះរូបភាពក្បាលទំព័រ (Header Banner)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeaderBgUpload}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0f2c59] hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2">គាំទ្រ JPEG/PNG - ប្រព័ន្ធនឹងបង្ហោះនិងប្ដូរផ្ទៃក្រោយស្វ័យប្រវត្តិ</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded border border-gray-150 flex flex-col justify-between">
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">៣. បង្ហោះរូបភាពស្លាយថ្មី (Home Slideshow - Multi)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleSlidesUpload}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0f2c59] hover:file:bg-blue-100 cursor-pointer"
                />

                {/* Grid of current slides with individual Delete/Replace actions */}
                {slides.length > 0 && (
                  <div className="mt-3 grid grid-cols-5 gap-1.5 pt-3 border-t border-gray-150">
                    {slides.map((slide, idx) => (
                      <div key={idx} className="relative group/thumb border border-gray-200 rounded overflow-hidden aspect-[16/9] bg-slate-900 shadow-sm">
                        <img src={slide} className="w-full h-full object-cover" alt="" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center gap-1 transition-opacity duration-150">
                          {/* Replace Icon */}
                          <label className="p-1 bg-amber-500 rounded text-slate-950 hover:bg-amber-400 cursor-pointer" title="ប្ដូររូប">
                            <Edit3 className="w-3 h-3" />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleReplaceSlide(e, idx)}
                              className="hidden"
                            />
                          </label>
                          {/* Delete Icon */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSlide(idx)}
                            className={`p-1 rounded text-white cursor-pointer select-none transition-all duration-150 flex items-center justify-center ${
                              slideToDeleteIndex === idx 
                                ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-2 animate-bounce' 
                                : 'bg-red-600 hover:bg-red-500'
                            }`}
                            title={slideToDeleteIndex === idx ? "ចុចម្ដងទៀតដើម្បីលុប" : "លុប"}
                          >
                            {slideToDeleteIndex === idx ? (
                              <span className="text-[8px] font-extrabold leading-none">លុប?</span>
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="absolute bottom-0 right-0 bg-black/75 text-white text-[8px] px-0.5 font-mono">
                          #{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-2 border-t pt-2 border-gray-200 font-battambang">
                <span className="text-[10px] text-gray-400">គាំទ្រការរើសរូបភាពច្រើន និងអាចកែ/លុបរូបនីមួយបាន</span>
                {isResetting ? (
                  <button
                    onClick={resetSlideshow}
                    className="text-[9px] text-yellow-700 bg-yellow-50 px-2 py-1 rounded border border-yellow-200 animate-pulse font-extrabold cursor-pointer"
                  >
                    ⚠️ ចុចម្ដងទៀតដើម្បីបញ្ជាក់ការកំណត់ឡើងវិញ!
                  </button>
                ) : (
                  <button
                    onClick={resetSlideshow}
                    className="text-[10px] text-red-500 hover:underline hover:text-red-650 font-bold cursor-pointer"
                  >
                    កំណត់ស្លាយឡើងវិញ
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Interactive Slideshow */}
      {slides.length > 0 ? (
        <div className="relative w-full aspect-[16/9] h-[270px] sm:h-[345px] md:h-[456px] lg:h-[540px] min-h-[240px] md:aspect-[19/7.2] rounded shadow-md overflow-hidden bg-slate-950 group">
          <div
            className="w-full h-full relative cursor-zoom-in"
            onClick={() => onZoomImage(slides[slideIndex], slides)}
          >
            <img
              src={slides[slideIndex]}
              className="w-full h-full object-cover select-none pointer-events-none transition-all duration-700 ease-in-out transform scale-100"
              alt="School Carousel"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 md:p-6 text-white select-none">
              <p className="text-[10px] md:text-xs font-battambang text-gray-300 mt-1 leading-relaxed">
                ចុចលើរូបភាពដើម្បីពង្រីកពេញ ឬទាញយករក្សាទុក។ ស្លាយនេះនឹងរត់ប្ដូរបង្ហាញរូបជាបន្តបន្ទាប់។
              </p>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrevSlide();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition hover:bg-black/60 focus:outline-none cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNextSlide();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition hover:bg-black/60 focus:outline-none cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 select-none">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setSlideIndex(i);
                }}
                className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                  i === slideIndex ? 'bg-amber-400 w-4' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full aspect-[16/9] md:aspect-[21/9] rounded bg-slate-900 border border-gray-850 flex flex-col items-center justify-center text-gray-500">
          <ImageIcon className="w-12 h-12 stroke-1 mb-2 animate-pulse" />
          <p className="text-xs font-battambang">មិនទាន់មានរូបភាពស្លាយនៅឡើយទេ</p>
        </div>
      )}

      {/* 3. School Activities CMS Editor Form (Admin Only) */}
      {isAdminLoggedIn && (
        <div className="bg-white p-3.5 rounded shadow-sm border-t-4 border-[#0f2c59] space-y-3 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-sm md:text-base font-bold text-[#0f2c59] flex items-center gap-2 font-moul">
              <Plus className="w-4 h-4 text-amber-500" />
              {editingActivityId ? 'កែសម្រួលសកម្មភាពសាលារៀន' : 'បង្កើតសកម្មភាពសាលារៀនថ្មី'}
            </h3>
            {editingActivityId && (
              <button
                onClick={() => selectActivityForEdit('new')}
                className="text-xs text-amber-600 hover:underline font-bold font-battambang"
              >
                បង្កើតថ្មីជំនួសវិញ
              </button>
            )}
          </div>

          <form onSubmit={handleSaveActivity} className="space-y-3 font-battambang text-xs text-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-500 mb-1">ចំណងជើងសកម្មភាព *</label>
                <input
                  type="text"
                  required
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="ឧ. ពិធីប្រកាសទទួលស្គាល់សិស្សពូកែថ្នាក់ជាតិ"
                  className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-500 mb-1">តំណយោង Google Drive (បើមាន)</label>
                <input
                  type="text"
                  value={activityDrive}
                  onChange={(e) => setActivityDrive(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-500 mb-1">ខ្លឹមសារពិពណ៌នាសកម្មភាព</label>
              <textarea
                rows={3}
                value={activityDesc}
                onChange={(e) => setActivityDesc(e.target.value)}
                placeholder="រៀបរាប់ពីព្រឹត្តិការណ៍សកម្មភាពសាលា..."
                className="w-full px-3 py-2 border rounded-lg text-sm text-black bg-white"
              />
            </div>

            <div className="bg-slate-50 p-3.5 border border-dashed rounded flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="w-full md:w-auto">
                <label className="block font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                  <CloudUpload className="w-4 h-4 text-blue-600" />
                  បង្ហោះរូបភាព និងប្រព័ន្ធនឹងបង្រួមភ្លាមដើម្បីល្បឿនលឿន (Multi Output)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleActivityImagesChange}
                  className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                />
              </div>
              
              {activityPhotos.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-[300px] py-1 border-l pl-4">
                  {activityPhotos.map((p, i) => (
                    <div key={i} className="relative w-10 h-10 border rounded overflow-hidden flex-shrink-0 group">
                      <img src={p} className="w-full h-full object-cover" alt="Thumb" />
                      <button
                        type="button"
                        onClick={() => setActivityPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-red-600/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer text-[9px] font-bold"
                      >
                        លុប
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={activityUploading}
              className="px-5 py-2.5 bg-[#0f2c59] hover:bg-blue-800 text-white font-bold rounded-lg transition text-xs shadow flex items-center gap-2 cursor-pointer disabled:bg-gray-400"
            >
              <Save className="w-4 h-4 text-amber-400" />
              {activityUploading ? 'កំពុងបង្ហោះ...' : editingActivityId ? 'រក្សាទុកការកែប្រែ' : 'បង្ហោះផ្សាយសកម្មភាព'}
            </button>
          </form>
        </div>
      )}

      {/* 4. Activities Grid list */}
      <div className="space-y-3">
        <h2 className="text-base md:text-lg font-bold font-moul text-blue-900 border-b pb-2 flex items-center gap-2 mb-4">
          <ImageIcon className="w-5 h-5 text-amber-500" /> ព្រឹត្តិការណ៍ និងសកម្មភាពរបស់សាលារៀន
        </h2>
        
        {dbState.activities_posts.length === 0 ? (
          <div className="text-center p-12 bg-white rounded border border-gray-150 text-gray-400 text-xs font-battambang">
            មិនទាន់មានអត្ថបទសកម្មភាពនៅឡើយទេ
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {dbState.activities_posts.slice(0, activityLimit).map((act) => (
              <div
                key={act.id}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded shadow-md hover:shadow-lg transition-all duration-300 p-3.5 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-blue-900 font-battambang text-[15px] line-clamp-1 flex-1">
                      {act.title}
                    </h3>
                  </div>

                  <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 border-b pb-1.5">
                    {act.date}
                  </span>

                  <p className="text-[13px] text-gray-500 font-battambang leading-relaxed whitespace-pre-line break-words">
                    {(() => {
                      const isLongText = estimateLinesAndTruncate(act.desc, 2, 42).hasMore;
                      if (!isLongText) {
                        return act.desc;
                      }
                      const oneLineText = estimateLinesAndTruncate(act.desc, 1, 42).truncatedText;
                      return (
                        <>
                          {expandedPostId === act.id 
                            ? act.desc 
                            : `${oneLineText}...`
                          }
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPostId(expandedPostId === act.id ? null : act.id);
                            }}
                            className="text-amber-600 hover:text-amber-700 font-bold ml-1 hover:underline cursor-pointer focus:outline-none inline-block font-battambang text-[13px]"
                          >
                            {expandedPostId === act.id ? ' (លាក់វិញ)' : ' (អានបន្ថែម)'}
                          </button>
                        </>
                      );
                    })()}
                  </p>

                  {renderCollageGrid(act)}
                </div>

                <div className="flex items-center justify-between border-t pt-3 mt-4 text-gray-500 text-[11px] font-battambang font-semibold">
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => handleLike(act)}
                      className="hover:text-blue-600 active:scale-95 flex items-center gap-1 transition py-1.5 px-3 bg-slate-50 hover:bg-blue-50 rounded-full border border-gray-100 shadow-3xs cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                      <span>ចូលចិត្ត ({act.likes || 0})</span>
                    </button>
                    <button
                      onClick={() => shareActivity(act)}
                      className="hover:text-green-600 active:scale-95 flex items-center gap-1 transition py-1.5 px-3 bg-slate-50 hover:bg-green-50 rounded-full border border-gray-100 shadow-3xs cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-green-600" />
                      <span>ចែករំលែក</span>
                    </button>
                  </div>

                  {isAdminLoggedIn && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectActivityForEdit(act)}
                        className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> កែប្រែ
                      </button>
                      <button
                        onClick={() => onDeleteActivity(act.id)}
                        className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> លុប
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Trigger */}
        {dbState.activities_posts.length > activityLimit && (
          <div className="pt-6 flex justify-center">
            <button
              onClick={() => setActivityLimit((prev) => prev + 4)}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-[#0f2c59] font-bold text-xs rounded-full transition shadow-md hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 font-battambang"
            >
              បង្ហាញសកម្មភាពច្រើនទៀត
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
