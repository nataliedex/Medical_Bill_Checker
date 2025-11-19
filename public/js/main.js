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
  await Promise.all(codes.map(async code => {
    descriptions[code] = await getCPTDescription(code);
  }));
  return descriptions;
}

// --- Fetch visit summary ---
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

  rows.forEach(row => tbody.appendChild(row));
  table.querySelectorAll("th i").forEach(i => i.className = "bi bi-arrow-down-up");
  table.querySelectorAll("th i")[n].className = sortDirections[n] ? "bi bi-arrow-down" : "bi bi-arrow-up";
}

// --- Pivot Table Rendering ---
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
  }

  await render();

  if (settingFilter) {
    settingFilter.addEventListener("change", async () => await render(settingFilter.value));
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

    let totalStandard = 0, totalNegotiated = 0, totalBilled = 0;

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
  <td class="dispute-cell" style="vertical-align:top;">
    <input type="checkbox" class="dispute-checkbox" aria-label="Dispute this charge">
  </td>
  <td>${cpt_code}</td>
  <td>${descriptions[cpt_code] || ""}</td>
  <td>${setting}</td>
  <td>$${medianStandard != null ? medianStandard.toFixed(0) : '0'}</td>
  <td>$${medianNegotiated != null ? medianNegotiated.toFixed(0) : '0'}</td>
  <td>${billedCharges != null ? `$${billedCharges.toFixed(0)}` : '<span class="text-muted">N/A</span>'}</td>
`;
pivotBody.appendChild(tr);


   

    // Add dispute note row on checkbox toggle
const checkbox = tr.querySelector(".dispute-checkbox");
if (checkbox) {
  checkbox.addEventListener("change", (e) => {

    // Remove an existing dispute-note-row if present
    let existingNoteRow = tr.nextElementSibling;
    if (existingNoteRow && existingNoteRow.classList.contains("dispute-note-row")) {
      existingNoteRow.remove();
    }

    // If checked, insert the dispute textarea row
    if (e.target.checked) {
      const noteRow = document.createElement("tr");
      noteRow.classList.add("dispute-note-row");

      const colspan = tr.children.length;

      noteRow.innerHTML = `
        <td colspan="${colspan}" style="background-color:#f9f9f9; padding:12px;">
          <label class="fw-bold">Add clarification for CPT ${cpt_code}:</label>
          <textarea class="form-control mt-2 dispute-note-text"
            rows="3"
            placeholder="Explain why this charge is incorrect or requires review..."></textarea>
        </td>
      `;

      tr.insertAdjacentElement("afterend", noteRow);
    }
  });
}



      totalStandard += medianStandard || 0;
      totalNegotiated += medianNegotiated || 0;
      totalBilled += billedCharges || 0;
    });

    // Total row
    const totalRow = document.createElement("tr");
    totalRow.style.fontWeight = "bold";
    totalRow.style.backgroundColor = "#f0f0f0";
    totalRow.innerHTML = `
      <td colspan="4" style="text-align:right;">Total:</td>
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
        <td colspan="7" style="font-style: italic; background-color: #fff3cd;">
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
  }

  await render();

  if (settingFilter) {
    settingFilter.addEventListener("change", async () => await render(settingFilter.value));
  }
}

// helper function to gather dispute notes
function gatherDisputeNotes() {
  const rows = document.querySelectorAll(".pivot-data-row");

  const notes = {};

  rows.forEach(row => {
    const checkbox = row.querySelector(".dispute-checkbox");
    if (!checkbox || !checkbox.checked) return;

    const cpt = row.children[1].textContent.trim();

    const noteRow = row.nextElementSibling;
    if (noteRow && noteRow.classList.contains("dispute-note-row")) {
      const text = noteRow.querySelector(".dispute-note-text")?.value.trim() || "";
      notes[cpt] = text;
    }
  });

  return notes;
}

// --- Medicare / Medicaid Toggle for RAW DATA only ---
function initRawTableToggle() {
  const toggle = document.getElementById("nonMedicareToggle");
  const hospitalSelect = document.getElementById("hospital");
  const rawTables = document.querySelectorAll("table#resultsTable"); // works for index + compare

  if (!toggle || rawTables.length === 0) return;

  toggle.addEventListener("change", () => {
    const selectedHospital = hospitalSelect ? hospitalSelect.value : "";

    rawTables.forEach(table => {
      const rows = Array.from(table.tBodies[0].rows);

      rows.forEach(row => {
        // IMPORTANT:
        // Raw table columns:
        // 0 = CPT
        // 1 = Setting
        // 2 = Standard
        // 3 = Negotiated
        // 4 = Payer
        // 5 = Plan Name   <--- THIS is what we filter on

        const planName = row.cells[5].innerText.trim().toLowerCase();

        if (!toggle.checked) {
          // Toggle OFF → show all rows
          row.style.display = "";
          return;
        }

        // Toggle ON → hide medicare + medicaid unless this hospital has a special rule
        let shouldShow = true;

        if (selectedHospital === "nch_data") {
          // NCH uses ONLY "All Products"
          shouldShow = planName === "all products";
        } else {
          // Everyone else: exclude medicare/medicaid
          shouldShow = !planName.includes("medicare") && !planName.includes("medicaid");
        }

        row.style.display = shouldShow ? "" : "none";
      });
    });
  });
}


