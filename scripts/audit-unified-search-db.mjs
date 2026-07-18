import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";

const outputPath = process.argv[2] || null;
const environmentName = process.argv[3] || process.env.VERCEL_ENV || "unknown";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Supabase preview environment is not configured");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const configs = {
  stories: {
    table: "stories",
    select: "id, name, summary, full_text, tags, category, is_active",
    title: "name",
    url: null,
    textFields: ["name", "summary", "full_text", "category"],
    tagField: "tags",
  },
  links: {
    table: "links",
    select: "id, title, url, description, tags, category, is_active",
    title: "title",
    url: "url",
    textFields: ["title", "description", "category"],
    tagField: "tags",
  },
  images: {
    table: "admin_images",
    select: "id, title, image_url, description, tags, is_active",
    title: "title",
    url: "image_url",
    textFields: ["title", "description"],
    tagField: "tags",
  },
  youtube: {
    table: "youtube_transcripts",
    select: "id, title, youtube_url, summary, category, is_active",
    title: "title",
    url: "youtube_url",
    textFields: ["title", "summary", "category"],
    tagField: null,
  },
};

const topics = {
  joint: ["관절", "무릎", "연골"],
  gut: ["장 건강", "장", "변비", "배변", "복통"],
};

function validHttpUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\/\S+$/i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeTags(value) {
  return Array.isArray(value) ? value : [];
}

function scoreRow(row, config, terms) {
  let score = 0;
  for (const term of terms) {
    const title = String(row[config.title] ?? "");
    if (title.includes(term)) score += 8;
    for (const field of config.textFields.filter((field) => field !== config.title)) {
      if (String(row[field] ?? "").includes(term)) score += 2;
    }
    if (config.tagField && normalizeTags(row[config.tagField]).join(" ").includes(term)) score += 6;
  }
  return score;
}

async function auditSource(source, config) {
  const [{ count: total, error: totalError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase.from(config.table).select("id", { count: "exact", head: true }),
    supabase.from(config.table).select(config.select).eq("is_active", true).limit(5000),
  ]);
  if (totalError) throw new Error(`${source} count failed: ${totalError.message}`);
  if (rowsError) throw new Error(`${source} read failed: ${rowsError.message}`);

  const activeRows = rows ?? [];
  const missingTitle = activeRows.filter((row) => !String(row[config.title] ?? "").trim()).length;
  const missingUrl = config.url
    ? activeRows.filter((row) => !validHttpUrl(row[config.url])).length
    : null;
  const missingTags = config.tagField
    ? activeRows.filter((row) => normalizeTags(row[config.tagField]).length === 0).length
    : null;

  const topicResults = {};
  for (const [topic, terms] of Object.entries(topics)) {
    const ranked = activeRows
      .map((row) => ({ row, score: scoreRow(row, config, terms) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ row, score }) => ({
        id: row.id,
        title: row[config.title] ?? null,
        url: config.url ? row[config.url] ?? null : null,
        score,
      }));
    topicResults[topic] = { matched: ranked.length, top3: ranked };
  }

  return {
    table: config.table,
    total: total ?? 0,
    active: activeRows.length,
    sampled_all_active: activeRows.length < 5000,
    missing_title: missingTitle,
    missing_url_or_invalid: missingUrl,
    missing_tags: missingTags,
    topics: topicResults,
  };
}

const sources = {};
for (const [source, config] of Object.entries(configs)) {
  try {
    sources[source] = await auditSource(source, config);
  } catch (error) {
    sources[source] = { error: error instanceof Error ? error.message : String(error) };
  }
}

const result = {
  generated_at: new Date().toISOString(),
  environment: environmentName,
  read_only: true,
  sources,
};

const serialized = JSON.stringify(result, null, 2);
if (outputPath) await writeFile(outputPath, serialized, "utf8");
console.log(serialized);
