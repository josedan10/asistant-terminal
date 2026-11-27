import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";

describe("App", () => {
  it("renders the Mission Control placeholder", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Mission Control" })).toBeTruthy();
  });
});
