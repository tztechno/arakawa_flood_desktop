// JGD2011 / Japan Plane Rectangular CS IX (EPSG:6677) — Tokyo & Saitama
import proj4 from 'proj4';

export const EPSG6677 =
  '+proj=tmerc +lat_0=36 +lon_0=139.8333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

const conv = proj4('EPSG:4326', EPSG6677);

/** [lon, lat] (deg) -> [E, N] (m) */
export function toPlane(lon, lat) {
  return conv.forward([lon, lat]);
}

/** [E, N] (m) -> [lon, lat] (deg) */
export function toLonLat(e, n) {
  return conv.inverse([e, n]);
}

/**
 * Arakawa Peil (A.P.) to Tokyo Peil (T.P. standard elevation)
 * A.P. = T.P. + 1.1344 m
 */
export const AP_OFFSET = 1.1344;
export const toTP = (ap) => ap - AP_OFFSET;
export const toAP = (tp) => tp + AP_OFFSET;

/** Format elevation in both A.P. and T.P. */
export function formatElev(tp) {
  const ap = toAP(tp);
  return `A.P. +${ap.toFixed(2)}m (T.P. +${tp.toFixed(2)}m)`;
}
