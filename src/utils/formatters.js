// src/utils/formatters.js

/**
 * Formats a Date object, a Firestore Timestamp, or a string into a readable locale string.
 * @param {Date | object | string} ts - The timestamp to format.
 * @returns {string} - The formatted date string or 'N/A'.
 */
export function formatTimestamp(ts) {
  if (!ts) return 'N/A';

  // Handle Firestore Timestamp objects
  if (ts.toDate && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).replace(',', '');
  }

  // Handle string or number timestamps
  const date = new Date(ts);
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  return date.toLocaleString('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '');
}

/**
 * Formats a size in bytes into a readable string (KB, MB, GB).
 * @param {number} bytes - The size in bytes.
 * @returns {string} - The formatted size string.
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}


/**
 * Fetches a file from a URL as a Blob and triggers a browser download.
 * @param {string} url - The direct URL to the file.
 * @param {string} fileName - The desired name for the downloaded file.
 */
export async function forceFileDownload(url, fileName) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);

  } catch (error) {
    console.error('Download failed:', error);
    // You can add a user-facing error notification here if you wish
    alert(`Failed to download ${fileName}. Please check the console for details.`);
  }
}