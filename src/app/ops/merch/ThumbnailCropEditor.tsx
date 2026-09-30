"use client";

import type { MerchImage, ThumbnailCrop } from "@/lib/merch/types";
import { thumbnailStyle } from "@/lib/merch/thumbnail";
import styles from "./MerchDashboard.module.css";

export default function ThumbnailCropEditor({ image, change }: { image: MerchImage; change: (image: MerchImage) => void }) {
  const crop = image.thumbnailCrop ?? { zoom: 1, x: 50, y: 50 };
  const update = (field: keyof ThumbnailCrop, value: number) => change({ ...image, thumbnailCrop: { ...crop, [field]: value } });
  return <fieldset className={styles.cropEditor}>
    <legend>Thumbnail framing</legend>
    <p>Frame the first photo for the shop and product cards. The full photo stays unchanged.</p>
    <div className={styles.cropLayout}>
      <div className={styles.cropPreview}><img src={image.url} alt="Thumbnail crop preview" draggable={false} style={thumbnailStyle(image.thumbnailCrop)} /></div>
      <div className={styles.cropControls}>
        <label className={styles.checkLabel}><input type="checkbox" checked={!!image.thumbnailCrop} onChange={e => change({ ...image, thumbnailCrop: e.target.checked ? crop : undefined })} />Crop to fill square</label>
        <label>Zoom <output>{crop.zoom.toFixed(2)}×</output><input aria-label="Thumbnail zoom" type="range" min="1" max="3" step="0.05" value={crop.zoom} disabled={!image.thumbnailCrop} onChange={e => update("zoom", Number(e.target.value))} /></label>
        <label>Horizontal position <output>{crop.x}%</output><input aria-label="Thumbnail horizontal position" type="range" min="0" max="100" value={crop.x} disabled={!image.thumbnailCrop} onChange={e => update("x", Number(e.target.value))} /></label>
        <label>Vertical position <output>{crop.y}%</output><input aria-label="Thumbnail vertical position" type="range" min="0" max="100" value={crop.y} disabled={!image.thumbnailCrop} onChange={e => update("y", Number(e.target.value))} /></label>
        <button type="button" className={styles.button} onClick={() => change({ ...image, thumbnailCrop: undefined })}>Reset to full photo</button>
        <p>Save product to apply this framing.</p>
      </div>
    </div>
  </fieldset>;
}
