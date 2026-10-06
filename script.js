// ---------- DATA ----------
const COMMODITIES = {
  "Fresh fruits (apple, banana, mango)": { moisture: 4, oxygen: 4, light: 2, resp: true, note: "Respires after harvest; needs controlled gas exchange to avoid spoilage." },
  "Fresh vegetables (leafy, tomato)":    { moisture: 5, oxygen: 3, light: 2, resp: true, note: "High respiration and moisture loss; wilting and condensation are risks." },
  "Dry fruits & nuts":                   { moisture: 8, oxygen: 9, light: 7, resp: false, note: "Fats go rancid with oxygen and light; moisture causes loss of crispness." },
  "Cereals & pulses":                    { moisture: 7, oxygen: 4, light: 2, resp: false, note: "Moisture absorption leads to mould and insect infestation." },
  "Spices & powders":                    { moisture: 9, oxygen: 7, light: 7, resp: false, note: "Aroma and colour are lost to moisture, oxygen and light." },
  "Snacks (chips, namkeen)":             { moisture: 9, oxygen: 9, light: 8, resp: false, note: "Texture degrades fast with moisture; oils oxidise." },
  "Dairy (milk, curd, paneer)":          { moisture: 6, oxygen: 8, light: 8, resp: false, note: "Microbial spoilage and light-induced nutrient loss." },
  "Meat, fish & poultry":                { moisture: 6, oxygen: 8, light: 4, resp: false, note: "Highly perishable; oxygen and microbes drive spoilage." },
  "Bakery products":                     { moisture: 6, oxygen: 5, light: 3, resp: false, note: "Staling and mould depend on moisture exchange." },
  "Beverages & juices":                  { moisture: 3, oxygen: 8, light: 7, resp: false, note: "Oxidation affects flavour, colour and vitamin C." }
};

// Material properties 0-10 (10 = best)
const MATERIALS = [
  { name: "LDPE film",                  moisture: 5, oxygen: 2, light: 2, breath: 7, cost: 9, eco: 4, note: "Cheap and flexible; good for produce bags." },
  { name: "Micro-perforated PE (MAP)",  moisture: 3, oxygen: 2, light: 2, breath: 10, cost: 8, eco: 4, note: "Tuned gas exchange for fresh produce." },
  { name: "HDPE pouch / container",     moisture: 7, oxygen: 3, light: 3, breath: 3, cost: 8, eco: 5, note: "Stiffer, better moisture barrier than LDPE." },
  { name: "BOPP film",                  moisture: 7, oxygen: 3, light: 3, breath: 3, cost: 8, eco: 4, note: "Clear, strong, good moisture barrier." },
  { name: "Metallised BOPP / PET",      moisture: 9, oxygen: 8, light: 9, breath: 0, cost: 6, eco: 2, note: "Strong barrier against moisture, oxygen and light." },
  { name: "Aluminium foil laminate",    moisture: 10, oxygen: 10, light: 10, breath: 0, cost: 3, eco: 2, note: "Best barrier; higher cost, hard to recycle." },
  { name: "PET bottle / tray",          moisture: 8, oxygen: 6, light: 5, breath: 1, cost: 6, eco: 6, note: "Transparent, recyclable, decent barrier." },
  { name: "Glass jar / bottle",         moisture: 10, oxygen: 10, light: 6, breath: 0, cost: 4, eco: 8, note: "Inert and reusable; heavy and breakable." },
  { name: "PLA bioplastic",             moisture: 4, oxygen: 4, light: 3, breath: 5, cost: 4, eco: 9, note: "Compostable; limited heat and moisture resistance." },
  { name: "Kraft paper with liner",     moisture: 4, oxygen: 3, light: 6, breath: 6, cost: 7, eco: 9, note: "Renewable and recyclable; needs a liner for moisture." },
  { name: "Corrugated / paperboard box",moisture: 2, oxygen: 1, light: 8, breath: 6, cost: 8, eco: 9, note: "Good for transport and protection of produce." },
  { name: "Woven HDPE / jute sack",     moisture: 3, oxygen: 1, light: 5, breath: 8, cost: 9, eco: 6, note: "Bulk grain storage and transport." }
];

// ---------- UI SETUP ----------
const $ = (id) => document.getElementById(id);
const select = $("commodity");
Object.keys(COMMODITIES).forEach((c) => select.add(new Option(c, c)));

const PRIORITY_LABELS = ["Lowest cost", "Balanced", "Eco-friendly"];
$("priority").addEventListener("input", (e) => {
  $("prioLabel").textContent = PRIORITY_LABELS[e.target.value];
});

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  recommend({
    commodity: select.value,
    temp: +$("temp").value,
    rh: +$("rh").value,
    shelf: +$("shelf").value,
    transport: +$("transport").value,
    priority: +$("priority").value
  });
});

