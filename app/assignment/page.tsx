import fs from "node:fs/promises";
import path from "node:path";
import {
  BookOpen,
  Database,
  FileCode2,
  FileText,
  ListChecks,
  Tag,
  Timer,
  Zap,
  ArrowLeft,
  ShieldOff,
  Sparkles,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { PageTabs } from "@/components/assignment/PageTabs";
import { SectionNav, type NavItem } from "@/components/assignment/SectionNav";
import { CodeCard } from "@/components/assignment/CodeCard";
import { CSVBrowser } from "@/components/assignment/CSVBrowser";
import { PythonRunner } from "@/components/assignment/PythonRunner";
import { TaskCard } from "@/components/assignment/TaskCard";
import { TASKS } from "@/lib/assignment/tasks";

export const metadata = {
  title: "Assignment · Spotify Music Graph in Neo4j",
  description:
    "Walkthrough of the Spotify Music Graph Neo4j assignment — cleaning, CSVs, import, Cypher tasks, and timing.",
};

const IMPORT_CONSTRAINTS = `CREATE CONSTRAINT track_id_unique IF NOT EXISTS
FOR (t:Track) REQUIRE t.track_id IS UNIQUE;

CREATE CONSTRAINT artist_name_unique IF NOT EXISTS
FOR (a:Artist) REQUIRE a.name IS UNIQUE;

CREATE CONSTRAINT album_name_unique IF NOT EXISTS
FOR (al:Album) REQUIRE al.name IS UNIQUE;

CREATE CONSTRAINT genre_name_unique IF NOT EXISTS
FOR (g:Genre) REQUIRE g.name IS UNIQUE;`;

const IMPORT_TRACKS = `LOAD CSV WITH HEADERS FROM 'file:///tracks.csv' AS row
WITH row
WHERE row.track_id IS NOT NULL AND trim(row.track_id) <> ""
MERGE (t:Track {track_id: row.track_id})
SET t.track_name   = row.track_name,
    t.popularity   = toInteger(row.popularity),
    t.danceability = toFloat(row.danceability),
    t.valence      = toFloat(row.valence),
    t.acousticness = toFloat(row.acousticness);`;

const IMPORT_NODES = `// Artists
LOAD CSV WITH HEADERS FROM 'file:///artists.csv' AS row
WITH row
WHERE row.name IS NOT NULL AND trim(row.name) <> ""
MERGE (:Artist {name: trim(row.name)});

// Albums
LOAD CSV WITH HEADERS FROM 'file:///albums.csv' AS row
WITH row
WHERE row.name IS NOT NULL AND trim(row.name) <> ""
MERGE (:Album {name: trim(row.name)});

// Genres
LOAD CSV WITH HEADERS FROM 'file:///genres.csv' AS row
WITH row
WHERE row.name IS NOT NULL AND trim(row.name) <> ""
MERGE (:Genre {name: trim(row.name)});`;

const IMPORT_RELS = `// PERFORMED_BY
LOAD CSV WITH HEADERS FROM 'file:///rel_performed_by.csv' AS row
WITH row
WHERE row.track_id IS NOT NULL AND trim(row.track_id) <> ""
  AND row.artist_name IS NOT NULL AND trim(row.artist_name) <> ""
MATCH (t:Track {track_id: row.track_id})
MATCH (a:Artist {name: trim(row.artist_name)})
MERGE (t)-[:PERFORMED_BY]->(a);

// BELONGS_TO
LOAD CSV WITH HEADERS FROM 'file:///rel_belongs_to.csv' AS row
WITH row
WHERE row.track_id IS NOT NULL AND trim(row.track_id) <> ""
  AND row.album_name IS NOT NULL AND trim(row.album_name) <> ""
MATCH (t:Track {track_id: row.track_id})
MATCH (al:Album {name: trim(row.album_name)})
MERGE (t)-[:BELONGS_TO]->(al);

// HAS_GENRE
LOAD CSV WITH HEADERS FROM 'file:///rel_has_genre.csv' AS row
WITH row
WHERE row.track_id IS NOT NULL AND trim(row.track_id) <> ""
  AND row.track_genre IS NOT NULL AND trim(row.track_genre) <> ""
MATCH (t:Track {track_id: row.track_id})
MATCH (g:Genre {name: trim(row.track_genre)})
MERGE (t)-[:HAS_GENRE]->(g);`;

async function readText(rel: string): Promise<string> {
  try {
    return await fs.readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), rel), "utf-8");
  } catch {
    return `# ${rel} could not be read from the project root.`;
  }
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: "BookOpen" },
  { id: "names", label: "Exact names", icon: "Tag" },
  { id: "cleaning", label: "Cleaning", icon: "FileCode2" },
  { id: "csvs", label: "CSV files", icon: "FileText" },
  { id: "import", label: "Neo4j import", icon: "Database" },
  { id: "tasks", label: "Cypher tasks (Q1–Q7)", icon: "ListChecks" },
  { id: "timing", label: "Timing", icon: "Timer" },
];

