import { vi } from "vitest";

const axiosMock: any = {
  defaults: {
    headers: {
      common: {},
    },
  },
  get: vi.fn(),
  post: vi.fn(),
  interceptors: {
    response: {
      use: vi.fn(),
      eject: vi.fn(),
    },
    request: {
      use: vi.fn(() => 1),
      eject: vi.fn(),
    },
  },
  create: () => axiosMock,
};

export default axiosMock;
