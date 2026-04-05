import { vi } from "vitest";

type AxiosMock = {
  defaults: { headers: { common: Record<string, string> } };
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  interceptors: {
    response: {
      use: ReturnType<typeof vi.fn>;
      eject: ReturnType<typeof vi.fn>;
    };
    request: { use: ReturnType<typeof vi.fn>; eject: ReturnType<typeof vi.fn> };
  };
  create: () => AxiosMock;
};

const axiosMock: AxiosMock = {
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
