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
type PostcodeProvider = "postcodes.io" | "getthedata.com";
type PostcodeLookupOutcome =
  | "success"
  | "retry"
  | "fallback_success"
  | "invalid_result"
  | "provider_failure";
export type PostcodeLookupEvent = {
  provider: PostcodeProvider;
  outcome: PostcodeLookupOutcome;
  attempt: number;
  httpStatus?: number;
};
type RecordPostcodeLookup = (event: PostcodeLookupEvent) => void;
const POSTCODE_LOOKUP_ATTEMPTS = 2;
const PRIMARY_POSTCODE_API_URL =
  process.env["POSTCODE_PRIMARY_API_URL"] ?? "https://api.postcodes.io/postcodes";
const SECONDARY_POSTCODE_API_URL =
  process.env["POSTCODE_SECONDARY_API_URL"] ?? "https://api.getthedata.com/postcode";

let recordPostcodeLookup: RecordPostcodeLookup = () => {};

export function setPostcodeLookupRecorder(recorder: RecordPostcodeLookup): void {
  recordPostcodeLookup = recorder;
}

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
  recordLookup: RecordPostcodeLookup,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetchImpl(
      `${SECONDARY_POSTCODE_API_URL}/${encodeURIComponent(compactPostcode)}`,
    );
    if (response.status === 400 || response.status === 404) {
      recordLookup({
        provider: "getthedata.com",
        outcome: "invalid_result",
        attempt: 1,
        httpStatus: response.status,
      });
      return null;
    }
    if (!response.ok) {
      recordLookup({
        provider: "getthedata.com",
        outcome: "provider_failure",
        attempt: 1,
        httpStatus: response.status,
      });
      throw new VenueMappingServiceError();
    }

    const data = await response.json() as {
      status?: string;
      data?: { latitude?: number | string; longitude?: number | string };
    };
    if (data.status === "no_match" || data.status === "no match") {
      recordLookup({
        provider: "getthedata.com",
        outcome: "invalid_result",
        attempt: 1,
        httpStatus: response.status,
      });
      return null;
    }
    if (data.status !== "match") {
      recordLookup({
        provider: "getthedata.com",
        outcome: "provider_failure",
        attempt: 1,
        httpStatus: response.status,
      });
      throw new VenueMappingServiceError();
    }

    const coordinates = validCoordinatePair(data.data?.latitude, data.data?.longitude);
    recordLookup({
      provider: "getthedata.com",
      outcome: coordinates ? "fallback_success" : "invalid_result",
      attempt: 1,
      httpStatus: response.status,
    });
    return coordinates;
  } catch (error) {
    if (error instanceof VenueMappingServiceError) throw error;
    recordLookup({
      provider: "getthedata.com",
      outcome: "provider_failure",
      attempt: 1,
    });
    throw new VenueMappingServiceError();
  }
}

export async function resolveVenueCoordinates(
  { postcode, lat, lng }: CoordinateInput,
  fetchImpl: FetchLike = fetch,
  recordLookup: RecordPostcodeLookup = recordPostcodeLookup,
): Promise<{ lat: number; lng: number } | null> {
  const manualCoordinates = validCoordinatePair(lat, lng);
  if (manualCoordinates) return manualCoordinates;

  const compactPostcode = postcode?.replace(/\s+/g, "").toUpperCase();
  if (!compactPostcode) return null;

  for (let attempt = 1; attempt <= POSTCODE_LOOKUP_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(
        `${PRIMARY_POSTCODE_API_URL}/${encodeURIComponent(compactPostcode)}`,
      );
      if (response.status === 400 || response.status === 404) {
        recordLookup({
          provider: "postcodes.io",
          outcome: "invalid_result",
          attempt,
          httpStatus: response.status,
        });
        return null;
      }
      if (!response.ok) {
        recordLookup({
          provider: "postcodes.io",
          outcome: "provider_failure",
          attempt,
          httpStatus: response.status,
        });
        if (attempt < POSTCODE_LOOKUP_ATTEMPTS) {
          recordLookup({
            provider: "postcodes.io",
            outcome: "retry",
            attempt: attempt + 1,
          });
          continue;
        }
        return lookupSecondaryPostcode(compactPostcode, fetchImpl, recordLookup);
      }

      const data = await response.json() as {
        result?: { latitude?: number; longitude?: number };
      };
      const coordinates = validCoordinatePair(data.result?.latitude, data.result?.longitude);
      recordLookup({
        provider: "postcodes.io",
        outcome: coordinates ? "success" : "invalid_result",
        attempt,
        httpStatus: response.status,
      });
      return coordinates;
    } catch (error) {
      if (error instanceof VenueMappingServiceError) throw error;
      recordLookup({
        provider: "postcodes.io",
        outcome: "provider_failure",
        attempt,
      });
      if (attempt === POSTCODE_LOOKUP_ATTEMPTS) {
        return lookupSecondaryPostcode(compactPostcode, fetchImpl, recordLookup);
      }
      recordLookup({
        provider: "postcodes.io",
        outcome: "retry",
        attempt: attempt + 1,
      });
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