# DAVV Events

The full write-up is in [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md). It covers what the system does, where each file lives, and why.

Event portal for Devi Ahilya Vishwavidyalaya, Indore. Students browse university-wide events and department events. A department event reveals its Google Form only after the access code for that school is checked.

## Schools

- Computer Science (IIPS — International Institute of Professional Studies)
- Cybersecurity (SCSIT — School of Computer Science & IT)
- Internet of Things (SoI — School of Instrumentation)
- Artificial Intelligence & Data Science (SDSF — School of Data Science and Forecasting)
- Electronics (SOEX — School of Electronics)

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

Use `npm run dev` for the demo. `npm start` expects compiled JavaScript and is not the demo command.

## Sign in

The login page has two options.

Demo login is one click and has no password:

- `organizer@scsit.davv` — Organizer
- `admin@davv.ac.in` — Admin
- `student.cs@iips.davv` — Attendee

Seeded login checks fixed records.

Students enter name, department, and enrollment number. The department list starts empty.

- Ananya Joshi, Cybersecurity (SCSIT), `2025SCSIT014`
- Rohan Patel, Internet of Things (SoI), `2026SOI008`

Organizer and admin enter an ID and password:

- Organizer: `SCSIT-ORG` / `Organizer@2026`
- Admin: `DAVV-ADMIN` / `Admin@2026`

## Access codes

- `CS2026` — Computer Science (IIPS)
- `CYBER2026` — Cybersecurity (SCSIT)
- `IOT2026` — Internet of Things (SoI)
- `AIDS2026` — Artificial Intelligence & Data Science (SDSF)
- `SOEX2026` — Electronics (SOEX)

## Google Form

Seeded events share one registration URL, `DEMO_REGISTRATION_URL` at the top of `server/db.ts`. Replace it with a real `https://docs.google.com/forms/...` or `https://forms.gle/...` link, delete `college_events.db`, and start the app again.

## Campus photos

Landing images live in `src/assets/davv/` as `hero`, `iips`, `scsit`, `soi`, `sdsf`, and `soex`. The map is in `src/utils/posterAssets.ts`. Replace those files with the official DAVV photographs when they are available.
