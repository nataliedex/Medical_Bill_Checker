// --- Median helper (ignore zeros) ---
function median(values) {
  const cleaned = values
    .filter(v => v != null && !isNaN(v))
    .map(Number)
    .filter(v => v > 0);

  if (!cleaned.length) return 0;

  cleaned.sort((a, b) => a - b);
  const mid = Math.floor(cleaned.length / 2);

  return cleaned.length % 2 !== 0
    ? cleaned[mid]
    : (cleaned[mid - 1] + cleaned[mid]) / 2;
}

// --- Fetch CPT descriptions ---
async function getCPTDescription(code) {
  try {
    const res = await fetch("/api/describe-cpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    return data.summary || "No description available.";
  } catch (err) {
    console.error("Error fetching CPT description:", err);
    return "Error fetching description.";
  }
}

async function getMultipleCPTDescriptions(codes) {
  const descriptions = {};
  await Promise.all(
    codes.map(async (code) => {
      descriptions[code] = await getCPTDescription(code);
    })
  );
  return descriptions;
}

// --- Fetch short visit summary ---
async function getVisitSummary(codes) {
  try {
    const res = await fetch("/api/summarize-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes }),
    });
    const data = await res.json();
    return data.summary || "No summary available.";
  } catch (err) {
    console.error("Error fetching visit summary:", err);
    return "Error generating summary.";
  }
}

// --- Table sorting ---
let sortDirections = {};
function sortTable(n, tableId = "resultsTable") {
  const table = document.getElementById(tableId);
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);

  sortDirections[n] = !sortDirections[n];
  const direction = sortDirections[n] ? 1 : -1;

  rows.sort((a, b) => {
    const valA = a.cells[n].innerText.replace(/[^0-9.-]+/g, "");
    const valB = b.cells[n].innerText.replace(/[^0-9.-]+/g, "");
    const numA = parseFloat(valA);
    const numB = parseFloat(valB);

    if (!isNaN(numA) && !isNaN(numB)) return (numA - numB) * direction;
    return a.cells[n].innerText.localeCompare(b.cells[n].innerText) * direction;
  });

  rows.forEach((row) => tbody.appendChild(row));

  table.querySelectorAll("th i").forEach((i) => (i.className = "bi bi-arrow-down-up"));
  table.querySelectorAll("th i")[n].className = sortDirections[n] ? "bi bi-arrow-down" : "bi bi-arrow-up";
}

// --- Manual Pivot Table Rendering ---
async function renderPivotTable(data) {
  const pivotBody = document.querySelector("#pivot-table tbody");
  const settingFilter = document.querySelector("#setting-filter");
  if (!pivotBody) return;

  const uniqueCPTs = [...new Set(data.map(item => item.cpt_code))];
  const descriptions = await getMultipleCPTDescriptions(uniqueCPTs);

  async function buildTable(filterSetting = "") {
    pivotBody.innerHTML = "";
    const displayedCodes = new Set();

    const grouped = {};
    data.forEach(item => {
      const setting = item.setting || "unknown";
      if (filterSetting && setting !== filterSetting) return;
      const key = `${item.cpt_code}||${setting}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
      displayedCodes.add(item.cpt_code);
    });

    let totalStandard = 0;
    let totalNegotiated = 0;

    Object.keys(grouped).sort().forEach(key => {
      const items = grouped[key];
      const [code, setting] = key.split("||");

      const standardMedian = median(items.map(x => Number(x.standard_charge)));
      const negotiatedValues = items.map(x => {
        const negotiated = Number(x.negotiated_charge) > 0 ? Number(x.negotiated_charge) : null;
        const cash = Number(x.standard_cash_charge) > 0 ? Number(x.standard_cash_charge) : null;
        const standard = Number(x.standard_charge) > 0 ? Number(x.standard_charge) : null;
        return negotiated || cash || (standard ? standard * 0.9 : null);
      });
      const negotiatedMedian = median(negotiatedValues);

      totalStandard += standardMedian;
      totalNegotiated += negotiatedMedian;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${code}</td>
        <td>${descriptions[code] || ""}</td>
        <td>${setting}</td>
        <td>$${standardMedian.toFixed(0)}</td>
        <td>$${negotiatedMedian.toFixed(0)}</td>
      `;
      pivotBody.appendChild(tr);
    });

    const totalRow = document.createElement("tr");
    totalRow.style.fontWeight = "bold";
    totalRow.style.backgroundColor = "#f0f0f0";
    totalRow.innerHTML = `
      <td colspan="3" style="text-align:right;">Total:</td>
      <td>$${totalStandard.toFixed(0)}</td>
      <td>$${totalNegotiated.toFixed(0)}</td>
    `;
    pivotBody.appendChild(totalRow);

    return Array.from(displayedCodes);
  }

  async function render(filterValue = settingFilter?.value || "") {
    await buildTable(filterValue);
    // Removed automatic addVisitSummary()
  }

  await render();

  if (settingFilter) {
    settingFilter.addEventListener("change", async () => {
      await render(settingFilter.value);
    });
  }
}

