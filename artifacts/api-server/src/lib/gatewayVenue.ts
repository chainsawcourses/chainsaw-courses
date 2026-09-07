export const VENUE_MAPPING_ERROR =
  "Enter a valid UK postcode or latitude and longitude so this venue can be added to the map.";
export const VENUE_MAPPING_SERVICE_ERROR =
  "The postcode mapping service is temporarily unavailable. Please try again shortly or enter latitude and longitude.";

export class VenueMappingServiceError extends Error {
  constructor() {
    super(VENUE_MAPPING_SERVICE_ERROR);
    this.name = "VenueMappingServiceError";
  }
}

type CoordinateInput = {
  postcode?: string;
  lat?: number;
  lng?: number;
};

type FetchLike = typeof fetch;
const POSTCODE_LOOKUP_ATTEMPTS = 2;

function normaliseCoordinate(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return undefined;
}

function validCoordinatePair(
  latitude: unknown,
  longitude: unknown,
): { lat: number; lng: number } | null {
  const lat = normaliseCoordinate(latitude);
  const lng = normaliseCoordinate(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat! >= -90 &&
    lat! <= 90 &&
    lng! >= -180 &&
    lng! <= 180 &&
    !(lat === 0 && lng === 0)
  ) ? { lat: lat!, lng: lng! } : null;
}

async function lookupSecondaryPostcode(
  compactPostcode: string,
  fetchImpl: FetchLike,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetchImpl(
      `https://api.getthedata.com/postcode/${encodeURIComponent(compactPostcode)}`,
    );
    if (response.status === 400 || response.status === 404) return null;
    if (!response.ok) throw new VenueMappingServiceError();

    const data = await response.json() as {
      status?: string;
      data?: { latitude?: number | string; longitude?: number | string };
    };
    if (data.status === "no_match" || data.status === "no match") return null;
    if (data.status !== "match") throw new VenueMappingServiceError();

    return validCoordinatePair(data.data?.latitude, data.data?.longitude);
  } catch (error) {
    if (error instanceof VenueMappingServiceError) throw error;
    throw new VenueMappingServiceError();
  }
}

export async function resolveVenueCoordinates(
  { postcode, lat, lng }: CoordinateInput,
  fetchImpl: FetchLike = fetch,
): Promise<{ lat: number; lng: number } | null> {
  const manualCoordinates = validCoordinatePair(lat, lng);
  if (manualCoordinates) return manualCoordinates;

  const compactPostcode = postcode?.replace(/\s+/g, "").toUpperCase();
  if (!compactPostcode) return null;

  for (let attempt = 1; attempt <= POSTCODE_LOOKUP_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(compactPostcode)}`,
      );
      if (response.status === 400 || response.status === 404) return null;
      if (!response.ok) {
        if (attempt < POSTCODE_LOOKUP_ATTEMPTS) continue;
        return lookupSecondaryPostcode(compactPostcode, fetchImpl);
      }

      const data = await response.json() as {
        result?: { latitude?: number; longitude?: number };
      };
      return validCoordinatePair(data.result?.latitude, data.result?.longitude);
    } catch (error) {
      if (error instanceof VenueMappingServiceError) throw error;
      if (attempt === POSTCODE_LOOKUP_ATTEMPTS) {
        return lookupSecondaryPostcode(compactPostcode, fetchImpl);
      }
    }
  }

  throw new VenueMappingServiceError();
}

export async function prepareNewGatewayVenue<
  T extends CoordinateInput & { name: string; active?: boolean },
>(
  input: T,
  fetchImpl: FetchLike = fetch,
): Promise<(Omit<T, "lat" | "lng" | "active"> & { lat: number; lng: number; active: true }) | null> {
  const coordinates = await resolveVenueCoordinates(input, fetchImpl);
  if (!coordinates) return null;

  return {
    ...input,
    ...coordinates,
    active: true,
  };
}