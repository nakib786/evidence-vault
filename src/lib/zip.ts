/** Bundle a set of in-memory files into one downloadable .zip, entirely on-device. */
import { zip, type Zippable } from 'fflate';

export interface ZipEntry {
  name: string;
  data: Blob | Uint8Array | string;
}

async function toBytes(data: Blob | Uint8Array | string): Promise<Uint8Array> {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(await data.arrayBuffer());
}

export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const files: Zippable = {};
  for (const entry of entries) {
    files[entry.name] = await toBytes(entry.data);
  }
  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}
