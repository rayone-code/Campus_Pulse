import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "college_events.db");

export const db = new Database(DB_PATH);

// Enforce foreign keys and enable WAL mode for concurrent reads
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'Attendee'
        CHECK (role IN ('Admin', 'Organizer', 'Attendee')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      department_id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_name TEXT NOT NULL UNIQUE,
      short_code TEXT NOT NULL DEFAULT '',
      branch_name TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS event_categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      event_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      venue TEXT NOT NULL,
      event_type TEXT NOT NULL
        CHECK (event_type IN ('College-wide', 'Department-specific')),
      status TEXT NOT NULL DEFAULT 'Upcoming'
        CHECK (status IN ('Upcoming', 'Ongoing', 'Completed', 'Cancelled', 'Postponed')),
      registration_url TEXT NOT NULL,
      poster_url TEXT NULL,
      organizer_id INTEGER NOT NULL,
      department_id INTEGER NULL,
      category_id INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organizer_id) REFERENCES users (user_id) ON DELETE RESTRICT,
      FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES event_categories (category_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS ix_events_event_date ON events (event_date);
    CREATE INDEX IF NOT EXISTS ix_events_status ON events (status);
    CREATE INDEX IF NOT EXISTS ix_events_event_type ON events (event_type);
    CREATE INDEX IF NOT EXISTS ix_events_organizer_id ON events (organizer_id);
    CREATE INDEX IF NOT EXISTS ix_events_department_id ON events (department_id);

    CREATE TABLE IF NOT EXISTS department_access (
      access_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      access_code_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (event_id, department_id),
      FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE RESTRICT
    );
  `);

  ensureDepartmentColumns();
  ensureUserAuthColumns();
  seedInitialData();
  ensureSeededCredentials();
}

export const SEEDED_STUDENTS = [
  {
    name: "Ananya Joshi",
    shortCode: "SCSIT",
    enrollmentNo: "2025SCSIT014",
    email: "ananya.joshi@scsit.davv",
  },
  {
    name: "Rohan Patel",
    shortCode: "SoI",
    enrollmentNo: "2026SOI008",
    email: "rohan.patel@soi.davv",
  },
] as const;

export const SEEDED_STAFF = [
  {
    role: "Organizer" as const,
    loginId: "SCSIT-ORG",
    password: "Organizer@2026",
    name: "SCSIT Event Organizer",
    email: "organizer@scsit.davv",
  },
  {
    role: "Admin" as const,
    loginId: "DAVV-ADMIN",
    password: "Admin@2026",
    name: "DAVV Administrator",
    email: "admin@davv.ac.in",
  },
] as const;

function ensureUserAuthColumns(): void {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("login_id")) db.exec("ALTER TABLE users ADD COLUMN login_id TEXT");
  if (!names.has("password_hash")) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  if (!names.has("enrollment_no")) db.exec("ALTER TABLE users ADD COLUMN enrollment_no TEXT");
  if (!names.has("department_id")) db.exec("ALTER TABLE users ADD COLUMN department_id INTEGER");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ix_users_login_id
      ON users (login_id) WHERE login_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ix_users_enrollment_no
      ON users (enrollment_no) WHERE enrollment_no IS NOT NULL;
  `);
}

