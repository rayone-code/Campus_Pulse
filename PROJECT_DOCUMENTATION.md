# CampusPulse — Project Documentation

**College:** Devi Ahilya Vishwavidyalaya (DAVV), Indore  
**Product name:** CampusPulse  
**What it is:** A web portal where DAVV students find events, organizers publish them, and department events stay locked until a school access code is entered.

This document explains what the system does, where each part lives in the folder, and why it was built that way. It is written so it can be used as the project write-up and as a script for a viva.

---

## 1. Why this project exists

College events are usually scattered across WhatsApp groups, notice boards, and separate Google Forms. A student from one school cannot easily see what another school is running, and a department form link can be forwarded to people who were not meant to register.

CampusPulse puts university-wide and department events in one place. The public page can show that an event exists. The Google Form link is fetched only after the server checks the student’s right to see it. For a department event, that check is a school access code stored as a hash, not as plain text.

---

## 2. Who uses it

| Role | What they can do | Why this role exists |
| --- | --- | --- |
| Attendee | Browse events, read announcements, enter a school access code, open the Google Form | A student should see events without being able to edit them |
| Organizer | Create and edit their own events, set the access code, post announcements, postpone or cancel | The person running the event should control its listing |
| Admin | Everything an organizer can do, plus every event, user roles, schools, and categories | Someone has to appoint organizers and keep the school list correct |

An admin who opens Organizer Studio sees every event, not only the ones they created. That is so a demo does not look empty when the sample events were created by the organizer account.

---

## 3. Schools in this project

Each row is one programme. The short code in brackets is the DAVV school.

| Branch | School | Code |
| --- | --- | --- |
| Computer Science | International Institute of Professional Studies | IIPS |
| Cybersecurity | School of Computer Science & IT | SCSIT |
| Internet of Things | School of Instrumentation | SoI |
| Artificial Intelligence & Data Science | School of Data Science and Forecasting | SDSF |
| Electronics | School of Electronics | SOEX |

The database stores the full school name, the short code, and the branch name separately. The screen shows them as `Cybersecurity (SCSIT)`. They are stored apart so a filter can use the id, while the label stays readable.

---

## 4. What a visitor can do

1. Open the landing page without signing in. It shows the campus, four activity cards, the next upcoming events, how the portal works, and a sign-in prompt for announcements.
2. Sign in through **Seeded login** or **Demo login**.
3. Search and filter events by type, status, category, school, and date.
4. Open an event. University-wide events reveal the Google Form after a click. Department events ask for that school’s access code first.
5. Read announcements.
6. Switch between day mode and night mode. The choice is saved in the browser.

Organizers and admins also get:

- Create and edit events
- Upload a poster file, or paste an image link
- Set a write-only access code for a department event
- Postpone or cancel an event
- Post, edit, and delete announcements
- Admin only: change roles, add or rename schools and categories

Registration itself stays in Google Forms. CampusPulse does not store who filled the form. That was a deliberate limit: the portal’s job is discovery and a guarded link, not a second registration database.

---

## 5. How the pieces fit together

The browser is a React application. It never talks to SQLite directly. It calls `/api/...` on the same server that also serves the pages.

```text
Browser (React pages)
        |
        |  HTTP /api
        v
Express server (server.ts)
        |
        |  SQL
        v
SQLite file (college_events.db)
```

One process does both jobs. In development, `npm run dev` starts `server.ts` with `tsx`. Express handles `/api`. Vite, running inside that same process, serves the React pages and reloads them when files change. That is why the demo command is `npm run dev`, not `npm start`. `npm start` expects already compiled JavaScript and is not the command used for the college demo.

The session is a JWT kept in `sessionStorage`. The token says who the user is. The role is read from the database on each request, so changing a role in the admin panel takes effect on the next API call even if an old token is still in the browser.

---

## 6. Technology and why it was chosen

| Piece | Used for | Why |
| --- | --- | --- |
| React + TypeScript | Pages and forms | Typed components make the three roles and event fields harder to mix up |
| React Router | URLs such as `/events/7` | Each screen has a real address that can be refreshed |
| Vite | Serves the frontend in development | Fast reload while the Express API stays up |
| Express | REST API | One place for auth, validation, and database rules |
| SQLite (`better-sqlite3`) | All stored data | A single file is enough for a college project and needs no separate database server |
| bcrypt | Access codes and staff passwords | The database never stores those secrets in plain text |
| JWT | Login session and the short-lived department pass | The browser can prove who it is without sending the password again |
| Tailwind CSS | Layout and night mode | Shared classes keep the navy, blue, and gold look consistent |
| Helmet and rate limits | Basic protection | Sign-in and access-code attempts are limited so a demo cannot be brute-forced casually |

