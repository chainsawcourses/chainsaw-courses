export const VENUE_MAPPING_ERROR =
  "Enter a valid UK postcode or latitude and longitude so this venue can be added to the map.";

type CoordinateInput = {
  postcode?: string;
  lat?: number;
  lng?: number;
};

type FetchLike = typeof fetch;

function isValidCoordinatePair(lat: number | undefined, lng: number | undefined): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat! >= -90 &&
    lat! <= 90 &&
    lng! >= -180 &&
    lng! <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export async function resolveVenueCoordinates(
  { postcode, lat, lng }: CoordinateInput,
  fetchImpl: FetchLike = fetch,
): Promise<{ lat: number; lng: number } | null> {
  if (isValidCoordinatePair(lat, lng)) {
    return { lat: lat!, lng: lng! };
  }

  const compactPostcode = postcode?.replace(/\s+/g, "").toUpperCase();
  if (!compactPostcode) return null;

  const response = await fetchImpl(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(compactPostcode)}`,
  );
  if (!response.ok) return null;

  const data = await response.json() as {
    result?: { latitude?: number; longitude?: number };
  };
  const resolvedLat = data.result?.latitude;
  const resolvedLng = data.result?.longitude;
  if (!isValidCoordinatePair(resolvedLat, resolvedLng)) {
    return null;
  }

  return { lat: resolvedLat!, lng: resolvedLng! };
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