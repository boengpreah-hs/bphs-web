/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const app = express();
const PORT = 3000;

// High limit to receive base64 payloads safely
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Directories setup
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded assets statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Default initial state matching the exact Khmer specifications
const defaultLayout = {
  bgImage: "", 
  bgSizeWidth: "100",
  bgSizeHeight: "100",
  bgPositionX: "0",
  bgPositionY: "0",
  academicYear: "2025-2026",
  photo: { left: "25px", top: "115px", width: "120px", height: "160px" },
  id: { left: "165px", top: "115px", fontSize: "14" },
  name: { left: "165px", top: "150px", fontSize: "14" },
  gender: { left: "165px", top: "185px", fontSize: "14" },
  nationality: { left: "165px", top: "220px", fontSize: "14" },
  dob: { left: "165px", top: "255px", fontSize: "13" },
  grade: { left: "165px", top: "290px", fontSize: "14" },
  year: { left: "165px", top: "325px", fontSize: "14" }
};

const defaultWatermark = {
  text: "ថតចម្លង",
  size: "28",
  opacity: "20",
  angle: "-45",
  color_r: "107",
  color_g: "114",
  color_b: "128"
};

const defaultAbout = {
  title: 'វិទ្យាល័យបឹងព្រះ',
  details: 'វិទ្យាល័យបឹងព្រះ គឺជាគ្រឹះស្ថានសិក្សាសាធារណៈគំរូមួយដែលបានបណ្តុះបណ្តាលសិស្សានុសិស្សប្រកបដោយគុណភាព វិន័យ សីលធម៌ និងការទទួលខុសត្រូវខ្ពស់។ យើងខ្ញុំផ្តោតសំខាន់លើការអភិវឌ្ឍសមត្ថភាពរៀនសូត្ររបស់សិស្សគ្រប់កម្រិតថ្នាក់។',
  phone: '0966187972',
  map: 'https://maps.app.goo.gl/RRunz94KgrKQFNDt5',
  image: ''
};

const defaultStudents = [
  {
    id: "001",
    name: "ស៊ន សុភ័ក្ត្រ",
    gender: "ប្រុស",
    dob: "១៥-មករា-២០០៨",
    grade: "១២A",
    village: "បឹងព្រះ",
    commune: "បឹងព្រះ",
    district: "បាភ្នំ",
    province: "ព្រៃវែង",
    fatherName: "ស៊ន សារ៉េត",
    fatherJob: "កសិករ",
    motherName: "ម៉ៅ សុខា",
    motherJob: "មេផ្ទះ",
    photo: "",
    phone: "012345678"
  }
];

const defaultActivities = [
  {
    id: 'act1',
    title: 'ពិធីប្រគល់សញ្ញាបត្រ និងរង្វាន់លើកទឹកចិត្ត',
    desc: 'សាលារៀនបានរៀបចំពិធីអបអរសាទរ និងប្រគល់លិខិតសរសើរដល់សិស្សពូកែប្រចាំឆមាស។',
    images: [
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=600&q=80"
    ],
    likes: 25,
    date: '10-05-2026 ម៉ោង 08:30',
    driveLink: ''
  }
];

const defaultAcademicPosts = [
  {
    id: 'ac1',
    title: 'សេចក្តីប្រកាសលទ្ធផលប្រចាំឆមាសទី១ ថ្នាក់ទី១២',
    grade: '12',
    year: '2025-2026',
    content: 'សូមជូនដំណឹងដល់ប្អូនៗសិស្សានុសិស្សទាំងអស់ មេត្តាពិនិត្យតារាងពិន្ទុឆមាសទី១ តាមការផ្សាយភ្ជាប់ខាងក្រោម។',
    date: '25-05-2026 ម៉ោង 09:00',
    driveLink: '',
    file: '',
    cover: ''
  }
];