Google sign-in is supported in the server if `GOOGLE_CLIENT_ID` is set. The college demo does not need it. When it is empty, the Demo login tab is used instead.

---

## 7. Where things live

### Root of the project

| Path | What it is | Why it is here |
| --- | --- | --- |
| `server.ts` | The whole HTTP API | One file keeps every route, check, and error shape in a place a viva can open |
| `server/db.ts` | Table creation, sample schools, sample events, seeded logins | The database setup is separate from the request handlers so the schema is easy to read |
| `college_events.db` | The live SQLite database | Created the first time the server starts. Not committed, because it is local data |
| `uploads/posters/` | Poster files uploaded from the organizer form | The image stays on this machine. A share link can expire; a local file does not |
| `src/` | The React application | Frontend code is kept apart from the server |
| `index.html` | Page title, fonts, and the night-mode flash script | The night class is applied before React loads so the page does not flicker white |
| `package.json` | Dependencies and scripts | `dev`, `lint`, and `clean` are defined here |
| `README.md` | Short run notes and logins | Enough to start the app |
| `PROJECT_DOCUMENTATION.md` | This document | The full explanation |

### `src/pages` — one file per screen

| File | Route | Why |
| --- | --- | --- |
| `LandingPage.tsx` | `/` | Public home. No login required, so a visitor can see the campus and upcoming events |
| `LoginPage.tsx` | `/login` | Two sign-in methods. Seeded login is shown first, and the department list starts empty |
| `EventsPage.tsx` | `/events` | Signed-in directory with search and filters |
| `EventDetailPage.tsx` | `/events/:eventId` | One event, its poster, description, and the registration action |
| `DepartmentVerifyPage.tsx` | `/events/:eventId/verify-access` | Access code form. The school is fixed to the event’s own school |
| `AnnouncementsPage.tsx` | `/announcements` | Notices across events, with a filter |
| `OrganizerDashboardPage.tsx` | `/organizer` | Create, edit, access codes, announcements, postpone, cancel |
| `AdminPanelPage.tsx` | `/admin` | Users, all events, announcements, schools, categories |
| `ForbiddenPage.tsx` | shown inside a route | A student who opens `/admin` sees this instead of the panel |

Routes are declared in `src/App.tsx`. `PrivateRoute` sends a signed-out visitor to login. `RoleRoute` blocks a role that is not allowed. `PublicRoute` sends someone who is already signed in away from the login page.

### `src/components` — pieces used by more than one page

| File | Why it exists |
| --- | --- |
| `Navbar.tsx` | Brand, links that change with the role, night-mode button, sign out |
| `Footer.tsx` | Closing line used on every page |
| `Layout.tsx` | Puts the navbar, the current page, and the footer together |
| `EventFormModal.tsx` | The create and edit form, including poster upload |
| `EventPoster.tsx` | Shows the poster, or a calm placeholder if there is no image |
| `SetAccessCodeModal.tsx` | Organizer sets the code. It cannot be read back, because only the hash is stored |
| `AnnouncementsModal.tsx` | Write and edit notices for one event |
| `Modal.tsx`, `ConfirmDialog.tsx` | Shared dialogs so delete and cancel ask before they act |
| `GoogleSignInButton.tsx` | Used only when Google sign-in is configured |
| `LoadingSpinner.tsx`, `EmptyState.tsx`, `ErrorMessage.tsx` | The same waiting, empty, and error states on every page |

### `src/context` and `src/api`

| File | Why |
| --- | --- |
| `AuthContext.tsx` | Remembers who is signed in and offers login and logout to every page |
| `ThemeContext.tsx` | Remembers day or night and writes `dark` on the page root |
| `ToastContext.tsx` | Short success and error messages |
| `api/client.ts` | Axios setup. Adds the JWT. Clears the session if the server says it expired |
| `api/services.ts` | Named functions for each API call, so pages do not build URLs by hand |
| `utils/tokenStorage.ts` | Reads and writes the JWT in `sessionStorage`. Closing the tab ends the session |
| `utils/formatters.ts` | Dates, `Computer Science (IIPS)` labels, and “University-wide” wording |
| `utils/posterAssets.ts` | Maps campus photos and turns an ImgBB share link into a real image address |
| `types.ts` | Shared TypeScript shapes for a user, an event, a school, and an announcement |

