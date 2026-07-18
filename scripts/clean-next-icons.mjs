import { readdir, rm } from "node:fs/promises";
import path from "node:path";

async function removeIconEntries(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.name.startsWith("Icon")) {
      await rm(fullPath, { recursive: true, force: true });
      return;
    }
    if (entry.isDirectory()) await removeIconEntries(fullPath);
  }));
}

await removeIconEntries(path.resolve(".next"));