// --- Export table to CSV ---
function exportTableToCSV(table, filename = "raw_data.csv") {
  if (!table) return alert("No table found to export.");

  const rows = Array.from(table.rows);
  const csv = rows.map(row => {
    const cells = Array.from(row.cells);
    return cells.map(cell => `"${cell.innerText.replace(/"/g, '""')}"`).join(",");
  }).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



// --- Initialize everything ---
document.addEventListener("DOMContentLoaded", async () => {
  // --- Pivot table rendering ---
  if (window.pivotData) {
    if (window.showBilledCharges) {
      await renderComparePivotTable(window.pivotData);
      // insertNoteRowIntoPivot();
    } else {
      await renderPivotTable(window.pivotData);
    }
  }

  // --- Raw table toggle ---
  initRawTableToggle();

  // --- Export buttons for each table ---
  // --- Export buttons ---
  document.querySelectorAll(".export-btn").forEach(button => {
    // remove any previous listeners just in case
    button.replaceWith(button.cloneNode(true));
  });
  document.querySelectorAll(".export-btn").forEach(button => {
    button.addEventListener("click", () => {
      const card = button.closest(".card"); // find the wrapping card
      const table = card.querySelector("#resultsTable");
      exportTableToCSV(table, "raw_data.csv");
    });
  });

  // --- Generate Visit Summary ---

  const visitSummaryBtn = document.getElementById("generateVisitSummaryBtn");

  if (visitSummaryBtn) {
    visitSummaryBtn.addEventListener("click", async () => {
      const tableBody = document.querySelector("#pivot-table tbody");
      if (!tableBody) return alert("No pivot table found to generate summary.");
  
      const rows = Array.from(tableBody.querySelectorAll("tr"));
      const dataRows = rows.filter(row => row.querySelector("td") && !row.classList.contains("total-row"));
  
      if (!dataRows.length) return alert("No CPT rows found in the table.");
  
      let cptIndex = 0;
      if (dataRows[0].querySelector("input.dispute-checkbox")) {
        cptIndex = 1; // CPT code is second cell if dispute column exists
      }
  
      const codes = dataRows.map(row => {
        const cptTd = row.querySelector("td:not(.dispute-cell");
        return cptTd ? cptTd.innerText.trim() : null;
      }).filter(code => code);
  
      if (!codes.length) return alert("No CPT codes found in the table.");
  
      const container = document.getElementById("visit-summary-container");
      container.innerHTML = `<p>Generating visit summary...</p>`;
  
      try {
        const summary = await getVisitSummary(codes);
        container.innerHTML = `
          <div class="card shadow-sm">
            <div class="card-body">
              <h5>Visit Summary:</h5>
              <p>${summary}</p>
            </div>
          </div>
        `;
  
        // Remove the button after summary is generated
        visitSummaryBtn.remove();
  
      } catch (err) {
        console.error("Error generating visit summary:", err);
        container.innerHTML = `<p class="text-danger">Error generating summary. Please try again.</p>`;
      }
    });
  }

  // --- Generate Letter ---
const generateLetterBtn = document.getElementById("generateLetterBtn");
const letterOutput = document.getElementById("letterOutput");
const generatedLetterPre = document.getElementById("generated-letter");

if (generateLetterBtn && letterOutput && generatedLetterPre) {
  generateLetterBtn.addEventListener("click", async () => {
    letterOutput.textContent = "Generating letter...";
  
    try {
      const disputeNotes = gatherDisputeNotes(); // { "99213": "note text", ... }
  
      // 1️⃣ Start with flagged charges and attach notes
      const fullChargeList = window.flaggedCharges.map(fc => ({
        ...fc,
        disputeNote: disputeNotes[fc.cpt_code] || ""
      }));
  
      // 2️⃣ Include any non-flagged rows that have a dispute note
      document.querySelectorAll(".pivot-data-row").forEach(row => {
        const cpt = row.children[1].textContent.trim();
  
        // Skip if already in fullChargeList or no note exists
        if (fullChargeList.find(item => item.cpt_code === cpt) || !disputeNotes[cpt]) return;
  
        fullChargeList.push({
          cpt_code: cpt,
          description: row.children[2].textContent.trim(),
          billed: parseFloat(row.children[6].textContent.replace(/\$|,/g, '')) || 0,
          negotiated: parseFloat(row.children[5].textContent.replace(/\$|,/g, '')) || 0,
          percentAbove: 0, // non-flagged row
          disputeNote: disputeNotes[cpt]
        });
      });
  
      // 3️⃣ Send to backend
      const res = await fetch("/api/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flaggedCharges: fullChargeList }),
      });
  
      if (!res.ok) {
        const err = await res.json();
        letterOutput.textContent = `Error: ${err.error || res.statusText}`;
        return;
      }
  
      const data = await res.json();
      letterOutput.textContent = data.letter;
      generatedLetterPre.textContent = data.letter;
  
      // Hide Generate Letter button & show export button
      generateLetterBtn.style.display = "none";
      document.querySelectorAll(".export-letter-btn").forEach(btn => btn.style.display = "inline-block");
  
    } catch (err) {
      console.error("Error generating letter:", err);
      letterOutput.textContent = "Error generating letter. See console for details.";
    }
  });

  
}
  
 

});