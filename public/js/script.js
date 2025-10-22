let sortDirections = {};

// Sort function
function sortTable(n) {
    const table = document.querySelector("#resultsTable");
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);

    sortDirections[n] = !sortDirections[n];
    const direction = sortDirections[n] ? 1 : -1;

    // Keep all rows together by CPT code if needed
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

// Filter toggle
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("nonMedicareToggle");
    const table = document.getElementById("resultsTable");

    toggle.addEventListener("change", () => {
        const rows = Array.from(table.tBodies[0].rows);

        rows.forEach(row => {
            const planName = row.cells[5].innerText; // Plan Name column
            if (toggle.checked) {
                // Hide Medicare rows, show "All Products"
                row.style.display = planName === "All Products" ? "" : "none";
            } else {
                // Show all rows
                row.style.display = "";
            }
        });
    });

    // Export button
    const exportBtn = document.getElementById("exportBtn");
    exportBtn.addEventListener("click", () => {
        const rows = Array.from(table.rows).filter(row => row.style.display !== "none");
        const csvContent = rows.map(r =>
            Array.from(r.cells).map(c => `"${c.innerText}"`).join(",")
        ).join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "search_results.csv";
        link.click();
    });
});

function median(arr) {
    const sorted = arr.slice().sort((a,b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}


// convert the information to a pivot table
document.addEventListener("DOMContentLoaded", () => {
    const pivotTableBody = document.querySelector("#pivot-table tbody");
  
    if (!window.pivotData || !pivotTableBody) return;
  
    // Function to calculate median
    function median(values) {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }
  
    function buildPivot(data) {
      // Group by CPT code
      const grouped = {};
      data.forEach(item => {
        if (!grouped[item.cpt_code]) grouped[item.cpt_code] = [];
        grouped[item.cpt_code].push(item);
      });
  
      // Clear existing rows
      pivotTableBody.innerHTML = "";

        let totalStandard = 0;
        let totalNegotiated = 0;
  
      // Build rows
      Object.keys(grouped).forEach(code => {
        const group = grouped[code];
        const standardMedian = median(group.map(x => parseFloat(x.standard_charge) || 0));
        const negotiatedMedian = median(group.map(x => parseFloat(x.negotiated_charge) || 0));

        totalStandard += standardMedian;
        totalNegotiated += negotiatedMedian;
  
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${code}</td>
          <td>$${standardMedian.toFixed(0)}</td>
          <td>$${negotiatedMedian.toFixed(0)}</td>
        `;
        pivotTableBody.appendChild(row);
      });

      const totalRow = document.createElement("tr");
      totalRow.classList.add("table-secondary");
      totalRow.innerHTML = `
        <td><strong>Total</strong></td>
        <td><strong>$${totalStandard.toFixed(0)}</strong></td>
        <td><strong>$${totalNegotiated.toFixed(0)}</strong></td>
      `;
      pivotTableBody.appendChild(totalRow);
    }
  
    buildPivot(window.pivotData);
  
    // Optional: listen for toggle (medicare / non-medicare) or other filters
    const toggle = document.querySelector("#nonMedicareToggle");
    if (toggle) {
      toggle.addEventListener("change", () => {
        const filtered = toggle.checked
          ? window.pivotData.filter(item => item.plan_name === "All Products")
          : window.pivotData;
        buildPivot(filtered);
      });
    }
  });