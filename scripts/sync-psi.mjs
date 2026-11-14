// Fetches NASA Physical Science Informatics (PSI) investigation records and
// stores a snapshot of the Combustion Science ones for the app.
// Usage: npm run sync:psi   (needs network access to psi.nasa.gov; honours HTTPS_PROXY)
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const BASE = "https://psi.nasa.gov";
const SEARCH = `${BASE}/geode-py/ws/repo/search?type=investigation&from=0&size=500`;

const res = await fetch(SEARCH, { headers: { Accept: "application/json" } });
if (!res.ok) throw new Error(`PSI search failed: HTTP ${res.status}`);
const raw = await res.text();
const body = JSON.parse(raw);

const split = (v) => (v ? String(v).split(/\s{3,}/).map((s) => s.trim()).filter(Boolean) : []);
const isoDate = (epoch) => (epoch ? new Date(epoch * 1000).toISOString().slice(0, 10) : null);
// PSI dates are MM-DD-YYYY.
const usDate = (v) => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v ?? "");
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

const records = body.hits.hits
  .map((h) => h._source)
  .filter((s) => s["Research Area"] === "Combustion Science")
  .map((s) => ({
    accession: s.Accession,
    acronym: s.Acronym || null,
    title: s.Title,
    url: `${BASE}/physci/repo/data/investigations/${s.Accession}`,
    researchArea: s["Research Area"],
    subResearchArea: s["SubResearch Area"] || null,
    flightPlatform: s["Flight Platform"] || null,
    projectType: s["Project Type"] || null,
    publicReleaseDate: isoDate(s["Public Release Date"]),
    startDate: usDate(s["Investigation Start Date"]),
    endDate: usDate(s["Investigation End Date"]),
    monitoringCenter: s["Monitoring Center"] || null,
    hardware: s["Experiment Hardware"]?.Name ?? null,
    keywords: split(s.Keywords),
    relatedInvestigations: split(s["Related Investigations"]),
    objectives: (s.Objectives ?? "").trim(),
    earthBenefits: (s["Research Impacts/Earth Benefits"] ?? "").trim(),
    publications: split(s["Publication Title"]),
  }))
  .sort((a, b) => Number(a.accession.split("-")[1]) - Number(b.accession.split("-")[1]));

const snapshot = {
  source: SEARCH,
  fetchedOn: new Date().toISOString().slice(0, 10),
  totalInvestigations: body.hits.total,
  responseSha256: createHash("sha256").update(raw).digest("hex"),
  records,
};

writeFileSync("src/data/psi-snapshot.json", JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Saved ${records.length} Combustion Science records of ${body.hits.total} PSI investigations.`);
