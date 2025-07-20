import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { initRouter } from '../../src/router.js';

test('Router', async (t) => {
  await t.test('should render the home page by default', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost/',
    });
    global.window = dom.window;
    global.document = dom.window.document;
    initRouter();
    const app = document.getElementById('app');
    assert.strictEqual(app.innerHTML, '<h1>Home</h1>');
  });

  await t.test('should render the about page when navigating to /about', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost/about',
    });
    global.window = dom.window;
    global.document = dom.window.document;
    initRouter();
    const app = document.getElementById('app');
    assert.strictEqual(app.innerHTML, '<h1>About</h1>');
  });
});
