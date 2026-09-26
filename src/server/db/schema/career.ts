import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { cards } from "./boards";
import { users } from "./identity";

/**
 * Career tables (ERD §2.3, spec §6.3). A job **is a card** (ADR-044): the board engine owns
 * ordering, versions, views and keyboard use; `job_applications` carries only what a board does
 * not model. Money is integer minor units + a currency code (ERD §2.4 convention) — never a
 * float.
 */

const timestamps = () => ({
  created_at: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    size: text("size"),
    location: text("location"),
    ats_type: text("ats_type"),
    logo_url: text("logo_url"),
    /** The company's own jobs page, kept apart from an application URL (ADR-114). */
    career_page: text("career_page"),
    linkedin: text("linkedin"),
    /** `cold` | `contacted` | `replied` | `referral` — how this company came to know you. */
    relationship: text("relationship"),
    /** Target countries as JSON, e.g. `["Germany","Remote"]` (ADR-114). */
    target_country: text("target_country").default("[]"),
    /** User's own research notes (tech stack, culture, Glassdoor-style) — never scraped. */
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [index("companies_user_idx").on(t.user_id, t.name)],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company_id: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    linkedin_url: text("linkedin_url"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [index("contacts_user_idx").on(t.user_id, t.name)],
);

export const job_applications = sqliteTable(
  "job_applications",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The board card this application is — one per card (ERD §2.3). */
    card_id: text("card_id")
      .notNull()
      .unique()
      .references(() => cards.id, { onDelete: "cascade" }),
    company_id: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    /**
     * The person on the other side (ADR-114). `contacts` existed and was linked to nothing, so a
     * contact could never be attached to the application they were actually discussing.
     */
    contact_id: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    /** Append-only `[{from, to, at}]` (ADR-044) — the funnel's raw material. */
    stage_history: text("stage_history").notNull().default("[]"),
    /**
     * The one thing to do next, in the user's own words (ADR-114). Free text on purpose: "email
     * Sarah about the referral deadline" and "re-apply after the freeze lifts" are not the same
     * shape, and a select would force one of them to be wrong.
     */
    next_action: text("next_action"),
    /** When that action is due. Null means "someday", which is a real and common answer. */
    next_action_due: integer("next_action_due", { mode: "timestamp_ms" }),
    /** The apply-by deadline, when the posting states one. */
    apply_by: integer("apply_by", { mode: "timestamp_ms" }),
    /** When the application was actually sent, distinct from when the row was created. */
    date_applied: integer("date_applied", { mode: "timestamp_ms" }),
    /** `junior` | `mid` | `senior` | `not_stated`. */
    seniority: text("seniority"),
    /** Where to send it, when the posting names an address. */
    apply_email: text("apply_email"),
    /** The posting's requisition id — the one field that makes a duplicate detectable. */
    req_id: text("req_id"),
    /** Per-application location: a remote role's country is not the company's HQ. */
    location: text("location"),
    /** Minor units + ISO code (ADR-044). */
    salary_min: integer("salary_min"),
    salary_max: integer("salary_max"),
    currency: text("currency"),
    /** `remote` | `hybrid` | `onsite`. */
    work_mode: text("work_mode"),
    /** Visa/relocation status — the international-seeker field (spec §6.3). */
    visa_status: text("visa_status"),
    source: text("source"),
    url: text("url"),
    /** The posting won't survive; this snapshot is what analytics can rely on. */
    jd_snapshot: text("jd_snapshot"),
    resume_id: text("resume_id"),
    cover_letter: text("cover_letter"),
    /** 1–5 (spec §6.3). */
    excitement: integer("excitement"),
    fit_score: integer("fit_score"),
    /**
     * The reference tracker keeps a short application id ("6", "REQ-000") that is *not* the
     * database key, because it is the number quoted to a recruiter, in a spreadsheet export, or in
     * an email. Nullable and free text: some portals give "R100705", some give nothing, and forcing
     * a number would reject half of them.
     */
    app_id: text("app_id"),
    /**
     * How far along this application is, 0–100. Deliberately a *human* judgement, not something
     * derived from the stage: two applications sitting in "Interview" are not equally far along, and
     * a number the owner types is the only thing that knows.
     */
    progress: integer("progress"),
    /**
     * Whether a cover letter is owed, as distinct from `cover_letter` which holds the text. Having
     * the text without this meant a blank text field and "not needed yet" were indistinguishable.
     */
    cover_letter_needed: integer("cover_letter_needed", { mode: "boolean" }),
    archived_at: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [
    index("job_applications_user_idx").on(t.user_id),
    index("job_applications_company_idx").on(t.company_id),
  ],
);

export const interviews = sqliteTable(
  "interviews",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    job_application_id: text("job_application_id")
      .notNull()
      .references(() => job_applications.id, { onDelete: "cascade" }),
    /** `screen` | `tech` | `system_design` | `behavioral` | `final` | `follow_up`. */
    kind: text("kind").notNull(),
    starts_at: integer("starts_at", { mode: "timestamp_ms" }),
    duration_min: integer("duration_min"),
    /**
     * When a **follow-up** is due (ADR-114). Distinct from `starts_at` because a follow-up has no
     * start time — "write to them on Friday" is a task with a due date, and storing it in
     * `starts_at` would have made it look like a scheduled meeting.
     */
    due_at: integer("due_at", { mode: "timestamp_ms" }),
    /** `planned` | `done` | `needs_follow_up` | `cancelled`. */
    status: text("status").notNull().default("planned"),
    /** What actually happened, once it has. */
    outcome: text("outcome"),
    /** Prep notes, read before the call rather than written after it. */
    preparation: text("preparation"),
    /** Interviewers as JSON (name/role), typed at the boundary. */
    interviewers: text("interviewers"),
    feedback: text("feedback"),
    rating: integer("rating"),
    ...timestamps(),
  },
  (t) => [
    index("interviews_application_idx").on(t.job_application_id),
    // The "what do I owe this company" read: due follow-ups across every application.
    index("interviews_user_due_idx").on(t.user_id, t.due_at),
  ],
);

export const offers = sqliteTable(
  "offers",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    job_application_id: text("job_application_id")
      .notNull()
      .references(() => job_applications.id, { onDelete: "cascade" }),
    base: integer("base"),
    equity: integer("equity"),
    bonus: integer("bonus"),
    currency: text("currency"),
    received_at: integer("received_at", { mode: "timestamp_ms" }),
    accepted_at: integer("accepted_at", { mode: "timestamp_ms" }),
    declined_at: integer("declined_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [index("offers_application_idx").on(t.job_application_id)],
);

export const resumes = sqliteTable(
  "resumes",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Shared base resume a variant derives from (ERD §2.3). */
    base_id: text("base_id"),
    template: text("template").notNull().default("classic"),
    /** JSON Resume-shaped document (spec §6.3). */
    data: text("data").notNull().default("{}"),
    /** Computed, nullable — never marketed as an "ATS score" (ADR-017). */
    ats_score: integer("ats_score"),
    share_slug: text("share_slug"),
    share_enabled: integer("share_enabled", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index("resumes_user_idx").on(t.user_id),
    uniqueIndex("resumes_share_slug_unq").on(t.share_slug),
  ],
);

export const resume_versions = sqliteTable(
  "resume_versions",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resume_id: text("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    /** Full snapshot, not a diff — an export is reproducible from this row alone (ADR-044). */
    snapshot: text("snapshot").notNull(),
    label: text("label"),
    exported_at: integer("exported_at", { mode: "timestamp_ms" }),
    ...timestamps(),
  },
  (t) => [index("resume_versions_resume_idx").on(t.resume_id, t.created_at)],
);

export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** 1–5 self-rating; evidence is what makes it credible. */
    level: integer("level"),
    /** JSON list of `{label, url}` evidence links. */
    evidence: text("evidence"),
    /** Imported sample rows are labelled (spec §12) and never mixed in silently. */
    is_demo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [uniqueIndex("skills_user_name_unq").on(t.user_id, t.name)],
);

export const achievements = sqliteTable(
  "achievements",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    /** Measured impact, e.g. "cut p95 by 40%" — the brag-doc field. */
    impact: text("impact"),
    occurred_at: integer("occurred_at", { mode: "timestamp_ms" }),
    links: text("links"),
    is_demo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("achievements_user_idx").on(t.user_id, t.occurred_at)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    url: text("url"),
    repo: text("repo"),
    tech: text("tech"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    is_demo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("projects_user_idx").on(t.user_id, t.name)],
);

export const star_stories = sqliteTable(
  "star_stories",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    situation: text("situation"),
    task: text("task"),
    action: text("action"),
    result: text("result"),
    tags: text("tags"),
    ...timestamps(),
  },
  (t) => [index("star_stories_user_idx").on(t.user_id)],
);

export const question_bank = sqliteTable(
  "question_bank",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    category: text("category"),
    answer: text("answer"),
    /** `easy` | `medium` | `hard`. */
    difficulty: text("difficulty"),
    ...timestamps(),
  },
  (t) => [index("question_bank_user_idx").on(t.user_id, t.category)],
);

export const coding_problems = sqliteTable(
  "coding_problems",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    platform: text("platform"),
    url: text("url"),
    difficulty: text("difficulty"),
    /** `todo` | `solved` | `revise`. */
    status: text("status").notNull().default("todo"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [index("coding_problems_user_idx").on(t.user_id, t.status)],
);
