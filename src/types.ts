/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Student {
  id: string;
  name: string;
  gender: 'ប្រុស' | 'ស្រី';
  dob: string;
  grade: string;
  village: string;
  commune: string;
  district: string;
  province: string;
  fatherName: string;
  fatherJob: string;
  motherName: string;
  motherJob: string;
  phone: string;
  photo: string; // Static URL or compressed JPEG base64
}

export interface Position {
  left: string;
  top: string;
  fontSize?: string;
  width?: string;
  height?: string;
}

export interface CardLayout {
  bgImage: string;
  bgSizeWidth: string;
  bgSizeHeight: string;
  bgPositionX: string;
  bgPositionY: string;
  academicYear: string;
  photo: Position;
  id: Position;
  name: Position;
  gender: Position;
  nationality: Position;
  dob: Position;
  grade: Position;
  year: Position;
}

export interface WatermarkSettings {
  text: string;
  size: string;
  opacity: string;
  angle: string;
  color_r: string;
  color_g: string;
  color_b: string;
}

export interface ActivityPost {
  id: string;
  title: string;
  desc: string;
  images: string[]; // array of images (urls or base64)
  driveLink: string;
  likes: number;
  date: string;
}

export interface AcademicPost {
  id: string;
  title: string;
  grade: string; // e.g., '12'
  year: string;  // e.g., '2025-2026'
  content: string;
  file: string; // Base64 description or dynamic url
  cover: string; // Base64 cover or empty
  driveLink: string;
  date: string;
}

export interface ExamPost {
  id: string;
  title: string;
  cat: 'diploma' | 'bacii';
  year: string;
  content: string;
  file: string;
  cover: string;
  driveLink: string;
  date: string;
}

export interface AboutSchool {
  title: string;
  details: string;
  phone: string;
  map: string;
  image: string; // URL or base64
}

export interface AdminCredentials {
  username?: string;
  password?: string;
  confirmGmail?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  subject?: string; // Specialty subject, e.g. ភាសាខ្មែរ
  phone?: string;
  photo?: string;
}

export interface DBState {
  students: Student[];
  card_layout: CardLayout;
  watermark: WatermarkSettings;
  admin_credentials: AdminCredentials;
  about_school: AboutSchool;
  activities_posts: ActivityPost[];
  academic_posts: AcademicPost[];
  exam_posts: ExamPost[];
  schedule_posts?: AcademicPost[];
  home_slides: string[];
  school_logo: string;
  header_bg: string;
  staff_members?: StaffMember[];
}
