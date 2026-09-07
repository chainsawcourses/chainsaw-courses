export async function getAdminApiError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? `The venue could not be saved (error ${response.status}).`;
}