const defaultExamPosts = [
  {
    id: 'ex1',
    title: 'លទ្ធផលផ្លូវការនៃការប្រឡងសញ្ញាបត្រមធ្យមសិក្សាទុតិយភូមិ (បាក់ឌុប)',
    cat: 'bacii',
    year: '2025',
    content: 'សូមអបអរសាទរដល់ប្អូនៗសិស្សានុសិស្សទាំងអស់ដែលបានប្រឡងជាប់សញ្ញាបត្រមធ្យមសិក្សាទុតិយភូមិសម័យប្រឡងនាពេលថ្មីៗនេះ។',
    date: '25-05-2026 ម៉ោង 15:20',
    driveLink: '',
    file: '',
    cover: ''
  }
];

const defaultSlides = [
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=1200&q=80"
];

const defaultDB = {
  students: defaultStudents,
  card_layout: defaultLayout,
  watermark: defaultWatermark,
  admin_credentials: {
    username: 'SengVa',
    password: '@9999',
    confirmGmail: 'sengva29@gmail.com'
  },
  about_school: defaultAbout,
  activities_posts: defaultActivities,
  academic_posts: defaultAcademicPosts,
  exam_posts: defaultExamPosts,
  schedule_posts: [],
  home_slides: defaultSlides,
  school_logo: "https://cdn-icons-png.flaticon.com/512/5087/5087579.png",
  header_bg: ""
};

// Global Memory Cache for rapid REST serving
let cachedDB: any = { ...defaultDB };

// Load initially saved database.json file if it already exists locally (persistence fallback)
if (fs.existsSync(DB_FILE)) {
  try {
    const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
    if (fileContent.trim()) {
      cachedDB = { ...cachedDB, ...JSON.parse(fileContent) };
      console.log('[JSON Offline DB] Successfully loaded existing local database.');
    }
  } catch (loadErr) {
    console.error('[JSON Offline DB] Failed to load local database, falling back to default:', loadErr);
  }
}

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.error('[Firebase Config] Failed to parse config file:', err);
  }
}

const isFirestoreEnabled = (() => {
  if (!firebaseConfig || !firebaseConfig.projectId) return false;
  const isPlaceholder = 
    firebaseConfig.projectId.includes('remixed-project-id') || 
    firebaseConfig.projectId.includes('remixed') ||
    firebaseConfig.apiKey === 'remixed-api-key';
  
  if (isPlaceholder) {
    console.warn('[Firestore] Running in Local Offline Mode because Firebase is not yet provisioned. Please complete the Firebase setup in the Google AI Studio UI to enable multi-device sync.');
    return false;
  }
  return true;
})();

// Lazy initialize Firebase SDK if enabled
const firebaseApp = isFirestoreEnabled ? initializeApp(firebaseConfig) : null;
const db: any = (isFirestoreEnabled && firebaseApp) ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId) : null;

// Error Handling Function conformed with the FirestoreErrorInfo constraint inside SKILL.md
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, collPath: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'server-admin',
      email: firebaseConfig.projectId,
      emailVerified: true
    },
    operationType,
    path: collPath
  };
  console.error('[Firestore Server Error]: ', JSON.stringify(errInfo, null, 2));
}

