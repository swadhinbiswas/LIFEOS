/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TuiCheckbox } from "./checkbox";
import { TuiSelect } from "./select";

/**
 * The two controls from ADR-116.
 *
 * Note on the keyboard: these assert the *element type*, not a simulated keypress. jsdom does not
 * translate `keydown` into the activation of a button, so a `fireEvent.keyDown` test would pass for
 * a `<div onKeyDown>` too — and a div with hand-written key handling is precisely what this
 * component exists to avoid. `tagName === "BUTTON"` is the stronger claim: it means the browser
 * itself answers Space and Enter, so there is no key handler here to get subtly wrong. The same
 * reasoning keeps `@testing-library/user-event` out of the tree, since the repo does not use it and
 * it is not needed to test the invariants below.
 */
afterEach(cleanup);

describe("TuiCheckbox", () => {
  it("is a real button, so the platform handles Space and Enter", () => {
    // The whole reason for the element choice. A div with an onKeyDown would fail this.
    const { container } = render(
      <TuiCheckbox checked={false} onCheckedChange={() => {}}>
        clear the inbox
      </TuiCheckbox>,
    );
    const box = screen.getByRole("checkbox", { name: /clear the inbox/i });
    expect(box.tagName).toBe("BUTTON");
    // `type="button"` matters: without it this is a submit button and the space key inside a form
    // would complete the review instead of ticking a box.
    expect(box).toHaveAttribute("type", "button");
    expect(container.querySelector("form")).toBeNull();
  });

  it("exposes checkbox semantics and reports its state", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TuiCheckbox checked={false} onCheckedChange={onChange}>
        clear the inbox
      </TuiCheckbox>,
    );
    const box = screen.getByRole("checkbox", { name: /clear the inbox/i });
    expect(box).toHaveAttribute("aria-checked", "false");

    rerender(
      <TuiCheckbox checked onCheckedChange={onChange}>
        clear the inbox
      </TuiCheckbox>,
    );
    expect(box).toHaveAttribute("aria-checked", "true");
    expect(box).toHaveAttribute("data-state", "checked");
  });

  it("toggles on click, in both directions", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TuiCheckbox checked={false} onCheckedChange={onChange}>
        clear the inbox
      </TuiCheckbox>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(true);

    // Re-render with the new state, as a controlled component requires.
    rerender(
      <TuiCheckbox checked onCheckedChange={onChange}>
        clear the inbox
      </TuiCheckbox>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("leaves the state to the caller, so two clicks without a re-render both report unchecked", () => {
    // A component that flipped its own copy would be a second source of truth, and the wizard's
    // three booleans would drift from the form that is actually submitted. Each click reports the
    // value it is asking for; whether it becomes truth is the parent's decision.
    const onChange = vi.fn();
    render(
      <TuiCheckbox checked={false} onCheckedChange={onChange}>
        x
      </TuiCheckbox>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenNthCalledWith(1, true);
    expect(onChange).toHaveBeenNthCalledWith(2, true);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  });

  it("swaps the glyph without changing the cell, so ticking a box does not shift the row", () => {
    // `▣` and `☐` are both single monospace characters in a `size-4` cell. The regression this
    // guards is the familiar one: a checkmark narrower than the box, and a label that jumps a
    // pixel left the moment you tick it.
    const glyphs = (checked: boolean) => {
      const { container, unmount } = render(
        <TuiCheckbox checked={checked} onCheckedChange={() => {}}>
          x
        </TuiCheckbox>,
      );
      const glyph = container.querySelector('[data-slot="tui-checkbox"] span[aria-hidden]');
      const text = glyph?.textContent ?? "";
      unmount();
      return text;
    };
    const off = glyphs(false);
    const on = glyphs(true);
    expect(off).toBe("☐");
    expect(on).toBe("▣");
    // Same character count is the property that matters; codepoint width is a font question, and
    // `grid size-4` is what actually fixes the box in the layout.
    expect([...off].length).toBe([...on].length);
  });

  it("names itself when there is no visible label, instead of being silent", () => {
    // An unlabelled control is indistinguishable from decoration. The state word rides along in the
    // accessible name so an icon-only checkbox still says what it is doing.
    render(<TuiCheckbox checked onCheckedChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toHaveAccessibleName("checked");
    cleanup();
    render(<TuiCheckbox checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toHaveAccessibleName("unchecked");
  });

  it("meets the 28px touch floor that spec §4.4 sets for controls", () => {
    // Asserted as a class, not measured: jsdom has no layout engine. `min-h-7` is 1.75rem, which is
    // above the floor; the rendered geometry is the e2e sweep's job, not this file's.
    const { container } = render(
      <TuiCheckbox checked={false} onCheckedChange={() => {}}>
        x
      </TuiCheckbox>,
    );
    expect(container.querySelector('[data-slot="tui-checkbox"]')?.className).toContain("min-h-7");
  });

  it("keeps a focus ring, which spec §4.1 forbids removing", () => {
    const { container } = render(
      <TuiCheckbox checked={false} onCheckedChange={() => {}}>
        x
      </TuiCheckbox>,
    );
    const className = container.querySelector('[data-slot="tui-checkbox"]')?.className ?? "";
    expect(className).toContain("focus-visible:outline-2");
    expect(className).not.toMatch(/focus:outline-none/);
  });
});

describe("TuiSelect", () => {
  it("stays a native select, so the platform keeps type-ahead and the mobile wheel", () => {
    // ADR-116: a custom listbox is prettier and worse. This test is what stops that decision from
    // quietly eroding into a div carrying a role.
    render(
      <TuiSelect label="cadence">
        <option value="weekly">weekly</option>
        <option value="monthly">monthly</option>
      </TuiSelect>,
    );
    const control = screen.getByRole("combobox", { name: "cadence" });
    expect(control.tagName).toBe("SELECT");
    expect(control).toHaveDisplayValue("weekly");
  });

  it("points the label at the control without the caller inventing an id", () => {
    render(
      <TuiSelect label="cadence">
        <option value="weekly">weekly</option>
      </TuiSelect>,
    );
    // A generated id that does not change between renders is the other half of this: an id built
    // from a counter would re-pair the label whenever a second select mounts.
    expect(screen.getByRole("combobox", { name: "cadence" })).toHaveAccessibleName("cadence");
  });

  it("reports the chosen value on change", () => {
    const onChange = vi.fn();
    render(
      <TuiSelect label="cadence" defaultValue="weekly" onChange={onChange}>
        <option value="weekly">weekly</option>
        <option value="monthly">monthly</option>
      </TuiSelect>,
    );
    const control = screen.getByRole("combobox", { name: "cadence" });
    fireEvent.change(control, { target: { value: "monthly" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(control).toHaveValue("monthly");
  });

  it("passes disabled through, so a busy form cannot be re-submitted from here", () => {
    render(
      <TuiSelect label="cadence" disabled>
        <option value="weekly">weekly</option>
      </TuiSelect>,
    );
    expect(screen.getByRole("combobox", { name: "cadence" })).toBeDisabled();
  });

  it("keeps the chevron out of the control and out of the accessible name", () => {
    // The `▾` is a sibling of the control, not a child, so it can never be clipped by the native
    // control's own box, and it is `aria-hidden` besides — which is also what the axe sweep checks.
    const { container } = render(
      <TuiSelect label="cadence">
        <option value="weekly">weekly</option>
      </TuiSelect>,
    );
    const chevron = container.querySelector('[data-slot="tui-select"] span[aria-hidden]');
    expect(chevron?.textContent).toBe("▾");
    expect(screen.getByRole("combobox", { name: "cadence" })).toHaveAccessibleName("cadence");
  });

  it("renders a hint when asked, and nothing extra when not", () => {
    const { container, rerender } = render(
      <TuiSelect label="cadence" hint="what the cadence means">
        <option value="weekly">weekly</option>
      </TuiSelect>,
    );
    expect(container.textContent).toContain("what the cadence means");
    rerender(
      <TuiSelect label="cadence">
        <option value="weekly">weekly</option>
      </TuiSelect>,
    );
    expect(container.textContent).not.toContain("what the cadence means");
  });
});
