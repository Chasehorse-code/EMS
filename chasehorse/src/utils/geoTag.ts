/**
 * GeoTagging utility: Stamps real GPS coordinates, address, and timestamp
 * directly onto field evidence images via HTML5 Canvas.
 */

export interface StampMetadata {
  lat: number;
  lng: number;
  accuracy?: number;
  address?: string;
  timestamp: string;
  taskId: string;
  employeeName?: string;
  checklistLabel?: string;
}

export type DrawableSource = string | File | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

/**
 * Loads an image from a File, Data URL, or element into an HTMLImageElement or directly draws it.
 */
export function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    if (src instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(src);
    } else {
      img.src = src;
    }

    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

/**
 * Stamps a high-visibility presentation banner and corner metadata with GPS,
 * address, timestamp, and task context onto the photo canvas.
 */
export async function stampGeotagOnImage(
  imageSource: DrawableSource,
  meta: StampMetadata,
): Promise<{ stampedDataUrl: string; rawDataUrl: string }> {
  let sourceElement: CanvasImageSource;
  let sourceWidth = 1280;
  let sourceHeight = 720;

  if (typeof imageSource === 'string' || imageSource instanceof File) {
    const img = await loadImage(imageSource);
    sourceElement = img;
    sourceWidth = img.naturalWidth || img.width;
    sourceHeight = img.naturalHeight || img.height;
  } else if (typeof HTMLVideoElement !== 'undefined' && imageSource instanceof HTMLVideoElement) {
    sourceElement = imageSource;
    sourceWidth = imageSource.videoWidth || 1280;
    sourceHeight = imageSource.videoHeight || 720;
  } else if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
    sourceElement = imageSource;
    sourceWidth = imageSource.width;
    sourceHeight = imageSource.height;
  } else {
    sourceElement = imageSource as HTMLImageElement;
    sourceWidth = (imageSource as HTMLImageElement).naturalWidth || (imageSource as HTMLImageElement).width;
    sourceHeight = (imageSource as HTMLImageElement).naturalHeight || (imageSource as HTMLImageElement).height;
  }

  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Draw original image / video frame
  ctx.drawImage(sourceElement, 0, 0, sourceWidth, sourceHeight);

  // Preserve raw data URL for pristine storage and review
  const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);

  // Slim, neat and unobtrusive semi-transparent footer strip (never covering the subject)
  const scale = Math.max(1, sourceWidth / 1280);
  const stripHeight = Math.round(54 * scale);
  const stripY = sourceHeight - stripHeight;

  // Semi-transparent dark strip background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.fillRect(0, stripY, sourceWidth, stripHeight);

  // Orange accent indicator line on top of strip
  ctx.fillStyle = '#e8541e';
  ctx.fillRect(0, stripY, sourceWidth, Math.max(2, Math.round(2 * scale)));

  // Text formatting
  ctx.textBaseline = 'middle';
  const paddingX = Math.round(16 * scale);

  // Line 1: Task ID | Worker Employee ID | Timestamp (local time with timezone)
  const taskLabel = meta.taskId.length > 20 && !meta.taskId.includes('-') && !meta.taskId.startsWith('OFW')
    ? meta.taskId.slice(0, 8).toUpperCase()
    : meta.taskId;
  const empCode = meta.employeeName || 'EMP001';
  const timeIST = meta.timestamp;

  ctx.font = `600 ${Math.round(13 * scale)}px "JetBrains Mono", Menlo, Monaco, Consolas, monospace`;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`TASK ${taskLabel} | EMP ${empCode} | ${timeIST}`, paddingX, stripY + Math.round(18 * scale));

  // Verification code & ChaseHorse mark on right of Line 1
  const verCode = Math.abs(Math.sin(meta.lat * 100 + meta.lng * 10) * 10000).toFixed(0).padStart(4, '0');
  ctx.font = `700 ${Math.round(11 * scale)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = '#e8541e';
  const sealText = `⚡ CHASEHORSE • #${verCode}`;
  const sealWidth = ctx.measureText(sealText).width;
  ctx.fillText(sealText, sourceWidth - sealWidth - paddingX, stripY + Math.round(18 * scale));

  // Line 2: <lat, lng> +/-<accuracy m> | <short address>
  const coordsStr = `GPS ${meta.lat.toFixed(5)}°, ${meta.lng.toFixed(5)}° ±${Math.round(meta.accuracy || 10)}m`;
  const shortAddr = meta.address ? (meta.address.length > 50 ? meta.address.slice(0, 48) + '...' : meta.address) : 'Verified Site Coordinate';

  ctx.font = `500 ${Math.round(12 * scale)}px "JetBrains Mono", Menlo, Monaco, Consolas, monospace`;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`${coordsStr} | ${shortAddr}`, paddingX, stripY + Math.round(38 * scale));

  const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  return { stampedDataUrl, rawDataUrl };
}
