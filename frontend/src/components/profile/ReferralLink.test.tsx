import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ReferralLink from "./ReferralLink";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";

describe("ReferralLink", () => {
  const originalLocation = window.location;

  beforeAll(() => {
    // @ts-ignore
    delete (window as any).location;
    (window as any).location = { origin: "https://app.monevo.com" };
  });

  afterAll(() => {
    // @ts-ignore
    window.location = originalLocation;
  });

  it("builds a welcome referral link with the referral code", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ReferralLink referralCode="TEST-CODE" />
      </I18nextProvider>
    );

    const input = screen.getByLabelText(/Referral link/i) as HTMLInputElement;
    expect(input.value).toBe(
      "https://app.monevo.com/welcome?ref=TEST-CODE"
    );
  });

  it("copies the referral link to clipboard when clicking copy", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator as any, {
      clipboard: { writeText },
    });

    render(
      <I18nextProvider i18n={i18n}>
        <ReferralLink referralCode="FRIEND-123" />
      </I18nextProvider>
    );

    const button = screen.getByRole("button", { name: /copy link/i });
    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith(
      "https://app.monevo.com/welcome?ref=FRIEND-123"
    );
  });
});
