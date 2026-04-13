import { afterEach, describe, expect, it } from "vitest";
import { configureCloudinaryCloudName, mascotImageUrl } from "./images";

afterEach(() => {
  configureCloudinaryCloudName("");
});

describe("mascotImageUrl", () => {
  it("uses Cloudinary when cloud name is configured", () => {
    configureCloudinaryCloudName("myfixturecloud");
    const u = mascotImageUrl("owl");
    expect(u).toContain("https://res.cloudinary.com/myfixturecloud/image/upload/");
    expect(u).toContain("garzoni/mascots/garzoni-owl");
  });

  it("adds width transform when opts.width is set", () => {
    configureCloudinaryCloudName("myfixturecloud");
    expect(mascotImageUrl("bull", { width: 160 })).toContain("w_160");
  });

  it("caps width transform at 2048", () => {
    configureCloudinaryCloudName("myfixturecloud");
    expect(mascotImageUrl("bear", { width: 9999 })).toContain("w_2048");
  });

  it("falls back to API media path when Cloudinary is not configured", () => {
    configureCloudinaryCloudName("");
    const u = mascotImageUrl("owl");
    expect(u).toMatch(/\/media\/mascots\/garzoni-owl\.png$/);
  });
});
