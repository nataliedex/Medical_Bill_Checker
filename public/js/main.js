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
  // Fetch all codes concurrently
  await Promise.all(codes.map(async (code) => {
    descriptions[code] = await getCPTDescription(code);
  }));
  return descriptions;
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
    else return a.cells[n].innerText.localeCompare(b.cells[n].innerText) * direction;
  });

  rows.forEach(row => tbody.appendChild(row));

  table.querySelectorAll("th i").forEach(i => i.className = "bi bi-arrow-down-up");
  table.querySelectorAll("th i")[n].className = sortDirections[n] ? "bi bi-arrow-down" : "bi bi-arrow-up";
}

// --- Median helper ---
function median(values) {
  const cleaned = values.filter(v => v != null && !isNaN(v)).map(Number).filter(v => v > 0);
  if (!cleaned.length) return 0;
  cleaned.sort((a, b) => a - b);
  const mid = Math.floor(cleaned.length / 2);
  return cleaned.length % 2 !== 0 ? cleaned[mid] : (cleaned[mid - 1] + cleaned[mid]) / 2;
}

// --- Pivot table rendering ---
async function renderPivotTable(data) {
  const pivotBody = document.querySelector("#pivot-table tbody");
  const settingFilter = document.querySelector("#setting-filter");
  if (!pivotBody) return;

  const uniqueCPTs = [...new Set(data.map(item => item.cpt_code))];
  const descriptions = await getMultipleCPTDescriptions(uniqueCPTs);

  function buildTable(filterSetting = "") {
    pivotBody.innerHTML = "";

    const grouped = {};
    data.forEach(item => {
      const setting = item.setting || "unknown";
      if (filterSetting && setting !== filterSetting) return;
      const key = `${item.cpt_code}||${setting}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    Object.keys(grouped).sort().forEach(key => {
      const items = grouped[key];
      const [code, setting] = key.split("||");

      const standardMedian = median(items.map(x => Number(x.standard_charge)));
      const negotiatedValues = items.map(x => {
        const negotiated = Number(x.negotiated_charge);
        const cash = Number(x.standard_cash_charge);
        const standard = Number(x.standard_charge);
        return negotiated > 0 ? negotiated : cash > 0 ? cash : standard * 0.9;
      });
      const negotiatedMedian = median(negotiatedValues);

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
  }

  buildTable();

  if (settingFilter) {
    settingFilter.addEventListener("change", () => {
      buildTable(settingFilter.value);
    });
  }
}

// --- Export & toggle ---
function initTableControls() {
  const toggle = document.getElementById("nonMedicareToggle");
  const table = document.getElementById("resultsTable");
  const exportBtn = document.getElementById("exportBtn");

  if (toggle && table) {
    toggle.addEventListener("change", () => {
      const rows = Array.from(table.tBodies[0].rows);
      const hospitalSelect = document.getElementById("hospital");
      const selectedHospital = hospitalSelect ? hospitalSelect.value.trim() : "";

      rows.forEach(row => {
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

  if (exportBtn && table) {
    exportBtn.addEventListener("click", () => {
      const rows = Array.from(table.rows).filter(r => r.style.display !== "none");
      const csvContent = rows.map(r => Array.from(r.cells).map(c => `"${c.innerText.replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "search_results.csv";
      link.click();
    });
  }
}

// --- Initialize everything ---
document.addEventListener("DOMContentLoaded", () => {
  if (window.pivotData) renderPivotTable(window.pivotData);
  initTableControls();
});