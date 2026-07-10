// Converts WGS84 lat/lon to a British National Grid reference (e.g. "TQ 388 775").
// Based on the standard Airy 1830 / OSGB36 Transverse Mercator projection formulas
// (as published by Ordnance Survey, "A guide to coordinate systems in Great Britain").

const RAD = Math.PI / 180;

// Airy 1830 ellipsoid
const a = 6377563.396;
const b = 6356256.909;
const f0 = 0.9996012717; // NatGrid scale factor on central meridian
const lat0 = 49 * RAD; // NatGrid true origin latitude
const lon0 = -2 * RAD; // NatGrid true origin longitude
const n0 = -100000; // northing of true origin, metres
const e0 = 400000; // easting of true origin, metres
const e2 = 1 - (b * b) / (a * a); // eccentricity squared
const n = (a - b) / (a + b);

function wgs84ToOsgb36(latDeg: number, lonDeg: number): { lat: number; lon: number } {
  // WGS84 ellipsoid
  const aWgs = 6378137.0;
  const bWgs = 6356752.3142;
  const e2Wgs = 1 - (bWgs * bWgs) / (aWgs * aWgs);

  const latR = latDeg * RAD;
  const lonR = lonDeg * RAD;
  const v = aWgs / Math.sqrt(1 - e2Wgs * Math.sin(latR) * Math.sin(latR));
  const x1 = v * Math.cos(latR) * Math.cos(lonR);
  const y1 = v * Math.cos(latR) * Math.sin(lonR);
  const z1 = (1 - e2Wgs) * v * Math.sin(latR);

  // Helmert 7-parameter transform, WGS84 -> OSGB36
  const tx = -446.448;
  const ty = 125.157;
  const tz = -542.06;
  const s = -20.4894 / 1e6; // scale factor (unitless, ppm)
  const rx = (-0.1502 / 3600) * RAD;
  const ry = (-0.247 / 3600) * RAD;
  const rz = (-0.8421 / 3600) * RAD;

  const x2 = tx + (1 + s) * x1 + -rz * y1 + ry * z1;
  const y2 = ty + rz * x1 + (1 + s) * y1 + -rx * z1;
  const z2 = tz + -ry * x1 + rx * y1 + (1 + s) * z1;

  // Convert back to lat/lon on Airy 1830 ellipsoid (iterative)
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let lat = Math.atan2(z2, p * (1 - e2));
  for (let i = 0; i < 10; i++) {
    const v2 = a / Math.sqrt(1 - e2 * Math.sin(lat) * Math.sin(lat));
    const latNext = Math.atan2(z2 + e2 * v2 * Math.sin(lat), p);
    if (Math.abs(latNext - lat) < 1e-14) {
      lat = latNext;
      break;
    }
    lat = latNext;
  }
  const lon = Math.atan2(y2, x2);

  return { lat, lon };
}

function meridionalArc(lat: number): number {
  const M1 = (1 + n + (5 / 4) * n * n + (5 / 4) * n * n * n) * (lat - lat0);
  const M2 = (3 * n + 3 * n * n + (21 / 8) * n * n * n) * Math.sin(lat - lat0) * Math.cos(lat + lat0);
  const M3 = ((15 / 8) * n * n + (15 / 8) * n * n * n) * Math.sin(2 * (lat - lat0)) * Math.cos(2 * (lat + lat0));
  const M4 = (35 / 24) * n * n * n * Math.sin(3 * (lat - lat0)) * Math.cos(3 * (lat + lat0));
  return b * f0 * (M1 - M2 + M3 - M4);
}

export function toOsGridReference(latDeg: number, lonDeg: number): string | null {
  try {
    const { lat, lon } = wgs84ToOsgb36(latDeg, lonDeg);

    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const tanLat = Math.tan(lat);

    const nu = (a * f0) / Math.sqrt(1 - e2 * sinLat * sinLat);
    const rho = (a * f0 * (1 - e2)) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
    const eta2 = nu / rho - 1;

    const M = meridionalArc(lat);
    const tan2lat = tanLat * tanLat;
    const tan4lat = tan2lat * tan2lat;

    const I = M + n0;
    const II = (nu / 2) * sinLat * cosLat;
    const III = (nu / 24) * sinLat * Math.pow(cosLat, 3) * (5 - tan2lat + 9 * eta2);
    const IIIA = (nu / 720) * sinLat * Math.pow(cosLat, 5) * (61 - 58 * tan2lat + tan4lat);

    const IV = nu * cosLat;
    const V = (nu / 6) * Math.pow(cosLat, 3) * (nu / rho - tan2lat);
    const VI = (nu / 120) * Math.pow(cosLat, 5) * (5 - 18 * tan2lat + tan4lat + 14 * eta2 - 58 * tan2lat * eta2);

    const dLon = lon - lon0;

    const N = I + II * dLon * dLon + III * Math.pow(dLon, 4) + IIIA * Math.pow(dLon, 6);
    const E = e0 + IV * dLon + V * Math.pow(dLon, 3) + VI * Math.pow(dLon, 5);

    return formatGridRef(E, N);
  } catch {
    return null;
  }
}

function formatGridRef(easting: number, northing: number): string | null {
  if (easting < 0 || easting >= 700000 || northing < 0 || northing >= 1300000) {
    return null;
  }

  const gridChars = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const e100k = Math.floor(easting / 100000);
  const n100k = Math.floor(northing / 100000);

  const l1 = 19 - n100k - ((19 - n100k) % 5) + Math.floor((e100k + 10) / 5);
  const l2 = ((19 - n100k) * 5) % 25 + (e100k % 5);

  if (l1 < 0 || l1 >= gridChars.length || l2 < 0 || l2 >= gridChars.length) return null;

  const letterPair = gridChars[l1] + gridChars[l2];

  const e = Math.floor(easting % 100000);
  const n = Math.floor(northing % 100000);

  const eStr = Math.floor(e / 100).toString().padStart(3, "0");
  const nStr = Math.floor(n / 100).toString().padStart(3, "0");

  return `${letterPair} ${eStr} ${nStr}`;
}