// Seed helper functions
async function seedFirestoreIfEmpty() {
  if (!isFirestoreEnabled || !db) {
    console.log('[Firestore] Local Offline Mode: Seeding skipped.');
    return;
  }
  try {
    console.log('[Firestore] Checking collections and seeding default database state...');

    // Seed Students
    const studentsSnap = await getDocs(collection(db, 'students'));
    if (studentsSnap.empty) {
      console.log('[Firestore] Seeding students collection...');
      for (const s of defaultDB.students) {
        await setDoc(doc(db, 'students', s.id), s);
      }
    }

    // Seed Activities
    const activitiesSnap = await getDocs(collection(db, 'activities'));
    if (activitiesSnap.empty) {
      console.log('[Firestore] Seeding activities collection...');
      for (const act of defaultDB.activities_posts) {
        await setDoc(doc(db, 'activities', act.id), act);
      }
    }

    // Seed Academic posts
    const academicSnap = await getDocs(collection(db, 'academic'));
    if (academicSnap.empty) {
      console.log('[Firestore] Seeding academic bulletins...');
      for (const p of defaultDB.academic_posts) {
        await setDoc(doc(db, 'academic', p.id), p);
      }
    }

    // Seed Exam listings
    const examsSnap = await getDocs(collection(db, 'exams'));
    if (examsSnap.empty) {
      console.log('[Firestore] Seeding exam bulletins...');
      for (const e of defaultDB.exam_posts) {
        await setDoc(doc(db, 'exams', e.id), e);
      }
    }

    // Settings singletons
    const cardLayoutDoc = await getDoc(doc(db, 'settings', 'card_layout'));
    if (!cardLayoutDoc.exists()) {
      await setDoc(doc(db, 'settings', 'card_layout'), defaultDB.card_layout);
    }

    const watermarkDoc = await getDoc(doc(db, 'settings', 'watermark'));
    if (!watermarkDoc.exists()) {
      await setDoc(doc(db, 'settings', 'watermark'), defaultDB.watermark);
    }

    const aboutSchoolDoc = await getDoc(doc(db, 'settings', 'about_school'));
    if (!aboutSchoolDoc.exists()) {
      await setDoc(doc(db, 'settings', 'about_school'), defaultDB.about_school);
    }

    const appConfigDoc = await getDoc(doc(db, 'settings', 'app_config'));
    if (!appConfigDoc.exists()) {
      await setDoc(doc(db, 'settings', 'app_config'), {
        home_slides: defaultDB.home_slides,
        school_logo: defaultDB.school_logo,
        header_bg: defaultDB.header_bg,
        admin_credentials: defaultDB.admin_credentials
      });
    }

    console.log('[Firestore] Seeding check finalized successfully.');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seeding');
  }
}

