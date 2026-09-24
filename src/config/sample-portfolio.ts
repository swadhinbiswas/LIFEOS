/**
 * Sample portfolio derived **verbatim** from `docs/research/github-swadhinbiswas.json`
 * (fetched 2026-09-23T15:54:57Z) — the Phase-0 seed research the spec §12 requires. Nothing
 * here is invented: every project carries its real repository URL, description, primary
 * language and star count from that file, and the skill levels are the language counts across
 * the account's 93 repositories.
 *
 * This exists so the portfolio/skills surfaces can be exercised with **real** data by any user
 * through an explicit, labelled import (rows land with `is_demo = true` and render a `sample`
 * chip). It is never seeded automatically and never presented as the user's own work.
 */

export interface SampleProject {
  name: string;
  url: string;
  description: string;
  language: string | null;
  stars: number;
  topics: string[];
}

export interface SampleSkill {
  name: string;
  /** Repositories using this language, per the same snapshot. */
  repos: number;
}

export interface SamplePortfolio {
  /** Provenance, rendered next to the import button. */
  source: string;
  fetchedAt: string;
  totalRepos: number;
  projects: SampleProject[];
  skills: SampleSkill[];
}

export const SAMPLE_PORTFOLIO: SamplePortfolio = {
  source: "docs/research/github-swadhinbiswas.json",
  fetchedAt: "2026-09-23T15:54:57.063992+00:00",
  totalRepos: 93,
  projects: [
    {
      name: "veet",
      url: "https://github.com/swadhinbiswas/veet",
      description: "Universal Linux Application Uninstaller & Deep-Clean Residual Purger",
      language: "Go",
      stars: 151,
      topics: ["appimage", "bubbletea", "bubbletea-tui", "cleanup"],
    },
    {
      name: "opengrammar",
      url: "https://github.com/swadhinbiswas/opengrammar",
      description: "A Opensource and self hosted alternative of Grammarly",
      language: "TypeScript",
      stars: 124,
      topics: ["alternative", "chrome", "extension", "extensions"],
    },
    {
      name: "Mervelas",
      url: "https://github.com/swadhinbiswas/Mervelas",
      description:
        "An independent, high-performance AI coding CLI built with Bun and driven by free resources",
      language: "TypeScript",
      stars: 51,
      topics: ["ai", "aiagent", "antrophic", "claude-code"],
    },
    {
      name: "FAANG-Playbook",
      url: "https://github.com/swadhinbiswas/FAANG-Playbook",
      description:
        "Complete guide to landing tech jobs at FAANG & 200+ companies with 1,400+ LeetCode problems, interview strategies",
      language: "Astro",
      stars: 40,
      topics: ["behavioral-interview", "coding-interview", "data-engineer", "dsa"],
    },
    {
      name: "AIBOT",
      url: "https://github.com/swadhinbiswas/AIBOT",
      description:
        "An advanced, versatile chatbot enhancing user interactions and automation on Telegram.",
      language: "HTML",
      stars: 25,
      topics: ["aibot", "chatgpt", "free", "freeai"],
    },
    {
      name: "OpencodeHub",
      url: "https://github.com/swadhinbiswas/OpencodeHub",
      description:
        "Self-hosted Git platform with SSH, Actions-compatible pipelines and AI code reviews",
      language: "TypeScript",
      stars: 16,
      topics: ["astro", "astrojs", "code-review", "dx"],
    },
    {
      name: "linuxy",
      url: "https://github.com/swadhinbiswas/linuxy",
      description: "One click AppImage Runner",
      language: "HTML",
      stars: 16,
      topics: ["appimage", "linux", "linux-app", "linuxapplication"],
    },
    {
      name: "lsf",
      url: "https://github.com/swadhinbiswas/lsf",
      description: "ls-f is a Linux terminal ls with file-type-specific Nerd Font icons",
      language: "Rust",
      stars: 15,
      topics: ["icon", "icon-in", "icon-integration", "icon-pack"],
    },
  ],
  skills: [
    { name: "Python", repos: 24 },
    { name: "TypeScript", repos: 13 },
    { name: "HTML", repos: 6 },
    { name: "Go", repos: 4 },
    { name: "Astro", repos: 4 },
    { name: "Rust", repos: 4 },
    { name: "C", repos: 3 },
    { name: "QML", repos: 2 },
  ],
};
