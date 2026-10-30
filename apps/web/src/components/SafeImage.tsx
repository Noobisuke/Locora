"use client";
import { useState } from "react";
// Square, cropped (object-fit: cover) image with a letter fallback if the URL is missing or fails to load.
export default function SafeImage({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="imgbox">
      {src && !failed ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
        : <span className="ph" aria-label="No image">{alt.charAt(0).toUpperCase()}</span>}
    </div>
  );
}