// Set up real-time listener subscription to sync other devices instantly (Zero polling overhead!)
function syncFirestoreCollections() {
  if (!isFirestoreEnabled || !db) {
    console.log('[Firestore] Local Offline Mode: Real-time syncing skipped.');
    return;
  }
  console.log('[Firestore] Setting up real-time onSnapshot listeners...');

  onSnapshot(collection(db, 'students'), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push(d.data()));
    if (list.length > 0) {
      cachedDB.students = list;
    } else {
      cachedDB.students = [];
    }
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

  onSnapshot(collection(db, 'activities'), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push(d.data()));
    cachedDB.activities_posts = list.sort((a, b) => b.id.localeCompare(a.id));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'activities'));

  onSnapshot(collection(db, 'academic'), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push(d.data()));
    cachedDB.academic_posts = list.sort((a, b) => b.id.localeCompare(a.id));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'academic'));

  onSnapshot(collection(db, 'exams'), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push(d.data()));
    cachedDB.exam_posts = list.sort((a, b) => b.id.localeCompare(a.id));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'exams'));

  onSnapshot(collection(db, 'schedules'), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push(d.data()));
    cachedDB.schedule_posts = list.sort((a, b) => b.id.localeCompare(a.id));
  }, (err) => handleFirestoreError(err, OperationType.LIST, 'schedules'));

  onSnapshot(doc(db, 'settings', 'card_layout'), (snap) => {
    if (snap.exists()) {
      cachedDB.card_layout = snap.data();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/card_layout'));

  onSnapshot(doc(db, 'settings', 'watermark'), (snap) => {
    if (snap.exists()) {
      cachedDB.watermark = snap.data();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/watermark'));

  onSnapshot(doc(db, 'settings', 'about_school'), (snap) => {
    if (snap.exists()) {
      cachedDB.about_school = snap.data();
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/about_school'));

  onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data) {
        if (data.home_slides) cachedDB.home_slides = data.home_slides;
        if (data.school_logo) cachedDB.school_logo = data.school_logo;
        if (data.header_bg) cachedDB.header_bg = data.header_bg;
        if (data.admin_credentials) cachedDB.admin_credentials = data.admin_credentials;
      }
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/app_config'));
}

// Push local edits back into Firestore collections
async function saveDBState(state: any) {
  try {
    cachedDB = { ...cachedDB, ...state };
    // Redundant backup to local storage
    fs.writeFileSync(DB_FILE, JSON.stringify(cachedDB, null, 2), 'utf-8');

    if (!isFirestoreEnabled || !db) {
      // Local Offline Mode: Skip writing to Firestore
      return;
    }

    // Trigger Firestore writes asynchronously to maintain high speed REST loops
    if (state.students) {
      for (const student of state.students) {
        if (student.id) {
          await setDoc(doc(db, 'students', student.id), student);
        }
      }
      const activeIds = new Set(state.students.map((s: any) => s.id));
      const currentSnapshot = await getDocs(collection(db, 'students'));
      for (const d of currentSnapshot.docs) {
        if (!activeIds.has(d.id)) {
          await deleteDoc(doc(db, 'students', d.id));
        }
      }
    }

    if (state.activities_posts) {
      for (const act of state.activities_posts) {
        if (act.id) {
          await setDoc(doc(db, 'activities', act.id), act);
        }
      }
      const activeIds = new Set(state.activities_posts.map((a: any) => a.id));
      const currentSnapshot = await getDocs(collection(db, 'activities'));
      for (const d of currentSnapshot.docs) {
        if (!activeIds.has(d.id)) {
          await deleteDoc(doc(db, 'activities', d.id));
        }
      }
    }

    if (state.academic_posts) {
      for (const p of state.academic_posts) {
        if (p.id) {
          await setDoc(doc(db, 'academic', p.id), p);
        }
      }
      const activeIds = new Set(state.academic_posts.map((a: any) => a.id));
      const currentSnapshot = await getDocs(collection(db, 'academic'));
      for (const d of currentSnapshot.docs) {
        if (!activeIds.has(d.id)) {
          await deleteDoc(doc(db, 'academic', d.id));
        }
      }
    }

    if (state.exam_posts) {
      for (const e of state.exam_posts) {
        if (e.id) {
          await setDoc(doc(db, 'exams', e.id), e);
        }
      }
      const activeIds = new Set(state.exam_posts.map((e: any) => e.id));
      const currentSnapshot = await getDocs(collection(db, 'exams'));
      for (const d of currentSnapshot.docs) {
        if (!activeIds.has(d.id)) {
          await deleteDoc(doc(db, 'exams', d.id));
        }
      }
    }

    if (state.schedule_posts) {
      for (const s of state.schedule_posts) {
        if (s.id) {
          await setDoc(doc(db, 'schedules', s.id), s);
        }
      }
      const activeIds = new Set(state.schedule_posts.map((s: any) => s.id));
      const currentSnapshot = await getDocs(collection(db, 'schedules'));
      for (const d of currentSnapshot.docs) {
        if (!activeIds.has(d.id)) {
          await deleteDoc(doc(db, 'schedules', d.id));
        }
      }
    }

    if (state.card_layout) {
      await setDoc(doc(db, 'settings', 'card_layout'), state.card_layout);
    }

    if (state.watermark) {
      await setDoc(doc(db, 'settings', 'watermark'), state.watermark);
    }

    if (state.about_school) {
      await setDoc(doc(db, 'settings', 'about_school'), state.about_school);
    }

    const hasConfigChange = state.home_slides || state.school_logo || state.header_bg || state.admin_credentials;
    if (hasConfigChange) {
      const configDoc = await getDoc(doc(db, 'settings', 'app_config'));
      const activeConfig = configDoc.exists() ? configDoc.data() : {};
      const newConfig = {
        ...activeConfig,
        ...(state.home_slides && { home_slides: state.home_slides }),
        ...(state.school_logo && { school_logo: state.school_logo }),
        ...(state.header_bg && { header_bg: state.header_bg }),
        ...(state.admin_credentials && { admin_credentials: state.admin_credentials })
      };
      await setDoc(doc(db, 'settings', 'app_config'), newConfig);
    }

  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'sync');
  }
}

// Load cache fallback on start
function getDBState() {
  return cachedDB;
}

// REST endpoints
app.get('/api/database', (req, res) => {
  res.json({ status: 'success', data: getDBState() });
});

app.post('/api/database', async (req, res) => {
  const incomingData = req.body;
  const current = getDBState();
  const updated = { ...current, ...incomingData };
  await saveDBState(updated);
  res.json({ status: 'success', data: updated });
});

// Full Backup Endpoint to compile database state + physical upload assets into one raw payload
app.get('/api/backup-full', (req, res) => {
  try {
    const dbState = getDBState();
    const uploadsMap: Record<string, string> = {};

    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const file of files) {
        const filePath = path.join(UPLOADS_DIR, file);
        if (fs.statSync(filePath).isFile()) {
          const fileBuffer = fs.readFileSync(filePath);
          const extension = path.extname(file).toLowerCase();
          let mimeType = 'image/jpeg';
          if (extension === '.png') mimeType = 'image/png';
          else if (extension === '.gif') mimeType = 'image/gif';
          else if (extension === '.svg') mimeType = 'image/svg+xml';
          else if (extension === '.pdf') mimeType = 'application/pdf';
          
          uploadsMap[file] = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
        }
      }
    }

    const backupPayload = {
      backupVersion: "1.0",
      generatedAt: new Date().toISOString(),
      schoolTitle: dbState.about_school?.title || "វិទ្យាល័យបឹងព្រះ",
      db: dbState,
      uploads: uploadsMap
    };

    res.json({ status: 'success', backup: backupPayload });
  } catch (err: any) {
    console.error('[Backup Error]:', err);
    res.status(500).json({ status: 'error', error: err.message || 'Failed to assemble full backup file' });
  }
});

// Full Restore Endpoint to ingest backup payload, rebuild local uploads directory, and sync state
app.post('/api/restore-full', async (req, res) => {
  try {
    const { backup } = req.body;
    if (!backup || !backup.db) {
      return res.status(400).json({ status: 'error', error: 'Invalid backup payload format' });
    }

    const importedDB = backup.db;
    const importedUploads = backup.uploads || {};

    // Restore uploads on disk
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    for (const [filename, base64Data] of Object.entries(importedUploads)) {
      if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const buffer = Buffer.from(matches[2], 'base64');
          const filePath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(filePath, buffer);
        }
      }
    }

    // Overwrite the database state with the imported data
    await saveDBState(importedDB);

    res.json({ status: 'success', message: 'Database and assets synchronized successfully' });
  } catch (err: any) {
    console.error('[Restore Error]:', err);
    res.status(500).json({ status: 'error', error: err.message || 'Failed to process snapshot restore' });
  }
});

// Post action: upload file or base64 photo
// This is the CRITICAL performance handler for quick image uploads!
app.post('/api/upload', (req, res) => {
  try {
    const { file, name, ext } = req.body;
    if (!file) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    // Parse base64 header
    const matches = file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 payload format' });
    }

    const fileType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    // Generate unique file name
    const timestamp = Date.now();
    const randomHex = Math.floor(Math.random() * 0xffffff).toString(16);
    const extension = ext || fileType.split('/')[1] || 'jpg';
    const filename = `${name ? name.replace(/[^a-zA-Z0-9_\-]/g, '_') : 'image'}_${timestamp}_${randomHex}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${filename}`;
    res.json({ status: 'success', url: relativeUrl, type: fileType });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

// Batch/multi-upload image endpoint for rapid slideshows and collages
app.post('/api/upload-multi', (req, res) => {
  try {
    const { files } = req.body; // Array of { file, name, ext }
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array is required' });
    }

    const urls: string[] = [];
    for (const item of files) {
      const { file, name, ext } = item;
      const matches = file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const fileType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const timestamp = Date.now();
        const extension = ext || fileType.split('/')[1] || 'jpg';
        const filename = `${name ? name.replace(/[^a-zA-Z0-9_\-]/g, '_') : 'asset'}_${timestamp}_${Math.floor(Math.random() * 1000)}.${extension}`;
        const filePath = path.join(UPLOADS_DIR, filename);

        fs.writeFileSync(filePath, buffer);
        urls.push(`/uploads/${filename}`);
      }
    }

    res.json({ status: 'success', urls });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Multi upload failed' });
  }
});

// Endpoint to bulk add list of students (extremely fast performance)
app.post('/api/students/bulk', async (req, res) => {
  const studentsList = req.body;
  if (!studentsList || !Array.isArray(studentsList)) {
    return res.status(400).json({ error: 'Expected an array of students' });
  }

  if (isFirestoreEnabled && db) {
    try {
      for (const student of studentsList) {
        if (student.id) {
          await setDoc(doc(db, 'students', student.id), student);
        }
      }
    } catch (err) {
      console.error('Firestore bulk write failed:', err);
    }
  }

  const dbState = getDBState();
  for (const student of studentsList) {
    if (!student.id) continue;
    const index = dbState.students.findIndex(s => s.id === student.id);
    if (index > -1) {
      dbState.students[index] = { ...dbState.students[index], ...student };
    } else {
      dbState.students.push(student);
    }
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', count: studentsList.length });
});

// Endpoint to append list of students
app.post('/api/students', async (req, res) => {
  const student = req.body;
  if (!student || !student.id) {
    return res.status(400).json({ error: 'Missing student or unique id' });
  }

  if (isFirestoreEnabled && db) {
    try {
      await setDoc(doc(db, 'students', student.id), student);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `students/${student.id}`);
    }
  }

  const dbState = getDBState();
  const index = dbState.students.findIndex(s => s.id === student.id);
  if (index > -1) {
    dbState.students[index] = { ...dbState.students[index], ...student };
  } else {
    dbState.students.push(student);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.students });
});

// Endpoint to delete a specific student
app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  if (isFirestoreEnabled && db) {
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
    }
  }

  const dbState = getDBState();
  dbState.students = dbState.students.filter(s => s.id !== id);
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.students });
});