### Campus photographs

| File | Used as |
| --- | --- |
| `src/assets/davv/hero-takshashila.jpg` | Landing hero. Aerial of Takshashila Campus |
| `src/assets/davv/sdsf.jpg` | Technical activity card |
| `src/assets/davv/soex.jpg` | Workshops card |
| `src/assets/davv/auditorium.jpg` | Cultural card |
| `src/assets/davv/nalanda-gate.jpg` | Campus gates card |
| `src/assets/davv/iips.jpg`, `scsit.jpg`, `soi.jpg` | Event cards for those schools when the event has no uploaded poster |

They are real DAVV photographs supplied for the project. The same photo is not reused for the hero and a card, so the landing page does not look like one picture copied everywhere.

`DAVV_Campus_Photo_Collection_Guide.pdf` is a list of gallery links. It does not contain image files. `davv images.pdf` is the source the campus photos were taken from.

---

## 8. Database

The file is `college_events.db` in the project folder. Tables are created in `server/db.ts` if they do not exist.

| Table | Stores | Why |
| --- | --- | --- |
| `users` | Name, email, role, and for seeded accounts an enrollment number or a login id and password hash | One account table for all three roles |
| `departments` | School name, short code, branch | Events and students point at a school id |
| `event_categories` | Technical, Workshop, Cultural, Seminar, Sports | Filters and labels, separate from the school |
| `events` | Title, description, date, time, venue, type, status, form URL, poster, organizer, school, category | The main record |
| `department_access` | Event, school, and the bcrypt hash of the access code | The code can be checked and replaced, but not displayed |
| `announcements` | Title, message, event, author | Notices stay attached to an event and disappear with it |

`events.registration_url` is never included in the normal event JSON. A separate request, `/api/events/:id/registration-link`, returns it. For a department event that request also needs a short-lived token from a successful access-code check. That is why the form link does not appear in “View page source” of the event list.

Sample events are inserted only when the events table is empty:

| Event | Scope | Code |
| --- | --- | --- |
| DAVV Inter-School Tech Meet | University-wide, Takshashila Campus Auditorium | none |
| IIPS Coding Sprint | Computer Science (IIPS) | `CS2026` |
| SCSIT Cybersecurity Briefing | Cybersecurity (SCSIT) | `CYBER2026` |
| SoI IoT Lab Session | Internet of Things (SoI) | `IOT2026` |
| SDSF Data Studio | Artificial Intelligence & Data Science (SDSF) | `AIDS2026` |
| SOEX Circuit Studio | Electronics (SOEX) | `SOEX2026` |

Those sample events share `DEMO_REGISTRATION_URL` at the top of `server/db.ts`. Before a viva, replace that constant with a real Google Form, delete `college_events.db`, and start the server again so the new link is seeded. Deleting the database also removes events and posters you added after the first run, so do it only when you want a fresh sample set.

---

## 9. Sign-in

The login page has two tabs.

### Seeded login

This is the tab that opens first. Nothing is pre-filled, and the department menu starts on “Select department”.

A student must match all three fields:

| Name | Department | Enrollment number |
| --- | --- | --- |
| Ananya Joshi | Cybersecurity (SCSIT) | `2025SCSIT014` |
| Rohan Patel | Internet of Things (SoI) | `2026SOI008` |

The two enrollment numbers are from different joining years on purpose: one `2025` and one `2026`. They are not IIPS students. IIPS remains a school in the list, but it is not the default student.

Organizer and admin use an ID and a password only. Passwords are stored with bcrypt.

| Role | ID | Password |
| --- | --- | --- |
| Organizer | `SCSIT-ORG` | `Organizer@2026` |
| Admin | `DAVV-ADMIN` | `Admin@2026` |

### Demo login

One click, no password. Useful when a faculty member wants to switch roles quickly.

