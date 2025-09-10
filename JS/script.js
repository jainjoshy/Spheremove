const vignette = document.querySelector('.vignette');
if (vignette) {
  window.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 4;
    const y = (e.clientY / window.innerHeight - 0.5) * 4;
    vignette.style.transform = `translate(${x}px, ${y}px)`;
  });
}

// Centralized fog: soft circular blobs orbiting around the main content (blue + green layers)
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
const hero = document.querySelector('.content');
const topbarEl = document.querySelector('.topbar');
let width = 0, height = 0, deviceRatio = window.devicePixelRatio || 1;

// Quality controls
let supersample = 2; // 1 = default, 2 = high quality
let renderScale = deviceRatio; // actual scale applied (deviceRatio * supersample, clamped by MAX_PIXELS)
const MAX_RENDER_PIXELS = 3840 * 2160 * 2; // cap to avoid extreme memory on very large displays

// Dither noise pattern to reduce gradient banding
let noisePattern = null;
function buildNoisePattern() {
  const tile = Math.max(64, Math.floor(128 * renderScale));
  const n = document.createElement('canvas');
  n.width = tile;
  n.height = tile;
  const nctx = n.getContext('2d');
  const img = nctx.createImageData(tile, tile);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0; // full-range grayscale for effective dithering
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  noisePattern = ctx.createPattern(n, 'repeat');
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  // Clamp render scale to avoid exceeding pixel budget
  const desiredScale = deviceRatio * supersample;
  const maxScaleByBudget = Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, width * height));
  renderScale = Math.max(deviceRatio, Math.min(desiredScale, maxScaleByBudget));

  canvas.width = Math.floor(width * renderScale);
  canvas.height = Math.floor(height * renderScale);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  buildNoisePattern();
}

window.addEventListener('resize', resize);
resize();

function getCenter() {
  const r = hero.getBoundingClientRect();
  const tbr = topbarEl ? topbarEl.getBoundingClientRect() : { bottom: 0 };
  const cx = window.innerWidth / 2;
  const cyPreferred = Math.min(r.top + r.height * 0.30, window.innerHeight * 0.38);
  const cy = Math.max(tbr.bottom + 20, cyPreferred);
  const outerR = Math.max(window.innerWidth, window.innerHeight) * 1.2;
  return { cx, cy, outerR };
}

// Create orbiting blobs for two separate fog layers (blue and green)
const BLUE_BLOBS = 160;
const GREEN_BLOBS = 57;
const blueBlobs = [];
const greenBlobs = [];

// Speed multiplier to increase fog movement speed
const SPEED_MULTIPLIER = 2.2; // increase to speed up movement

for (let i = 0; i < BLUE_BLOBS; i++) {
  blueBlobs.push({
    theta: Math.random() * Math.PI * 2,
    baseR: 250 + Math.random() * 310,
    noiseAmp: 12 + Math.random() * 34,
    noisePhase: Math.random() * Math.PI * 2,
    omega: (0.00315 + Math.random() * 0.0005) * (Math.random() < 0.5 ? -1 : 1) * SPEED_MULTIPLIER,
    rVis: 160 + Math.random() * 220,
    hue: 205 + Math.random() * 20 // blue range
  });
}

for (let i = 0; i < GREEN_BLOBS; i++) {
  greenBlobs.push({
    theta: Math.random() * Math.PI * 2,
    baseR: 200 + Math.random() * 260,
    noiseAmp: 14 + Math.random() * 36,
    noisePhase: Math.random() * Math.PI * 2,
    omega: (0.00315 + Math.random() * 0.001) * (Math.random() < 0.5 ? -1 : 1) * SPEED_MULTIPLIER,
    rVis: 160 + Math.random() * 220,
    hue: 150 + Math.random() * 8 // green range
  });
}

let t = 0;

function step() {
  ctx.clearRect(0, 0, width, height);

  const { cx, cy, outerR } = getCenter();
  const tbr = topbarEl ? topbarEl.getBoundingClientRect() : { bottom: 0 };

  // Clip all fog rendering to start below the topbar
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, tbr.bottom, width, Math.max(0, height - tbr.bottom));
  ctx.clip();

  // Subtle background blend towards black (no hard edges)
  const base = ctx.createRadialGradient(cx, cy, outerR * 0.02, cx, cy, Math.max(width, height));
  base.addColorStop(0, 'rgba(0,0,0,0.62)');
  base.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Draw orbiting fog around the center (blue layer)
  ctx.globalCompositeOperation = 'screen';
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (const b of blueBlobs) {
    b.theta += b.omega;
    const radius = b.baseR + Math.sin(t + b.noisePhase) * b.noiseAmp;
    const x = cx + Math.cos(b.theta) * radius;
    const y = cy + Math.sin(b.theta) * radius;

    const g = ctx.createRadialGradient(x, y, 0, x, y, b.rVis);
    g.addColorStop(0, `hsla(${b.hue}, 100%, 60%, 0.7)`);                // blue core
    g.addColorStop(0.55, `hsla(${b.hue}, 100%, 52%, 0.12)`);            // blue mid
    g.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, b.rVis, 0, Math.PI * 2);
    ctx.fill();

  }
  ctx.restore();

  // Draw orbiting fog around the center (green layer)
  ctx.globalCompositeOperation = 'screen';
  ctx.save();
  ctx.globalAlpha = 0.1;
  for (const b of greenBlobs) {
    b.theta += b.omega;
    const radius = b.baseR + Math.sin(t + b.noisePhase) * b.noiseAmp;
    const x = cx + Math.cos(b.theta) * radius;
    const y = cy + Math.sin(b.theta) * radius;

    const g = ctx.createRadialGradient(x, y, 0, x, y, b.rVis);
    g.addColorStop(0, `hsla(${b.hue}, 100%, 60%, 0.30)`);               // green core
    g.addColorStop(0.55, `hsla(${b.hue}, 100%, 48%, 0.10)`);            // green mid for smoother falloff
    g.addColorStop(1, 'rgba(34, 148, 123, 0)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, b.rVis, 0, Math.PI * 2);
    ctx.fill();

  }
  ctx.restore();

  // Radial mask to softly blend fog into black around content
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(cx, cy, outerR * 0.18, cx, cy, outerR);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Subtle noise overlay to reduce gradient banding
  if (noisePattern) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = noisePattern;
    ctx.fillRect(0, tbr.bottom, width, Math.max(0, height - tbr.bottom));
    ctx.restore();
  }

  // End clipping region
  ctx.restore();

  // Advance time to animate radius noise gently
  t += 0.0045; // slight time increment for soft pulsation

  requestAnimationFrame(step);
}

requestAnimationFrame(step);

