import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { getServerSession } from "@/server/auth/session";
import { listGrowth, parseProjectTech } from "@/server/career/growth";

import { AddAchievementForm, AddProjectForm, AddSkillForm } from "./_components/growth-forms";
import { SampleActions } from "./_components/sample-actions";

export const metadata = { title: "Portfolio" };

/**
 * `/career/portfolio` (spec §6.3 "projects"): the user's repositories and their skills. The
 * sample import is the only way data arrives here automatically, it is explicitly labelled and
 * it can be removed again — everything else is the user's own entry (next chunk adds the forms).
 */
export default async function PortfolioPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Career");
  const growth = await listGrowth(session.user.id);
  const hasSamples = growth.projects.some((project) => project.is_demo);

  return (
    <>
      <PageHeader title={t("portfolioTitle")} />

      <div className="grid max-w-4xl gap-4">
        <Panel title={t("sampleData")} hint={t("labelledRemovable")}>
          <SampleActions
            source={growth.sample.source}
            fetchedAt={growth.sample.fetchedAt}
            totalRepos={growth.sample.totalRepos}
            projectCount={growth.projects.length}
            skillCount={growth.skills.length}
            hasSamples={hasSamples}
          />
        </Panel>

        <Panel title={t("projects")} hint={`${growth.projects.length}`}>
          <AddProjectForm />
          {growth.projects.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noProjects")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {growth.projects.map((project) => {
                const tech = parseProjectTech(project.tech);
                return (
                  <li
                    key={project.id}
                    data-slot="project-row"
                    className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                  >
                    <a
                      href={project.url ?? project.repo ?? "#"}
                      className="text-primary hover:underline"
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      {project.name}
                    </a>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {project.description ?? ""}
                    </span>
                    {tech.language ? <span>{tech.language}</span> : null}
                    {tech.stars > 0 ? <span className="tabular-nums">★{tech.stars}</span> : null}
                    {project.featured ? (
                      <span className="text-warning">{t("featured")}</span>
                    ) : null}
                    {project.is_demo ? (
                      <span className="border border-border px-1 text-muted-foreground">
                        {t("sample")}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t("skills")} hint={`${growth.skills.length}`}>
          <AddSkillForm />
          {growth.skills.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("noSkills")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2 font-mono text-xs">
              {growth.skills.map((skill) => (
                <li
                  key={skill.id}
                  data-slot="skill-row"
                  className="flex items-center gap-1 border border-border px-2 py-0.5"
                >
                  {skill.name}
                  {skill.level !== null ? (
                    <span className="text-warning">{"★".repeat(skill.level)}</span>
                  ) : null}
                  {skill.is_demo ? (
                    <span className="text-muted-foreground">({t("sample")})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("bragDoc")} hint={`${growth.achievements.length}`}>
          <AddAchievementForm />
          {growth.achievements.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">{t("nothingYetWins")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {growth.achievements.map((achievement) => (
                <li
                  key={achievement.id}
                  data-slot="achievement-row"
                  className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">{achievement.title}</span>
                  {achievement.impact ? (
                    <span className="text-muted-foreground">{achievement.impact}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
