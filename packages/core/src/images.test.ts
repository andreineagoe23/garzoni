import { afterEach, describe, expect, it } from "vitest";
import {
  Images,
  authLogoBlackRectangularUrl,
  authLogoRectangleNoBgUrl,
  authLogoWhiteBgUrl,
  authLogoWhiteRectangularUrl,
  configureCloudinaryCloudName,
  mascotImageUrl,
} from "./images";

afterEach(() => {
  configureCloudinaryCloudName("");
});

describe("mascotImageUrl", () => {
  it("uses Cloudinary when cloud name is configured", () => {
    configureCloudinaryCloudName("myfixturecloud");
    const u = mascotImageUrl("owl");
    expect(u).toContain(
      "https://res.cloudinary.com/myfixturecloud/image/upload/",
    );
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

describe("authLogoBlackRectangularUrl", () => {
  it("uses Cloudinary when cloud name is configured", () => {
    configureCloudinaryCloudName("myfixturecloud");
    const u = authLogoBlackRectangularUrl({ width: 400 });
    expect(u).toContain("res.cloudinary.com/myfixturecloud");
    expect(u).toContain("garzoni/logo/garzoni-logo-black-rectangular");
    expect(u).toContain("w_400");
  });

  it("falls back to media path when Cloudinary is not configured", () => {
    configureCloudinaryCloudName("");
    const u = authLogoBlackRectangularUrl();
    expect(u).toMatch(/\/media\/logo\/garzoni-logo-black-rectangular\.png$/);
  });
});

describe("authLogoWhiteRectangularUrl", () => {
  it("uses Cloudinary when cloud name is configured", () => {
    configureCloudinaryCloudName("myfixturecloud");
    const u = authLogoWhiteRectangularUrl();
    expect(u).toContain("garzoni/logo/garzoni-logo-white-rectangular");
  });

  it("falls back to media path when Cloudinary is not configured", () => {
    configureCloudinaryCloudName("");
    const u = authLogoWhiteRectangularUrl();
    expect(u).toMatch(/\/media\/logo\/garzoni-logo-white-rectangular\.png$/);
  });
});

describe("authLogoRectangleNoBgUrl", () => {
  it("uses Cloudinary when cloud name is configured", () => {
    configureCloudinaryCloudName("myfixturecloud");
    const u = authLogoRectangleNoBgUrl({ width: 600 });
    expect(u).toContain("garzoni/logo/garzoni-logo-rectangle-no-bg");
    expect(u).toContain("w_600");
  });

  it("falls back to media path when Cloudinary is not configured", () => {
    configureCloudinaryCloudName("");
    const u = authLogoRectangleNoBgUrl();
    expect(u).toMatch(/\/media\/logo\/garzoni-logo-rectangle-no-bg\.png$/);
  });
});

describe("Images.authLightBg", () => {
  it("uses Cloudinary when cloud name is configured", () => {
    configureCloudinaryCloudName("myfixturecloud");
    const u = Images.authLightBg;
    expect(u).toContain("res.cloudinary.com/myfixturecloud");
    expect(u).toContain("garzoni/welcome/background_auth");
  });

  it("falls back to media path when Cloudinary is not configured", () => {
    configureCloudinaryCloudName("");
    const u = Images.authLightBg;
    expect(u).toMatch(/\/media\/welcome\/background_auth\.png$/);
  });
});

describe("authLogoWhiteBgUrl", () => {
  it("uses Cloudinary when cloud name is configured", () => {
    configureCloudinaryCloudName("myfixturecloud");
    const u = authLogoWhiteBgUrl({ width: 400 });
    expect(u).toContain("garzoni/logo/garzoni-logo-white-bg");
    expect(u).toContain("w_400");
  });

  it("falls back to media path when Cloudinary is not configured", () => {
    configureCloudinaryCloudName("");
    const u = authLogoWhiteBgUrl();
    expect(u).toMatch(/\/media\/logo\/garzoni-logo-white-bg\.png$/);
  });
});
