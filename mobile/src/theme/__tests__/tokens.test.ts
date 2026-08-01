import { layout, radius, spacing } from "../../theme/tokens";

it("resolves @garzoni/tokens through the mobile theme entry point", () => {
  expect(spacing.xl).toBe(20);
  expect(radius.card).toBe(20);
  expect(layout.screenPaddingX).toBe(20);
});
