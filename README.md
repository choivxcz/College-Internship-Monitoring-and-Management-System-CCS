# College Internship Monitoring and Management System

## Overview

The College Internship Monitoring and Management System (College Internship Hub) is a web-based prototype intended for the internship coordinators of LSPU-SCC. It consolidates the records involved in supervising student internships, namely placements, applications, required documents, and rendered hours, into a single workspace.

The system includes a React frontend and an Express backend. Local development uses SQLite, so a separate database server is not required.

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

Node.js 22 or later is required.

Install dependencies in both applications:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` and set `ADMIN_PASSWORD` to a password with at least 10 characters. Then initialize the database and create the administrator account:

```powershell
npm run db:migrate
npm run db:seed
```

Start the backend in one terminal:

```powershell
cd backend
npm run dev
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Select Admin and sign in with the email and password configured in `backend/.env`. The frontend proxies `/api` requests to the backend at http://127.0.0.1:3001.

To type-check and produce a production build in `frontend/dist`:

```bash
npm run build
```

## Repository Structure

```
frontend/   React and TypeScript client (pages, layout, components, styles)
backend/    Express API, SQLite/MySQL persistence, migrations, and seed scripts
docs/       Screenshots used in this document
```

## Author

Karl Sebastian V. Cuerdo
