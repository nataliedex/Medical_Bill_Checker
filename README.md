## Medical Billing & Pricing Transparency Tool

This project is an interactive web application built with Node.js, Express, and EJS that allows users to explore, analyze, and generate summaries of medical billing and pricing data across multiple hospitals. The tool provides a clean interface to search CPT codes, filter by plan type, view median and negotiated charge summaries, and even generate letters for billing clarifications.

---

## 🎥 Demo Video
[▶️ Watch the demo here](https://youtu.be/7LofkcbPovo)

---

## 🧠 About the Project

In compliance with federal hospital price transparency requirements, hospitals publish their standard and negotiated charge data.
This project takes that dataset and presents it in a user-friendly, searchable web interface designed for:
	•	Patients and families comparing healthcare costs
	•	Researchers exploring pricing variation
	•	Developers and analysts experimenting with health cost data tools

Users can:
	•	Enter one or more CPT codes to see all matching pricing details
	•	Filter to show non-Medicare (“All Products”) plans only using a toggle
	•	View a summary table with median standard and negotiated charges
	•	Sort, filter, and export data to Excel for deeper analysis
	•	Generate billing clarification letters for flagged charges or personal disputes 

---

## 🖼️ Features

✅ Search multiple CPT codes at once
✅ Toggle to show or hide non-Medicare data
✅ Interactive, sortable results table
✅ Auto-generated pivot summary table with median values
✅ Generate billing letters with flagged and dispute-only charges
✅ One-click Excel export
✅ Clean Bootstrap UI

---

## 💻 Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | HTML, CSS (Bootstrap), JavaScript |
| Backend | Node.js, Express.js |
| Template Engine | EJS |
| Data | Pricing Transparency dataset from:  Nationwide Children's Hospital, Cleveland Clinic Main Campus,  OSU Medical Center, Riverside Methodist, Mount Carmel Dubln|
| Export | JavaScript Blob + Excel-compatible CSV |

---


