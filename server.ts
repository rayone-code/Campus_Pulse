import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import { db, initializeDatabase, SEEDED_STAFF, SEEDED_STUDENTS } from "./server/db.ts";

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "campuspulse-dev-jwt-secret-change-in-prod";
const JWT_EXPIRATION_SECONDS = Number(process.env.JWT_EXPIRATION_SECONDS || 3600);
const EVENT_ACCESS_EXPIRATION_SECONDS = Number(
  process.env.EVENT_ACCESS_EXPIRATION_SECONDS || 600
);
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "")
  .trim()
  .replace(/^@/, "")
  .toLowerCase();
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "admin@davv.ac.in")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const googleOAuthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

interface UserRow {
  user_id: number;
  google_id: string;
  name: string;
  email: string;
  role: "Admin" | "Organizer" | "Attendee";
  created_at: string;
  login_id?: string | null;
  password_hash?: string | null;
  enrollment_no?: string | null;
  department_id?: number | null;
}

interface EventRow {
  event_id: number;
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  event_type: "College-wide" | "Department-specific";
  status: "Upcoming" | "Ongoing" | "Completed" | "Cancelled" | "Postponed";
  registration_url: string;
  poster_url: string | null;
  organizer_id: number;
  organizer_name?: string;
  department_id: number | null;
  department_name?: string | null;
  department_branch?: string | null;
  department_short_code?: string | null;
  category_id: number | null;
  category_name?: string | null;
  created_at: string;
}

interface AuthenticatedRequest extends Request {
  currentUser?: UserRow;
}

class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const VALID_ROLES = new Set(["Admin", "Organizer", "Attendee"]);
const VALID_EVENT_TYPES = new Set(["College-wide", "Department-specific"]);
const VALID_STATUSES = new Set([
  "Upcoming",
  "Ongoing",
  "Completed",
  "Cancelled",
  "Postponed",
]);

function serializePublicUser(u: UserRow) {
  return {
    user_id: u.user_id,
    name: u.name,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
  };
}

// Intentionally EXCLUDES registration_url (Hard Scope Rule #4)
function serializePublicEvent(ev: EventRow) {
  return {
    event_id: ev.event_id,
    title: ev.title,
    description: ev.description,
    event_date: ev.event_date,
    start_time: ev.start_time,
    end_time: ev.end_time,
    venue: ev.venue,
    event_type: ev.event_type,
    status: ev.status,
    poster_url: ev.poster_url,
    organizer_id: ev.organizer_id,
    organizer_name: ev.organizer_name ?? null,
    department_id: ev.department_id,
    department_name: ev.department_name ?? null,
    department_branch: ev.department_branch ?? null,
    department_short_code: ev.department_short_code ?? null,
    category_id: ev.category_id,
    category_name: ev.category_name ?? null,
    created_at: ev.created_at,
  };
}

function issueAuthJwt(user: UserRow): string {
  return jwt.sign({ sub: String(user.user_id) }, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION_SECONDS,
  });
}

function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    throw new ApiError("Authentication required. Provide a Bearer token.", 401);
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError("Authentication token is empty.", 401);
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError("Session expired. Please sign in again.", 401);
    }
    throw new ApiError("Invalid authentication token.", 401);
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) {
    throw new ApiError("Invalid authentication token subject.", 401);
  }

  // Always reload current role & profile from DB
  const user = db
    .prepare("SELECT * FROM users WHERE user_id = ?")
    .get(userId) as UserRow | undefined;

  if (!user) {
    throw new ApiError("Authenticated user no longer exists.", 401);
  }

  req.currentUser = user;
  next();
}

function requireRole(...allowedRoles: Array<UserRow["role"]>) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const user = req.currentUser;
    if (!user) {
      throw new ApiError("Authentication required.", 401);
    }
    if (!allowedRoles.includes(user.role)) {
      throw new ApiError(
        "Forbidden: you do not have permission to perform this action.",
        403
      );
    }
    next();
  };
}

function validateGoogleFormsUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new ApiError("'registration_url' is required.", 400);
  }
  const cleaned = rawUrl.trim();
  if (cleaned.length > 500) {
    throw new ApiError("'registration_url' must be at most 500 characters.", 400);
  }
  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new ApiError("registration_url must be a valid URL.", 400);
  }

  const host = parsed.hostname.toLowerCase();
  const isDocsForms = host === "docs.google.com" && parsed.pathname.startsWith("/forms");
  const isShortForms =
    host === "forms.gle" && parsed.pathname.replace(/\//g, "").length > 0;

  if (parsed.protocol !== "https:" || (!isDocsForms && !isShortForms)) {
    throw new ApiError(
      "registration_url must be an https Google Forms URL (docs.google.com/forms or forms.gle).",
      400
    );
  }
  return cleaned;
}

function validatePosterUrl(rawUrl: unknown): string | null {
  if (rawUrl === null || rawUrl === undefined) return null;
  if (typeof rawUrl !== "string") {
    throw new ApiError("'poster_url' must be a string URL.", 400);
  }
  const cleaned = rawUrl.trim();
  if (!cleaned) return null;
  if (cleaned.length > 500) {
    throw new ApiError("'poster_url' must be at most 500 characters.", 400);
  }
  // Allow seeded local asset paths or valid https URLs
  if (cleaned.startsWith("/src/assets/images/") || cleaned.startsWith("/uploads/posters/")) {
    if (cleaned.includes("..")) {
      throw new ApiError("poster_url is not a valid path.", 400);
    }
    return cleaned;
  }
  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new ApiError("poster_url must be a valid https URL.", 400);
  }
  if (parsed.protocol !== "https:" || !parsed.hostname) {
    throw new ApiError("poster_url must be a valid https URL.", 400);
  }
  return cleaned;
}

const IBB_VIEWER_HOSTS = new Set(["ibb.co", "www.ibb.co", "imgbb.com", "www.imgbb.com"]);
const posterImageCache = new Map<string, string>();