function ensureSeededCredentials(): void {
  const departmentReady = db
    .prepare("SELECT COUNT(*) as cnt FROM departments")
    .get() as { cnt: number };
  if (departmentReady.cnt === 0) return;

  const updateStaff = db.prepare(
    "UPDATE users SET login_id = ?, password_hash = ?, name = ?, role = ? WHERE email = ?"
  );
  const insertStaff = db.prepare(
    `INSERT INTO users (google_id, name, email, role, login_id, password_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const staff of SEEDED_STAFF) {
    const hash = bcrypt.hashSync(staff.password, 10);
    const existing = db
      .prepare("SELECT user_id FROM users WHERE email = ?")
      .get(staff.email) as { user_id: number } | undefined;
    if (existing) {
      updateStaff.run(staff.loginId, hash, staff.name, staff.role, staff.email);
    } else {
      insertStaff.run(`seed-${staff.loginId}`, staff.name, staff.email, staff.role, staff.loginId, hash);
    }
  }

  const insertStudent = db.prepare(
    `INSERT INTO users (google_id, name, email, role, enrollment_no, department_id)
     VALUES (?, ?, ?, 'Attendee', ?, ?)`
  );
  const updateStudent = db.prepare(
    `UPDATE users
     SET name = ?, email = ?, role = 'Attendee', department_id = ?
     WHERE enrollment_no = ?`
  );
  for (const student of SEEDED_STUDENTS) {
    const department = db
      .prepare("SELECT department_id FROM departments WHERE short_code = ?")
      .get(student.shortCode) as { department_id: number } | undefined;
    if (!department) continue;
    const existing = db
      .prepare("SELECT user_id FROM users WHERE enrollment_no = ? OR email = ?")
      .get(student.enrollmentNo, student.email) as { user_id: number } | undefined;
    if (existing) {
      updateStudent.run(student.name, student.email, department.department_id, student.enrollmentNo);
      db.prepare(
        "UPDATE users SET enrollment_no = ?, department_id = ? WHERE user_id = ?"
      ).run(student.enrollmentNo, department.department_id, existing.user_id);
    } else {
      insertStudent.run(
        `seed-${student.enrollmentNo}`,
        student.name,
        student.email,
        student.enrollmentNo,
        department.department_id
      );
    }
  }
}

function ensureDepartmentColumns(): void {
  const columns = db.prepare("PRAGMA table_info(departments)").all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("short_code")) {
    db.exec("ALTER TABLE departments ADD COLUMN short_code TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("branch_name")) {
    db.exec("ALTER TABLE departments ADD COLUMN branch_name TEXT NOT NULL DEFAULT ''");
  }
}

/** Paste a real https Google Form URL here before the viva, then delete college_events.db and restart. */
export const DEMO_REGISTRATION_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdDAVVeventsDemoForm/viewform";

const DAVV_PROGRAMMES = [
  {
    department_name: "International Institute of Professional Studies",
    short_code: "IIPS",
    branch_name: "Computer Science",
  },
  {
    department_name: "School of Computer Science & IT",
    short_code: "SCSIT",
    branch_name: "Cybersecurity",
  },
  {
    department_name: "School of Instrumentation",
    short_code: "SoI",
    branch_name: "Internet of Things",
  },
  {
    department_name: "School of Data Science and Forecasting",
    short_code: "SDSF",
    branch_name: "Artificial Intelligence & Data Science",
  },
  {
    department_name: "School of Electronics",
    short_code: "SOEX",
    branch_name: "Electronics",
  },
] as const;

function seedInitialData(): void {
  const existingEvents = db
    .prepare("SELECT COUNT(*) as cnt FROM events")
    .get() as { cnt: number };

  if (existingEvents.cnt > 0) {
    return;
  }

  const insertDept = db.prepare(
    "INSERT OR IGNORE INTO departments (department_name, short_code, branch_name) VALUES (?, ?, ?)"
  );
  for (const programme of DAVV_PROGRAMMES) {
    insertDept.run(programme.department_name, programme.short_code, programme.branch_name);
  }

  const insertCat = db.prepare(
    "INSERT OR IGNORE INTO event_categories (category_name) VALUES (?)"
  );
  const catNames = ["Technical", "Workshop", "Cultural", "Seminar", "Sports"];
  for (const name of catNames) {
    insertCat.run(name);
  }

  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (google_id, name, email, role) VALUES (?, ?, ?, ?)"
  );
  insertUser.run("seed-davv-admin", "DAVV Administrator", "admin@davv.ac.in", "Admin");
  insertUser.run(
    "seed-davv-organizer",
    "SCSIT Event Organizer",
    "organizer@scsit.davv",
    "Organizer"
  );
  insertUser.run("seed-davv-student", "IIPS CS Student", "student.cs@iips.davv", "Attendee");

  const organizer = db
    .prepare("SELECT user_id FROM users WHERE email = ?")
    .get("organizer@scsit.davv") as { user_id: number };

  const departmentId = (shortCode: string) =>
    (
      db
        .prepare("SELECT department_id FROM departments WHERE short_code = ?")
        .get(shortCode) as { department_id: number }
    ).department_id;

  const categoryId = (name: string) =>
    (
      db
        .prepare("SELECT category_id FROM event_categories WHERE category_name = ?")
        .get(name) as { category_id: number }
    ).category_id;

  const insertEvent = db.prepare(`
    INSERT INTO events (
      title, description, event_date, start_time, end_time, venue,
      event_type, status, registration_url, poster_url,
      organizer_id, department_id, category_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seededEvents: Array<{
    title: string;
    description: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    venue: string;
    eventType: "College-wide" | "Department-specific";
    category: string;
    shortCode: string | null;
    accessCode: string | null;
    announcement?: { title: string; message: string };
  }> = [
    {
      title: "DAVV Inter-School Tech Meet",
      description:
        "Students from IIPS, SCSIT, SoI, SDSF, and SOEX present projects and short talks on one stage. Open to every student of Devi Ahilya Vishwavidyalaya, Indore.",
      eventDate: "2026-12-08",
      startTime: "10:00",
      endTime: "16:30",
      venue: "Takshashila Campus Auditorium, Khandwa Road, Indore",
      eventType: "College-wide",
      category: "Technical",
      shortCode: null,
      accessCode: null,
      announcement: {
        title: "Reporting time for the Tech Meet",
        message:
          "Reach the Takshashila Campus auditorium by 9:40 AM. Carry your DAVV identity card for entry.",
      },
    },
    {
      title: "IIPS Coding Sprint",
      description:
        "A timed problem-solving session for the Computer Science batch at the International Institute of Professional Studies. Bring a laptop.",
      eventDate: "2026-11-22",
      startTime: "09:30",
      endTime: "13:00",
      venue: "IIPS Seminar Hall, DAVV Indore",
      eventType: "Department-specific",
      category: "Workshop",
      shortCode: "IIPS",
      accessCode: "CS2026",
    },
    {
      title: "SCSIT Cybersecurity Briefing",
      description:
        "A closed session for the Cybersecurity batch on lab safety, phishing drills, and how to report an incident inside SCSIT.",
      eventDate: "2026-11-27",
      startTime: "14:00",
      endTime: "16:00",
      venue: "SCSIT Lecture Hall, Takshashila Campus",
      eventType: "Department-specific",
      category: "Seminar",
      shortCode: "SCSIT",
      accessCode: "CYBER2026",
      announcement: {
        title: "Keep personal laptops off the lab network",
        message:
          "Do not connect a personal laptop to the SCSIT lab network until the session lead allows it.",
      },
    },
    {
      title: "SoI IoT Lab Session",
      description:
        "Hands-on work with sensors and a small dashboard for the Internet of Things batch at the School of Instrumentation.",
      eventDate: "2026-12-03",
      startTime: "11:00",
      endTime: "15:00",
      venue: "School of Instrumentation Lab, DAVV Indore",
      eventType: "Department-specific",
      category: "Workshop",
      shortCode: "SoI",
      accessCode: "IOT2026",
    },
    {
      title: "SDSF Data Studio",
      description:
        "The Artificial Intelligence and Data Science batch walks through a dataset, a baseline model, and a short presentation at SDSF.",
      eventDate: "2026-12-11",
      startTime: "10:00",
      endTime: "13:30",
      venue: "SDSF Classroom Block, DAVV Indore",
      eventType: "Department-specific",
      category: "Technical",
      shortCode: "SDSF",
      accessCode: "AIDS2026",
    },
    {
      title: "SOEX Circuit Studio",
      description:
        "A bench session on basic analog circuits for the Electronics batch at the School of Electronics.",
      eventDate: "2026-12-16",
      startTime: "14:00",
      endTime: "17:00",
      venue: "School of Electronics Laboratory, DAVV Indore",
      eventType: "Department-specific",
      category: "Workshop",
      shortCode: "SOEX",
      accessCode: "SOEX2026",
    },
  ];

  const insertAccess = db.prepare(
    "INSERT INTO department_access (event_id, department_id, access_code_hash) VALUES (?, ?, ?)"
  );
  const insertAnn = db.prepare(
    "INSERT INTO announcements (event_id, title, message, created_by) VALUES (?, ?, ?, ?)"
  );

  for (const event of seededEvents) {
    const deptId = event.shortCode ? departmentId(event.shortCode) : null;
    const created = insertEvent.run(
      event.title,
      event.description,
      event.eventDate,
      event.startTime,
      event.endTime,
      event.venue,
      event.eventType,
      "Upcoming",
      DEMO_REGISTRATION_URL,
      null,
      organizer.user_id,
      deptId,
      categoryId(event.category)
    );
    if (event.accessCode && deptId) {
      insertAccess.run(created.lastInsertRowid, deptId, bcrypt.hashSync(event.accessCode, 10));
    }
    if (event.announcement) {
      insertAnn.run(
        created.lastInsertRowid,
        event.announcement.title,
        event.announcement.message,
        organizer.user_id
      );
    }
  }
}