// Endpoint to bulk reset or clear students
app.post('/api/students/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (ids && Array.isArray(ids)) {
      // Delete specific student IDs from Firestore if enabled
      if (isFirestoreEnabled && db) {
        for (const id of ids) {
          await deleteDoc(doc(db, 'students', id));
        }
      }
      const dbState = getDBState();
      dbState.students = dbState.students.filter(s => !ids.includes(s.id));
      fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
      return res.json({ status: 'success', message: 'Cleared selected students successfully' });
    } else {
      // Delete all students from Firestore if enabled
      if (isFirestoreEnabled && db) {
        const listSnap = await getDocs(collection(db, 'students'));
        for (const d of listSnap.docs) {
          await deleteDoc(doc(db, 'students', d.id));
        }
      }
      const dbState = getDBState();
      dbState.students = [];
      fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
      return res.json({ status: 'success', message: 'Cleared all students successfully' });
    }
  } catch (err) {
    if (isFirestoreEnabled) {
      handleFirestoreError(err, OperationType.DELETE, 'students');
    } else {
      console.error(err);
    }
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});

// Endpoint to post activities
app.post('/api/activities', async (req, res) => {
  const activity = req.body; // standard ActivityPost schema
  if (!activity || !activity.id) {
    return res.status(400).json({ error: 'Missing activity ID' });
  }

  if (isFirestoreEnabled && db) {
    try {
      await setDoc(doc(db, 'activities', activity.id), activity);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `activities/${activity.id}`);
    }
  }

  const dbState = getDBState();
  const index = dbState.activities_posts.findIndex(a => a.id === activity.id);
  if (index > -1) {
    dbState.activities_posts[index] = { ...dbState.activities_posts[index], ...activity };
  } else {
    dbState.activities_posts.unshift(activity);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.activities_posts });
});

