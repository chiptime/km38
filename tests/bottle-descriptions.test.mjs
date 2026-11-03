// Run with: node --test tests/bottle-descriptions.test.mjs
// Set CHROMIUM if the Chromium executable is not on PATH.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const browserChecks = String.raw`
<script>
window.addEventListener('load', async () => {
  await document.fonts.load('700 24px Gaegu');
  const style = document.createElement('style');
  style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.head.append(style);

  const expected = {
    'gran-reserva': { label: 'Vino Gran Reserva', temp: 'Servir entre -16 y -18 °C', color: 'rgb(172, 151, 86)' },
    tinto: { label: 'Vino tinto', temp: 'Servir entre -14 y -16 °C', color: 'rgb(180, 179, 179)' },
    blanco: { label: 'Vino blanco', temp: 'Servir entre -8 y -10 °C', color: 'rgb(183, 91, 26)' }
  };
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const root = document.documentElement;
  const cards = [...document.querySelectorAll('.card[data-wine]')];
  const flier = document.querySelector('[data-flier] svg');
  const description = svg => svg.querySelector('[data-bottle-description]')?.textContent.trim();
  const firstDots = [...cards[0].querySelectorAll('.bottle-dots circle')]
    .map(dot => [dot.getAttribute('cx'), dot.getAttribute('cy'), dot.getAttribute('r')].join(','))
    .join(';');

  check(cards.length === 3 && !!flier, 'three cards and one flying bottle');
  for (const card of cards) {
    const wine = card.dataset.wine;
    const svg = card.querySelector('svg');
    const caption = svg.querySelector('[data-bottle-description]');
    check(description(svg) === expected[wine].label, 'card description: ' + wine);
    check(caption && +caption.getAttribute('y') >= 257, 'lowered description: ' + wine);
    check(caption && getComputedStyle(caption).fontFamily.includes('Gaegu'), 'handwritten description: ' + wine);
    check(caption && caption.querySelectorAll('tspan').length === (wine === 'gran-reserva' ? 2 : 1), 'caption lines: ' + wine);
    check(card.querySelector('.card__temp').textContent.trim() === expected[wine].temp, 'card temperature: ' + wine);
    check(getComputedStyle(svg.querySelector('.bottle-label')).fill === expected[wine].color, 'label color: ' + wine);
    const dots = [...svg.querySelectorAll('.bottle-dots circle')];
    check(dots.length === 243, 'dot count: ' + wine);
    check(dots.map(dot => [dot.getAttribute('cx'), dot.getAttribute('cy'), dot.getAttribute('r')].join(',')).join(';') === firstDots, 'deterministic dots: ' + wine);
    const colors = ['e', 'a', 'b', 'c', 'd'];
    for (const dot of dots) {
      const column = Math.round((+dot.getAttribute('cx') - 6) / 13);
      check(dot.style.fill === 'var(--dot-' + colors[column % colors.length] + ')', 'dot column: ' + wine);
    }
  }

  for (const wine of ['gran-reserva', 'tinto', 'blanco']) {
    check(root.dataset.wine === wine, 'slider selection: ' + wine);
    check(description(flier) === expected[wine].label, 'flying description: ' + wine);
    check(document.querySelector('[data-wine-temp]').textContent.trim() === expected[wine].temp, 'slider temperature: ' + wine);
    document.querySelector('[data-next]').click();
  }
  check(root.dataset.wine === 'gran-reserva', 'next wraps');
  document.querySelector('[data-prev]').click();
  check(root.dataset.wine === 'blanco' && description(flier) === expected.blanco.label, 'previous wraps');
  for (const wine of ['gran-reserva', 'tinto', 'blanco']) {
    document.querySelector('[data-want="' + wine + '"]').click();
    check(root.dataset.wine === wine && description(flier) === expected[wine].label, 'card selection: ' + wine);
  }
  check(document.querySelector('[data-cart-count]').textContent === '3', 'decorative cart count');
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
  check(root.dataset.wine === 'gran-reserva' && description(flier) === expected['gran-reserva'].label, 'keyboard next wraps');
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
  check(root.dataset.wine === 'blanco' && description(flier) === expected.blanco.label, 'keyboard previous wraps');

  const proof = document.createElement('pre');
  proof.id = 'bottle-test-result';
  proof.textContent = JSON.stringify({ok: failures.length === 0, failures: failures.slice(0, 20)});
  document.body.append(proof);
});
</script>`;

test('bottle descriptions and shared wine controls', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'km38-browser-'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '')
    .replace('</body>', browserChecks + '</body>');
  const files = {
    '/main.js': ['main.js', 'text/javascript'],
    '/styles.css': ['styles.css', 'text/css'],
    '/assets/Gaegu-Bold.ttf': ['assets/Gaegu-Bold.ttf', 'font/ttf'],
    '/assets/km38-reference.webp': ['assets/km38-reference.webp', 'image/webp']
  };
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    if (name === '/') return response.end(html);
    const file = files[name];
    if (!file) { response.writeHead(404); return response.end(); }
    response.writeHead(200, {'Content-Type': file[1]});
    fs.createReadStream(path.join(root, file[0])).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temporary, {recursive: true, force: true});
  });

  const browser = spawn(process.env.CHROMIUM || 'chromium', [
    '--headless', '--disable-gpu', '--disable-dev-shm-usage',
    `--user-data-dir=${path.join(temporary, 'profile')}`,
    `--window-size=${process.env.VIEWPORT || '1440,900'}`,
    '--virtual-time-budget=6000', '--dump-dom', `http://127.0.0.1:${server.address().port}/`
  ], {env: {...process.env, HOME: temporary, TMPDIR: temporary}});
  let output = '';
  let stderr = '';
  browser.stdout.on('data', chunk => { output += chunk; });
  browser.stderr.on('data', chunk => { if (stderr.length < 3000) stderr += chunk; });
  const timer = setTimeout(() => browser.kill('SIGTERM'), 40000);
  const exitCode = await new Promise((resolve, reject) => {
    browser.once('error', reject);
    browser.once('close', resolve);
  }).finally(() => clearTimeout(timer));
  assert.equal(exitCode, 0, `Chromium failed: ${stderr}`);
  const match = output.match(/<pre id="bottle-test-result">([^<]+)<\/pre>/);
  assert.ok(match, `Browser result missing: ${stderr}`);
  const result = JSON.parse(match[1]);
  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
});
