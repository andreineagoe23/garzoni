/**
 * TypeScript entry for tests: `import { mockNavigate } from ".../react-router-dom-mock"`.
 * The Jest `react-router-dom` alias targets `react-router-dom-mock-impl.js` (CommonJS) so
 * named imports like `createMemoryRouter` keep working.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const impl = require("./react-router-dom-mock-impl.js") as Record<
  string,
  unknown
> & {
  /** Jest mock from `jest.fn()` in the impl bundle */
  mockNavigate: {
    (...args: unknown[]): unknown;
    mockReset: () => void;
    mockClear: () => void;
  };
};

export const mockNavigate = impl.mockNavigate;
export default impl;