app.delete('/api/activities/:id', async (req, res) => {
  const { id } = req.params;
  if (isFirestoreEnabled && db) {
    try {
      await deleteDoc(doc(db, 'activities', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `activities/${id}`);
    }
  }

  const dbState = getDBState();
  dbState.activities_posts = dbState.activities_posts.filter(a => a.id !== id);
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.activities_posts });
});

// Endpoint to post academic bulletin
app.post('/api/academic', async (req, res) => {
  const post = req.body;
  if (!post || !post.id) {
    return res.status(400).json({ error: 'Missing academic post id' });
  }

  if (isFirestoreEnabled && db) {
    try {
      await setDoc(doc(db, 'academic', post.id), post);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `academic/${post.id}`);
    }
  }

  const dbState = getDBState();
  const index = dbState.academic_posts.findIndex(p => p.id === post.id);
  if (index > -1) {
    dbState.academic_posts[index] = { ...dbState.academic_posts[index], ...post };
  } else {
    dbState.academic_posts.unshift(post);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.academic_posts });
});

app.delete('/api/academic/:id', async (req, res) => {
  const { id } = req.params;
  if (isFirestoreEnabled && db) {
    try {
      await deleteDoc(doc(db, 'academic', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `academic/${id}`);
    }
  }

  const dbState = getDBState();
  dbState.academic_posts = dbState.academic_posts.filter(p => p.id !== id);
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.academic_posts });
});

