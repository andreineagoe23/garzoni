const axiosMock = {
  defaults: {
    headers: {
      common: {},
    },
  },
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    response: {
      use: jest.fn(),
      eject: jest.fn(),
    },
    request: {
      use: jest.fn(() => 1),
      eject: jest.fn(),
    },
  },
  create: () => axiosMock,
};

module.exports = axiosMock;
