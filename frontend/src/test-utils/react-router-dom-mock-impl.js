/**
 * Jest manual mock for react-router-dom (implementation).
 *
 * Mirrors the real package by merging `react-router` + `react-router/dom` (same as RR DOM's entry),
 * then overrides useLocation / useNavigate / Navigate for test control.
 *
 * - Default: mocked useLocation (via __TEST_LOCATION_* globals) and useNavigate → mockNavigate.
 * - Integration tests: set global __USE_REAL_ROUTER__ = true with RouterProvider / createMemoryRouter.
 *
 * We do not load `react-router-dom/dist/index.js` here: Jest's resolver does not resolve the
 * `react-router/dom` subpath from that nested require without an explicit mapper.
 *
 * Import `mockNavigate` from `react-router-dom-mock.ts` in tests; Jest `moduleNameMapper` points here.
 */
const { TextEncoder, TextDecoder } = require("util");
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}

const React = require("react");

const reactRouter = require("react-router");
const reactRouterDom = require("react-router/dom");
const actual = { ...reactRouter, ...reactRouterDom };

const mockNavigate = jest.fn();

function getSearch() {
  return global.__TEST_LOCATION_SEARCH__ || "";
}
function getPathname() {
  return global.__TEST_LOCATION_PATHNAME__ || "/";
}
function getLocationState() {
  return global.__TEST_LOCATION_STATE__;
}

function useLocation() {
  if (global.__USE_REAL_ROUTER__) {
    return actual.useLocation();
  }
  return {
    pathname: getPathname(),
    search: getSearch(),
    hash: "",
    state: getLocationState(),
    key: "default",
  };
}

function useNavigate() {
  if (global.__USE_REAL_ROUTER__) {
    return actual.useNavigate();
  }
  return mockNavigate;
}

function MockNavigate({ to }) {
  return React.createElement("div", {
    "data-mock-navigate": typeof to === "string" ? to : "",
    "data-testid": `mock-navigate-${to}`,
  });
}

const api = {
  ...actual,
  useLocation,
  useNavigate,
  Navigate: MockNavigate,
  mockNavigate,
};

api.__esModule = true;
api.default = api;

module.exports = api;
