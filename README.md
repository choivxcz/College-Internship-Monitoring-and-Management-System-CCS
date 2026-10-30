# College Internship Monitoring and Management System

## Overview

The College Internship Monitoring and Management System (College Internship Hub) is a web-based prototype intended for the internship coordinators of LSPU-SCC. It consolidates the records involved in supervising student internships, namely placements, applications, required documents, and rendered hours, into a single workspace.

The current version is a front-end prototype that operates on sample data. The back-end service (`backend/`) has not yet been implemented, and the sign-in screen is a demonstration that does not perform authentication. All names, organizations, and figures shown in the prototype are fictitious.

![Internship overview](docs/overview.jpg)

## Objectives

1. To give coordinators a single view of each student's placement status, from application to completion.
2. To track the submission and verification of required internship documents.
3. To monitor rendered hours, attendance, and weekly accomplishments throughout the internship period.

## Features

1. Overview dashboard. A placement pipeline (not applied, applying, accepted, interning, completed) in which each stage filters the application register, together with a list of students who require follow-up.
2. Student profiles and application register. Records can be searched, filtered, and paginated, and the filtered rows can be exported as a CSV file.
3. Document verification. Each student has a checklist of requirements, with space for the coordinator's remarks.
4. Progress monitoring. Rendered hours, attendance logs, weekly accomplishments, and adviser remarks are recorded per student.
5. Keyboard support. Ctrl + K opens the quick search, and Esc closes any open dialog.

| Progress monitoring | Document verification |
|---|---|
| ![Progress monitoring](docs/progress-monitoring.jpg) | ![Document verification](docs/documents.jpg) |

## Technologies Used

- React
- TypeScript
- Vite
- lucide-react (icons)

## Installation and Usage

Node.js 18 or later is required.

```bash
cd frontend
npm install
npm run dev
```

The development server runs at http://localhost:5173. On the sign-in screen, select Admin and enter any ID and password to open the coordinator dashboard.

To type-check and produce a production build in `frontend/dist`:

```bash
npm run build
```

## Repository Structure

```
frontend/   React and TypeScript client (pages, layout, components, styles)
backend/    Reserved for the server application (not yet implemented)
docs/       Screenshots used in this document
```

## Author

Karl Sebastian V. Cuerdo
