/* Compress locally before sending an attachment to storage. */
const photoCompression = (() => {
  const MAX_EDGE = 1600;
  const UPLOAD_LIMIT = 10 * 1024 * 1024;
  async function decode(file) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(file, {imageOrientation:'from-image'}); } catch {}
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(Error('Could not read this photo. Please choose another file.'));
        image.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }
  async function prepare(file) {
    const mime = file.type || (/\.pdf$/i.test(file.name || '') ? 'application/pdf' : '');
    if (mime === 'application/pdf') {
      if (file.size > UPLOAD_LIMIT) throw Error('PDF files must be under 10 MB.');
      return file;
    }
    if (!['image/jpeg','image/png','image/webp'].includes(mime)) throw Error('Use JPEG, PNG, WebP or PDF files.');
    if (file.size > 30 * 1024 * 1024) throw Error('Choose a photo under 30 MB before compression.');
    const image = await decode(file);
    const canvas = document.createElement('canvas');
    try {
      const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
      if (!width || !height) throw Error('This photo has invalid dimensions.');
      const ratio = Math.min(1, MAX_EDGE / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      const context = canvas.getContext('2d');
      if (!context) throw Error('Photo compression is unavailable in this browser.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // WebP retains transparency for PNG/WebP inputs; unsupported browsers return PNG.
      const outputType = mime === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
      const compressed = await new Promise(resolve => canvas.toBlob(resolve, outputType, 0.82));
      if (!compressed) throw Error('Could not compress this photo. Please try another file.');
      const result = compressed.size < file.size ? compressed : file;
      if (result.size > UPLOAD_LIMIT) throw Error('This photo is still over 10 MB after compression. Please choose a smaller photo.');
      return result;
    } finally {
      if (typeof image.close === 'function') image.close();
      canvas.width = canvas.height = 0;
    }
  }
  return {prepare};
})();
