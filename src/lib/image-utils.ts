/**
 * Convert and resize an image file to JPEG using an off-screen canvas.
 * This handles:
 *  - HEIC/HEIF detection (unsupported format, gives clear error)
 *  - Oversized images (resizes to max dimension while preserving aspect ratio)
 *  - Non-standard MIME types (normalizes to JPEG)
 *  - Returns a clean data:image/jpeg;base64,... string
 */
export function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Detect HEIC/HEIF early — canvas cannot load these
    const mimeType = (file.type || '').toLowerCase();
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      reject(new Error(
        'HEIC/HEIF format is not supported. ' +
        'On iPhone: go to Settings \u2192 Camera \u2192 Formats \u2192 select \"Most Compatible\". ' +
        'Or take a screenshot of the image and upload that instead.'
      ));
      return;
    }

    // Check if it's a valid image type
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (JPEG, PNG, or WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      if (!dataUri) {
        reject(new Error('Failed to read image file.'));
        return;
      }

      // Load into an Image element to get dimensions and enable canvas resize
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 2000; // Max width or height in pixels — keeps file under ~3MB
        let { width, height } = img;

        if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
          // No resize needed — return the original data URI
          // but ensure it's a standard JPEG data URI
          if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            resolve(dataUri);
            return;
          }
          // Convert non-JPEG to JPEG via canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0);
          const jpegDataUri = canvas.toDataURL('image/jpeg', 0.92);
          resolve(jpegDataUri);
        } else {
          // Resize to fit within MAX_DIMENSION
          const scale = MAX_DIMENSION / Math.max(width, height);
          const newWidth = Math.round(width * scale);
          const newHeight = Math.round(height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          const jpegDataUri = canvas.toDataURL('image/jpeg', 0.92);
          resolve(jpegDataUri);
        }
      };
      img.onerror = () => {
        reject(new Error(
          'Failed to load image. The file may be corrupted or in an unsupported format. ' +
          'Try converting to JPEG and uploading again.'
        ));
      };
      img.src = dataUri;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read the file. Please try again.'));
    };
    reader.readAsDataURL(file);
  });
}
