import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dropSpaFallbackParam,
  handOffPrerenderedSnapshot,
} from "./prerenderHandoff";

describe("dropSpaFallbackParam", () => {
  it("removes only the fallback flag", () => {
    window.history.replaceState(null, "", "/learn/new?utm_source=x&_spa=1#top");
    dropSpaFallbackParam();
    const { pathname, search, hash } = window.location;
    expect(`${pathname}${search}${hash}`).toBe("/learn/new?utm_source=x#top");
  });
});

const html = document.documentElement;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function mountRoot(markup: string) {
  document.body.innerHTML = `<div id="root">${markup}</div>`;
  return document.getElementById("root") as HTMLElement;
}

describe("handOffPrerenderedSnapshot", () => {
  beforeEach(() => {
    html.removeAttribute("data-prerendered");
    html.removeAttribute("data-snapshot");
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("leaves the plain SPA shell alone", () => {
    const root = mountRoot("");
    handOffPrerenderedSnapshot(root);
    expect(root.getAttribute("style")).toBeNull();
    expect(document.body.children).toHaveLength(1);
  });

  it("keeps the snapshot on screen until the app renders its <h1>", async () => {
    html.setAttribute("data-prerendered", "en");
    const root = mountRoot("<main><h1>Budgeting</h1></main>");

    handOffPrerenderedSnapshot(root);

    expect(root.childNodes).toHaveLength(0);
    expect(root.style.visibility).toBe("hidden");
    const snapshot = root.nextElementSibling as HTMLElement;
    expect(snapshot.textContent).toBe("Budgeting");
    expect(html.hasAttribute("data-prerendered")).toBe(false);

    root.innerHTML = '<div data-app-fallback="">Loading…</div>';
    await flush();
    expect(snapshot.isConnected).toBe(true);

    root.innerHTML = "<main><h1>Budgeting</h1></main>";
    await flush();
    expect(snapshot.isConnected).toBe(false);
    expect(root.getAttribute("style")).toBeNull();
  });

  it("waits while a loading fallback is still on screen", async () => {
    html.setAttribute("data-prerendered", "en");
    const root = mountRoot("<h1>Budgeting</h1>");
    handOffPrerenderedSnapshot(root);
    const snapshot = root.nextElementSibling as HTMLElement;

    root.innerHTML = '<div data-app-fallback=""></div><h1>Budgeting</h1>';
    await flush();
    expect(snapshot.isConnected).toBe(true);

    root.querySelector("[data-app-fallback]")?.remove();
    await flush();
    expect(snapshot.isConnected).toBe(false);
  });

  it("reveals the app after the timeout even without an <h1>", () => {
    vi.useFakeTimers();
    html.setAttribute("data-prerendered", "en");
    const root = mountRoot("<h1>Budgeting</h1>");
    handOffPrerenderedSnapshot(root);
    const snapshot = root.nextElementSibling as HTMLElement;

    vi.advanceTimersByTime(8000);
    expect(snapshot.isConnected).toBe(false);
    expect(root.getAttribute("style")).toBeNull();
  });

  it("drops each snapshot head tag once the app writes its own", async () => {
    document.head.innerHTML =
      '<meta name="viewport" content="width=device-width">' +
      "<title>Budgeting — Garzoni</title>" +
      '<link rel="canonical" href="https://www.garzoni.app/learn">';
    html.setAttribute("data-prerendered", "en");
    handOffPrerenderedSnapshot(mountRoot("<h1>Budgeting</h1>"));

    const title = document.createElement("title");
    title.textContent = "Budgeting — Garzoni";
    document.head.append(title);
    await flush();

    expect(document.head.querySelectorAll("title")).toHaveLength(1);
    expect(document.head.querySelector("title")).toBe(title);
    expect(
      document.head.querySelectorAll('link[rel="canonical"]')
    ).toHaveLength(1);
    expect(document.head.querySelector('meta[name="viewport"]')).not.toBeNull();
    document.head.innerHTML = "";
  });

  it("drops a snapshot the shell marked stale", () => {
    html.setAttribute("data-prerendered", "en");
    html.setAttribute("data-snapshot", "stale");
    const root = mountRoot("<h1>Budgeting</h1>");

    handOffPrerenderedSnapshot(root);

    expect(root.childNodes).toHaveLength(0);
    expect(root.nextElementSibling).toBeNull();
    expect(html.hasAttribute("data-snapshot")).toBe(false);
  });
});
