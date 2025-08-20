'use client';

import { useRef, useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { LightGallery as ILightGallery } from 'lightgallery/lightgallery';
import { API_GET_PROXY } from '@/lib/api';

// Core + your existing plugins
import lgZoom from 'lightgallery/plugins/zoom';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgVideo from 'lightgallery/plugins/video';

// New plugins
import lgShare from 'lightgallery/plugins/share';
import lgHash from 'lightgallery/plugins/hash';
import lgRotate from 'lightgallery/plugins/rotate';
import lgAutoplay from 'lightgallery/plugins/autoplay';
import lgPager from 'lightgallery/plugins/pager';

// CSS (core + each plugin you use)
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';
import 'lightgallery/css/lg-thumbnail.css';
import 'lightgallery/css/lg-video.css';
import 'lightgallery/css/lg-share.css';
import 'lightgallery/css/lg-rotate.css';
import 'lightgallery/css/lg-autoplay.css';
import 'lightgallery/css/lg-pager.css';

const LightGallery = dynamic(() => import('lightgallery/react'), { ssr: false });

async function generateVideoThumb(
  src: string,
  opts: { time?: number; width?: number } = {}
): Promise<string> {
  const { time = 0.1, width = 480 } = opts; // grab frame at 0.1s
  const video = document.createElement('video');
  // IMPORTANT for canvas draw: your server must send proper CORS headers
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true; // some browsers require muted to programmatically play/seek
  video.src = src;

  await new Promise<void>((resolve, reject) => {
    const onError = () => reject(new Error('Failed to load video'));
    video.addEventListener('loadedmetadata', () => {
      // Clamp seek time within duration
      const target = Math.min(Math.max(time, 0), Math.max(video.duration - 0.01, 0));
      // iOS sometimes needs a tiny play/pause before seeking
      const trySeek = () => {
        video.currentTime = isFinite(target) ? target : 0;
      };
      try {
        video.play().then(() => {
          video.pause();
          trySeek();
        }).catch(() => trySeek());
      } catch {
        trySeek();
      }
    }, { once: true });
    video.addEventListener('seeked', () => resolve(), { once: true });
    video.addEventListener('error', onError, { once: true });
  });

  const scale = width / video.videoWidth;
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');

  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.8);
}

const isImage = (url: string) => /\.(jpe?g|png|gif|bmp|webp|svg)$/i.test(url);
const isVideo = (url: string) => /\.(mp4|mov|webm|ogg)$/i.test(url);

export default function ImageGallery({ images }: { images: string[] }) {
  const lgRef = useRef<ILightGallery | null>(null);
  const [dynamicEl, setDynamicEl] = useState<any[]>([]);
  const [videoThumbs, setVideoThumbs] = useState<Record<string, string>>({}); // raw -> dataURL

  const proxied = useMemo(
    () => images.map((raw) => ({ raw, src: `${API_GET_PROXY}${raw}` })),
    [images]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: any[] = [];

      for (const { raw, src } of proxied) {
        if (isImage(raw)) {
          entries.push({ src, thumb: src, subHtml: '' });
        }
      }

      const thumbMap: Record<string, string> = {};
      for (const { raw, src } of proxied) {
        if (!isVideo(raw)) continue;
        try {
          const dataUrl = await generateVideoThumb(src, { time: 0.1, width: 480 });
          thumbMap[raw] = dataUrl;
          entries.push({
            poster: dataUrl,
            thumb: dataUrl,
            subHtml: '',
            video: {
              source: [{ src, type: raw.endsWith('.webm') ? 'video/webm' : 'video/mp4' }],
              attributes: { controls: true, preload: 'metadata', playsinline: true },
            },
          });
        } catch {
          entries.push({
            subHtml: '',
            video: {
              source: [{ src, type: raw.endsWith('.webm') ? 'video/webm' : 'video/mp4' }],
              attributes: { controls: true, preload: 'metadata', playsinline: true },
            },
          });
        }
      }

      if (!cancelled) {
        setVideoThumbs(thumbMap);
        const byRaw: Record<string, any> = {};
        for (const e of entries) {
          const key = proxied.find(p => p.src === e.src || (e.video?.source?.[0]?.src === p.src))?.raw;
          if (key) byRaw[key] = e;
        }
        setDynamicEl(images.map(raw => byRaw[raw] || null).filter(Boolean));
      }
    })();
    return () => { cancelled = true; };
  }, [proxied, images]);

  const openAt = (i: number) => lgRef.current?.openGallery(i);

  return (
    <div className="w-full">
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap p-2">
        {images.map((raw, i) => {
          const src = `${API_GET_PROXY}${raw}`;
          if (isImage(raw)) {
            return (
              <img
                key={i}
                src={src}
                alt={`Thumbnail ${i}`}
                className="w-24 h-24 object-cover cursor-pointer rounded-lg border flex-shrink-0"
                onClick={() => openAt(i)}
                loading="lazy"
              />
            );
          }
          if (isVideo(raw)) {
            const thumb = videoThumbs[raw];
            return thumb ? (
              <img
                key={i}
                src={thumb}
                alt={`Video thumbnail ${i}`}
                className="w-24 h-24 object-cover cursor-pointer rounded-lg border flex-shrink-0"
                onClick={() => openAt(i)}
                loading="lazy"
              />
            ) : (
              <video
                key={i}
                src={src}
                className="w-24 h-24 object-cover cursor-pointer rounded-lg border flex-shrink-0"
                muted
                playsInline
                onClick={() => openAt(i)}
              />
            );
          }
          return null;
        })}
      </div>

      <LightGallery
        onInit={(detail) => (lgRef.current = detail.instance)}
        plugins={[
          lgZoom,
          lgThumbnail,
          lgVideo,
          lgShare,
          lgHash,
          lgRotate,
          lgAutoplay,
          lgPager,]}
        dynamic
        dynamicEl={dynamicEl}
        closable
        counter
        download={false}
        zoomFromOrigin
        thumbnail
        speed={300}
        mobileSettings={{ controls: true, showCloseIcon: true, download: false, rotate: false }}
      />
    </div>
  );
}