/**
 * @file A simple client-side router.
 */

/**
 * @typedef {object} Route
 * @property {string} path - The path of the route.
 * @property {string} template - The HTML template for the route.
 */

/** @type {Route[]} */
const routes = [
  { path: "/", template: "<h1>Home</h1>" },
  { path: "/about", template: "<h1>About</h1>" },
  { path: "/contact", template: "<h1>Contact</h1>" },
];

/**
 * Renders the view for the current route.
 * @returns {void}
 */
const render = () => {
  const path = window.location.pathname;
  const match = routes.find((route) => route.path === path);
  const view = match ? match.template : "<h1>404 - Not Found</h1>";
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = view;
  }
};

/**
 * Navigates to a new path.
 * @param {string} path - The path to navigate to.
 * @returns {void}
 */
const navigate = (path) => {
  window.history.pushState({}, "", path);
  render();
};

/**
 * Initializes the router.
 * @returns {void}
 */
export const initRouter = () => {
  window.addEventListener("popstate", render);
  document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", (e) => {
      const target = e.target;
      if (target instanceof HTMLAnchorElement && target.matches("[data-link]")) {
        e.preventDefault();
        navigate(target.href);
      }
    });
    render();
  });
};
