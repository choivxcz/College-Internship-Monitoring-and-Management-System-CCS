
import {
  Users,
  BriefcaseBusiness,
  FileCheck2,
  Clock3,
  ChartNoAxesCombined,
  Search,
  Plus,
  ArrowUpRight,
  ClipboardList,
} from "lucide-react";
import "./module-page.css";

type ModulePageProps = {
  active: string;
};

const moduleDetails: Record<
  string,
  {
    subtitle: string;
    description: string;
    cards: { label: string; value: string; detail: string }[];
    columns: string[];
    rows: string[][];
  }
> = {
  "Student profiles": {
    subtitle: "STUDENT MANAGEMENT",
    description: "View and organize student internship profiles.",
    cards: [
      { label: "Enrolled students", value: "240", detail: "Across 3 programs" },
      { label: "Currently interning", value: "126", detail: "Active placements" },
      { label: "For verification", value: "18", detail: "Sample records" },
    ],
    columns: ["Student", "Student ID", "Program", "Status"],
    rows: [
      ["Paolo Villanueva", "2023-0147", "BSIT 4A", "Interning"],
      ["Janell Tagayun", "2023-0214", "BSIT 4A", "Accepted"],
      ["Marciano Salazar", "2023-0307", "BSIT 4B", "Applying"],
    ],
  },
  Applications: {
    subtitle: "PLACEMENT MANAGEMENT",
    description: "Track applications and placement decisions.",
    cards: [
      { label: "Total applications", value: "312", detail: "Sample count" },
      { label: "Under review", value: "42", detail: "Awaiting review" },
      { label: "Accepted", value: "18", detail: "Sample count" },
    ],
    columns: ["Student", "Organization", "Position", "Status"],
    rows: [
      ["Paolo Villanueva", "BrightPath Technologies", "Software Dev. Intern", "Interning"],
      ["Janell Tagayun", "Nexa Digital Studio", "Frontend Intern", "Accepted"],
      ["Marciano Salazar", "Orbit Solutions", "QA Intern", "Applying"],
    ],
  },
  Documents: {
    subtitle: "DOCUMENT MANAGEMENT",
    description: "Review internship requirements and their verification status.",
    cards: [
      { label: "Submitted", value: "186", detail: "Sample count" },
      { label: "Pending review", value: "38", detail: "Needs attention" },
      { label: "Verified", value: "148", detail: "Sample count" },
    ],
    columns: ["Student", "Requirement", "Submission date", "Status"],
    rows: [
      ["Paolo Villanueva", "Learning agreement", "Oct 10, 2026", "For review"],
      ["Janell Tagayun", "Parent consent", "Oct 11, 2026", "Verified"],
      ["Marciano Salazar", "Medical certificate", "Oct 12, 2026", "Pending"],
    ],
  },
  "Progress monitoring": {
    subtitle: "INTERNSHIP HOURS",
    description: "Monitor rendered hours, progress, and students who need follow-up.",
    cards: [
      { label: "Currently monitored", value: "126", detail: "Sample count" },
      { label: "On track", value: "104", detail: "Sample count" },
      { label: "Needs follow-up", value: "22", detail: "Sample count" },
    ],
    columns: ["Student", "Required hours", "Rendered hours", "Progress"],
    rows: [
      ["Paolo Villanueva", "486", "320", "66%"],
      ["Janell Tagayun", "486", "410", "84%"],
      ["Marciano Salazar", "486", "120", "25%"],
    ],
  },
  "Monitoring & reports": {
    subtitle: "EVALUATION & REPORTING",
    description: "Review internship outcomes and prepare monitoring summaries.",
    cards: [
      { label: "For evaluation", value: "24", detail: "Sample count" },
      { label: "Completed", value: "30", detail: "Sample count" },
      { label: "Reports available", value: "6", detail: "Demo summaries" },
    ],
    columns: ["Student", "Program", "Evaluation", "Completion"],
    rows: [
      ["Paolo Villanueva", "BSIT 4A", "Pending", "In progress"],
      ["Janell Tagayun", "BSIT 4A", "For review", "In progress"],
      ["Christian Mer Cuala", "BSIT 4A", "Completed", "Completed"],
    ],
  },
};

const icons: Record<string, typeof Users> = {
  "Student profiles": Users,
  Applications: BriefcaseBusiness,
  Documents: FileCheck2,
  "Progress monitoring": Clock3,
  "Monitoring & reports": ChartNoAxesCombined,
};

export default function ModulePage({ active }: ModulePageProps) {
  const details = moduleDetails[active];
  const Icon = icons[active] ?? ClipboardList;

  if (!details) {
    return (
      <section className="module-page">
        <h1>{active}</h1>
        <p>This section is not configured yet.</p>
      </section>
    );
  }

  return (
    <section className="module-page">
      <div className="module-page-heading">
        <div>
          <span className="module-eyebrow">
            <Icon size={14} />
            {details.subtitle}
          </span>
          <h1>{active}</h1>
          <p>{details.description}</p>
        </div>

        <button
          className="module-action-button"
          type="button"
          onClick={() =>
            window.alert(
              "This action is a frontend demo. Add the backend before saving real records."
            )
          }
        >
          <Plus size={15} />
          Add new
        </button>
      </div>

      <div className="module-summary-grid">
        {details.cards.map((card) => (
          <article className="module-summary-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>

      <section className="module-table-panel">
        <div className="module-table-heading">
          <div>
            <h2>{active} register</h2>
            <p>Example data for layout testing only</p>
          </div>
          <button
            className="module-secondary-button"
            type="button"
            onClick={() =>
              window.alert("Search and database integration will be added next.")
            }
          >
            <Search size={14} />
            Search
          </button>
        </div>

        <div className="module-table-scroll">
          <table>
            <thead>
              <tr>
                {details.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {details.rows.map((row, rowIndex) => (
                <tr key={`${active}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`}>
                      {cellIndex === row.length - 1 ? (
                        <span className="module-status">{cell}</span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="module-table-footer">
          <span>{details.rows.length} demo records shown</span>
          <span>
            Preview only <ArrowUpRight size={12} />
          </span>
        </div>
      </section>

      <p className="module-demo-note">
        <ClipboardList size={14} />
        These are placeholder records, not live student information. Database
        storage, search, and saving will be implemented when the backend is ready.
      </p>
    </section>
  );
}