export default async function AssignmentPage() {
  const cleaningCode = await readText("cleaning.py");
  const timingCode = await readText("timing.py");

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-[#1E293B] bg-[#0F172A]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              aria-label="Back to Explorer"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] px-2.5 py-1.5 rounded-md hover:bg-[#1E293B] whitespace-nowrap"
            >
              <ArrowLeft size={14} aria-hidden="true" className="shrink-0" />
              <span>Back</span>
            </Link>
            <div className="hidden md:flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#22C55E]/15 flex items-center justify-center shrink-0">
                <span className="text-[#22C55E] text-lg font-bold">⬡</span>
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-sm text-[#F8FAFC] truncate">
                  Assignment walkthrough
                </h1>
                <p className="text-xs text-[#64748b] truncate hidden lg:block">
                  Spotify Music Graph in Neo4j · Option 3
                </p>
              </div>
            </div>
          </div>

          <PageTabs current="assignment" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 lg:gap-10">
        <aside className="hidden lg:block lg:sticky lg:top-[72px] lg:self-start lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto">
          <div className="text-[10px] font-black uppercase tracking-widest text-[#64748b] px-3 mb-3">
            On this page
          </div>
          <SectionNav items={NAV_ITEMS} />
        </aside>

        <main className="flex flex-col gap-8 min-w-0">
          {/* Hero */}
          <section className="rounded-2xl border border-[#1E293B] bg-gradient-to-br from-[#052e16] via-[#0F172A] to-[#1E293B] p-6 sm:p-10 overflow-hidden relative">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#22C55E]/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col gap-5 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-3 py-1.5 rounded-full w-fit whitespace-nowrap">
                <Sparkles size={12} aria-hidden="true" />
                Live walkthrough
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                Spotify Music Graph in Neo4j
              </h2>
              <p className="text-[#CBD5E1] leading-relaxed max-w-2xl">
                We cleaned a real Kaggle Spotify dataset, transformed it into graph-ready CSVs,
                imported into Neo4j, and solved seven Cypher tasks with reliable timing.
                Every step below is interactive —{" "}
                <strong className="text-[#F8FAFC]">Python runs locally</strong> on this machine,
                and <strong className="text-[#F8FAFC]">read-only Cypher runs against
                the live graph</strong>. Write queries are{" "}
                <strong className="text-amber-300">simulated</strong> so the cloud graph is never modified.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  "Option 3",
                  "Kaggle dataset",
                  "pandas cleaning",
                  "7 CSVs",
                  "LOAD CSV import",
                  "7 timed tasks",
                  "89,740 tracks",
                ].map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#1E293B] border border-[#334155] text-[#CBD5E1] whitespace-nowrap"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Overview */}
          <Section
            id="overview"
            kicker="Our approach"
            title="How we built it"
            icon={BookOpen}
          >
            <p className="text-[#CBD5E1] leading-relaxed">
              We built a Spotify-style music graph in Neo4j from a real Kaggle dataset
              (not Faker-generated data). We used Python + pandas to clean the data,
              exported CSV files for nodes and relationships, imported them into Neo4j,
              then solved seven timed Cypher query tasks.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {[
                { n: 1, t: "Downloaded the dataset", d: "Got dataset.csv from Kaggle." },
                { n: 2, t: "Cleaned with pandas", d: "Dropped nulls; normalized artists." },
                { n: 3, t: "Generated CSVs", d: "4 node + 3 relationship files." },
                { n: 4, t: "Imported to Neo4j", d: "Used constraints + LOAD CSV commands." },
                { n: 5, t: "Wrote Cypher tasks", d: "Seven read/write queries." },
                { n: 6, t: "Timed & submitted", d: "10 runs × 7 tasks, reported averages." },
              ].map((s) => (
                <div
                  key={s.n}
                  className="rounded-xl border border-[#334155] bg-[#0B1120] p-4 flex items-start gap-3"
                >
                  <div className="shrink-0 w-9 h-9 rounded-full bg-[#22C55E]/15 text-[#22C55E] font-black flex items-center justify-center text-sm">
                    {s.n}
                  </div>
                  <div className="min-w-0 flex flex-col gap-0.5 pt-0.5">
                    <div className="font-semibold text-sm text-[#F8FAFC] leading-tight">{s.t}</div>
                    <div className="text-xs text-[#94A3B8] leading-relaxed">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Exact names */}
          <Section id="names" kicker="Exact names" title="Names we used" icon={Tag}>
            <div className="rounded-xl border border-[#334155] bg-[#0B1120] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm table-fixed">
                  <tbody className="divide-y divide-[#1E293B]">
                    <Row head="Database" body={<>Preferred <InlineCode>spotifydb</InlineCode>. We used <InlineCode>neo4j</InlineCode> (default) on our Aura instance.</>} />
                    <Row head="Node labels" body={<><InlineCode>:Track</InlineCode>, <InlineCode>:Artist</InlineCode>, <InlineCode>:Album</InlineCode>, <InlineCode>:Genre</InlineCode></>} />
                    <Row head="Relationship types" body={<><InlineCode>:PERFORMED_BY</InlineCode>, <InlineCode>:BELONGS_TO</InlineCode>, <InlineCode>:HAS_GENRE</InlineCode></>} />
                    <Row head="CSV file names" body={<><InlineCode>tracks.csv</InlineCode>, <InlineCode>artists.csv</InlineCode>, <InlineCode>albums.csv</InlineCode>, <InlineCode>genres.csv</InlineCode>, <InlineCode>rel_performed_by.csv</InlineCode>, <InlineCode>rel_belongs_to.csv</InlineCode>, <InlineCode>rel_has_genre.csv</InlineCode></>} />
                    <Row head="ZIP file" body={<InlineCode>group#_Option#_Project_Section11.zip</InlineCode>} />
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Cleaning */}
          <Section
            id="cleaning"
            kicker="Part 1"
            title="Cleaning the Kaggle dataset with Python + pandas"
            icon={FileCode2}
          >
            <p className="text-[#CBD5E1] leading-relaxed">
              We started from{" "}
              <InlineCode>dataset.csv</InlineCode>{" "}
              (Maharshi Pandya&apos;s Spotify Tracks dataset on Kaggle, ~20 MB),
              dropped rows missing any critical field, normalized the semicolon-separated{" "}
              <InlineCode>artists</InlineCode> column, and deduplicated by{" "}
              <InlineCode>track_id</InlineCode>. The cleaned base was then
              used to generate every node and relationship CSV — guaranteeing
              a consistent graph.
            </p>

            <div className="rounded-xl border border-[#334155] bg-[#0B1120] p-5 flex flex-wrap gap-6 sm:gap-8 text-xs font-mono">
              <Stat label="Raw rows" value="114,000" />
              <Stat label="After cleaning" value="89,740" accent />
              <Stat label="Unique artists" value="30,854" />
              <Stat label="Unique albums" value="46,588" />
              <Stat label="Unique genres" value="114" />
            </div>

            <CodeCard
              code={cleaningCode}
              lang="python"
              label="Python"
              filename="cleaning.py"
              maxHeight={480}
            />

            <PythonRunner
              endpoint="/api/assignment/clean"
              scriptLabel="cleaning.py"
              commandPreview="python cleaning.py"
            />
          </Section>

          {/* CSV files */}
          <Section
            id="csvs"
            kicker="Part 2"
            title="The CSV files we generated"
            icon={FileText}
          >
            <p className="text-[#CBD5E1] leading-relaxed">
              The cleaning script emitted seven CSV files — four for nodes and three for relationships.
              Click a file to preview the first 25 rows from disk, directly from the copies
              generated by <InlineCode>cleaning.py</InlineCode>.
            </p>
            <CSVBrowser />
          </Section>

          {/* Import */}
          <Section
            id="import"
            kicker="Part 3"
            title="How we imported into Neo4j"
            icon={Database}
          >
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100 flex items-start gap-2">
              <ShieldOff size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
              <div>
                <span className="font-bold text-amber-300">Not runnable from this tab.</span>{" "}
                These are write commands against Neo4j. They were already executed once by{" "}
                <InlineCode>scripts/load_graph.ts</InlineCode> to populate the cloud graph —
                re-running them here would duplicate work. The output panel below shows{" "}
                <em>what the import produced</em>, not a live execution.
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <SubCard
                heading="Constraints first"
                summary="We added these before any LOAD CSV — they let MERGE match efficiently and prevent duplicate nodes."
              >
                <CodeCard code={IMPORT_CONSTRAINTS} lang="cypher" label="Cypher" maxHeight={240} />
              </SubCard>

              <SubCard
                heading="Loading Track nodes"
                summary="Built every :Track using track_id as the key; attached popularity, danceability, valence, and acousticness."
              >
                <CodeCard code={IMPORT_TRACKS} lang="cypher" label="Cypher" maxHeight={240} />
              </SubCard>

              <SubCard
                heading="Loading Artist, Album, and Genre nodes"
                summary="Three separate LOAD CSV blocks, run one at a time in Neo4j Browser."
              >
                <CodeCard code={IMPORT_NODES} lang="cypher" label="Cypher" maxHeight={320} />
              </SubCard>

              <SubCard
                heading="Loading relationships"
                summary="Three blocks — PERFORMED_BY, BELONGS_TO, HAS_GENRE — matching by the keys already indexed."
              >
                <CodeCard code={IMPORT_RELS} lang="cypher" label="Cypher" maxHeight={360} />
              </SubCard>

              <SubCard
                heading="What the import produced"
                summary="These are the counts currently in the live graph."
              >
                <div className="rounded-xl border border-[#334155] bg-[#0B1120] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#1E293B]/50 border-b border-[#1E293B]">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-[#64748b]">
                          Element
                        </th>
                        <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[#64748b]">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E293B]/40 font-mono">
                      {[
                        ["Track nodes", "89,740"],
                        ["Artist nodes", "30,854"],
                        ["Album nodes", "46,588"],
                        ["Genre nodes", "114"],
                        ["PERFORMED_BY", "123,420"],
                        ["BELONGS_TO", "89,740"],
                        ["HAS_GENRE", "89,740"],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td className="px-4 py-2 text-[#CBD5E1]">{k}</td>
                          <td className="px-4 py-2 text-right text-[#22C55E] font-bold">
                            {v}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SubCard>
            </div>
          </Section>

          {/* Tasks */}
          <Section
            id="tasks"
            kicker="Part 4"
            title="The seven Cypher queries we wrote"
            icon={ListChecks}
          >
            <div className="flex flex-col gap-3 text-sm text-[#CBD5E1] leading-relaxed">
              <p>
                Each of the seven tasks below runs live against the Neo4j graph.
                Tasks 1–4 and 6–7 are read-only, so they run for real.
                Task 5 performs a <InlineCode>SET</InlineCode> — we{" "}
                <strong className="text-amber-300">simulate</strong> it by running the
                equivalent MATCH and synthesizing the row the update would have returned,
                leaving the cloud graph untouched.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <LegendDot color="#22C55E" label="Read-only — runs live" />
                <LegendDot color="#fbbf24" label="Write — simulated only" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {TASKS.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </Section>

          {/* Timing */}
          <Section
            id="timing"
            kicker="Execution time"
            title="How we time every task 10 times"
            icon={Timer}
          >
            <p className="text-[#CBD5E1] leading-relaxed">
              The brief asked for each task to be run <strong>10 times</strong> using{" "}
              <InlineCode>time.perf_counter()</InlineCode>. Our original Python script —{" "}
              <InlineCode>timing.py</InlineCode> — did exactly that against a local
              Neo4j. The Task cards above run the same measurements from inside this
              browser tab, using the server-side Neo4j driver against the live cloud
              graph. For Task 5, the timed query is the MATCH-only equivalent so nothing
              is ever written.
            </p>

            <CodeCard code={timingCode} lang="python" label="Python" filename="timing.py" maxHeight={520} />

            <div className="rounded-lg border border-sky-400/30 bg-sky-400/5 p-4 text-sm text-sky-100 flex items-start gap-2">
              <BarChart3 size={16} className="mt-0.5 shrink-0 text-sky-300" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-sky-200">Where to see the timings</span>
                <span>
                  Scroll back to the <a href="#tasks" className="underline hover:text-white">Tasks</a> section —
                  each task card has a <InlineCode>Time 10 runs</InlineCode> button that
                  produces a full bar chart and average for that query.
                </span>
              </div>
            </div>
          </Section>


          <footer className="pt-4 pb-12 text-center">
            <div className="inline-flex items-center gap-2 text-xs text-[#64748b]">
              <Zap size={12} aria-hidden="true" />
              Runs locally · cloud graph stays read-only · Task 5 is simulated
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-[#1E293B] bg-[#0B1120]/60 p-6 sm:p-8 flex flex-col gap-5"
    >
      <header className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#22C55E]">
          <Icon size={13} className="text-[#22C55E]" aria-hidden />
          {kicker}
        </div>
        <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#F8FAFC] leading-tight">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function SubCard({
  heading,
  summary,
  children,
}: {
  heading: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-sm font-bold text-[#F8FAFC]">{heading}</div>
        <div className="text-xs text-[#94A3B8]">{summary}</div>
      </div>
      {children}
    </div>
  );
}

function Row({ head, body }: { head: string; body: React.ReactNode }) {
  return (
    <tr>
      <th className="text-left px-4 py-3 w-36 sm:w-48 text-xs uppercase tracking-wider text-[#64748b] font-semibold align-top bg-[#1E293B]/30">
        {head}
      </th>
      <td className="px-4 py-3 text-sm text-[#CBD5E1] break-words">{body}</td>
    </tr>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.86em] px-1.5 py-0.5 rounded bg-[#1E293B] border border-[#334155] text-[#A7F3D0] whitespace-nowrap">
      {children}
    </code>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-[#64748b] font-semibold">
        {label}
      </span>
      <span
        className={
          accent
            ? "text-[#22C55E] font-bold text-sm"
            : "text-[#CBD5E1] font-semibold text-sm"
        }
      >
        {value}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[#94A3B8]">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
