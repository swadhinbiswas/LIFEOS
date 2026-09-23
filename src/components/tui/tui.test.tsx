import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { AsciiMeter } from "./ascii-meter";
import { Kbd } from "./kbd";
import { Panel } from "./panel";
import { Spark } from "./spark";
import { StatusLine } from "./status-line";

// RTL auto-cleanup needs a global afterEach; vitest runs with globals off (ADR-029).
afterEach(cleanup);

const AXE_OPTIONS: axe.RunOptions = {
  rules: {
    // jsdom has no layout/paint — token contrast is covered by src/config/themes.test.ts
    // and every shell route gets a full axe pass in Playwright (ADR-029), so page-structure
    // rules that only make sense for whole documents are out of scope for fragments.
    "color-contrast": { enabled: false },
    region: { enabled: false },
    "landmark-one-main": { enabled: false },
    "page-has-heading-one": { enabled: false },
    "heading-order": { enabled: false },
  },
};

const expectNoAxeViolations = async (container: HTMLElement): Promise<void> => {
  const results = await axe.run(container, AXE_OPTIONS);
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

describe("Panel (spec §4.1)", () => {
  it("renders the title as a heading, the hint chip, and its content", async () => {
    const { container } = render(
      <>
        <h1>Page</h1>
        <Panel title="Today" hint="5 of 20">
          body text
        </Panel>
      </>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Today" })).toBeTruthy();
    expect(screen.getByText("5 of 20")).toBeTruthy();
    expect(screen.getByText("body text")).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it("builds the frame with CSS — no box-drawing characters are printed (spec §4.1)", () => {
    const { container } = render(<Panel title="Boards">content</Panel>);
    expect(container.textContent ?? "").not.toMatch(/[┌┐└┘─│┤├┼]/);
  });

  it("honours an explicit heading level", () => {
    render(
      <>
        <h1>Page</h1>
        <Panel title="Solo" titleAs="h3">
          x
        </Panel>
      </>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Solo" })).toBeTruthy();
  });

  it("marks the active panel with the ring border (focus by border color alone)", () => {
    const { container } = render(<Panel active>focused</Panel>);
    const panel = container.querySelector("[data-slot='panel']");
    expect(panel?.className).toContain("border-ring");
  });
});

describe("Kbd", () => {
  it("renders a real kbd element", async () => {
    const { container } = render(
      <p>
        press <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>
      </p>,
    );
    expect(screen.getByText("Ctrl").tagName).toBe("KBD");
    expect(screen.getByText("K").tagName).toBe("KBD");
    await expectNoAxeViolations(container);
  });
});

describe("AsciiMeter (spec §4.1 example: ▰▰▰▰▱▱ 66%)", () => {
  it("renders the exact spec example for 0.66 across 6 cells", async () => {
    const { container } = render(<AsciiMeter value={0.66} cells={6} label="progress" />);
    const bar = screen.getByRole("progressbar", { name: "progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("66");
    expect(container.textContent).toContain("▰▰▰▰▱▱");
    expect(container.textContent).toContain("66%");
    await expectNoAxeViolations(container);
  });

  it("clamps out-of-range values and treats non-finite input as 0", () => {
    const { container, rerender } = render(<AsciiMeter value={1.4} label="over" />);
    expect(screen.getByRole("progressbar", { name: "over" }).getAttribute("aria-valuenow")).toBe(
      "100",
    );
    expect(container.textContent).not.toContain("▱");

    rerender(<AsciiMeter value={-0.2} label="over" />);
    expect(screen.getByRole("progressbar", { name: "over" }).getAttribute("aria-valuenow")).toBe(
      "0",
    );
    expect(container.textContent).not.toContain("▰");

    rerender(<AsciiMeter value={Number.NaN} label="over" />);
    expect(screen.getByRole("progressbar", { name: "over" }).getAttribute("aria-valuenow")).toBe(
      "0",
    );
  });

  it("can hide the numeric readout", () => {
    const { container } = render(<AsciiMeter value={0.5} label="quiet" showValue={false} />);
    expect(container.textContent).not.toContain("%");
  });
});

describe("Spark (braille sparklines, spec §4.1)", () => {
  it("encodes a flat series as a single dot column pair (⠉)", () => {
    const { container } = render(<Spark values={[1, 1, 1, 1]} cells={1} label="flat" />);
    expect(screen.getByRole("img", { name: "flat" }).textContent).toBe("⠉");
    expect(container.textContent).toBe("⠉");
  });

  it("encodes a rising two-point series (⢁)", () => {
    render(<Spark values={[0, 3]} cells={1} label="rising" />);
    expect(screen.getByRole("img", { name: "rising" }).textContent).toBe("⢁");
  });

  it("draws a rising staircase across two cells (⠑⢄)", () => {
    // Dot columns sample indices [0,1] then [2,3]: rows 0+1 (low) then rows 2+3 (high).
    render(<Spark values={[0, 1, 2, 3]} cells={2} label="steps" />);
    expect(screen.getByRole("img", { name: "steps" }).textContent).toBe("⠑⢄");
  });

  it("renders the block ramp one glyph per value (▁▅█)", async () => {
    const { container } = render(<Spark values={[0, 0.5, 1]} variant="blocks" label="blocks" />);
    expect(screen.getByRole("img", { name: "blocks" }).textContent).toBe("▁▅█");
    await expectNoAxeViolations(container);
  });

  it("renders nothing for an empty series without crashing", () => {
    const { container } = render(<Spark values={[]} label="empty" />);
    expect(container.textContent).toBe("");
  });
});

describe("StatusLine (spec §4.1, RESEARCH §c #2/#4/#5)", () => {
  const hints = [
    { keys: ["?"], label: "help" },
    { keys: ["Ctrl", "K"], label: "command" },
    { keys: ["/"], label: "search" },
  ];

  it("shows mode, path, sync glyph+word, timer and the hint row", async () => {
    const { container } = render(
      <StatusLine mode="NORMAL" path="/boards/roadmap" sync="saving" timer="24:31" hints={hints} />,
    );
    expect(screen.getByText("NORMAL")).toBeTruthy();
    expect(screen.getByText("/boards/roadmap")).toBeTruthy();
    // glyph + word together: color is never the only signal (spec §4.4)
    expect(screen.getByText("◌")).toBeTruthy();
    expect(screen.getByText("saving")).toBeTruthy();
    expect(container.textContent).toContain("24:31");
    expect(screen.getByText("help")).toBeTruthy();
    expect(screen.getByText("command")).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it("truncates the hint row with CSS instead of wrapping (RESEARCH §c #4)", () => {
    const { container } = render(<StatusLine hints={hints} />);
    const hintRow = container.querySelector("[data-slot='status-hints']");
    expect(hintRow?.className).toContain("truncate");
    expect(hintRow?.className).toContain("text-primary"); // one accent color (§c #2)
    // the decorative glyph is hidden from assistive tech; the word is the label
    const footer = container.querySelector("footer");
    expect(footer?.textContent).toContain("help");
  });

  it("omits optional slots that were not passed", () => {
    const { container } = render(<StatusLine />);
    expect(screen.queryByText("NORMAL")).toBeNull();
    expect(container.querySelector("[data-slot='status-hints']")).toBeNull();
    expect(screen.queryByText("synced")).toBeNull();
  });

  it("renders every sync state with its glyph", () => {
    const { rerender } = render(<StatusLine sync="synced" />);
    expect(screen.getByText("●")).toBeTruthy();
    rerender(<StatusLine sync="offline" />);
    expect(screen.getByText("○")).toBeTruthy();
    expect(screen.getByText("offline")).toBeTruthy();
  });
});