| Account | Email |
| --- | --- |
| Organizer | `organizer@scsit.davv` |
| Admin | `admin@davv.ac.in` |
| Attendee | `student.cs@iips.davv` |

A new email typed on that tab creates an Attendee. It does not create an organizer or an admin.

---

## 10. Main API groups

All of these live in `server.ts`. Unknown `/api` paths return JSON `{ "error": "..." }`, not an HTML page.

| Group | Examples | Who |
| --- | --- | --- |
| Health and config | `GET /api/health`, `GET /api/auth/config` | Anyone |
| Demo and seeded login | `POST /api/auth/demo`, `POST /api/auth/seeded` | Anyone, rate limited |
| Current user | `GET /api/users/me` | Signed in |
| Events | `GET /api/events`, `POST /api/events`, `PUT /api/events/:id` | List needs login. Create and edit need organizer or admin |
| Public preview | `GET /api/events/preview` | Anyone. Next upcoming events for the landing page |
| Registration link | `GET /api/events/:id/registration-link` | Signed in, and for department events a valid access token |
| Access code | `POST /api/events/:id/access`, `POST /api/events/:id/verify-access` | Set: organizer or admin. Verify: any signed-in user. The school must be the event’s own school |
| Posters | `POST /api/posters`, `GET /api/posters/resolve` | Upload: organizer or admin. Resolve: turns an `ibb.co` share page into the image file when ImgBB still has it |
| Announcements | `GET/POST /api/announcements`, `PUT/DELETE /api/announcements/:id` | Read: signed in. Write: the author, the event organizer, or an admin |
| Schools and categories | `/api/departments`, `/api/categories` | Reading schools is public so the login form can list them. Changes need an admin |
| Roles | `GET /api/admin/users`, `PATCH /api/admin/users/:id/role` | Admin. An admin cannot remove their own admin role |

---

## 11. Look of the site

Day mode uses a light grey page (`#F5F7FB`), white cards, navy text (`#101D3A`), royal blue buttons (`#2457D6`), and gold labels (`#D5AE65`).

Night mode keeps the same blue and gold, and darkens the surfaces:

| | Day | Night |
| --- | --- | --- |
| Page | `#F5F7FB` | `#0E1626` |
| Cards and header | White | `#172033` |
| Text | `#101D3A` | `#E7EDF6` |
| Borders | Light slate | `#2A3650` |
| Footer | `#101D3A` | `#070C16` |

The rules are in `src/index.css`. The toggle is in the navbar. `ThemeContext` saves `campuspulse-theme` in `localStorage`.

Landing sections, in order: hero with the Takshashila photo, activity cards, upcoming events, three steps (Discover, Verify, Participate), announcements, and the navy footer “Campus life, connected.”

---

## 12. Posters

An organizer can upload a JPG, PNG, or WebP. The file is written under `uploads/posters/` and the event stores a path such as `/uploads/posters/cultural-iot.jpeg`. The events page and the detail page then load that file from this server.

An `https://ibb.co/...` link is a gallery page, not the image file. `posterAssets.ts` asks `/api/posters/resolve` to read that page and redirect to the real `i.ibb.co` image. If ImgBB later deletes the page, the card shows the calendar placeholder. That is what happened to the first cultural-event link. The original WhatsApp image was copied onto the server as `uploads/posters/cultural-iot.jpeg` so the card shows it again without ImgBB.

---

## 13. How to run it

Requirements: Node.js 22.18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

`npm run lint` checks TypeScript. `npm run clean` deletes a production `dist` folder. It uses a small Node script so it works on Windows.

---

## 14. What this project does not do

These were left out on purpose so the project stays explainable:

- No in-app list of who registered. That data stays in Google Forms.
- No payments, email, or QR attendance.
- No automatic change from Upcoming to Ongoing when the clock passes the start time. Status is set by an organizer.
- Google sign-in is optional and not required for the demo.
- The Gemini package is in `package.json` from the original template. The running app does not call it.

---

## 15. A short demo order

1. Landing page, then the night-mode button.
2. Seeded login as Rohan Patel, Internet of Things (SoI), `2026SOI008`.
3. Open SoI IoT Lab Session and enter `IOT2026`. The Google Form link appears only after that.
4. Sign out. Demo login as the organizer. Create or edit an event and upload a poster.
5. Demo login as admin. Change a user’s role, or show the school list under Admin Panel.
