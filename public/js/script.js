let sortDirections = {};

// Sort function
function sortTable(n) {
  const table = document.querySelector("#resultsTable");
  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);

  sortDirections[n] = !sortDirections[n];
  const direction = sortDirections[n] ? 1 : -1;

  rows.sort((a, b) => {
    const valA = a.cells[n].innerText.replace(/[^0-9.-]+/g, "");
    const valB = b.cells[n].innerText.replace(/[^0-9.-]+/g, "");

    const numA = parseFloat(valA);
    const numB = parseFloat(valB);

    if (!isNaN(numA) && !isNaN(numB)) {
      return (numA - numB) * direction;
    } else {
      return a.cells[n].innerText.localeCompare(b.cells[n].innerText) * direction;
    }
  });

  rows.forEach(row => tbody.appendChild(row));

  // Reset icons
  document.querySelectorAll("th i").forEach(i => {
    i.className = "bi bi-arrow-down-up";
  });

  const icon = table.querySelectorAll("th i")[n];
  icon.className = sortDirections[n] ? "bi bi-arrow-down" : "bi bi-arrow-up";
}

// Filter toggle, export, and DOM ready
document.addEventListener("DOMContentLoaded", () => {
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
  
          if (selectedHospital === "nch_data") {
            // For NCH: show only "All Products"
            showRow = planName === "all products";
          } else {
            // For OSU & Riverside: hide Medicare or Medicaid (any case)
            showRow = !planName.includes("medicare") && !planName.includes("medicaid");
          }
  
          row.style.display = showRow ? "" : "none";
        } else {
          // Toggle off → show all rows again
          row.style.display = "";
        }
      });
    });
  }

  if (exportBtn && table) {
    exportBtn.addEventListener("click", () => {
      const rows = Array.from(table.rows).filter(row => row.style.display !== "none");
      const csvContent = rows.map(r =>
        Array.from(r.cells).map(c => `"${c.innerText.replace(/"/g, '""')}"`).join(",")
      ).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "search_results.csv";
      link.click();
    });
  }
});

// single, robust median function (filters null/NaN/<=0)
function median(values) {
  const cleaned = values
    .filter(v => v != null && !isNaN(v))    // drop null/undefined/NaN
    .map(Number)                            // ensure numbers
    .filter(v => v > 0);                    // drop zeros and negatives

  if (!cleaned.length) return 0;

  cleaned.sort((a, b) => a - b);
  const mid = Math.floor(cleaned.length / 2);
  return cleaned.length % 2 !== 0
    ? cleaned[mid]
    : (cleaned[mid - 1] + cleaned[mid]) / 2;
}

// pivot table with setting filter + total row
document.addEventListener("DOMContentLoaded", () => {
  const pivotTableBody = document.querySelector("#pivot-table tbody");
  const settingFilter = document.querySelector("#setting-filter");

  if (!window.pivotData || !pivotTableBody) return;

  function buildPivot(data, filterSetting = "") {
    const grouped = {};
    let totalStandard = 0;
    let totalNegotiated = 0;

    data.forEach(item => {
      const setting = (item.setting || "unknown").toString();
      if (filterSetting && setting !== filterSetting) return;

      const key = `${item.cpt_code || "unknown"}||${setting}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    // sort keys so table is stable (by cpt, then setting)
    const keys = Object.keys(grouped).sort((a, b) => {
      const [aCode, aSetting] = a.split("||");
      const [bCode, bSetting] = b.split("||");
      if (aCode === bCode) return aSetting.localeCompare(bSetting);
      return aCode.localeCompare(bCode, undefined, {numeric: true});
    });

    pivotTableBody.innerHTML = "";

    keys.forEach(key => {
      const group = grouped[key];
      const [code, setting] = key.split("||");

      // IMPORTANT: do not coerce to 0 here; let median drop bad values
      const standardMedian = median(group.map(x => parseFloat(x.standard_charge)));

      const negotiatedValues = group.map(x => {
        const negotiated = parseFloat(x.negotiated_charge);
        const standard = parseFloat(x.standard_charge);
        
        if (!isNaN(negotiated) && negotiated > 0) {
          return negotiated;
        } else if (!isNaN(standard) && standard > 0) {
          return standard * 0.9; // 10% off fallback
        } else {
          return 0;
        }
      });

      const negotiatedMedian = median(negotiatedValues);

      totalStandard += standardMedian;
      totalNegotiated += negotiatedMedian;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${code}</td>
        <td>${setting}</td>
        <td>$${standardMedian ? standardMedian.toFixed(0) : "—"}</td>
        <td>$${negotiatedMedian ? negotiatedMedian.toFixed(0) : "—"}</td>
      `;
      pivotTableBody.appendChild(row);
    });

    // Add total row (sum of medians)
    const totalRow = document.createElement("tr");
    totalRow.classList.add("table-secondary");
    totalRow.innerHTML = `
      <td><strong>Total</strong></td>
      <td></td>
      <td><strong>$${totalStandard ? totalStandard.toFixed(0) : "0"}</strong></td>
      <td><strong>$${totalNegotiated ? totalNegotiated.toFixed(0) : "0"}</strong></td>
    `;
    pivotTableBody.appendChild(totalRow);
  }

  // Initial build (no filter)
  buildPivot(window.pivotData);

  // Rebuild when dropdown changes (if present)
  if (settingFilter) {
    settingFilter.addEventListener("change", () => {
      buildPivot(window.pivotData, settingFilter.value);
    });
  }
});