import { randomUUID } from "crypto";
import { type File } from "@google-cloud/storage";
import { createObjectStorageRuntime } from "./objectStorageRuntime.ts";

const { storage, upload } = createObjectStorageRuntime();

function privateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return dir.replace(/\/+$/, "");
}

function parseObjectPath(rawPath: string): { bucketName: string; objectName: string } {
  const parts = rawPath.replace(/^\/+/, "").split("/");
  if (parts.length < 2) throw new Error("Invalid App Storage path");
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

async function createPrivateObjectUpload(objectKey: string): Promise<{ uploadURL: string; objectKey: string }> {
  const { bucketName, objectName } = parseObjectPath(`${privateObjectDir()}/${objectKey}`);
  return { uploadURL: await upload(bucketName, objectName), objectKey };
}

async function getPrivateObject(objectKey: string): Promise<File | null> {
  const { bucketName, objectName } = parseObjectPath(`${privateObjectDir()}/${objectKey}`);
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  return exists ? file : null;
}

export async function createAssessmentMediaUpload(
  kind: "images" | "audio",
): Promise<{ uploadURL: string; objectKey: string }> {
  return createPrivateObjectUpload(`assessment-media/${kind}/${randomUUID()}`);
}

export async function getAssessmentMediaObject(objectKey: string): Promise<File | null> {
  if (!/^assessment-media\/(?:images|audio)\/[a-f0-9-]+$/.test(objectKey)) return null;
  return getPrivateObject(objectKey);
}

export async function deleteAssessmentMediaObject(objectKey: string): Promise<void> {
  const file = await getAssessmentMediaObject(objectKey);
  if (file) await file.delete({ ignoreNotFound: true });
}

export function retailerLogoObjectKeyFor(retailerId: number, objectId: string): string | null {
  if (!Number.isInteger(retailerId) || retailerId <= 0 || !/^[a-f0-9-]{36}$/.test(objectId)) return null;
  return `retailer-logos/${retailerId}/${objectId}`;
}

export function retailerLogoObjectIdFromKey(objectKey: string, retailerId: number): string | null {
  const match = objectKey.match(/^retailer-logos\/([1-9]\d*)\/([a-f0-9-]{36})$/);
  if (!match || Number(match[1]) !== retailerId) return null;
  return match[2];
}

export async function createRetailerLogoUpload(
  retailerId: number,
): Promise<{ uploadURL: string; objectKey: string }> {
  const objectKey = retailerLogoObjectKeyFor(retailerId, randomUUID());
  if (!objectKey) throw new Error("Invalid retailer id for logo upload");
  return createPrivateObjectUpload(objectKey);
}

export async function getRetailerLogoObject(objectKey: string, retailerId: number): Promise<File | null> {
  if (!retailerLogoObjectIdFromKey(objectKey, retailerId)) return null;
  return getPrivateObject(objectKey);
}

export async function deleteRetailerLogoObject(objectKey: string, retailerId: number): Promise<void> {
  const file = await getRetailerLogoObject(objectKey, retailerId);
  if (file) await file.delete({ ignoreNotFound: true });
}

export async function listAssessmentMediaObjects(): Promise<Array<{
  objectKey: string;
  createdAt: Date;
}>> {
  const privateDir = privateObjectDir();
  const { bucketName, objectName } = parseObjectPath(`${privateDir}/assessment-media/`);
  const [files] = await storage.bucket(bucketName).getFiles({ prefix: objectName });
  return files.flatMap(file => {
    const objectKey = assessmentMediaObjectKeyFromFileName(file.name, privateDir);
    const createdAt = file.metadata.timeCreated ? new Date(file.metadata.timeCreated) : null;
    return objectKey && createdAt && !Number.isNaN(createdAt.getTime())
      ? [{ objectKey, createdAt }]
      : [];
  });
}

export function assessmentMediaObjectKeyFromFileName(
  fileName: string,
  rawPrivateDir: string,
): string | null {
  const { objectName } = parseObjectPath(rawPrivateDir);
  const privatePrefix = `${objectName.replace(/\/+$/, "")}/`;
  return fileName.startsWith(privatePrefix)
    ? fileName.slice(privatePrefix.length)
    : null;
}