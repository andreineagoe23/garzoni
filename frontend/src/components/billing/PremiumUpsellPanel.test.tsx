import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../test-utils/i18n-for-tests";
import PremiumUpsellPanel from "./PremiumUpsellPanel";

const mockLoadProfile = jest.fn();

jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1 },
    loadProfile: mockLoadProfile,
  }),
}));

describe("PremiumUpsellPanel", () => {
  it("uses stored referral code in referral link", async () => {
    mockLoadProfile.mockResolvedValueOnce({ referral_code: "REALCODE42" });
    render(
      <I18nextProvider i18n={i18n}>
        <PremiumUpsellPanel />
      </I18nextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/welcome\?ref=REALCODE42/i)).toBeInTheDocument();
    });
  });
});