// Endpoint to post study schedules
app.post('/api/schedules', async (req, res) => {
  const post = req.body;
  if (!post || !post.id) {
    return res.status(400).json({ error: 'Missing schedule post id' });
  }

  if (isFirestoreEnabled && db) {
    try {
      await setDoc(doc(db, 'schedules', post.id), post);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schedules/${post.id}`);
    }
  }

  const dbState = getDBState();
  if (!dbState.schedule_posts) dbState.schedule_posts = [];
  const index = dbState.schedule_posts.findIndex(p => p.id === post.id);
  if (index > -1) {
    dbState.schedule_posts[index] = { ...dbState.schedule_posts[index], ...post };
  } else {
    dbState.schedule_posts.unshift(post);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.schedule_posts });
});

app.delete('/api/schedules/:id', async (req, res) => {
  const { id } = req.params;
  if (isFirestoreEnabled && db) {
    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `schedules/${id}`);
    }
  }

  const dbState = getDBState();
  if (!dbState.schedule_posts) dbState.schedule_posts = [];
  dbState.schedule_posts = dbState.schedule_posts.filter(p => p.id !== id);
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.schedule_posts });
});

// Endpoint for exam results
app.post('/api/exams', async (req, res) => {
  const post = req.body;
  if (!post || !post.id) {
    return res.status(400).json({ error: 'Missing exam post ID' });
  }

  if (isFirestoreEnabled && db) {
    try {
      await setDoc(doc(db, 'exams', post.id), post);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `exams/${post.id}`);
    }
  }

  const dbState = getDBState();
  const index = dbState.exam_posts.findIndex(e => e.id === post.id);
  if (index > -1) {
    dbState.exam_posts[index] = { ...dbState.exam_posts[index], ...post };
  } else {
    dbState.exam_posts.unshift(post);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.exam_posts });
});

app.delete('/api/exams/:id', async (req, res) => {
  const { id } = req.params;
  if (isFirestoreEnabled && db) {
    try {
      await deleteDoc(doc(db, 'exams', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `exams/${id}`);
    }
  }

  const dbState = getDBState();
  dbState.exam_posts = dbState.exam_posts.filter(e => e.id !== id);
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.exam_posts });
});

// Sync layout settings or save configuration
app.post('/api/layout', async (req, res) => {
  const layout = req.body;
  const dbState = getDBState();
  dbState.card_layout = { ...dbState.card_layout, ...layout };
  if (isFirestoreEnabled && db) {
    try {
      await setDoc(doc(db, 'settings', 'card_layout'), dbState.card_layout);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/card_layout');
    }
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.card_layout });
});

app.post('/api/watermark', async (req, res) => {
  const wm = req.body;
  const dbState = getDBState();
  dbState.watermark = { ...dbState.watermark, ...wm };
  if (isFirestoreEnabled && db) {
    try {
      await setDoc(doc(db, 'settings', 'watermark'), dbState.watermark);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/watermark');
    }
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  res.json({ status: 'success', data: dbState.watermark });
});

async function startServer() {
  // 1. Initial Firestore setup, seeding and real-time syncing
  await seedFirestoreIfEmpty();
  syncFirestoreCollections();

  // 2. Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
