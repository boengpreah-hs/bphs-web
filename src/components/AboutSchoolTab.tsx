/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Info, MapPin, Phone, Edit, Image as ImageIcon, Heart, Globe, Save, Users, Trash2, Plus, User, X } from 'lucide-react';
import { DBState, AboutSchool, StaffMember } from '../types';
import { fileToBase64, compressImage, getEmbedMapUrl } from '../utils';

interface AboutProps {
  dbState: DBState;
  isAdminLoggedIn: boolean;
  onUpdateDB: (data: Partial<DBState>) => Promise<void>;
  onZoomImage?: (src: string, allImages?: string[]) => void;
}

export default function AboutSchoolTab({
  dbState,
  isAdminLoggedIn,
  onUpdateDB,
  onZoomImage,
}: AboutProps) {
  const [showEdit, setShowEdit] = useState(false);

  // Editable fields local state
  const [title, setTitle] = useState(dbState.about_school.title || 'វិទ្យាល័យបឹងព្រះ');
  const [details, setDetails] = useState(dbState.about_school.details || '');
  const [phone, setPhone] = useState(dbState.about_school.phone || '0966187972');
  const [mapUrl, setMapUrl] = useState(dbState.about_school.map || '');
  const [image, setImage] = useState(dbState.about_school.image || '');

  // Staff interactive in-card editing states
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffRole, setEditStaffRole] = useState('គ្រូបង្រៀន');
  const [editStaffSubject, setEditStaffSubject] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffPhoto, setEditStaffPhoto] = useState('');
  const [isStaffUploading, setIsStaffUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      // Compress about school image
      const compressed = await compressImage(base64, 800, 500, 0.75);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: compressed, name: 'about_logo', ext: 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        setImage(resData.url);
      } else {
        setImage(compressed);
      }
    } catch (err) {
      alert('កំហុសក្នុងការបង្ហោះរូបភាពសាលា!');
    }
  };

  const handlePhotoDrop = async (e: React.DragEvent<HTMLDivElement>, memberId: string) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setIsStaffUploading(true);
    try {
      const base64 = await fileToBase64(file);
      // Preserve absolute original resolution entirely
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, name: 'staff_photo', ext: 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        setEditStaffPhoto(resData.url);
      } else {
        setEditStaffPhoto(base64);
      }
    } catch (err) {
      alert('កំហុសក្នុងការអាប់ឡូតរូបភាព!');
    } finally {
      setIsStaffUploading(false);
    }
  };

  const handleStaffPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsStaffUploading(true);
    try {
      const base64 = await fileToBase64(file);
      // Preserve original resolution entirely (No compression inside compressImage because it acts as identity Promise in utils.ts)
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, name: 'staff_photo', ext: 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        setEditStaffPhoto(resData.url);
      } else {
        setEditStaffPhoto(base64);
      }
    } catch (err) {
      alert('កំហុសក្នុងការបង្ហោះរូបបុគ្គលិក!');
    } finally {
      setIsStaffUploading(false);
    }
  };

  const handleSaveAbout = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAbout: AboutSchool = {
      title,
      details,
      phone,
      map: mapUrl,
      image,
    };

    await onUpdateDB({ about_school: updatedAbout });
    setShowEdit(false);
  };

  // Triggers creation of a new blank card and immediately sets editing state
  const handleAddNewStaffCard = async () => {
    const tempId = 'temp_' + Date.now();
    const newStaff: StaffMember = {
      id: tempId,
      name: '',
      role: 'គ្រូបង្រៀន',
      subject: '',
      phone: '',
      photo: ''
    };
    
    const currentStaffMembers = dbState.staff_members || [];
    await onUpdateDB({
      staff_members: [...currentStaffMembers, newStaff]
    });
    
    // Set edit states
    setEditingStaffId(tempId);
    setEditStaffName('');
    setEditStaffRole('គ្រូបង្រៀន');
    setEditStaffSubject('');
    setEditStaffPhone('');
    setEditStaffPhoto('');
  };

  const handleStartInCardEdit = (member: StaffMember) => {
    setEditingStaffId(member.id);
    setEditStaffName(member.name);
    setEditStaffRole(member.role || 'គ្រូបង្រៀន');
    setEditStaffSubject(member.subject || '');
    setEditStaffPhone(member.phone || '');
    setEditStaffPhoto(member.photo || '');
  };

  const handleSaveInCardEdit = async (id: string) => {
    if (!editStaffName.trim()) {
      alert('សូមបញ្ចូលឈ្មោះបុគ្គលិក!');
      return;
    }
    const currentStaffMembers = dbState.staff_members || [];
    const updatedStaff = currentStaffMembers.map(s => {
      if (s.id === id) {
        return {
          ...s,
          name: editStaffName.trim(),
          role: editStaffRole.trim() || 'គ្រូបង្រៀន',
          subject: editStaffSubject.trim() || undefined,
          phone: editStaffPhone.trim() || undefined,
          photo: editStaffPhoto || undefined
        };
      }
      return s;
    });
    await onUpdateDB({ staff_members: updatedStaff });
    setEditingStaffId(null);
  };

  const handleCancelEditing = async (id: string, isNew: boolean) => {
    setEditingStaffId(null);
    if (isNew) {
      // Discard empty temporary cards
      const currentStaff = dbState.staff_members || [];
      const updatedStaff = currentStaff.filter(s => s.id !== id);
      await onUpdateDB({ staff_members: updatedStaff });
    }
  };

  const handleDeleteStaff = (id: string) => {
    setStaffToDelete(id);
  };

  const handleConfirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    const currentStaffMembers = dbState.staff_members || [];
    const updatedStaff = currentStaffMembers.filter((s) => s.id !== staffToDelete);
    await onUpdateDB({ staff_members: updatedStaff });
    if (editingStaffId === staffToDelete) {
      setEditingStaffId(null);
    }
    setStaffToDelete(null);
  };

  const activeAbout = dbState.about_school;
  const mapEmbedSrc = getEmbedMapUrl(activeAbout.map);
  const staffList = dbState.staff_members || [];

  return (
    <div className="bg-white p-3.5 rounded shadow-xs border-t-4 border-blue-900 space-y-4">
      <div className="flex justify-between items-center border-b pb-3">
        <h2 className="text-sm md:text-base font-bold font-moul text-blue-900 flex items-center gap-1.5">
          <Info className="w-5 h-5 text-amber-500" /> ព័ត៌មានសង្ខេបរបស់សាលារៀន
        </h2>
        {isAdminLoggedIn && !showEdit && (
          <button
            onClick={() => {
              setTitle(activeAbout.title || '');
              setDetails(activeAbout.details || '');
              setPhone(activeAbout.phone || '');
              setMapUrl(activeAbout.map || '');
              setImage(activeAbout.image || '');
              setShowEdit(true);
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 font-battambang"
          >
            <Edit className="w-4 h-4" /> កែប្រែព័ត៌មានសាលា
          </button>
        )}
      </div>

      {!showEdit ? (
        <div id="about-display-area" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-gray-700 font-battambang">
            {/* Text fields */}
            <div className="lg:col-span-7 space-y-4">
              <h3 id="about-school-title" className="font-moul text-[#0f2c59] text-base font-bold">
                {activeAbout.title || 'វិទ្យាល័យបឹងព្រះ'}
              </h3>
              <p id="about-school-details" className="text-xs md:text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {activeAbout.details ||
                  'វិទ្យាល័យបឹងព្រះ គឺជាគ្រឹះស្ថានសិក្សាសាធារណៈគំរូមួយដែលបានបណ្តុះបណ្តាលសិស្សានុសិស្សប្រកបដោយគុណភាព វិន័យ សីលធម៌ និងការទទួលខុសត្រូវខ្ពស់។'}
              </p>
              <div className="space-y-1 bg-slate-50 p-3 rounded border text-gray-700">
                <span className="font-bold text-[#0f2c59]">លេខទូរស័ព្ទទំនាក់ទំនងសាលា</span>
                <div className="flex items-center gap-1">
                  <span>លេខទូរស័ព្ទ៖</span>
                  <a
                    href={`tel:${activeAbout.phone || '0966187972'}`}
                    className="font-bold text-blue-900 hover:underline hover:text-blue-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {activeAbout.phone || '0966187972'}
                  </a>
                </div>
              </div>
            </div>

            {/* Photo banner */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              {activeAbout.image ? (
                <img
                  id="about-school-img"
                  src={activeAbout.image}
                  alt="School view"
                  className="w-full h-auto object-contain rounded shadow border"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div id="about-school-img-placeholder" className="w-full h-[180px] bg-slate-50 flex flex-col items-center justify-center rounded border border-dashed text-gray-400">
                  <ImageIcon className="w-10 h-10 stroke-1" />
                  <span className="text-[10px]">មិនទាន់មានរូបភាពសាលារៀន</span>
                </div>
              )}
            </div>
          </div>

          {/* STAFF & BOARD SECTION */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-sm md:text-base font-bold font-moul text-blue-900 flex items-center gap-1.5">
                <Users className="w-5 h-5 text-amber-500" /> គណៈគ្រប់គ្រង លោកគ្រូ-អ្នកគ្រូ
              </h2>
              {isAdminLoggedIn && staffList.length === 0 && (
                <button
                  onClick={handleAddNewStaffCard}
                  className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 font-battambang"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" /> បន្ថែមព័ត៌មានបុគ្គលិកថ្មី
                </button>
              )}
            </div>

            {/* Staff Grid containing card-shaped profiles */}
            {staffList.length === 0 ? (
              <div className="py-8 text-center text-gray-400 font-battambang text-xs border border-dashed rounded-xl">
                គ្មានទិន្នន័យគ្រូទេ! {isAdminLoggedIn && 'សូមចុចប៊ូតុងខាងលើដើម្បីបញ្ជូលសមាជិកថ្មី!'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full items-start">
                {staffList.map((member) => {
                  const isEditingThis = editingStaffId === member.id;

                  if (isEditingThis) {
                    return (
                      <div
                        key={member.id}
                        className="bg-white border-2 border-amber-400 shadow-md rounded-2xl overflow-hidden transition duration-200 relative flex flex-col items-center p-5 text-center text-black"
                      >
                        {/* Drag and Drop portrait frame */}
                        <div
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={(e) => handlePhotoDrop(e, member.id)}
                          className="w-40 h-48 mb-4 bg-amber-50 rounded-xl overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-amber-300 shadow-xs shrink-0 select-none relative group/drop"
                        >
                          {editStaffPhoto ? (
                            <>
                              <img
                                src={editStaffPhoto}
                                alt="Staff portrait"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => setEditStaffPhoto('')}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover/drop:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity cursor-pointer flex-col gap-1"
                              >
                                <Trash2 className="w-5 h-5 text-red-400" />
                                <span>លុបរូបថត</span>
                              </button>
                            </>
                          ) : (
                            <label htmlFor={`edit-file-${member.id}`} className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-2 text-center text-slate-400 hover:text-amber-600 transition">
                              <User className="w-12 h-12 stroke-1 mb-1 text-slate-350" />
                              <span className="text-[10px] font-bold text-slate-500">ទាញរូបភាពដាក់ទីនេះ</span>
                              <span className="text-[9px] text-amber-600 mt-1 font-semibold underline">ឬ ចុចជ្រើសរើស</span>
                              <input
                                type="file"
                                accept="image/*"
                                id={`edit-file-${member.id}`}
                                className="hidden"
                                onChange={handleStaffPhotoUpload}
                              />
                            </label>
                          )}
                        </div>

                        {/* Inline Card Editor Form */}
                        <div className="w-full space-y-2.5 text-xs text-left font-battambang">
                          <div>
                            <label className="text-[10px] text-gray-500 font-bold block mb-0.5">ឈ្មោះបុគ្គលិក *</label>
                            <input
                              type="text"
                              required
                              value={editStaffName}
                              onChange={(e) => setEditStaffName(e.target.value)}
                              placeholder="ឈ្មោះបុគ្គលិក"
                              className="w-full px-2.5 py-1.5 border rounded-lg bg-slate-50 text-black text-xs font-bold font-moul focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-gray-500 font-bold block mb-0.5">តួនាទី / ឋានៈ *</label>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                required
                                value={editStaffRole}
                                onChange={(e) => setEditStaffRole(e.target.value)}
                                placeholder="តួនាទី (ឧ. គ្រូបង្រៀន)"
                                className="w-full px-2.5 py-1.5 border rounded-lg bg-slate-50 text-black text-xs font-bold focus:ring-1 focus:ring-amber-500"
                              />
                              <select
                                value={['គ្រូបង្រៀន', 'នាយក', 'នាយិកា', 'នាយករង', 'នាយិការង'].includes(editStaffRole) ? editStaffRole : ''}
                                onChange={(e) => {
                                  if (e.target.value) setEditStaffRole(e.target.value);
                                }}
                                className="px-1 py-1.5 border rounded-lg bg-slate-50 text-black text-xs shrink-0 cursor-pointer"
                              >
                                <option value="">រហ័ស...</option>
                                <option value="គ្រូបង្រៀន">គ្រូបង្រៀន</option>
                                <option value="នាយក">នាយក</option>
                                <option value="នាយិកា">នាយិកា</option>
                                <option value="នាយករង">នាយករង</option>
                                <option value="នាយិការង">នាយិការង</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-gray-500 font-bold block mb-0.5">ឯកទេស / មុខវិជ្ជា</label>
                            <input
                              type="text"
                              value={editStaffSubject}
                              onChange={(e) => setEditStaffSubject(e.target.value)}
                              placeholder="ឧ. គណិតវិទ្យា (បើមាន)"
                              className="w-full px-2.5 py-1.5 border rounded-lg bg-slate-50 text-black text-xs focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-gray-500 font-bold block mb-0.5">លេខទូរស័ព្ទ</label>
                            <input
                              type="text"
                              value={editStaffPhone}
                              onChange={(e) => setEditStaffPhone(e.target.value)}
                              placeholder="ឧ. 096xxxxxxx (បើមាន)"
                              className="w-full px-2.5 py-1.5 border rounded-lg bg-slate-50 text-black text-xs font-bold focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div className="flex justify-end gap-1.5 pt-3 border-t border-slate-100 !mt-3">
                            <button
                              type="button"
                              onClick={() => handleCancelEditing(member.id, member.id.startsWith('temp_'))}
                              className="px-3 py-1.5 bg-gray-150 hover:bg-gray-200 text-gray-800 rounded-lg text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" /> បោះបង់
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveInCardEdit(member.id)}
                              className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5 text-amber-400" /> រក្សាទុក
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Non-edit display card layout
                  return (
                    <div
                      key={member.id}
                      className="bg-white border border-slate-200/60 shadow-sm hover:shadow-md rounded-2xl overflow-hidden transition duration-200 relative flex flex-col items-center p-5 text-center group"
                    >
                      {isAdminLoggedIn && (
                        <div className="absolute top-3 right-3 flex gap-1.5 z-20">
                          <button
                            type="button"
                            onClick={() => handleStartInCardEdit(member)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-900 p-2 rounded-full transition cursor-pointer shadow-2xs border border-blue-250/20"
                            title="កែសម្រួលព័ត៌មានបុគ្គលិក"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(member.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-full transition cursor-pointer shadow-2xs border border-red-250/20"
                            title="លុបព័ត៌មានបុគ្គលិក"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Portrait frame */}
                      <div className="w-40 h-48 mb-4 bg-slate-150 rounded-xl overflow-hidden flex items-center justify-center border-4 border-white shadow-xs shrink-0 select-none relative">
                        {member.photo ? (
                          <img
                            src={member.photo}
                            alt={member.name}
                            className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition duration-250"
                            referrerPolicy="no-referrer"
                            onClick={() => onZoomImage?.(member.photo!)}
                          />
                        ) : (
                          <User className="w-16 h-16 text-slate-400 stroke-1" />
                        )}
                      </div>

                      <div className="space-y-1 w-full text-xs font-battambang">
                        {/* Name styled in Moul with bigger font */}
                        <p className="font-moul text-blue-950 text-sm md:text-base font-bold leading-normal truncate-2-lines px-1 min-h-[35px] flex items-center justify-center">
                          {member.name || 'គ្មានឈ្មោះ'}
                        </p>
                        
                        {/* Role displayed literally "តួនាទី ៖ {member.role}" */}
                        <p className="text-[11px] sm:text-xs text-gray-600 font-semibold pt-1">
                          តួនាទី ៖ <span className="text-gray-900 font-bold">{member.role || 'គ្រូបង្រៀន'}</span>
                        </p>

                        {member.subject && (
                          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold pt-0.5">
                            ឯកទេស ៖ <span className="text-gray-750 font-bold">{member.subject}</span>
                          </p>
                        )}

                        {/* Click to call support with <a href="tel:..."> */}
                        {member.phone && (
                          <a
                            href={`tel:${member.phone}`}
                            className="text-blue-950 font-bold hover:underline hover:text-blue-800 flex items-center justify-center gap-1.5 pt-2 border-t border-slate-200/50 mt-2.5 text-[11px] select-all w-full decoration-amber-500"
                            title="ចុចដើម្បីហៅទូរស័ព្ទ"
                          >
                            <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" /> {member.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Inline Empty Add Card at the end */}
                {isAdminLoggedIn && !editingStaffId && (
                  <button
                    type="button"
                    onClick={handleAddNewStaffCard}
                    className="bg-white border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[350px] transition cursor-pointer group/add shadow-3xs hover:shadow-2xs"
                  >
                    <Plus className="w-12 h-12 text-slate-400 group-hover/add:text-amber-500 transition mb-3" />
                    <p className="font-moul text-xs sm:text-sm text-slate-600 group-hover/add:text-slate-900 transition font-bold">បន្ថែមបុគ្គលិកសាលា</p>
                    <p className="font-battambang text-[10px] text-slate-400 mt-1">ចុចដើម្បីបន្ថែមរូបភាព និងព័ត៌មានជាកាតថ្មី</p>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Map Frame iframe at the absolute bottom of about tab view content */}
          <div className="lg:col-span-12 space-y-2 border-t pt-6 mt-2">
            <h4 className="font-moul text-blue-900 text-xs sm:text-sm font-bold flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-500 animate-bounce" /> ផែនទី និងទីតាំងសាលារៀន (Google Maps)
            </h4>
            <div id="map-iframe-container" className="w-full h-[320px] rounded-xl overflow-hidden border">
              <iframe
                id="about-map-iframe"
                src={mapEmbedSrc}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                title="School Location Map"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Edit Tab Form (Admin Only) */
        <form onSubmit={handleSaveAbout} className="space-y-4 font-battambang text-xs text-gray-750 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 mb-1 font-bold">ចំណងជើងសាលារៀន *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-black text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-1 font-bold">លេខទូរស័ព្ទទំនាក់ទំនង *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-black text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-500 mb-1 font-bold">ខ្លឹមសារពិពណ៌នាលម្អិតពីសាលារៀន *</label>
            <textarea
              required
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-white text-black text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 mb-1 font-bold">លីង Google Maps Link (Share link ឬ Embed link)</label>
              <input
                type="text"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-black text-xs font-semibold"
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-1 font-bold">រូបភាពក្រួសាលារៀន</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0"
              />
              {image && <span className="text-[10px] text-blue-600 block mt-1 truncate">រូបភាព៖ {image}</span>}
            </div>
          </div>

          <div className="flex gap-2 justify-end border-t pt-4">
            <button
              type="button"
              onClick={() => setShowEdit(false)}
              className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-black font-semibold rounded-lg cursor-pointer"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-850 font-bold cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4 text-amber-400" /> រក្សាទុក
            </button>
          </div>
        </form>
      )}

      {/* Modern custom confirmation modal for deleting staff */}
      {staffToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4 border-t-4 border-red-600 animate-in zoom-in-95 duration-150 text-slate-700 font-battambang">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-full text-red-600 flex-shrink-0 animate-pulse">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm font-moul text-red-700">លុបទិន្នន័យបុគ្គលិក</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">ព័ត៌មាននេះនឹងត្រូវលុបចេញពីប្រព័ន្ធរហូត</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-gray-600">
              តើអ្នកពិតជាចង់លុបព័ត៌មានបុគ្គលិកនេះមែនទេ? សកម្មភាពនេះមិនអាចបង្កើតឡើងវិញបានឡើយ។
            </p>

            <div className="flex justify-end gap-2 text-xs pt-3 border-t font-semibold">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-605 rounded-lg cursor-pointer font-bold"
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer flex items-center gap-1.5 font-bold"
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
