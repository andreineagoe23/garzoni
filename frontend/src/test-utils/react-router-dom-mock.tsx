import React from "react";

const mockNavigate = jest.fn();
const getSearch = () => (global as any).__TEST_LOCATION_SEARCH__ || "";

const reactRouterDomMock = {
  BrowserRouter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  MemoryRouter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Routes: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Route: ({ element }: { element: React.ReactNode }) => element,
  Link: ({
    to,
    children,
  }: {
    to: string;
    children: React.ReactNode;
  }) => <a href={typeof to === "string" ? to : "#"}>{children}</a>,
  Navigate: ({ to }: { to: string }) => (
    <div data-mock-navigate={typeof to === "string" ? to : ""} />
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/", search: getSearch() }),
  useParams: () => ({}),
};

export default reactRouterDomMock;
module.exports = reactRouterDomMock;
