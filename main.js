// KM38 landing behaviour:
// 1. Draws the KM38 bottle as inline SVG (colours come from CSS variables).
// 2. Hero slider: switches the selected wine and recolours the whole page.
// 3. The flying bottle: travels down the page with the scroll, from the hero
//    through the story section, and lands in the card of the selected wine.
// 4. Decorative "cart", toasts and reveal-on-scroll.

(() => {
  "use strict";

  const WINES = {
    "gran-reserva": { name: "Gran Reserva", description: ["Vino Gran", "Reserva"], temp: "Servir entre 16 y 18 °C", theme: "#33201d" },
    tinto: { name: "Tinto Joven", description: ["Vino tinto"], temp: "Servir entre 12 y 14 °C", theme: "#2b0b14" },
    blanco: { name: "Blanco Joven", description: ["Vino blanco"], temp: "Servir entre 6 y 12 °C", theme: "#3a3212" },
  };
  const ORDER = ["gran-reserva", "tinto", "blanco"];

  // Funny feedback for the decorative cart (microcopy, review before final).
  const WANT_MESSAGES = [
    "Apuntado. Es de mentira, pero la ilusión es de verdad.",
    "Hecho. En esta mesa siempre cabe alguien más.",
    "Añadido. Que conste que era «solo para un rato».",
    "Otra más a la mesa. ¿Quién trae el sacacorchos?",
  ];

  const root = document.documentElement;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  root.classList.add("js");

  // ---------------------------------------------------------------------------
  // 1. Bottle SVG
  // ---------------------------------------------------------------------------
  const BOTTLE_PATH =
    "M53 8 H67 Q73 8 73 14 V118 C75 160 108 172 108 214 V374 Q108 392 90 392 H30 Q12 392 12 374 V214 C12 172 45 160 47 118 V14 Q47 8 53 8 Z";

  // Hand-stamped polka dots: vertical columns, each column one solid color,
  // colors changing column to column. Slight deterministic variations in size
  // and position (seeded) keep the hand-made print look.
  const dotField = () => {
    let seed = 38;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const GAP = 13;
    // The edge column precedes the light-to-dark sequence in the artwork.
    const COLORS = ["--dot-e", "--dot-a", "--dot-b", "--dot-c", "--dot-d"];
    let dots = "";
    let col = 0;
    for (let x = 6; x < 122; x += GAP, col += 1) {
      const color = COLORS[col % COLORS.length];
      for (let y = 60; y < 402; y += GAP) {
        const r = 2.35 + rand() * 0.7;
        const cx = x + (rand() - 0.5) * 1.6;
        const cy = y + (rand() - 0.5) * 1.6;
        dots += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" style="fill:var(${color})"/>`;
      }
    }
    return dots;
  };

  const labelSVG = () => `
      <circle class="bottle-label" cx="60" cy="292" r="44" style="fill:var(--bottle-label)"/>
      <g class="bottle-brand">
        <text x="45 75" y="288 292" text-anchor="middle" font-size="55" rotate="-12 -7"
          style="fill:var(--bottle-label-ink)">km</text>
        <text x="48 72" y="328 330" text-anchor="middle" font-size="68" rotate="-12 12"
          style="fill:var(--bottle-label-ink)">38</text>
      </g>`;

  const bottleSVG = (id) => `
    <svg viewBox="0 0 124 400" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <defs>
        <clipPath id="clip-${id}"><path d="${BOTTLE_PATH}"/></clipPath>
        <linearGradient id="shine-${id}" x1="0" x2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".35"/>
          <stop offset=".22" stop-color="#fff" stop-opacity=".28"/>
          <stop offset=".34" stop-color="#fff" stop-opacity="0"/>
          <stop offset=".78" stop-color="#000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity=".45"/>
        </linearGradient>
      </defs>

      <g clip-path="url(#clip-${id})">
        <rect class="bottle-glass" width="124" height="400" style="fill:var(--glass)"/>
        <g class="bottle-dots">${dotField()}</g>
        <rect width="124" height="400" fill="url(#shine-${id})"/>
      </g>

      <!-- wax seal with drips -->
      <path class="bottle-wax" style="fill:var(--wax)"
        d="M45 4 Q45 2 48 2 H72 Q75 2 75 4 V62 Q75 70 72 70 Q69 70 69 63 V58 Q68 74 64 74 Q60 74 60 66 V60 Q59 68 55 68 Q51 68 51 61 V57 Q50 64 47.5 64 Q45 64 45 58 Z"/>
      <rect x="49" y="8" width="3" height="46" rx="1.5" fill="#fff" opacity=".18"/>

      <!-- kraft tag hanging from the neck -->
      <path d="M73 96 C82 104 90 118 96 132" fill="none" stroke="#b08a55" stroke-width="1.4"/>
      <path d="M47 96 C55 100 66 100 73 96" fill="none" stroke="#b08a55" stroke-width="1.6"/>
      <circle cx="100" cy="146" r="15" fill="#c9a46a"/>
      <circle cx="98" cy="136" r="1.8" style="fill:var(--paper)"/>
    </svg>`;

  $$("[data-bottle]").forEach((el, index) => {
    el.innerHTML = bottleSVG(index + 1);
  });

  $$(".header .logo, .footer .logo").forEach((logo) => {
    logo.innerHTML = `<svg class="logo__mark" viewBox="8 238 104 120" aria-hidden="true" focusable="false">${labelSVG()}</svg>`;
    logo.classList.add("logo--bottle");
  });

  // ---------------------------------------------------------------------------
  // 2. Wine selection (hero slider + cards)
  // ---------------------------------------------------------------------------
  const nameEl = $("[data-wine-name]");
  const tempEl = $("[data-wine-temp]");
  const indexEl = $("[data-wine-index]");
  const themeMeta = $('meta[name="theme-color"]');

  const currentWine = () => root.dataset.wine;

  function setWine(id) {
    if (!WINES[id]) return;
    const step = ORDER.indexOf(id) + 1;

    root.dataset.wine = id;
    root.style.setProperty("--step", step);
    nameEl.textContent = WINES[id].name;
    tempEl.textContent = WINES[id].temp;
    indexEl.textContent = String(step).padStart(2, "0");
    themeMeta?.setAttribute("content", WINES[id].theme);

    measure();
  }

  function shiftWine(delta) {
    const next = (ORDER.indexOf(currentWine()) + delta + ORDER.length) % ORDER.length;
    setWine(ORDER[next]);
  }

  $("[data-prev]").addEventListener("click", () => shiftWine(-1));
  $("[data-next]").addEventListener("click", () => shiftWine(1));

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, select")) return;
    if (event.key === "ArrowLeft") shiftWine(-1);
    if (event.key === "ArrowRight") shiftWine(1);
  });

  // ---------------------------------------------------------------------------
  // 3. Flying bottle
  // ---------------------------------------------------------------------------
  const sheet = $(".sheet");
  const flier = $("[data-flier]");
  const flierBody = flier.firstElementChild;
  const narrow = window.matchMedia("(max-width: 980px)");
  const ROTATIONS = [-8, 6, 0];
  let waypoints = [];

  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - (1 - t) ** 3;

  // Waypoints are measured in sheet coordinates. Each one also stores the
  // scroll position ("at") where the bottle should sit exactly in that slot:
  // the slot centred in the viewport (the hero one is reached at scroll 0).
  function measure() {
    const slots = [
      $('[data-slot="hero"]'),
      $('[data-slot="story"]'),
      $(`[data-slot="${currentWine()}"]`),
    ];
    const sheetBox = sheet.getBoundingClientRect();
    const viewport = window.innerHeight;

    waypoints = slots.map((slot, i) => {
      const box = slot.getBoundingClientRect();
      const top = box.top + window.scrollY;
      return {
        x: box.left - sheetBox.left,
        y: box.top - sheetBox.top,
        w: box.width,
        h: box.height,
        rot: ROTATIONS[i],
        at: i === 0 ? 0 : Math.max(0, top + box.height / 2 - viewport / 2),
      };
    });

    for (let i = 1; i < waypoints.length; i += 1) {
      waypoints[i].at = Math.max(waypoints[i].at, waypoints[i - 1].at + 1);
    }

    render();
    flier.classList.add("is-ready");
  }

  function render() {
    if (!waypoints.length) return;
    const scroll = window.scrollY;
    const last = waypoints[waypoints.length - 1];
    let from = waypoints[0];
    let to = waypoints[0];
    let t = 0;

    if (scroll >= last.at) {
      from = to = last;
    } else {
      for (let i = 0; i < waypoints.length - 1; i += 1) {
        if (scroll < waypoints[i + 1].at) {
          from = waypoints[i];
          to = waypoints[i + 1];
          t = Math.min(1, Math.max(0, (scroll - from.at) / (to.at - from.at)));
          break;
        }
      }
    }

    // Vertical travel is linear so the bottle keeps pace with the scroll.
    // The sideways drift happens early (ease-out) so the bottle reaches its
    // column before the text of the next section scrolls into view.
    const s = smooth(t);
    const x = lerp(from.x, to.x, easeOut(t));
    const y = lerp(from.y, to.y, t);
    const w = lerp(from.w, to.w, t);
    const h = lerp(from.h, to.h, t);
    const rot = lerp(from.rot, to.rot, s);

    // On single-column layouts the bottle has to cross the text, so it
    // fades while travelling and comes back solid at each stop.
    flierBody.style.opacity = narrow.matches ? String(1 - 0.82 * Math.sin(Math.PI * t)) : "";

    flier.style.width = `${w}px`;
    flier.style.height = `${h}px`;
    flier.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        render();
        ticking = false;
      });
    },
    { passive: true },
  );

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 120);
  });
  window.addEventListener("load", measure);
  document.fonts?.ready.then(measure);
  measure();

  // ---------------------------------------------------------------------------
  // 4. Decorative cart, toast and reveals
  // ---------------------------------------------------------------------------
  const countEl = $("[data-cart-count]");
  const toastEl = $("[data-toast]");
  let cartCount = 0;
  let toastTimer;
  let messageIndex = 0;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2800);
  }

  $$("[data-want]").forEach((button) => {
    button.addEventListener("click", () => {
      cartCount += 1;
      countEl.textContent = cartCount;
      countEl.classList.remove("is-bump");
      void countEl.offsetWidth; // restart the bump animation
      countEl.classList.add("is-bump");
      setWine(button.dataset.want);
      toast(WANT_MESSAGES[messageIndex % WANT_MESSAGES.length]);
      messageIndex += 1;
    });
  });

  $("[data-cart]").addEventListener("click", () => {
    toast(
      cartCount
        ? `Brindis apuntados: ${cartCount}. Ni tarjeta, ni prisas.`
        : "Todavía no has brindado por nada. Eso tiene arreglo.",
    );
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
  );
  $$(".reveal").forEach((el) => revealObserver.observe(el));
})();
