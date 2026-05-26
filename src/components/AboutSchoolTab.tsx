/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Info, MapPin, Phone, Edit, Image as ImageIcon, Heart, Globe, Save, Users, Trash2, Plus, User } from 'lucide-react';
import { DBState, AboutSchool, StaffMember } from '../types';
import { fileToBase64, compressImage, getEmbedMapUrl } from '../utils';

interface AboutProps {
  dbState: DBState;
  isAdminLoggedIn: boolean;
  onUpdateDB: (data: Partial<DBState>) => Promise<void>;
}

export default function AboutSchoolTab({
  dbState,
  isAdminLoggedIn,
  onUpdateDB,
}: AboutProps) {
  const [showEdit, setShowEdit] = useState(false);

  // Editable fields local state
  const [title, setTitle] = useState(dbState.about_school.title || 'វិទ្យាល័យបឹងព្រះ');
  const [details, setDetails] = useState(dbState.about_school.details || '');
  const [phone, setPhone] = useState(dbState.about_school.phone || '0966187972');
  const [mapUrl, setMapUrl] = useState(dbState.about_school.map || '');
  const [image, setImage] = useState(dbState.about_school.image || '');

  // Staff add form states
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'នាយក' | 'នាយិកា' | 'នាយករង' | 'នាយិការង' | 'លោកគ្រូ' | 'អ្នកគ្រូ'>('លោកគ្រូ');
  const [staffSubject, setStaffSubject] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPhoto, setStaffPhoto] = useState('');
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

  const handleStaffPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsStaffUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const compressed = await compressImage(base64, 300, 400, 0.75);
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: compressed, name: 'staff_photo', ext: 'jpg' })
      });
      const resData = await response.json();
      if (resData.status === 'success') {
        setStaffPhoto(resData.url);
      } else {
        setStaffPhoto(compressed);
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

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) return;

    const newStaff: StaffMember = {
      id: 'staff_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: staffName.trim(),
      role: staffRole,
      subject: staffSubject.trim() || undefined,
      phone: staffPhone.trim() || undefined,
      photo: staffPhoto || undefined,
    };

    const currentStaffMembers = dbState.staff_members || [];
    await onUpdateDB({
      staff_members: [...currentStaffMembers, newStaff],
    });

    // Reset Form
    setStaffName('');
    setStaffRole('លោកគ្រូ');
    setStaffSubject('');
    setStaffPhone('');
    setStaffPhoto('');
    setShowAddStaffForm(false);
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('តើអ្នកពិតជាចង់លុបព័ត៌មានបុគ្គលិកនេះមែនទេ?')) return;
    const currentStaffMembers = dbState.staff_members || [];
    const updatedStaff = currentStaffMembers.filter((s) => s.id !== id);
    await onUpdateDB({ staff_members: updatedStaff });
  };

  const activeAbout = dbState.about_school;
  const mapEmbedSrc = getEmbedMapUrl(activeAbout.map);
  const staffList = dbState.staff_members || [];

  return (
    <div className="bg-white p-3.5 rounded shadow-xs border-t-4 border-blue-900 space-y-4">
      <div className="flex justify-between items-center border-b pb-3">
        <h2 className="text-sm md:text-base font-bold font-moul text-blue-900 flex items-center gap-1.5">
          <Info className="w-5 h-5 text-amber-500" /> អំពីសាលារៀនរបស់យើងខ្ញុំ
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
                <span className="font-bold text-[#0f2c59]">ព័ត៌មានទំនាក់ទំនងសហគមន៍</span>
                <div className="flex items-center gap-1">
                  <span>លេខទូរស័ព្ទ៖</span>
                  <span className="font-bold text-blue-900">{activeAbout.phone || '0966187972'}</span>
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

            {/* Map Frame iframe */}
            <div className="lg:col-span-12 space-y-2 border-t pt-4">
              <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1">
                <MapPin className="w-4 h-4 text-amber-500 animate-bounce" /> ផែនទី និងទីតាំងសាលារៀន (Google Maps)
              </h4>
              <div id="map-iframe-container" className="w-full h-[280px] rounded overflow-hidden border">
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

          {/* STAFF & BOARD SECTION */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
              <h3 className="text-xs md:text-sm font-bold font-moul text-blue-900 flex items-center gap-1.5">
                <Users className="w-5 h-5 text-amber-500" /> គណៈគ្រប់គ្រង លោកគ្រូ-អ្នកគ្រូ
              </h3>
              {isAdminLoggedIn && (
                <button
                  onClick={() => setShowAddStaffForm(!showAddStaffForm)}
                  className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 font-battambang"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" /> {showAddStaffForm ? 'បិទដែនបញ្ចូល' : 'បញ្ចូលព័ត៌មានបុគ្គលិកថ្មី'}
                </button>
              )}
            </div>

            {/* Add Staff form block */}
            {isAdminLoggedIn && showAddStaffForm && (
              <form onSubmit={handleSaveStaff} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 font-battambang text-xs text-black space-y-3 animate-in fade-in duration-200">
                <p className="font-bold text-blue-900 border-b pb-1 font-moul text-[11px]">បញ្ចូលព័ត៌មានបុគ្គលិកសាលាជាកាត</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">គោត្តនាម-នាម *</label>
                    <input
                      type="text"
                      required
                      placeholder="ឧ. សេង វ៉ា"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">តួនាទី / ឋានៈ *</label>
                    <select
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-xs"
                    >
                      <option value="នាយក">នាយក</option>
                      <option value="នាយិកា">នាយិកា</option>
                      <option value="នាយករង">នាយករង</option>
                      <option value="នាយិការង">នាយិការង</option>
                      <option value="លោកគ្រូ">លោកគ្រូ</option>
                      <option value="អ្នកគ្រូ">អ្នកគ្រូ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">ឯកទេស / មុខវិជ្ជា</label>
                    <input
                      type="text"
                      placeholder="ឧ. គណិតវិទ្យា (បើមាន)"
                      value={staffSubject}
                      onChange={(e) => setStaffSubject(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">លេខទូរស័ព្ទ</label>
                    <input
                      type="text"
                      placeholder="ឧ. 096xxxxxxx (បើមាន)"
                      value={staffPhone}
                      onChange={(e) => setStaffPhone(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg bg-white text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-center pt-1 border-t border-dashed mt-2">
                  <div className="flex-grow w-full">
                    <label className="block text-gray-600 font-bold mb-1">រូបថតបុគ្គលិក</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleStaffPhotoUpload}
                      className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0"
                    />
                  </div>
                  <div className="shrink-0 flex gap-2 w-full sm:w-auto justify-end pt-3 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => setShowAddStaffForm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg text-xs cursor-pointer"
                    >
                      បោះបង់
                    </button>
                    <button
                      type="submit"
                      disabled={isStaffUploading}
                      className="px-5 py-2 bg-blue-900 hover:bg-blue-850 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <Save className="w-4 h-4 text-amber-400" /> {isStaffUploading ? 'កំពុងបង្ហោះរូបភាព...' : 'រក្សាទុកព័ត៌មាន'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Staff Grid containing card-shaped profiles */}
            {staffList.length === 0 ? (
              <div className="py-8 text-center text-gray-400 font-battambang text-xs border border-dashed rounded-xl">
                ไม่ទាន់មានព័ត៌មានបុគ្គលិកសិក្សាឡើយ។ {isAdminLoggedIn && 'សូមចុចប៊ូតុងខាងលើដើម្បីបញ្ជូលសមាជិកថ្មី!'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {staffList.map((member) => (
                  <div
                    key={member.id}
                    className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition duration-200 relative flex flex-col items-center p-3.5 text-center group"
                  >
                    {isAdminLoggedIn && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(member.id)}
                        className="absolute top-2 right-2 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white p-1 rounded-full transition cursor-pointer z-20"
                        title="លុបព័ត៌មានបុគ្គលិក"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Member image frame */}
                    <div className="w-20 h-24 mb-3 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center border-2 border-white shadow-xs shrink-0 select-none">
                      {member.photo ? (
                        <img
                          src={member.photo}
                          alt={member.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-10 h-10 text-slate-400 stroke-1" />
                      )}
                    </div>

                    <div className="space-y-1 w-full text-xs font-battambang">
                      <p className="font-bold text-gray-800 text-[11px] leading-tight truncate-2-lines min-h-[30px] flex items-center justify-center">
                        {member.name}
                      </p>
                      
                      <div className="pt-1">
                        <span
                          className={`inline-block text-[9px] px-2.5 py-0.5 rounded-full font-bold select-none ${
                            ['នាយក', 'នាយិកា'].includes(member.role)
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : ['នាយករង', 'នាយិការង'].includes(member.role)
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {member.role}
                        </span>
                      </div>

                      {member.subject && (
                        <p className="text-[10px] text-gray-500 font-semibold truncate pt-0.5">
                          ឯកទេស៖ <span className="text-gray-750 font-bold">{member.subject}</span>
                        </p>
                      )}

                      {member.phone && (
                        <p className="text-[9px] text-blue-900 font-bold flex items-center justify-center gap-0.5 pt-1.5 border-t border-slate-200/50 mt-1">
                          <Phone className="w-2.5 h-2.5 text-blue-600" /> {member.phone}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
    </div>
  );
}
