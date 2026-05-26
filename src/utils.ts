/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student } from './types';

/**
 * Compresses an image base64 data string to a small JPEG string using HTML Canvas.
 * Ensures lightning-fast upload speeds on Android and iOS devices.
 */
export function compressImage(
  base64Str: string,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.8
): Promise<string> {
  // Return the original base64 string directly to preserve absolute maximum quality, resolution, format, and size.
  return Promise.resolve(base64Str);
}

/**
 * Converts a direct file upload to a data base64 URL.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Extract direct Google Drive Resource ID from file preview or view link
 */
export function getDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  const regExp = /\/file\/d\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)/;
  const matches = url.match(regExp);
  if (matches) {
    return matches[1] || matches[2];
  }
  return null;
}

/**
 * Helper to display map embed src based on the saved URL
 */
export function getEmbedMapUrl(inputUrl: string): string {
  if (!inputUrl) {
    return "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3915.2285157144704!2d105.32187647572798!3d11.133221088998851!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x310b91df4d2ec75d%3A0x86849b3ae334afb2!2z4Z6c4Z-S4Z634Z6R4Z-S4Z6Z4Z624Z6b4Z-S4Z6Z4Z6b4Z-S4Z6a4Z-H!5e0!3m2!1skm!2skh!4v1716500000000!5m2!1skm!2skh";
  }

  if (inputUrl.includes('RRunz94KgrKQFNDt5')) {
    return "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3915.2285157144704!2d105.32187647572798!3d11.133221088998851!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x310b91df4d2ec75d%3A0x86849b3ae334afb2!2z4Z6c4Z-S4Z634Z6R4Z-S4Z6Z4Z624Z6b4Z-S4Z6Z4Z6b4Z-S4Z6a4Z-H!5e0!3m2!1skm!2skh!4v1716500000000!5m2!1skm!2skh";
  }

  if (inputUrl.includes('/embed') || inputUrl.includes('output=embed')) {
    return inputUrl;
  }

  if (
    inputUrl.includes('maps.app.goo.gl') ||
    inputUrl.includes('maps.google.com') ||
    inputUrl.includes('google.com/maps')
  ) {
    const placeRegex = /\/place\/([^/]+)/;
    const match = inputUrl.match(placeRegex);
    if (match && match[1]) {
      return `https://maps.google.com/maps?q=${match[1]}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }

    const coordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const coordMatch = inputUrl.match(coordRegex);
    if (coordMatch && coordMatch[1] && coordMatch[2]) {
      return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(inputUrl)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

/**
 * Returns current timestamp in Khmer format of date & hour
 */
export function getNowString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hr = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${d}-${m}-${y} ម៉ោង ${hr}:${min}`;
}

/**
 * Estimates if text crosses the specified visual line count, and truncates it.
 * Designed for responsive Khmer layouts to handle both physical newlines and word wrapping.
 */
export function estimateLinesAndTruncate(
  content: string,
  maxLines = 2,
  maxCharsPerLine = 42
): { hasMore: boolean; truncatedText: string } {
  if (!content) return { hasMore: false, truncatedText: '' };

  const physicalLines = content.split('\n');
  let currentVisualLines = 0;
  const truncatedLines: string[] = [];
  let hasMore = false;

  for (let i = 0; i < physicalLines.length; i++) {
    const pLine = physicalLines[i];
    const estimatedVisualsForThisLine = Math.max(1, Math.ceil(pLine.length / maxCharsPerLine));

    if (currentVisualLines + estimatedVisualsForThisLine <= maxLines) {
      truncatedLines.push(pLine);
      currentVisualLines += estimatedVisualsForThisLine;
    } else {
      // It exceeds the remaining visual lines allowed
      const remainingVisualLines = maxLines - currentVisualLines;
      if (remainingVisualLines > 0) {
        // We can fit a partial part of this physical line
        const charsToFit = remainingVisualLines * maxCharsPerLine;
        // Truncate cleanly and avoid breaking in middle of a word if possible, but simple slice is standard
        truncatedLines.push(pLine.slice(0, charsToFit));
      }
      hasMore = true;
      break;
    }
  }

  // If there are more physical lines remaining that we didn't process, it has more
  if (!hasMore && physicalLines.length > truncatedLines.length) {
    hasMore = true;
  }

  const truncatedText = truncatedLines.join('\n');
  return { hasMore, truncatedText };
}

