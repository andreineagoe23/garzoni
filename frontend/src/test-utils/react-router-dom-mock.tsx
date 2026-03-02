import React from "react";

export const mockNavigate = jest.fn();

type TestGlobal = typeof globalThis & {
  __TEST_LOCATION_SEARCH__?: string;
  __TEST_LOCATION_PATHNAME__?: string;
};

const getSearch = () =>
  (globalThis as TestGlobal).__TEST_LOCATION_SEARCH__ || "";
const getPathname = () =>
  (globalThis as TestGlobal).__TEST_LOCATION_PATHNAME__ || "/";

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
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={typeof to === "string" ? to : "#"}>{children}</a>
  ),
  NavLink: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string | ((props: { isActive: boolean }) => string);
    onClick?: () => void;
  }) => {
    const resolvedClassName =
      typeof className === "function"
        ? className({ isActive: false })
        : className;
    return (
      <a
        href={typeof to === "string" ? to : "#"}
        className={resolvedClassName}
        onClick={onClick}
      >
        {children}
      </a>
    );
  },
  Navigate: ({ to }: { to: string }) => (
    <div
      data-mock-navigate={typeof to === "string" ? to : ""}
      data-testid={`mock-navigate-${to}`}
    />
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: getPathname(), search: getSearch() }),
  useParams: () => ({}),
  mockNavigate,
};

export default reactRouterDomMock;
module.exports = reactRouterDomMock;
