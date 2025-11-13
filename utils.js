// --- Median helper ---
function median(values) {
  // Only include numbers > 0
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

module.exports = { median };