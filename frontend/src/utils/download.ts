/** Save a downloaded blob (e.g. a PDF from the API) as a file in the browser. */
export function saveBlob(data: BlobPart, filename: string, type = 'application/pdf') {
  const url = window.URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/** A file name made of letters, digits, hyphens and underscores. */
export function safeFileName(name: string, fallback: string) {
  const cleaned = name.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 60);
  return cleaned || fallback;
}

/** Link for an uploaded file (stored as /uploads/<name>). */
export function uploadUrl(path: string) {
  return path.startsWith('http') || path.startsWith('/') ? path : `/uploads/${path.replace(/\\/g, '/').split('/').pop()}`;
}
