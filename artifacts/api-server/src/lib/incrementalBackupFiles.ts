export function backupFileIdentity(name: string): string {
  const text = name.replace(/_/g, " ");
  const user = text.match(/\bUser[ -]+(\d+)/i)?.[1];
  const enrolment = text.match(/\bEnrolment[ -]+(\d+|null)/i)?.[1];
  if (/certificate/i.test(text) && user) return `certificate:${user}:${enrolment ?? "legacy"}`;
  if (/waiver/i.test(text) && user && enrolment) return `waiver:${user}:${enrolment}`;
  if (/progress/i.test(text) && user) return `progress:${user}`;
  const inspection = text.match(/\bInspection[ -]+(\d+)/i);
  if (inspection) return `inspection:${inspection[1]}`;
  const risk = text.match(/\bRisk[ -]+Assessment[ -]+(\d+)/i);
  if (risk) return `risk:${risk[1]}`;
  const logo = text.match(/\bRetailer[ -]+(\d+)[ -]+Logo/i);
  if (logo) return `logo:${logo[1]}`;
  return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2}(?:[-.]\d{3})?Z/g, "")
    .replace(/[ —-]+(?=\.|$)/g, "").trim().toLowerCase();
}

type FileEntry = { id: string; name: string; md5Checksum?: string; appProperties?: { sourceHash?: string; verifiedMd5?: string } };
type Request = <T>(url: string, request: { method: string; headers?: Record<string, string>; body?: string }) => Promise<T>;
const listings = new WeakMap<object, Map<string, FileEntry[]>>();

export function rememberIncrementalFile(owner: object, folderId: string, file: FileEntry): void {
  const files = listings.get(owner)?.get(folderId);
  if (!files) return;
  const index = files.findIndex((entry) => entry.id === file.id);
  if (index >= 0) files[index] = file;
  else files.unshift(file);
}

/** Adopt the newest matching existing file; older historical duplicates are never deleted. */
export async function findIncrementalFile(owner: object, folderId: string, name: string, request: Request, aliases: string[] = []): Promise<FileEntry | undefined> {
  let cache = listings.get(owner);
  if (!cache) { cache = new Map(); listings.set(owner, cache); }
  let files = cache.get(folderId);
  if (!files) {
    files = [];
    let token: string | undefined;
    do {
      const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`;
      const page: { files?: FileEntry[]; nextPageToken?: string } = await request(
        `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,md5Checksum,appProperties),nextPageToken&orderBy=createdTime%20desc&pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`,
        { method: "GET" },
      );
      files.push(...(page.files ?? []));
      token = page.nextPageToken;
    } while (token);
    cache.set(folderId, files);
  }
  const keys = new Set([name, ...aliases].map(backupFileIdentity));
  return files.find((file) => keys.has(backupFileIdentity(file.name)));
}