function isIbbViewerUrl(rawUrl: string): boolean {
  try {
    return IBB_VIEWER_HOSTS.has(new URL(rawUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function directIbbImageFromHtml(html: string): string | null {
  const og = html.match(/property="og:image"\s+content="(https:\/\/i\.ibb\.co\/[^"]+)"/i);
  if (og) return og[1];
  const embedded = html.match(/"url":"(https:\\\/\\\/i\.ibb\.co\\\/[^"]+)"/);
  if (!embedded) return null;
  return embedded[1].replace(/\\\//g, "/");
}

async function expandPosterUrl(rawUrl: string | null): Promise<string | null> {
  if (!rawUrl || !isIbbViewerUrl(rawUrl)) return rawUrl;
  const cached = posterImageCache.get(rawUrl);
  if (cached) return cached;

  const response = await fetch(rawUrl, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,image/avif,image/webp,image/*,*/*",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new ApiError("Could not open that ImgBB poster link.", 400);
  }
  const direct = directIbbImageFromHtml(await response.text());
  if (!direct) {
    throw new ApiError(
      "That ImgBB link is a page, not an image file. Paste the direct image URL instead.",
      400
    );
  }
  const parsed = new URL(direct);
  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "i.ibb.co") {
    throw new ApiError("Could not find a safe image on that ImgBB page.", 400);
  }
  posterImageCache.set(rawUrl, parsed.toString());
  return parsed.toString();
}

function validateEventPayload(
  body: Record<string, unknown>,
  isUpdate: boolean,
  existing?: EventRow
) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const eventDate = typeof body.event_date === "string" ? body.event_date.trim() : "";
  const startTime = typeof body.start_time === "string" ? body.start_time.trim() : "";
  const endTime = typeof body.end_time === "string" ? body.end_time.trim() : "";
  const eventType = body.event_type;
  const status = (body.status ?? existing?.status ?? "Upcoming") as string;

  if (!title || title.length > 200) {
    throw new ApiError("'title' is required (max 200 characters).", 400);
  }
  if (!description) {
    throw new ApiError("'description' is required.", 400);
  }
  if (!venue || venue.length > 200) {
    throw new ApiError("'venue' is required (max 200 characters).", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new ApiError("'event_date' must be in YYYY-MM-DD format.", 400);
  }
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(startTime) || !/^\d{2}:\d{2}(:\d{2})?$/.test(endTime)) {
    throw new ApiError("'start_time' and 'end_time' must be in HH:MM format.", 400);
  }
  if (endTime <= startTime) {
    throw new ApiError("end_time must be after start_time.", 400);
  }
  if (typeof eventType !== "string" || !VALID_EVENT_TYPES.has(eventType)) {
    throw new ApiError(
      "event_type must be 'College-wide' or 'Department-specific'.",
      400
    );
  }
  if (!VALID_STATUSES.has(status)) {
    throw new ApiError("Invalid event status.", 400);
  }

  let departmentId: number | null =
    body.department_id !== undefined && body.department_id !== null && body.department_id !== ""
      ? Number(body.department_id)
      : null;

  if (eventType === "Department-specific") {
    if (!departmentId || !Number.isInteger(departmentId)) {
      throw new ApiError(
        "department_id is required for Department-specific events.",
        400
      );
    }
    const deptExists = db
      .prepare("SELECT department_id FROM departments WHERE department_id = ?")
      .get(departmentId);
    if (!deptExists) {
      throw new ApiError("Selected department does not exist.", 400);
    }
  } else {
    departmentId = null;
  }

  let categoryId: number | null =
    body.category_id !== undefined && body.category_id !== null && body.category_id !== ""
      ? Number(body.category_id)
      : null;

  if (categoryId !== null) {
    if (!Number.isInteger(categoryId)) {
      throw new ApiError("category_id must be a valid integer.", 400);
    }
    const catExists = db
      .prepare("SELECT category_id FROM event_categories WHERE category_id = ?")
      .get(categoryId);
    if (!catExists) {
      throw new ApiError("Selected category does not exist.", 400);
    }
  }

  let registrationUrl: string;
  if (
    isUpdate &&
    existing &&
    (body.registration_url === undefined ||
      body.registration_url === null ||
      String(body.registration_url).trim() === "")
  ) {
    registrationUrl = existing.registration_url;
  } else {
    registrationUrl = validateGoogleFormsUrl(body.registration_url);
  }

  const posterUrl = validatePosterUrl(body.poster_url);

  return {
    title,
    description,
    event_date: eventDate,
    start_time: startTime.slice(0, 5),
    end_time: endTime.slice(0, 5),
    venue,
    event_type: eventType as EventRow["event_type"],
    status: status as EventRow["status"],
    department_id: departmentId,
    category_id: categoryId,
    registration_url: registrationUrl,
    poster_url: posterUrl,
  };
}

function readDepartmentInput(body: Record<string, unknown>) {
  const name = typeof body.department_name === "string" ? body.department_name.trim() : "";
  const shortCode = typeof body.short_code === "string" ? body.short_code.trim() : "";
  const branchName = typeof body.branch_name === "string" ? body.branch_name.trim() : "";

  if (!name || name.length > 150) {
    throw new ApiError("'department_name' is required (max 150 characters).", 400);
  }
  if (!shortCode || shortCode.length > 20) {
    throw new ApiError("'short_code' is required (max 20 characters).", 400);
  }
  if (!branchName || branchName.length > 120) {
    throw new ApiError("'branch_name' is required (max 120 characters).", 400);
  }

  return { name, shortCode, branchName };
}

function getEventWithJoins(eventId: number): EventRow | undefined {
  return db
    .prepare(
      `
      SELECT e.*,
             u.name AS organizer_name,
             d.department_name AS department_name,
             d.branch_name AS department_branch,
             d.short_code AS department_short_code,
             c.category_name AS category_name
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.user_id
      LEFT JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN event_categories c ON e.category_id = c.category_id
      WHERE e.event_id = ?
      `
    )
    .get(eventId) as EventRow | undefined;
}

async function startServer() {
  initializeDatabase();

  const app = express();
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      frameguard: false,
    })
  );
  app.use(express.json({ limit: "8mb" }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  // Prevent browser/proxy caching of API responses containing tokens or links
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please wait a minute." },
  });

  const verifyAccessLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => {
      const userId = req.currentUser?.user_id ?? "anon";
      const eventId = req.params.id ?? "none";
      const clientIp = ipKeyGenerator(req.ip ?? "");
      return `verify:${userId}:${eventId}:${clientIp}`;
    },
    message: {
      error: "Too many incorrect access code attempts. Please wait 10 minutes before trying again.",
    },
  });

  // --- Health ---
  app.get("/api/health", (_req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.json({
        status: "OK",
        service: "college-event-system-api",
        database: "connected",
      });
    } catch {
      res.status(503).json({ error: "Database connection failed." });
    }
  });

  // --- Auth Config & Google / Preview Sign-In ---
  app.get("/api/auth/config", (_req, res) => {
    res.json({
      googleClientId: GOOGLE_CLIENT_ID || null,
      googleConfigured: Boolean(GOOGLE_CLIENT_ID),
      demoModeEnabled: !GOOGLE_CLIENT_ID,
      allowedDomain: ALLOWED_EMAIL_DOMAIN || null,
      seededStudents: SEEDED_STUDENTS.map((student) => ({
        name: student.name,
        shortCode: student.shortCode,
        enrollmentNo: student.enrollmentNo,
      })),
      seededStaff: SEEDED_STAFF.map((staff) => ({
        role: staff.role,
        loginId: staff.loginId,
        password: staff.password,
      })),
    });
  });

  app.post("/api/auth/google", authLimiter, async (req, res, next) => {
    try {
      const idToken = req.body?.id_token;
      if (typeof idToken !== "string" || !idToken.trim()) {
        throw new ApiError("id_token is required.", 400);
      }
      if (!googleOAuthClient || !GOOGLE_CLIENT_ID) {
        throw new ApiError("Server Google OAuth Client ID is not configured.", 500);
      }

      let payload;
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken,
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch {
        throw new ApiError("Invalid or expired Google ID token.", 401);
      }

      if (!payload || !payload.sub || !payload.email || !payload.email_verified) {
        throw new ApiError("Google account email is not verified.", 401);
      }

      const email = payload.email.trim().toLowerCase();
      const name = (payload.name || email.split("@")[0]).trim();

      if (ALLOWED_EMAIL_DOMAIN) {
        const domain = email.split("@").pop() || "";
        if (domain !== ALLOWED_EMAIL_DOMAIN) {
          throw new ApiError(
            `Access restricted to @${ALLOWED_EMAIL_DOMAIN} Google accounts.`,
            403
          );
        }
      }

      let user = db
        .prepare("SELECT * FROM users WHERE google_id = ?")
        .get(payload.sub) as UserRow | undefined;

      if (!user) {
        user = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(email) as UserRow | undefined;

        if (user) {
          db.prepare("UPDATE users SET google_id = ?, name = ? WHERE user_id = ?").run(
            payload.sub,
            name,
            user.user_id
          );
          user = db
            .prepare("SELECT * FROM users WHERE user_id = ?")
            .get(user.user_id) as UserRow;
        } else {
          const initialRole = ADMIN_EMAILS.has(email) ? "Admin" : "Attendee";
          const result = db
            .prepare(
              "INSERT INTO users (google_id, name, email, role) VALUES (?, ?, ?, ?)"
            )
            .run(payload.sub, name, email, initialRole);
          user = db
            .prepare("SELECT * FROM users WHERE user_id = ?")
            .get(result.lastInsertRowid) as UserRow;
        }
      } else {
        db.prepare("UPDATE users SET name = ?, email = ? WHERE user_id = ?").run(
          name,
          email,
          user.user_id
        );
        user = db
          .prepare("SELECT * FROM users WHERE user_id = ?")
          .get(user.user_id) as UserRow;
      }

      res.json({
        access_token: issueAuthJwt(user),
        token_type: "Bearer",
        expires_in: JWT_EXPIRATION_SECONDS,
        user: serializePublicUser(user),
      });
    } catch (err) {
      next(err);
    }
  });

  // Preview-only sign-in endpoint when GOOGLE_CLIENT_ID is not configured
  app.post("/api/auth/demo", authLimiter, (req, res) => {
    if (GOOGLE_CLIENT_ID) {
      throw new ApiError("Demo sign-in is disabled when Google OAuth is active.", 403);
    }

    const emailRaw = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const nameRaw = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!emailRaw || !emailRaw.includes("@")) {
      throw new ApiError("Please provide a valid email address.", 400);
    }

    if (ALLOWED_EMAIL_DOMAIN) {
      const domain = emailRaw.split("@").pop() || "";
      if (domain !== ALLOWED_EMAIL_DOMAIN) {
        throw new ApiError(
          `Access restricted to @${ALLOWED_EMAIL_DOMAIN} accounts.`,
          403
        );
      }
    }

    let user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(emailRaw) as UserRow | undefined;

    if (!user) {
      const initialRole = ADMIN_EMAILS.has(emailRaw) ? "Admin" : "Attendee";
      const displayName = nameRaw || emailRaw.split("@")[0];
      const result = db
        .prepare("INSERT INTO users (google_id, name, email, role) VALUES (?, ?, ?, ?)")
        .run(`preview-${emailRaw}`, displayName, emailRaw, initialRole);
      user = db
        .prepare("SELECT * FROM users WHERE user_id = ?")
        .get(result.lastInsertRowid) as UserRow;
    }

    res.json({
      access_token: issueAuthJwt(user),
      token_type: "Bearer",
      expires_in: JWT_EXPIRATION_SECONDS,
      user: serializePublicUser(user),
    });
  });

  app.post("/api/auth/seeded", authLimiter, (req, res) => {
    const role = req.body?.role;
    if (role !== "Attendee" && role !== "Organizer" && role !== "Admin") {
      throw new ApiError("Choose Attendee, Organizer, or Admin.", 400);
    }

    let user: UserRow | undefined;

    if (role === "Attendee") {
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const enrollment =
        typeof req.body?.enrollment_no === "string"
          ? req.body.enrollment_no.trim().toUpperCase()
          : "";
      const departmentId = Number(req.body?.department_id);
      if (!name || !enrollment || !Number.isInteger(departmentId)) {
        throw new ApiError("Name, department, and enrollment number are required.", 400);
      }
      user = db
        .prepare(
          `SELECT * FROM users
           WHERE role = 'Attendee'
             AND LOWER(name) = LOWER(?)
             AND UPPER(enrollment_no) = ?
             AND department_id = ?`
        )
        .get(name, enrollment, departmentId) as UserRow | undefined;
      if (!user) {
        throw new ApiError(
          "No seeded student matches that name, department, and enrollment number.",
          401
        );
      }
    } else {
      const loginId =
        typeof req.body?.login_id === "string" ? req.body.login_id.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!loginId || !password) {
        throw new ApiError("ID and password are required.", 400);
      }
      user = db
        .prepare(
          "SELECT * FROM users WHERE role = ? AND LOWER(login_id) = LOWER(?)"
        )
        .get(role, loginId) as UserRow | undefined;
      if (!user?.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        throw new ApiError("ID or password is incorrect.", 401);
      }
    }

    res.json({
      access_token: issueAuthJwt(user),
      token_type: "Bearer",
      expires_in: JWT_EXPIRATION_SECONDS,
      user: serializePublicUser(user),
    });
  });

  app.get("/api/users/me", requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: serializePublicUser(req.currentUser!) });
  });

  // --- Admin User Management ---
  app.get(
    "/api/admin/users",
    requireAuth,
    requireRole("Admin"),
    (req, res) => {
      const roleFilter = String(req.query.role || "").trim();
      const search = String(req.query.search || "").trim();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (roleFilter) {
        if (!VALID_ROLES.has(roleFilter)) {
          throw new ApiError("Invalid role filter.", 400);
        }
        conditions.push("role = ?");
        params.push(roleFilter);
      }

      if (search) {
        conditions.push("(LOWER(name) LIKE ? OR LOWER(email) LIKE ?)");
        const pattern = `%${search.toLowerCase()}%`;
        params.push(pattern, pattern);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = db
        .prepare(`SELECT * FROM users ${where} ORDER BY created_at DESC, user_id DESC`)
        .all(...params) as UserRow[];

      res.json({ users: rows.map(serializePublicUser) });
    }
  );

  app.patch(
    "/api/admin/users/:id/role",
    requireAuth,
    requireRole("Admin"),
    (req: AuthenticatedRequest, res) => {
      const targetId = Number(req.params.id);
      const newRole = req.body?.role;

      if (!Number.isInteger(targetId)) {
        throw new ApiError("Invalid user ID.", 400);
      }
      if (typeof newRole !== "string" || !VALID_ROLES.has(newRole)) {
        throw new ApiError("Invalid role. Must be Admin, Organizer, or Attendee.", 400);
      }

      const target = db
        .prepare("SELECT * FROM users WHERE user_id = ?")
        .get(targetId) as UserRow | undefined;

      if (!target) {
        throw new ApiError("User not found.", 404);
      }

      if (target.user_id === req.currentUser!.user_id && newRole !== "Admin") {
        throw new ApiError("You cannot remove your own Admin role.", 400);
      }

      db.prepare("UPDATE users SET role = ? WHERE user_id = ?").run(newRole, targetId);
      const updated = db
        .prepare("SELECT * FROM users WHERE user_id = ?")
        .get(targetId) as UserRow;

      res.json({ user: serializePublicUser(updated) });
    }
  );

  // --- Events ---
  app.get("/api/events/preview", (_req, res) => {
    const rows = db
      .prepare(
        `
        SELECT e.*, u.name AS organizer_name, d.department_name,
               d.branch_name AS department_branch, d.short_code AS department_short_code,
               c.category_name
        FROM events e
        LEFT JOIN users u ON e.organizer_id = u.user_id
        LEFT JOIN departments d ON e.department_id = d.department_id
        LEFT JOIN event_categories c ON e.category_id = c.category_id
        WHERE e.status = 'Upcoming'
        ORDER BY e.event_date ASC, e.start_time ASC
        LIMIT 3
        `
      )
      .all() as EventRow[];

    res.json({ events: rows.map(serializePublicEvent) });
  });

  app.get("/api/events", requireAuth, (req: AuthenticatedRequest, res) => {
    const q = String(req.query.q || "").trim();
    const eventType = String(req.query.event_type || "").trim();
    const status = String(req.query.status || "").trim();
    const categoryIdRaw = String(req.query.category_id || "").trim();
    const departmentIdRaw = String(req.query.department_id || "").trim();
    const dateFrom = String(req.query.date_from || "").trim();
    const dateTo = String(req.query.date_to || "").trim();
    const mine = String(req.query.mine || "").toLowerCase() === "true";
    const sort = String(req.query.sort || "date_asc").trim();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q) {
      conditions.push("(LOWER(e.title) LIKE ? OR LOWER(e.description) LIKE ?)");
      const pat = `%${q.toLowerCase()}%`;
      params.push(pat, pat);
    }
    if (eventType) {
      if (!VALID_EVENT_TYPES.has(eventType)) {
        throw new ApiError("Invalid event_type filter.", 400);
      }
      conditions.push("e.event_type = ?");
      params.push(eventType);
    }
    if (status) {
      if (!VALID_STATUSES.has(status)) {
        throw new ApiError("Invalid status filter.", 400);
      }
      conditions.push("e.status = ?");
      params.push(status);
    }
    if (categoryIdRaw) {
      const catId = Number(categoryIdRaw);
      if (!Number.isInteger(catId)) throw new ApiError("Invalid category_id.", 400);
      conditions.push("e.category_id = ?");
      params.push(catId);
    }
    if (departmentIdRaw) {
      const deptId = Number(departmentIdRaw);
      if (!Number.isInteger(deptId)) throw new ApiError("Invalid department_id.", 400);
      conditions.push("e.department_id = ?");
      params.push(deptId);
    }
    if (dateFrom) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
        throw new ApiError("date_from must be YYYY-MM-DD.", 400);
      }
      conditions.push("e.event_date >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        throw new ApiError("date_to must be YYYY-MM-DD.", 400);
      }
      conditions.push("e.event_date <= ?");
      params.push(dateTo);
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new ApiError("date_from cannot be after date_to.", 400);
    }
    if (mine) {
      conditions.push("e.organizer_id = ?");
      params.push(req.currentUser!.user_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy =
      sort === "date_desc"
        ? "ORDER BY e.event_date DESC, e.start_time DESC"
        : "ORDER BY e.event_date ASC, e.start_time ASC";

    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12) || 12));
    const offset = (page - 1) * limit;

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM events e ${where}`)
      .get(...params) as { total: number };

    const rows = db
      .prepare(
        `
        SELECT e.*, u.name AS organizer_name, d.department_name,
               d.branch_name AS department_branch, d.short_code AS department_short_code,
               c.category_name
        FROM events e
        LEFT JOIN users u ON e.organizer_id = u.user_id
        LEFT JOIN departments d ON e.department_id = d.department_id
        LEFT JOIN event_categories c ON e.category_id = c.category_id
        ${where}
        ${orderBy}
        LIMIT ? OFFSET ?
        `
      )
      .all(...params, limit, offset) as EventRow[];

    res.json({
      events: rows.map(serializePublicEvent),
      pagination: {
        page,
        limit,
        total: countRow.total,
        pages: Math.max(1, Math.ceil(countRow.total / limit)),
      },
    });
  });

  app.get("/api/events/:id", requireAuth, (req, res) => {
    const eventId = Number(req.params.id);
    if (!Number.isInteger(eventId)) {
      throw new ApiError("Invalid event ID.", 400);
    }
    const ev = getEventWithJoins(eventId);
    if (!ev) {
      throw new ApiError("Event not found.", 404);
    }

    const announcements = db
      .prepare(
        `
        SELECT a.*, u.name AS creator_name
        FROM announcements a
        LEFT JOIN users u ON a.created_by = u.user_id
        WHERE a.event_id = ?
        ORDER BY a.created_at DESC, a.announcement_id DESC
        `
      )
      .all(eventId);

    res.json({
      event: serializePublicEvent(ev),
      announcements,
    });
  });

  app.post(
    "/api/posters",
    requireAuth,
    requireRole("Organizer", "Admin"),
    (req, res) => {
      const dataUrl = typeof req.body?.image === "string" ? req.body.image.trim() : "";
      const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
      if (!match) {
        throw new ApiError("Upload a JPG, PNG, or WebP poster.", 400);
      }
      const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
      const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
      if (buffer.length < 32 || buffer.length > 5 * 1024 * 1024) {
        throw new ApiError("Poster must be under 5 MB.", 400);
      }
      const dir = path.resolve(process.cwd(), "uploads", "posters");
      fs.mkdirSync(dir, { recursive: true });
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      fs.writeFileSync(path.join(dir, filename), buffer);
      res.status(201).json({ poster_url: `/uploads/posters/${filename}` });
    }
  );

  app.get("/api/posters/resolve", async (req, res, next) => {
    try {
      const raw = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!isIbbViewerUrl(raw)) {
        throw new ApiError("Only ImgBB share links can be resolved.", 400);
      }
      const direct = await expandPosterUrl(raw);
      if (!direct) throw new ApiError("Poster image was not found.", 404);
      res.redirect(302, direct);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    "/api/events",
    requireAuth,
    requireRole("Organizer", "Admin"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
      const cleaned = validateEventPayload(req.body || {}, false);
      cleaned.poster_url = await expandPosterUrl(cleaned.poster_url);
      const result = db
        .prepare(
          `
          INSERT INTO events (
            title, description, event_date, start_time, end_time, venue,
            event_type, status, registration_url, poster_url,
            organizer_id, department_id, category_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          cleaned.title,
          cleaned.description,
          cleaned.event_date,
          cleaned.start_time,
          cleaned.end_time,
          cleaned.venue,
          cleaned.event_type,
          cleaned.status,
          cleaned.registration_url,
          cleaned.poster_url,
          req.currentUser!.user_id,
          cleaned.department_id,
          cleaned.category_id
        );

      const created = getEventWithJoins(Number(result.lastInsertRowid))!;
      res.status(201).json({ event: serializePublicEvent(created) });
      } catch (err) {
        next(err);
      }
    }
  );

  app.put(
    "/api/events/:id",
    requireAuth,
    requireRole("Organizer", "Admin"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
      const eventId = Number(req.params.id);
      if (!Number.isInteger(eventId)) throw new ApiError("Invalid event ID.", 400);

      const existing = getEventWithJoins(eventId);
      if (!existing) throw new ApiError("Event not found.", 404);

      if (
        req.currentUser!.role !== "Admin" &&
        existing.organizer_id !== req.currentUser!.user_id
      ) {
        throw new ApiError(
          "Forbidden: only the event organizer or an Admin can modify this event.",
          403
        );
      }

      const cleaned = validateEventPayload(req.body || {}, true, existing);
      cleaned.poster_url = await expandPosterUrl(cleaned.poster_url);
      db.prepare(
        `
        UPDATE events
        SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ?,
            venue = ?, event_type = ?, status = ?, registration_url = ?, poster_url = ?,
            department_id = ?, category_id = ?
        WHERE event_id = ?
        `
      ).run(
        cleaned.title,
        cleaned.description,
        cleaned.event_date,
        cleaned.start_time,
        cleaned.end_time,
        cleaned.venue,
        cleaned.event_type,
        cleaned.status,
        cleaned.registration_url,
        cleaned.poster_url,
        cleaned.department_id,
        cleaned.category_id,
        eventId
      );

      const updated = getEventWithJoins(eventId)!;
      res.json({ event: serializePublicEvent(updated) });
      } catch (err) {
        next(err);
      }
    }
  );

  app.patch(
    "/api/events/:id/status",
    requireAuth,
    requireRole("Organizer", "Admin"),
    (req: AuthenticatedRequest, res) => {
      const eventId = Number(req.params.id);
      if (!Number.isInteger(eventId)) throw new ApiError("Invalid event ID.", 400);

      const existing = getEventWithJoins(eventId);
      if (!existing) throw new ApiError("Event not found.", 404);

      if (
        req.currentUser!.role !== "Admin" &&
        existing.organizer_id !== req.currentUser!.user_id
      ) {
        throw new ApiError(
          "Forbidden: only the event organizer or an Admin can modify this event.",
          403
        );
      }

      const newStatus = req.body?.status;
      if (typeof newStatus !== "string" || !VALID_STATUSES.has(newStatus)) {
        throw new ApiError("Invalid event status.", 400);
      }

      db.prepare("UPDATE events SET status = ? WHERE event_id = ?").run(
        newStatus,
        eventId
      );
      const updated = getEventWithJoins(eventId)!;
      res.json({ event: serializePublicEvent(updated) });
    }
  );

  // --- Department Access & Guarded Registration Link ---
  app.post(
    "/api/events/:id/access",
    requireAuth,
    requireRole("Organizer", "Admin"),
    (req: AuthenticatedRequest, res) => {
      const eventId = Number(req.params.id);
      if (!Number.isInteger(eventId)) throw new ApiError("Invalid event ID.", 400);

      const ev = db
        .prepare("SELECT * FROM events WHERE event_id = ?")
        .get(eventId) as EventRow | undefined;
      if (!ev) throw new ApiError("Event not found.", 404);

      if (
        req.currentUser!.role !== "Admin" &&
        ev.organizer_id !== req.currentUser!.user_id
      ) {
        throw new ApiError(
          "Forbidden: only the event organizer or an Admin can set access codes.",
          403
        );
      }

      if (ev.event_type !== "Department-specific") {
        throw new ApiError(
          "Access codes can only be set for Department-specific events.",
          400
        );
      }

      const departmentId = Number(req.body?.department_id);
      const accessCode =
        typeof req.body?.access_code === "string" ? req.body.access_code.trim() : "";

      if (!Number.isInteger(departmentId)) {
        throw new ApiError("Valid department_id is required.", 400);
      }
      const dept = db
        .prepare("SELECT department_id FROM departments WHERE department_id = ?")
        .get(departmentId);
      if (!dept) {
        throw new ApiError("Selected department does not exist.", 400);
      }
      if (ev.department_id !== departmentId) {
        throw new ApiError("Access codes can only be set for this event's own school.", 400);
      }
      if (accessCode.length < 4 || accessCode.length > 100) {
        throw new ApiError("access_code must be between 4 and 100 characters.", 400);
      }

      const hash = bcrypt.hashSync(accessCode, 10);
      const existing = db
        .prepare(
          "SELECT access_id FROM department_access WHERE event_id = ? AND department_id = ?"
        )
        .get(eventId, departmentId);

      if (existing) {
        db.prepare(
          "UPDATE department_access SET access_code_hash = ? WHERE event_id = ? AND department_id = ?"
        ).run(hash, eventId, departmentId);
        res.json({
          message: "Department access code updated.",
          event_id: eventId,
          department_id: departmentId,
        });
      } else {
        db.prepare(
          "INSERT INTO department_access (event_id, department_id, access_code_hash) VALUES (?, ?, ?)"
        ).run(eventId, departmentId, hash);
        res.status(201).json({
          message: "Department access code saved.",
          event_id: eventId,
          department_id: departmentId,
        });
      }
    }
  );

  app.post(
    "/api/events/:id/verify-access",
    requireAuth,
    verifyAccessLimiter,
    (req: AuthenticatedRequest, res) => {
      const eventId = Number(req.params.id);
      if (!Number.isInteger(eventId)) throw new ApiError("Invalid event ID.", 400);

      const ev = db
        .prepare("SELECT * FROM events WHERE event_id = ?")
        .get(eventId) as EventRow | undefined;
      if (!ev) throw new ApiError("Event not found.", 404);

      if (ev.event_type !== "Department-specific") {
        throw new ApiError(
          "This event is College-wide and does not require an access code.",
          400
        );
      }

      const departmentId = Number(req.body?.department_id);
      const accessCode =
        typeof req.body?.access_code === "string" ? req.body.access_code.trim() : "";

      if (!Number.isInteger(departmentId) || !accessCode) {
        throw new ApiError("department_id and access_code are required.", 400);
      }
      if (ev.department_id !== departmentId) {
        throw new ApiError("This event only accepts the access code for its own school.", 400);
      }

      const record = db
        .prepare(
          "SELECT access_code_hash FROM department_access WHERE event_id = ? AND department_id = ?"
        )
        .get(eventId, departmentId) as { access_code_hash: string } | undefined;

      if (!record || !bcrypt.compareSync(accessCode, record.access_code_hash)) {
        throw new ApiError("Invalid department or access code.", 403);
      }

      const accessToken = jwt.sign(
        {
          type: "event_access",
          sub: String(req.currentUser!.user_id),
          event_id: eventId,
          department_id: departmentId,
        },
        JWT_SECRET,
        { expiresIn: EVENT_ACCESS_EXPIRATION_SECONDS }
      );

      res.json({
        access_token: accessToken,
        expires_in: EVENT_ACCESS_EXPIRATION_SECONDS,
      });
    }
  );

  app.get(
    "/api/events/:id/registration-link",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const eventId = Number(req.params.id);
      if (!Number.isInteger(eventId)) throw new ApiError("Invalid event ID.", 400);

      const ev = db
        .prepare("SELECT * FROM events WHERE event_id = ?")
        .get(eventId) as EventRow | undefined;
      if (!ev) throw new ApiError("Event not found.", 404);

      if (
        ev.status === "Cancelled" ||
        ev.status === "Completed" ||
        ev.status === "Postponed"
      ) {
        throw new ApiError(
          `Registration is unavailable because this event is ${ev.status}.`,
          400
        );
      }

      if (ev.event_type === "College-wide") {
        res.json({ event_id: ev.event_id, registration_url: ev.registration_url });
        return;
      }

      const tokenHeader = req.headers["x-event-access-token"];
      const accessToken =
        typeof tokenHeader === "string" ? tokenHeader.trim() : "";

      if (!accessToken) {
        throw new ApiError(
          "Department access verification is required to view this registration link.",
          403
        );
      }

      let payload: jwt.JwtPayload;
      try {
        payload = jwt.verify(accessToken, JWT_SECRET) as jwt.JwtPayload;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new ApiError(
            "Department access token expired. Please re-enter the access code.",
            403
          );
        }
        throw new ApiError("Invalid department access token.", 403);
      }

      if (
        payload.type !== "event_access" ||
        payload.sub !== String(req.currentUser!.user_id) ||
        payload.event_id !== ev.event_id
      ) {
        throw new ApiError(
          "Access token is not valid for this user or event.",
          403
        );
      }

      res.json({ event_id: ev.event_id, registration_url: ev.registration_url });
    }
  );

  // --- Announcements ---
  app.get("/api/announcements", requireAuth, (req, res) => {
    const eventIdRaw = String(req.query.event_id || "").trim();
    let where = "";
    const params: unknown[] = [];

    if (eventIdRaw) {
      const eventId = Number(eventIdRaw);
      if (!Number.isInteger(eventId)) {
        throw new ApiError("event_id filter must be a valid integer.", 400);
      }
      where = "WHERE a.event_id = ?";
      params.push(eventId);
    }

    const rows = db
      .prepare(
        `
        SELECT a.*, e.title AS event_title, u.name AS creator_name
        FROM announcements a
        LEFT JOIN events e ON a.event_id = e.event_id
        LEFT JOIN users u ON a.created_by = u.user_id
        ${where}
        ORDER BY a.created_at DESC, a.announcement_id DESC
        `
      )
      .all(...params);

    res.json({ announcements: rows });
  });

  app.post(
    "/api/announcements",
    requireAuth,
    requireRole("Organizer", "Admin"),
    (req: AuthenticatedRequest, res) => {
      const eventId = Number(req.body?.event_id);
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

      if (!Number.isInteger(eventId)) throw new ApiError("Valid event_id is required.", 400);
      if (!title || title.length > 200) {
        throw new ApiError("'title' is required (max 200 characters).", 400);
      }
      if (!message) throw new ApiError("'message' is required.", 400);

      const ev = db
        .prepare("SELECT * FROM events WHERE event_id = ?")
        .get(eventId) as EventRow | undefined;
      if (!ev) throw new ApiError("Event not found.", 404);

      if (
        req.currentUser!.role !== "Admin" &&
        ev.organizer_id !== req.currentUser!.user_id
      ) {
        throw new ApiError(
          "Forbidden: only the event's organizer or an Admin can post announcements.",
          403
        );
      }

      const result = db
        .prepare(
          "INSERT INTO announcements (event_id, title, message, created_by) VALUES (?, ?, ?, ?)"
        )
        .run(eventId, title, message, req.currentUser!.user_id);

      const created = db
        .prepare("SELECT * FROM announcements WHERE announcement_id = ?")
        .get(result.lastInsertRowid);
      res.status(201).json({ announcement: created });
    }
  );

  app.put(
    "/api/announcements/:id",
    requireAuth,
    requireRole("Organizer", "Admin"),
    (req: AuthenticatedRequest, res) => {
      const annId = Number(req.params.id);
      if (!Number.isInteger(annId)) throw new ApiError("Invalid announcement ID.", 400);

      const ann = db
        .prepare("SELECT * FROM announcements WHERE announcement_id = ?")
        .get(annId) as { announcement_id: number; created_by: number } | undefined;
      if (!ann) throw new ApiError("Announcement not found.", 404);

      if (
        req.currentUser!.role !== "Admin" &&
        ann.created_by !== req.currentUser!.user_id
      ) {
        throw new ApiError(
          "Forbidden: only the announcement author or an Admin can edit it.",
          403
        );
      }

      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      if (!title || title.length > 200) {
        throw new ApiError("'title' is required (max 200 characters).", 400);
      }
      if (!message) throw new ApiError("'message' is required.", 400);

      db.prepare(
        "UPDATE announcements SET title = ?, message = ? WHERE announcement_id = ?"
      ).run(title, message, annId);
      const updated = db
        .prepare("SELECT * FROM announcements WHERE announcement_id = ?")
        .get(annId);
      res.json({ announcement: updated });
    }
  );

  app.delete(
    "/api/announcements/:id",
    requireAuth,
    requireRole("Organizer", "Admin"),
    (req: AuthenticatedRequest, res) => {
      const annId = Number(req.params.id);
      if (!Number.isInteger(annId)) throw new ApiError("Invalid announcement ID.", 400);

      const ann = db
        .prepare("SELECT * FROM announcements WHERE announcement_id = ?")
        .get(annId) as { announcement_id: number; created_by: number } | undefined;
      if (!ann) throw new ApiError("Announcement not found.", 404);

      if (
        req.currentUser!.role !== "Admin" &&
        ann.created_by !== req.currentUser!.user_id
      ) {
        throw new ApiError(
          "Forbidden: only the announcement author or an Admin can delete it.",
          403
        );
      }

      db.prepare("DELETE FROM announcements WHERE announcement_id = ?").run(annId);
      res.json({ message: "Announcement deleted." });
    }
  );

  // --- Reference Data: Departments & Categories ---
  app.get("/api/departments", (_req, res) => {
    const departments = db
      .prepare("SELECT * FROM departments ORDER BY department_id ASC")
      .all();
    res.json({ departments });
  });

  app.post(
    "/api/departments",
    requireAuth,
    requireRole("Admin"),
    (req, res) => {
      const { name, shortCode, branchName } = readDepartmentInput(req.body || {});
      const existingName = db
        .prepare("SELECT department_id FROM departments WHERE LOWER(department_name) = ?")
        .get(name.toLowerCase());
      if (existingName) {
        throw new ApiError("A department with that name already exists.", 409);
      }
      const existingCode = db
        .prepare("SELECT department_id FROM departments WHERE LOWER(short_code) = ?")
        .get(shortCode.toLowerCase());
      if (existingCode) {
        throw new ApiError("A department with that school code already exists.", 409);
      }
      const result = db
        .prepare(
          "INSERT INTO departments (department_name, short_code, branch_name) VALUES (?, ?, ?)"
        )
        .run(name, shortCode, branchName);
      const dept = db
        .prepare("SELECT * FROM departments WHERE department_id = ?")
        .get(result.lastInsertRowid);
      res.status(201).json({ department: dept });
    }
  );

  app.put(
    "/api/departments/:id",
    requireAuth,
    requireRole("Admin"),
    (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw new ApiError("Invalid department ID.", 400);
      const dept = db
        .prepare("SELECT * FROM departments WHERE department_id = ?")
        .get(id);
      if (!dept) throw new ApiError("Department not found.", 404);

      const { name, shortCode, branchName } = readDepartmentInput(req.body || {});
      const nameConflict = db
        .prepare(
          "SELECT department_id FROM departments WHERE LOWER(department_name) = ? AND department_id != ?"
        )
        .get(name.toLowerCase(), id);
      if (nameConflict) {
        throw new ApiError("Another department already uses that name.", 409);
      }
      const codeConflict = db
        .prepare(
          "SELECT department_id FROM departments WHERE LOWER(short_code) = ? AND department_id != ?"
        )
        .get(shortCode.toLowerCase(), id);
      if (codeConflict) {
        throw new ApiError("Another department already uses that school code.", 409);
      }
      db.prepare(
        "UPDATE departments SET department_name = ?, short_code = ?, branch_name = ? WHERE department_id = ?"
      ).run(name, shortCode, branchName, id);
      const updated = db
        .prepare("SELECT * FROM departments WHERE department_id = ?")
        .get(id);
      res.json({ department: updated });
    }
  );

  app.delete(
    "/api/departments/:id",
    requireAuth,
    requireRole("Admin"),
    (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw new ApiError("Invalid department ID.", 400);
      const dept = db
        .prepare("SELECT * FROM departments WHERE department_id = ?")
        .get(id);
      if (!dept) throw new ApiError("Department not found.", 404);

      const inUse = db
        .prepare("SELECT event_id FROM events WHERE department_id = ? LIMIT 1")
        .get(id);
      if (inUse) {
        throw new ApiError(
          "Cannot delete department while events are assigned to it.",
          409
        );
      }
      db.prepare("DELETE FROM departments WHERE department_id = ?").run(id);
      res.json({ message: "Department deleted." });
    }
  );

  app.get("/api/categories", requireAuth, (_req, res) => {
    const categories = db
      .prepare("SELECT * FROM event_categories ORDER BY category_name ASC")
      .all();
    res.json({ categories });
  });

  app.post(
    "/api/categories",
    requireAuth,
    requireRole("Admin"),
    (req, res) => {
      const name =
        typeof req.body?.category_name === "string"
          ? req.body.category_name.trim()
          : "";
      if (!name || name.length > 100) {
        throw new ApiError("'category_name' is required (max 100 characters).", 400);
      }
      const existing = db
        .prepare(
          "SELECT category_id FROM event_categories WHERE LOWER(category_name) = ?"
        )
        .get(name.toLowerCase());
      if (existing) {
        throw new ApiError("A category with that name already exists.", 409);
      }
      const result = db
        .prepare("INSERT INTO event_categories (category_name) VALUES (?)")
        .run(name);
      const cat = db
        .prepare("SELECT * FROM event_categories WHERE category_id = ?")
        .get(result.lastInsertRowid);
      res.status(201).json({ category: cat });
    }
  );

  app.put(
    "/api/categories/:id",
    requireAuth,
    requireRole("Admin"),
    (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw new ApiError("Invalid category ID.", 400);
      const cat = db
        .prepare("SELECT * FROM event_categories WHERE category_id = ?")
        .get(id);
      if (!cat) throw new ApiError("Category not found.", 404);

      const name =
        typeof req.body?.category_name === "string"
          ? req.body.category_name.trim()
          : "";
      if (!name || name.length > 100) {
        throw new ApiError("'category_name' is required (max 100 characters).", 400);
      }
      const conflict = db
        .prepare(
          "SELECT category_id FROM event_categories WHERE LOWER(category_name) = ? AND category_id != ?"
        )
        .get(name.toLowerCase(), id);
      if (conflict) {
        throw new ApiError("Another category already uses that name.", 409);
      }
      db.prepare(
        "UPDATE event_categories SET category_name = ? WHERE category_id = ?"
      ).run(name, id);
      const updated = db
        .prepare("SELECT * FROM event_categories WHERE category_id = ?")
        .get(id);
      res.json({ category: updated });
    }
  );

  app.delete(
    "/api/categories/:id",
    requireAuth,
    requireRole("Admin"),
    (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw new ApiError("Invalid category ID.", 400);
      const cat = db
        .prepare("SELECT * FROM event_categories WHERE category_id = ?")
        .get(id);
      if (!cat) throw new ApiError("Category not found.", 404);

      db.prepare("DELETE FROM event_categories WHERE category_id = ?").run(id);
      res.json({ message: "Category deleted." });
    }
  );

  // Unknown API routes always return JSON {"error": "..."}
  app.all("/api/*", (_req, _res, next) => {
    next(new ApiError("API endpoint not found.", 404));
  });

  // Consistent JSON error handler for all /api/* errors
  app.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
      if (err instanceof ApiError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error("Unhandled API error:", err);
      res.status(500).json({ error: "An unexpected internal server error occurred." });
    }
  );

  // Frontend serving: Vite middleware in development, static dist/ in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DAVV Events running on http://localhost:${PORT}`);
  });
}

startServer();
