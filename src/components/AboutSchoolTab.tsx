/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Info, MapPin, Phone, Edit, Image as ImageIcon, Heart, Globe, Save } from 'lucide-react';
import { DBState, AboutSchool } from '../types';
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
  const [title, setTitle] = useState(dbState.about_school.title || 'វិទ្យាល័យបារាយណ៍');
  const [details, setDetails] = useState(dbState.about_school.details || '');
  const [phone, setPhone] = useState(dbState.about_school.phone || '0966187972');
  const [mapUrl, setMapUrl] = useState(dbState.about_school.map || '');
  const [image, setImage] = useState(dbState.about_school.image || '');

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

  const activeAbout = dbState.about_school;
  const mapEmbedSrc = getEmbedMapUrl(activeAbout.map);

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
        <div id="about-display-area" className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-gray-700 font-battambang">
          {/* Text fields */}
          <div className="lg:col-span-7 space-y-4">
            <h3 id="about-school-title" className="font-moul text-[#0f2c59] text-base font-bold">
              {activeAbout.title || 'វិទ្យាល័យបារាយណ៍'}
            </h3>
            <p id="about-school-details" className="text-xs md:text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {activeAbout.details ||
                'វិទ្យាល័យបារាយណ៍ គឺជាគ្រឹះស្ថានសិក្សាសាធារណៈគំរូមួយដែលបានបណ្តុះបណ្តាលសិស្សានុសិស្សប្រកបដោយគុណភាព វិន័យ សីលធម៌ និងការទទួលខុសត្រូវខ្ពស់។'}
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
                alt="School View"
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
