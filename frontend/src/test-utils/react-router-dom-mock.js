const React = require("react");

const mockNavigate = jest.fn();

module.exports = {
  BrowserRouter: ({ children }) => <div>{children}</div>,
  MemoryRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ element }) => element,
  Link: ({ to, children }) => (
    <a href={typeof to === "string" ? to : "#"}>{children}</a>
  ),
  Navigate: ({ to }) => (
    <div data-mock-navigate={typeof to === "string" ? to : ""} />
  ),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/", search: "" }),
  useParams: () => ({}),
};
