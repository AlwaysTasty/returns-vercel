// src/utils/formatters.js

/**
 * Formats a Date object, a Firestore Timestamp, or a string into a readable locale string.
 * @param {Date | object | string} ts - The timestamp to format.
 * @returns {string} - The formatted date string or 'N/A'.
 */
export function formatTimestamp(ts) {
  if (!ts) return 'N/A';

  if (ts.toDate && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleString('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).replace(',', '');
  }

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
    alert(`Failed to download ${fileName}. Please check the console for details.`);
  }
}

/**
 * Fetches an image from a URL, converts it to a PNG Blob, and copies it to the clipboard.
 * @param {string} url - The direct URL to the image.
 * @returns {Promise<boolean>} - A promise that resolves to true on success, false on failure.
 */
export async function copyImageToClipboard(url) {
  if (!navigator.clipboard?.write) {
    console.error("Clipboard API not supported or write access denied.");
    alert("Your browser does not support copying images to the clipboard.");
    return false;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image for copying.");
    
    let blob = await response.blob();

    // The robust solution is to always try to convert to PNG for the clipboard.
    try {
      const imageBitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, 0, 0);

      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!pngBlob) throw new Error('Canvas to PNG Blob conversion failed.');

      blob = pngBlob; // Use the new PNG blob
      
    } catch (conversionError) {
      console.warn("Could not convert to PNG. Attempting to copy original image type. Error:", conversionError);
      // If conversion fails, we proceed with the original blob.
    }

    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ]);
    
    return true; // Indicate success
  } catch (error) {
    console.error('Failed to copy image to clipboard:', error);
    if (error.name === 'NotAllowedError') {
      alert("Copy failed. The browser tab may need to be focused when you click the button due to security restrictions.");
    } else {
      alert("Failed to copy image. The browser may not support copying this image type directly.");
    }
    return false; // Indicate failure
  }
}