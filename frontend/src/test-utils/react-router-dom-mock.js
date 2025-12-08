const React = require("react");

const mockNavigate = jest.fn();

module.exports = {
  HashRouter: ({ children }) => <div>{children}</div>,
  MemoryRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ element }) => element,
  Link: ({ to, children }) => <a href={typeof to === "string" ? to : "#"}>{children}</a>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/", search: "" }),
};