// --- Compare Pivot Table Rendering ---
async function renderComparePivotTable(data) {
  const pivotBody = document.querySelector("#pivot-table tbody");
  const settingFilter = document.querySelector("#setting-filter");
  if (!pivotBody) return;

  const uniqueCPTs = [...new Set(data.map(item => item.cpt_code))];
  const descriptions = await getMultipleCPTDescriptions(uniqueCPTs);

  async function buildTable(filterSetting = "") {
    pivotBody.innerHTML = "";
    const displayedCodes = new Set();
    const flaggedCharges = [];

    const grouped = {};
    data.forEach(item => {
      const setting = item.setting || "unknown";
      if (filterSetting && setting !== filterSetting) return;
      const key = `${item.cpt_code}||${setting}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
      displayedCodes.add(item.cpt_code);
    });

    let totalStandard = 0;
    let totalNegotiated = 0;
    let totalBilled = 0;

    Object.keys(grouped).sort().forEach(key => {
      const items = grouped[key];
      const { cpt_code, medianStandard, medianNegotiated, billedCharges, setting } = items[0];

      let suspicious = false;
      if (billedCharges != null && medianNegotiated != null && medianNegotiated > 0) {
        const percentAbove = (billedCharges - medianNegotiated) / medianNegotiated;
        suspicious = billedCharges > medianNegotiated && percentAbove > 0.10;
      }

      if (suspicious) {
        const percentAbove = (((billedCharges - medianNegotiated) / medianNegotiated) * 100).toFixed(1);
        flaggedCharges.push({
          cpt_code,
          description: descriptions[cpt_code] || "",
          setting,
          billedCharges,
          medianNegotiated,
          percentAbove
        });
      }

      const tr = document.createElement("tr");
      if (suspicious) {
        tr.classList.add("suspicious-charge");
        tr.title = "Suspicious: billed > 10% above negotiated";
      }
      tr.innerHTML = `
        <td>${cpt_code}</td>
        <td>${descriptions[cpt_code] || ""}</td>
        <td>${setting}</td>
        <td>$${medianStandard != null ? medianStandard.toFixed(0) : '0'}</td>
        <td>$${medianNegotiated != null ? medianNegotiated.toFixed(0) : '0'}</td>
        <td>${billedCharges != null ? `$${billedCharges.toFixed(0)}` : '<span class="text-muted">N/A</span>'}</td>
      `;
      pivotBody.appendChild(tr);

      totalStandard += medianStandard || 0;
      totalNegotiated += medianNegotiated || 0;
      totalBilled += billedCharges || 0;
    });

    // Total row
    const totalRow = document.createElement("tr");
    totalRow.style.fontWeight = "bold";
    totalRow.style.backgroundColor = "#f0f0f0";
    totalRow.innerHTML = `
      <td colspan="3" style="text-align:right;">Total:</td>
      <td>$${totalStandard.toFixed(0)}</td>
      <td>$${totalNegotiated.toFixed(0)}</td>
      <td>$${totalBilled.toFixed(0)}</td>
    `;
    pivotBody.appendChild(totalRow);

    // Flagged summary row
    if (flaggedCharges.length > 0) {
      const flaggedTr = document.createElement("tr");
      flaggedTr.classList.add("flagged-summary-row");
      flaggedTr.innerHTML = `
        <td colspan="6" style="font-style: italic; background-color: #fff3cd;">
          Suspicious charges: ${flaggedCharges.map(fc =>
            `${fc.cpt_code} (${fc.setting}): $${fc.billedCharges.toFixed(0)} > $${fc.medianNegotiated.toFixed(0)} (${fc.percentAbove}% above)`
          ).join("; ")}
        </td>
      `;
      pivotBody.appendChild(flaggedTr);
    }

    return { displayedCodes: Array.from(displayedCodes), flaggedCharges };
  }

  async function render(filterValue = settingFilter?.value || "") {
    const result = await buildTable(filterValue);
    window.flaggedCharges = result.flaggedCharges;
    // Removed automatic addVisitSummary()
  }

  await render();

  if (settingFilter) {
    settingFilter.addEventListener("change", async () => {
      await render(settingFilter.value);
    });
  }
}

// --- Medicare toggle & init ---
function initTableControls() {
  const toggle = document.getElementById("nonMedicareToggle");
  const table = document.getElementById("resultsTable");

  if (toggle && table) {
    toggle.addEventListener("change", () => {
      const rows = Array.from(table.tBodies[0].rows);
      const hospitalSelect = document.getElementById("hospital");
      const selectedHospital = hospitalSelect ? hospitalSelect.value.trim() : "";

      rows.forEach((row) => {
        const planName = row.cells[6].innerText.trim().toLowerCase();
        if (toggle.checked) {
          let showRow = true;
          if (selectedHospital === "nch_data") showRow = planName === "all products";
          else showRow = !planName.includes("medicare") && !planName.includes("medicaid");
          row.style.display = showRow ? "" : "none";
        } else row.style.display = "";
      });
    });
  }
}

// --- Generate Visit Summary Button ---
document.getElementById("generateVisitSummaryBtn")?.addEventListener("click", async () => {
  const pivotBody = document.querySelector("#pivot-table tbody");
  const button = document.getElementById("generateVisitSummaryBtn");
  const summaryContainer = document.getElementById("visit-summary-container");

  if (!pivotBody || !summaryContainer || !button) return;

  // Collect all CPT codes currently displayed in the pivot table
  const displayedCodes = Array.from(pivotBody.querySelectorAll("tr"))
    .map(tr => tr.cells[0]?.innerText)
    .filter(code => code && code.trim() !== "");

  if (displayedCodes.length === 0) {
    alert("No CPT codes available for summary.");
    return;
  }

  // Disable button while generating
  button.disabled = true;
  summaryContainer.textContent = "Generating summary...";

  try {
    const summary = await getVisitSummary(displayedCodes);
    summaryContainer.textContent = summary;

    // Hide the button now that summary is generated
    button.style.display = "none";
  } catch (err) {
    console.error("Error generating visit summary:", err);
    summaryContainer.textContent = "Error generating visit summary.";
    button.disabled = false; // re-enable if error
  }
});


// --- Generate Letter Button ---
document.getElementById("generateLetterBtn")?.addEventListener("click", async () => {
  const button = document.getElementById("generateLetterBtn");
  const letterContainer = document.getElementById("letterOutput"); // updated to match EJS

  if (!button || !letterContainer) return;

  if (!window.flaggedCharges || window.flaggedCharges.length === 0) {
    alert("No flagged charges to generate a letter.");
    return;
  }

  // Update button state
  button.disabled = true;
  button.textContent = "Generating Letter...";
  letterContainer.textContent = "Generating letter...";

  try {
    const res = await fetch("/api/generate-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flaggedCharges: window.flaggedCharges }),
    });

    if (!res.ok) throw new Error("Failed to generate letter");

    const data = await res.json();
    const letter = data.letter || "No letter generated.";

    // Display letter
    letterContainer.textContent = letter;

    // Show Export button
    const exportBtn = document.getElementById("export-letter-btn"); // updated to match EJS
    if (exportBtn) {
      exportBtn.style.display = "inline-block";
    }

    // Reset button text
    button.textContent = "Generate Letter";
    button.disabled = false;

  } catch (err) {
    console.error("Error generating letter:", err);
    letterContainer.textContent = "Error generating letter.";
    button.disabled = false;
    button.textContent = "Generate Letter";
  }
});

// --- Export Letter Button ---
document.getElementById("export-letter-btn")?.addEventListener("click", () => {
  const letterContainer = document.getElementById("letterOutput"); // updated to match EJS
  if (!letterContainer) return;

  const text = letterContainer.textContent;
  if (!text) return;

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "billing_letter.txt";
  a.click();
  URL.revokeObjectURL(url);
});
// --- Initialize everything ---
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.pivotData) return;

  if (window.showBilledCharges) {
    await renderComparePivotTable(window.pivotData);
  } else {
    await renderPivotTable(window.pivotData);
  }

  initTableControls();
});