// ---------- SCORING ENGINE ----------
function recommend(inp) {
  const c = COMMODITIES[inp.commodity];

  let moistureNeed = c.moisture;
  if (inp.rh > 75) moistureNeed += 1.5;
  if (inp.rh < 40) moistureNeed -= 1;

  let oxygenNeed = c.oxygen + (inp.temp > 30 ? 1 : 0);
  const lightNeed = c.light;

  const durationFactor = Math.min(2, (inp.shelf + inp.transport) / 60);
  moistureNeed += durationFactor;
  oxygenNeed += durationFactor;
  const clamp = (v) => Math.max(0, Math.min(10, v));
  moistureNeed = clamp(moistureNeed);
  oxygenNeed = clamp(oxygenNeed);

  const costW = [3, 1.5, 0.5][inp.priority];
  const ecoW = [0.5, 1.5, 3][inp.priority];
  const breathW = c.resp ? 6 : 0;
  const transportW = inp.transport > 7 ? 1 : 0;

  const results = MATERIALS.map((m) => {
    const gaps = {
      moisture: Math.max(0, moistureNeed - m.moisture),
      oxygen: Math.max(0, oxygenNeed - m.oxygen),
      light: Math.max(0, lightNeed - m.light)
    };
    const protection = 30 - (gaps.moisture * 1.6 + gaps.oxygen * 1.4 + gaps.light * 0.8);
    const respiration = c.resp ? m.breath * (breathW / 10) * 2 : 0;
    const sealedPenalty = c.resp && m.breath < 3 ? 12 : 0;

    const raw = protection + respiration + m.cost * costW + m.eco * ecoW + m.moisture * transportW - sealedPenalty;
    return { m, gaps, raw };
  });

  results.sort((a, b) => b.raw - a.raw);
  const best = results[0].raw;
  const worst = results[results.length - 1].raw;
  results.forEach((r) => {
    r.score = Math.round(50 + ((r.raw - worst) / (best - worst || 1)) * 48);
  });

  render(inp, c, results.slice(0, 3), { moistureNeed, oxygenNeed, lightNeed });
}

function estimateShelfLife(inp, r) {
  const worstGap = Math.max(r.gaps.moisture, r.gaps.oxygen, r.gaps.light);
  const factor = Math.max(0.3, 1 - worstGap * 0.1);
  return Math.round(inp.shelf * factor * (inp.temp > 30 ? 0.9 : 1));
}

// ---------- RENDER ----------
function barColor(v) {
  return v >= 7 ? "var(--good)" : v >= 4 ? "var(--mid)" : "var(--low)";
}

function bar(label, value) {
  return `<div class="bar"><span>${label}</span>
    <div class="track"><div class="fill" style="width:${value * 10}%;background:${barColor(value)}"></div></div>
    <span>${value}</span></div>`;
}

function reasons(inp, c, r, needs) {
  const out = [];
  const m = r.m;
  if (c.resp) {
    out.push(m.breath >= 6 ? "Allows gas exchange, so produce keeps respiring without spoiling." : "Low breathability: may trap moisture and gases around respiring produce.");
  }
  if (needs.moistureNeed >= 7) out.push(m.moisture >= 7 ? "Strong moisture barrier for this product and humidity." : "Moisture barrier is below ideal for these conditions.");
  if (needs.oxygenNeed >= 7) out.push(m.oxygen >= 7 ? "High oxygen barrier slows oxidation and rancidity." : "Oxygen barrier is below ideal; consider a laminate.");
  if (needs.lightNeed >= 7) out.push(m.light >= 7 ? "Blocks light that degrades colour and nutrients." : "Offers limited light protection.");
  out.push(m.note);
  return out;
}

function render(inp, c, top, needs) {
  const profile = $("profile");
  profile.classList.remove("hidden");
  profile.innerHTML = `<b>${inp.commodity}</b><br>${c.note}<br>
    Needs → moisture barrier ${needs.moistureNeed.toFixed(1)}/10, oxygen barrier ${needs.oxygenNeed.toFixed(1)}/10, light protection ${needs.lightNeed}/10.`;

  $("results").innerHTML = top
    .map((r, i) => {
      const life = estimateShelfLife(inp, r);
      return `<article class="card ${i === 0 ? "best" : ""}">
        <header>
          <h3>${i + 1}. ${r.m.name} ${i === 0 ? '<span class="badge">Best match</span>' : ""}</h3>
          <span class="score">${r.score}%</span>
        </header>
        <p class="meta">Estimated shelf life: about ${life} days (target ${inp.shelf})</p>
        <div class="bars">
          ${bar("Moisture barrier", r.m.moisture)}
          ${bar("Oxygen barrier", r.m.oxygen)}
          ${bar("Light barrier", r.m.light)}
          ${bar("Breathability", r.m.breath)}
          ${bar("Affordability", r.m.cost)}
          ${bar("Eco-friendliness", r.m.eco)}
        </div>
        <ul class="why">${reasons(inp, c, r, needs).map((t) => `<li>${t}</li>`).join("")}</ul>
      </article>`;
    })
    .join("");
}