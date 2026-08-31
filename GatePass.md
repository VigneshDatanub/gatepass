**SAP BTP TRAINEE PROGRAMME — CAP STARTER PROJECT — TRAINEE 1**

**GatePass**

Visitor Gate Pass & On-Site Register — a real client requirement, cut down to the smallest application that still teaches the whole SAP Cloud Application Programming Model.

| **Assigned to**            | Trainee 1                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Client / business area** | NubTech Industries Pvt. Ltd. — Plant Security & EHS. A genuine white-space process: no SAP standard transaction covers it, which is exactly why it becomes a BTP side-app. |
| **Duration**               | 5 working days                                                                                                                                                             |
| **Size**                   | 1 document · 3 child/master tables · 4 config and code lists · 7 actions · 12 business rules                                                                               |
| **Stack**                  | CDS · Node.js · OData V4 · Fiori Elements · SQLite locally → SAP HANA Cloud                                                                                                |
| **Pairs with**             | Trainee 2 — BreakFix (Machine Breakdown Job Card). Same skeleton, same rubric, different business. Compare notes on CAP; do not compare business logic.                    |
| **Prepared by**            | Functional & Technical Enablement Team, DataNub                                                                                                                            |
| **Version**                | v1.0 — released for training                                                                                                                                               |

**Read Sections 1 to 9 before you open an editor.** They tell you what the business needs and why. Section 10 onwards tells you how to build it. Every rule has an ID — quote it in your commit message, in a comment where you implement it, and in the name of the test that proves it. If you cannot say which rule or which field a line of your code serves, you invented it: delete it, or ask.

**1\. The Client and the Pain**

NubTech Industries Pvt. Ltd. — 1,400 employees, four plants (Chennai, Hosur, Pune, Baddi), head office in Chennai. About 60 visitors are admitted across the four gates every working day: supplier engineers, customer auditors, contractor labour, couriers, interview candidates, inspectors.

EHS policy 9.1 says three things. Every visitor is pre-registered by an employee who takes responsibility for them. Nobody enters the shop floor without a valid safety induction. At any moment the security office can produce a list of everyone inside the plant. None of the three can be enforced today, because the gate runs on a paper register: the visitor writes their own details, the guard telephones the employee, a plastic badge comes off a hook board, and the exit column gets filled in when somebody remembers.

| **#** | **Pain point observed today**                                   | **Business impact**                                                                        | **Measured**                                                   |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| P1    | Paper register, handwritten by the visitor at the gate.         | Names and mobile numbers illegible. Not searchable, not reportable.                        | 4 registers per plant per year                                 |
| P2    | No pre-registration — the guard telephones the host on arrival. | The visitor waits at the gate while the host is hunted down.                               | Avg 11 min gate wait, ~60 visitors/day                         |
| P3    | The exit column is filled in only when somebody remembers.      | The register shows people inside who left days ago. The evacuation muster list is fiction. | Fire drill 2026-03: muster took 34 min against an 8 min target |
| P4    | Safety induction validity is never checked at the gate.         | Contractors reach the shop floor on an expired induction. Statutory exposure.              | EHS finding 2026-02 — 2 entries on expired induction           |
| P5    | Badges are handed out from a hook board with no record.         | Badges are not returned and get reused; a badge cannot be traced to a person.              | 47 badges unaccounted                                          |
| P6    | Laptops, tools and samples walk in and out unrecorded.          | No proof of what came in, so no basis to challenge what goes out.                          | 3 disputes last FY, all closed unproven                        |

**P3 is the one that matters.** The others are inconvenient. If a fire breaks out and the security officer cannot say within seconds who is inside, the company answers to a factory inspector. Several decisions in this specification look fussy — check-out is its own action, a pass can never be cancelled once the visitor is inside, the day-end job flags an overstay instead of quietly closing it. All of them exist because of P3. Do not simplify them away.

**2\. What We Are Building**

One application on SAP BTP. The host pre-registers the visitor before the visit. The system checks the request against the rules configured for the area being visited and routes it for approval only when that area needs it. The guard admits the visitor against an approved pass and records the badge. The guard checks the visitor out at the gate. The security office can answer who is on site right now, at any second of the day.

| **Pain** | **TO-BE capability**                                                                                                       | **Benefit**                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| P1       | Structured pre-registration typed by the host, who actually knows the visitor.                                             | Legible, searchable, reportable.                  |
| P2       | The pass is approved before the visitor arrives; the guard verifies the ID and presses Check In.                           | Gate wait from ~11 min to under 1 min.            |
| P3       | Check-out is a mandatory action. On Site Now is derived from status, not from a column somebody remembers to fill.         | A muster list correct by construction.            |
| P4       | Areas needing induction are configuration (BR-05). The reference and expiry are validated at submit and again at check-in. | An expired induction cannot reach the shop floor. |
| P5       | Badge captured at check-in, unique among visitors currently on site, released at check-out (BR-08).                        | Every badge traceable to a person and a time.     |
| P6       | Items carried are declared on the pass and verified back out at check-out (BR-09).                                         | Disputes become resolvable.                       |

**In scope**

- Create, edit, submit, cancel and copy a visitor pass, with the items the visitor carries in.
- Single-step approval by the security supervisor, required only for areas configured as approval-relevant.
- Gate operations: check in with badge issue, check out with item verification.
- A day-end job: expire passes never used, flag visitors still on site past their validity.
- Master and configuration data in the app: employees, plants, visit areas, purposes, ID proof types.
- An immutable event log of every status change, role-based access, and masking of the visitor ID number.
- Fiori Elements UI for three personas, and the three reports in Section 10.

**Out of scope — say this out loud before anybody assumes otherwise**

- All hardware: turnstiles, boom barriers, biometrics, RFID, cameras, photo capture, badge printers. The guard types a badge number.
- SMS or e-mail notification. The worklists are the notification mechanism.
- Vehicle and material gate entry as documents of their own. Items are declared on the visitor pass.
- The safety induction itself — the app stores the reference and expiry and validates the date; the induction happens in the EHS system.
- Multi-level approval chains, budgets, and any ERP integration. Native mobile app.

**Consultant habit.** Always write the out-of-scope list, before anybody asks for it. Most project failures are not technical — they are two people holding different assumptions about what a visitor app means. One of them is picturing turnstiles.

**3\. Personas and Roles**

| **Persona**         | **Role code**      | **What they do**                                                                                       | **Volume**         |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------ | ------------------ |
| Host — any employee | Host               | Pre-registers a visitor, declares items, submits, tracks, cancels. Sees only their own passes.         | ~1,400 users       |
| Security Supervisor | SecuritySupervisor | Approves or rejects passes for approval-relevant areas at their plant. Reads all passes at that plant. | 4 users            |
| Security Guard      | SecurityGuard      | Works the gate console: verifies ID, issues the badge, checks in, verifies items, checks out.          | 12 users, 3 shifts |
| Administrator       | Admin              | Maintains master and configuration data, runs the day-end job. Reads everything.                       | 2 users            |

**Segregation of duties — build it, then prove it.** The host requests but never approves and never admits. The supervisor approves but never operates the gate. The guard admits but never approves. A host who also holds the supervisor role may never approve their own pass (BR-11). This is the first thing an auditor tests, and here it is TC-08 and TC-09.

**4\. Process Flow**

HOST SYSTEM SUPERVISOR GUARD AT GATE

\==== ====== ========== =============

(1) Create ----> \[DRAFT\] private, no rules yet | |

\+ items | | |

(2) Submit -----> \[validate BR-01..BR-06\] | |

| | assign passNo (BR-12) | |

| | area.requiresApproval ? | |

| | no -> APPROVED -------------------------------> |

| | yes -> REQUESTED ---------->| |

| | (3) Approve / Reject + reason (BR-10) |

| |<--------------------------------| |

| | APPROVED / REJECTED ------------------------------> |

| | (4) Visitor arrives: verify ID, |

| | type badge, Check In (BR-06..08) |

| |<-------------------------------------------------------- |

| | ON_SITE, arrival stamped by the server |

| | (5) Visitor leaves: verify items, |

| | collect badge, Check Out (BR-09) |

| |<-------------------------------------------------------- |

| | CHECKED_OUT, departure stamped, duration computed |

|&lt;-- status visible to the host at every step ---------------------------&gt; |

| **Step** | **Actor**  | **Action**                                             | **System does**                                                                                                                                                           | **Status after**      |
| -------- | ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1        | Host       | Create the pass and its items.                         | Private draft. Autosaved. No rules applied yet.                                                                                                                           | DRAFT                 |
| 2        | Host       | Submit.                                                | Runs BR-01 to BR-06. Assigns passNo (BR-12). Decides from the area whether approval is needed (BR-04). Writes the first event row (BR-12). Header and items go read-only. | REQUESTED or APPROVED |
| 3        | Supervisor | Approve or Reject.                                     | Reject demands a reason of at least 10 characters (BR-10). Either way one event row.                                                                                      | APPROVED or REJECTED  |
| 4        | Guard      | Visitor arrives — verify ID, type badge, Check In.     | Validates the window and the induction (BR-06), the visitor is not already on site (BR-07), the badge is free (BR-08). Stamps arrival.                                    | ON_SITE               |
| 5        | Guard      | Visitor leaves — tick items, collect badge, Check Out. | Every returnable item confirmed (BR-09). Stamps departure, computes duration, releases the badge.                                                                         | CHECKED_OUT           |
| 6        | Admin      | Day-end job, once each evening.                        | APPROVED passes past validity and never used become EXPIRED. Passes still ON_SITE past validity are flagged, never auto-closed.                                           | EXPIRED, or flagged   |

**Exception flows — the ones people forget**

| **Situation**                          | **What must happen, and why**                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The visit is called off.               | Host cancels. Allowed from DRAFT, REQUESTED and APPROVED only. The pass stays visible and countable — deleting it destroys the audit trail.                     |
| The visitor never turns up.            | The day-end job moves APPROVED to EXPIRED. Nobody has to remember anything.                                                                                     |
| Still inside at 21:00, past validity.  | Overstay flag, appears on the supervisor report, status stays ON_SITE. The system never invents a departure time — that is P3 again, with a computer behind it. |
| The badge is lost.                     | Check-out proceeds with a remark; the badge number stays blocked until an Admin releases it. A lost badge is a security event, not a data-entry inconvenience.  |
| The visitor is 40 minutes early.       | Check-in is allowed from 30 min before validFrom (BR-06). Earlier is a hard error — the host must extend the pass and take responsibility for the extra time.   |
| Rejected, and the host wants to retry. | Copy to a new DRAFT (BR-13) and submit that. A rejected pass is never reopened; the reason must stay readable exactly as written.                               |

**5\. Data Model**

Employees ---host---+ +--- VisitAreas (requiresApproval, requiresInduction)

| |

Plants ----plant----+---> VisitorPasses <-+--- VisitPurposes, IdProofTypes, PassStatus (code lists)

| |

composition (owned)| |composition (owned, write once)

PassItems PassEvents

| **Entity**                                | **Kind**                  | **What it is**                                                                                     |
| ----------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| VisitorPasses                             | Transactional header      | One planned or actual visit by one visitor. The only document in this application.                 |
| PassItems                                 | Owned child (Composition) | One line per item carried in: laptop, toolkit, sample box. Returnable flag, returned-at-exit flag. |
| PassEvents                                | Owned child, write once   | One row per status change: from, to, who, when, remark. Never updated or deleted, by anybody.      |
| Employees                                 | Master                    | Everybody who can be a host. Default plant, active flag.                                           |
| Plants                                    | Master                    | The four sites, with gate opening hours.                                                           |
| VisitAreas                                | Configuration             | Office, shop floor, warehouse, lab. Carries the two flags that drive the whole process.            |
| VisitPurposes / IdProofTypes / PassStatus | Code lists                | Short translatable lists with a code and a description.                                            |

| **Relationship**                                 | **Which**               | **The test that proves it**                                                                                                                                                      |
| ------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pass → PassItems, Pass → PassEvents              | Composition (ownership) | Does a declared item or an event mean anything with no visit attached? No. Deep insert and cascade delete are correct here.                                                      |
| Pass → Employees, Plants, VisitAreas, code lists | Association (reference) | Does the employee exist when there is no pass? Obviously. Deleting a pass must never touch master data — and never copy the name onto the pass, read it through the association. |

**The question your mentor asks on Day 1.** If PassItems were an independent entity that merely points back at a pass, name three things in this specification that break. If you cannot answer in under a minute, you are not ready to leave the whiteboard.

**6\. Entity and Field Specification**

This is the contract between the consultant and the developer. If a field is not here, it does not exist in the build — a gap is raised and added, never invented silently. Mand.: Yes = the user supplies it, Sys = the system sets it and no user may ever type it, Cond. = only under the stated condition. Ref → X means it points at a row in X.

**6.1 VisitorPasses**

| **Field**                                    | **Type**            | **Mand.** | **Meaning and rule**                                                                                               |
| -------------------------------------------- | ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| ID                                           | UUID                | Sys       | Technical key. Never shown.                                                                                        |
| passNo                                       | String(16)          | Sys       | GP-&lt;plant&gt;-&lt;YYYY&gt;-&lt;5 digits&gt;. Assigned at submit, never at draft creation. Never reused (BR-12). |
| host                                         | Ref → Employees     | Sys       | Always the logged-in user. Not selectable — nobody registers a visitor on someone else's behalf.                   |
| plant                                        | Ref → Plants        | Yes       | Defaults from the host's employee record.                                                                          |
| area                                         | Ref → VisitAreas    | Yes       | Must be active and belong to the chosen plant. Drives BR-04 and BR-05.                                             |
| purpose                                      | Ref → VisitPurposes | Yes       | See 6.5.                                                                                                           |
| purposeDetail                                | String(200)         | Cond.     | Mandatory when purpose = OTHER, minimum 15 characters.                                                             |
| visitorName                                  | String(80)          | Yes       | Minimum 3 characters.                                                                                              |
| visitorCompany                               | String(80)          | Yes       | Free text. A supplier master link is deliberately out of scope.                                                    |
| visitorMobile                                | String(10)          | Yes       | Exactly 10 digits, first digit 6–9. Also the key for BR-07 and BR-13.                                              |
| idProofType                                  | Ref → IdProofTypes  | Yes       | See 6.5.                                                                                                           |
| idProofNumber                                | String(20)          | Yes       | Stored in full. Returned masked to everyone except the guard at check-in and the Admin (BR-14).                    |
| visitDate                                    | Date                | Yes       | Not in the past (BR-01).                                                                                           |
| validFrom / validTo                          | Time                | Yes       | validTo after validFrom, same day, window at most 12 h, inside plant gate hours (BR-02).                           |
| inductionRef                                 | String(30)          | Cond.     | Mandatory when the area has requiresInduction (BR-05).                                                             |
| inductionValidTill                           | Date                | Cond.     | Mandatory with inductionRef. On or after visitDate (BR-05).                                                        |
| vehicleNo                                    | String(15)          | No        | Gate log only.                                                                                                     |
| status                                       | Ref → PassStatus    | Sys       | Changed only by the actions in Section 7. Never patched directly.                                                  |
| badgeNo                                      | String(10)          | Sys       | Captured by the guard at check-in. Unique among ON_SITE passes (BR-08).                                            |
| actualInAt / actualOutAt                     | DateTime            | Sys       | Stamped by the server. Never accepted from a browser.                                                              |
| durationMinutes                              | Integer             | Sys       | Computed at check-out from the two timestamps.                                                                     |
| isOverstay                                   | Boolean             | Sys       | Set by the day-end job.                                                                                            |
| rejectionReason                              | String(200)         | Cond.     | Mandatory on reject, minimum 10 characters (BR-10). Read-only forever after.                                       |
| items / events                               | Composition         | —         | See 6.2 and 6.3.                                                                                                   |
| createdAt, createdBy, modifiedAt, modifiedBy | managed aspect      | Sys       | Never write these yourself. CAP maintains them.                                                                    |

**Three fields that must never be accepted from the browser.** passNo, actualInAt, actualOutAt. If a PATCH can set them, a visitor can be given a departure time they never had and the whole register is worthless. Prove on Day 5 that sending them changes nothing.

**6.2 PassItems — owned by the pass**

| **Field**          | **Type**                | **Mand.** | **Meaning and rule**                                                                                    |
| ------------------ | ----------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| ID / pass / itemNo | UUID / parent / Integer | Sys       | Key, composition parent, line number 10, 20, 30 … Gaps are fine.                                        |
| description        | String(100)             | Yes       | Minimum 3 characters. 'Laptop' is acceptable; 'asdf' is not.                                            |
| serialNo           | String(40)              | No        | Strongly recommended for laptops — the guard cannot argue at the gate about an item with no identifier. |
| quantity           | Integer                 | Yes       | Between 1 and 99.                                                                                       |
| isReturnable       | Boolean                 | Yes       | Default true. False for a sample being handed over.                                                     |
| returnedAtExit     | Boolean                 | Sys       | Ticked by the guard at check-out. Blocks check-out while any returnable item is unticked (BR-09).       |
| exitRemark         | String(100)             | Cond.     | Mandatory when a returnable item is not confirmed and the guard forces the check-out.                   |

**6.3 PassEvents — write once, never touched again**

| **Field**             | **Type**                | **Meaning and rule**                                                         |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| ID / pass / seq       | UUID / parent / Integer | Key, composition parent, event order within the pass.                        |
| fromStatus / toStatus | String(12)              | Status before and after. fromStatus is empty on the first event.             |
| action                | String(20)              | SUBMIT, APPROVE, REJECT, CHECK_IN, CHECK_OUT, CANCEL, EXPIRE, OVERSTAY.      |
| actor / actedAt       | String(80) / DateTime   | The logged-in user from req.user — never from the payload — and server time. |
| remark                | String(200)             | Mandatory for REJECT and for a forced check-out.                             |

**Write once means write once.** No user, no role, no screen, not the Admin, not the person who wrote it two minutes ago, may update or delete a PassEvent. Enforce it on the server, not by leaving the button off the UI. TC-10 tests it with a hand-written request.

**6.4 Master and configuration data**

| **Entity** | **Fields**                                                                                                     | **Rules**                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Employees  | empNo (unique), name, email (unique, matched against req.user.id), department, defaultPlant → Plants, isActive | An inactive employee cannot host a new pass but stays readable on old ones (BR-03). Never hard-deleted.              |
| Plants     | code (key: 1000/2000/3000/4000), name, city, gateOpenTime, gateCloseTime, isActive                             | Gate hours are used by BR-02. Inactive plants leave the value help but old passes still resolve.                     |
| VisitAreas | code (key), plant → Plants, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive             | An area is defined per plant. The two booleans drive BR-04 and BR-05 — this is the configuration-versus-code lesson. |

**The question that separates a developer from a consultant.** EHS decides that from 1 October the R&D lab also needs an induction. Describe exactly what changes. If any part of your answer is 'change the code', redesign the model — that request should never reach a developer at all.

**6.5 Code lists**

| **Code list** | **Values**                                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VisitPurposes | SUPPLIER (supplier or vendor meeting) · CUSTOMER (customer visit or audit) · INTERVIEW · SERVICE (AMC or breakdown engineer) · COURIER · GOVT (statutory inspection) · OTHER (forces purposeDetail)                                       |
| IdProofTypes  | AADHAAR · PAN · DL (driving licence) · PASSPORT · EMPCARD (employee card of another company)                                                                                                                                              |
| PassStatus    | DRAFT · REQUESTED · APPROVED · REJECTED · ON_SITE · CHECKED_OUT · CANCELLED · EXPIRED. Give it a criticality element so Fiori colours the badge: 1 red REJECTED/EXPIRED, 2 amber REQUESTED, 3 green APPROVED/CHECKED_OUT, 5 blue ON_SITE. |

**7\. Status Lifecycle**

DRAFT --submit--> REQUESTED --approve--> APPROVED --check in--> ON_SITE --check out--> CHECKED_OUT

| | | ^ | (terminal)

| | +---reject+reason--> REJECTED (terminal) +-- past validTo --> isOverstay = true

| | (status unchanged)

| +--- area.requiresApproval = false: submit goes straight to APPROVED

|

+--- cancel from DRAFT / REQUESTED / APPROVED --> CANCELLED never from ON_SITE (BR-04 note, BR-09)

APPROVED, validity passed, never used --day-end job--> EXPIRED

Anything not in this table is forbidden. Put the check in one place on the server that every action calls — not scattered across seven handlers.

| **From**                     | **To**      | **Trigger**   | **Who**                  | **Conditions**                                                           |
| ---------------------------- | ----------- | ------------- | ------------------------ | ------------------------------------------------------------------------ |
| —                            | DRAFT       | Create        | Host                     | None. A draft has no rules.                                              |
| DRAFT                        | REQUESTED   | Submit        | Host (owner)             | BR-01 to BR-06 pass and area.requiresApproval is true.                   |
| DRAFT                        | APPROVED    | Submit        | Host (owner)             | BR-01 to BR-06 pass and area.requiresApproval is false.                  |
| REQUESTED                    | APPROVED    | Approve       | Supervisor of that plant | Not the host themselves (BR-11).                                         |
| REQUESTED                    | REJECTED    | Reject        | Supervisor of that plant | Reason of at least 10 characters (BR-10).                                |
| APPROVED                     | ON_SITE     | Check In      | Guard of that plant      | BR-06 window and induction, BR-07 not already on site, BR-08 badge free. |
| ON_SITE                      | CHECKED_OUT | Check Out     | Guard of that plant      | Every returnable item confirmed or remarked (BR-09).                     |
| DRAFT / REQUESTED / APPROVED | CANCELLED   | Cancel        | Host (owner)             | Only before check-in.                                                    |
| APPROVED                     | EXPIRED     | Day-end job   | System (Admin runs it)   | Validity passed and never checked in.                                    |
| ON_SITE                      | ON_SITE     | Overstay flag | System (Admin runs it)   | validTo passed. Only isOverstay changes.                                 |

**The transition that does not exist.** ON_SITE → CANCELLED. There is no such transition and there never will be. A person is physically inside a factory; the only way that pass ends is a human at the gate pressing Check Out. A trainee who adds it to make a test easier has misunderstood the application.

**8\. Business Rules**

Quote the ID in your commit, in a comment, and in the test name. The message column is what the user must actually see — put those texts in i18n, never hard-coded in the middle of your logic.

| **ID** | **Rule**                                                                                                                               | **When**                           | **Message the user sees**                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01  | visitDate is not in the past.                                                                                                          | Save, Submit                       | A pass cannot be raised for a date that has already passed.                                                                           |
| BR-02  | validTo after validFrom, both on visitDate, window at most 12 h, inside the plant gate hours.                                          | Save, Submit                       | The visit window must end after it starts. / A pass cannot cover more than 12 hours. / Plant {0} admits visitors between {1} and {2}. |
| BR-03  | visitorName ≥ 3 chars; visitorMobile exactly 10 digits starting 6–9; host, plant and area all active.                                  | Submit                             | Enter a valid 10-digit mobile number. / {0} is no longer active and cannot host a visitor.                                            |
| BR-04  | If the area has requiresApproval, submit goes to REQUESTED; otherwise straight to APPROVED.                                            | Submit                             | No message — this is determination, not validation. But the resulting status must be obvious on the screen.                           |
| BR-05  | If the area has requiresInduction, inductionRef is mandatory and inductionValidTill ≥ visitDate.                                       | Submit, and again at Check In      | Area {0} requires a valid safety induction. / The induction expired on {0}; the visitor cannot enter {1}.                             |
| BR-06  | Check-in only from 30 minutes before validFrom until validTo, on visitDate.                                                            | Check In                           | This pass is valid from {0} to {1} on {2}. Ask the host to extend it.                                                                 |
| BR-07  | The same visitorMobile cannot be ON_SITE on two passes at once, across all plants.                                                     | Submit (warning), Check In (error) | Warning: this visitor already has an open pass today at {0}. Error: already on site at {0} on pass {1} — check them out there first.  |
| BR-08  | badgeNo is mandatory at check-in and must not be held by another ON_SITE pass.                                                         | Check In                           | Enter the badge number issued. / Badge {0} is already issued to {1} on pass {2}.                                                      |
| BR-09  | Check-out is blocked while any returnable item is unconfirmed, unless the guard gives a remark for each.                               | Check Out                          | {0} returnable item(s) not confirmed: {1}. Confirm them, or record why they are not leaving.                                          |
| BR-10  | Rejection needs a reason of at least 10 characters.                                                                                    | Reject                             | Give a reason of at least 10 characters. The host has to be able to act on it.                                                        |
| BR-11  | Nobody may approve a pass on which they are the host, even holding the supervisor role.                                                | Approve                            | You cannot approve a visitor you are hosting yourself.                                                                                |
| BR-12  | passNo drawn at submit, per plant per year, never reused. Every status change writes exactly one PassEvent in the same transaction.    | Every action                       | No message. If the event row cannot be written the whole action rolls back — status and audit commit together or not at all.          |
| BR-13  | Copy: any pass copies into a new DRAFT. Visitor details, ID proof and items carry over; number, status, dates, badge and times do not. | Copy                               | Pass copied from {0}. Check the dates and the induction validity before submitting.                                                   |
| BR-14  | idProofNumber is returned masked (last 4 characters) to every role except the guard during check-in, and the Admin.                    | Every read                         | No message. Mask on the server in an after-read handler. Never in the UI.                                                             |

**Error, warning, or neither — BR-07 is the one to study.** At submit, the same visitor holding another open pass is a warning: the host may legitimately be registering tomorrow's visit. At check-in it is a hard error, because the muster list would go wrong. Same rule, same data, two severities at two moments. Being able to explain why is worth more than any code you write this week.

**9\. Authorization**

C = create, R = read, U = update, D = delete. Own = rows where the logged-in user is the host. Plant = restricted to that user's plant.

| **Object / action**    | **Host**                         | **Guard**                                    | **Supervisor**            | **Admin**                             |
| ---------------------- | -------------------------------- | -------------------------------------------- | ------------------------- | ------------------------------------- |
| VisitorPasses          | C R U D (own; U/D only in DRAFT) | R (plant: today and on-site)                 | R (plant)                 | R (all)                               |
| PassItems              | C R U D (own draft)              | U (returnedAtExit, exitRemark, at check-out) | R (plant)                 | R (all)                               |
| PassEvents             | R (own)                          | R (plant)                                    | R (plant)                 | R (all) — never U, never D            |
| Master and config data | R (value help)                   | R                                            | R                         | C R U — deactivate, never hard delete |
| submit / cancel / copy | Yes (own)                        | —                                            | —                         | —                                     |
| approve / reject       | —                                | —                                            | Yes (plant, not own pass) | —                                     |
| checkIn / checkOut     | —                                | Yes (plant)                                  | —                         | —                                     |
| runDayEndJob           | —                                | —                                            | —                         | Yes                                   |
| idProofNumber          | Masked                           | Full, only during check-in                   | Masked                    | Full                                  |

**Instance-based authorization is the hard part, and it is the point.** Restricting by role is one annotation. Restricting a host to their own passes and a guard to their own plant is @restrict with a where clause evaluated against the logged-in user. TC-09 logs in as a second host and opens the first host's pass by direct URL — that must come back 403 or empty, never data.

**10\. Screens and Reports**

| **#** | **Screen / report**                                          | **Persona**           | **Must show and do**                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1    | My Visitor Passes (List Report + Object Page, draft enabled) | Host                  | Own passes, filterable by status and date, status as a coloured badge. Create, edit draft, submit, cancel, copy. Object page shows header, items and the event history.                                                            |
| S2    | Approval Worklist                                            | Supervisor            | Only REQUESTED passes for that plant, oldest first, with an ageing column. Approve and Reject; Reject opens a dialog demanding the reason.                                                                                         |
| S3    | Gate Console                                                 | Guard                 | Tab 1 Expected Today: APPROVED passes for today, one search box matching mobile number or name, Check In asks for the badge. Tab 2 On Site Now: every ON_SITE pass with time inside, Check Out opens the item verification dialog. |
| R1    | On Site Now — the muster list                                | Security office       | Every ON_SITE pass grouped by plant and area: visitor, company, host, host mobile, badge, time in, minutes inside. This report is the business case.                                                                               |
| R2    | Overstay list                                                | Supervisor            | ON_SITE passes past validTo, longest over first. Also the output of the day-end job.                                                                                                                                               |
| R3    | Visitor footfall                                             | Plant head, ISO audit | Count of passes and average duration by plant, area, purpose and month, over CHECKED_OUT passes.                                                                                                                                   |

**The one screen requirement that is not negotiable.** On the Gate Console, a single search box must find a visitor by mobile number or by name. A guard with a queue does not pick a filter field first. Test it by timing yourself: pass found and visitor checked in, in under 15 seconds.

**11\. The 5-Day Build Plan**

| **Day**     | **Milestone**                   | **Build**                                                                                                                                                                                     | **Gate — done only when all of this is true**                                                                                                                                                                              |
| ----------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 am        | M0 Model                        | Read Sections 1–9. Draw the model and the status diagram on a whiteboard. List every system-set field. cds init, cds watch running, committed.                                                | The whiteboard covers every field in Section 6. You can say of any relationship: composition or association, and why. You can explain why passNo is assigned at submit.                                                    |
| 1 pm – 2    | M1 Model + master data          | All entities in db/schema.cds with aspects, associations, compositions, code lists. All CSVs from Section 12. First service projection and the Fiori preview.                                 | cds deploy loads every CSV with no skipped rows. The list shows host, plant and status resolved through associations. \$expand=items works. Nothing can be hard-deleted.                                                   |
| 2 pm – 3 am | M2 Pass + validation            | Header and items on one object page with drafts. @mandatory / @assert for BR-02 and BR-03. Handler validation for BR-01, BR-03, BR-05. Value helps on active rows only. All messages in i18n. | A pass with three problems reports all three, not the first. A draft is invisible to every other user including Admin — prove it in a second browser. A DRAFT has no passNo, shown in the database.                        |
| 3 pm        | M3 Status machine               | One transition table used by every action. submit (BR-04, BR-12), approve, reject (BR-10, BR-11), cancel. PassEvents written in the same transaction.                                         | OFFICE submit lands APPROVED, SHOPFLOOR lands REQUESTED — one config column, two outcomes, no code change. Kill the process between the status update and the event insert: the status change rolled back too.             |
| 4           | M4 The gate                     | checkIn (BR-05 recheck, BR-06, BR-07, BR-08). checkOut (BR-09, duration, badge released). Gate Console S3. Report R1.                                                                         | 31 min early refused, 29 min allowed. The same mobile cannot check in twice, and the error names the other pass. An in-use badge is refused, and accepted again after that visitor leaves. R1 shows exactly who is inside. |
| 5           | M5 Security, job, tests, deploy | xs-security.json, @requires and @restrict with where clauses, BR-14 masking, the day-end job, reports R2 and R3, cds.test for every case in Section 13, MTA deploy to HANA Cloud.             | Every test in Section 13 passes, run by the mentor as each persona. npm test green from a clean checkout in one command. The day-end job run twice changes nothing the second time. Same model file runs on HANA.          |

**12\. Test Data**

Load exactly this — you and your mentor will be testing against these values all week. File names follow the CAP convention: db/data/nub.gatepass-Plants.csv and so on.

**12.1 Plants**

| **code** | **name**              | **city** | **gateOpenTime** | **gateCloseTime** | **isActive** |
| -------- | --------------------- | -------- | ---------------- | ----------------- | ------------ |
| 1000     | NubTech Chennai Works | Chennai  | 07:00:00         | 20:00:00          | true         |
| 2000     | NubTech Hosur Plant   | Hosur    | 06:30:00         | 21:00:00          | true         |
| 3000     | NubTech Pune Plant    | Pune     | 07:00:00         | 19:30:00          | true         |
| 4000     | NubTech Baddi Unit    | Baddi    | 08:00:00         | 18:00:00          | false        |

**12.2 VisitAreas — the two flags are the whole point**

| **code**  | **plant** | **name**                     | **requiresApproval** | **requiresInduction** | **maxVisitorsOnSite** | **isActive** |
| --------- | --------- | ---------------------------- | -------------------- | --------------------- | --------------------- | ------------ |
| OFFICE    | 1000      | Administration Block         | false                | false                 | (blank)               | true         |
| SHOPFLOOR | 1000      | Machine Shop & Assembly      | true                 | true                  | 15                    | true         |
| WAREHOUSE | 1000      | Finished Goods Warehouse     | true                 | true                  | 8                     | true         |
| RNDLAB    | 1000      | R&D Laboratory               | true                 | false                 | 5                     | true         |
| CANTEEN   | 1000      | Canteen Block                | false                | false                 | (blank)               | true         |
| OFFICE    | 2000      | Hosur Office                 | false                | false                 | (blank)               | true         |
| SHOPFLOOR | 2000      | Hosur Press Shop             | true                 | true                  | 20                    | true         |
| OLDBLOCK  | 1000      | Old Admin Block (demolished) | false                | false                 | (blank)               | false        |

**12.3 Employees**

| **empNo** | **name**            | **email**                       | **department** | **defaultPlant** | **isActive** |
| --------- | ------------------- | ------------------------------- | -------------- | ---------------- | ------------ |
| E1001     | Anitha Raman        | <anitha.raman@nubtech.example>  | Purchase       | 1000             | true         |
| E1002     | Karthik Subramanian | <karthik.s@nubtech.example>     | Production     | 1000             | true         |
| E1003     | Meera Joseph        | <meera.joseph@nubtech.example>  | Quality        | 1000             | true         |
| E1004     | Rakesh Bhatia       | <rakesh.bhatia@nubtech.example> | Security       | 1000             | true         |
| E1005     | Suresh Iyer         | <suresh.iyer@nubtech.example>   | Maintenance    | 2000             | true         |
| E1006     | Deepak Nair         | <deepak.nair@nubtech.example>   | Purchase       | 1000             | false        |

**E1006 and OLDBLOCK are inactive on purpose.** They exist so BR-03 has something to fail on. Every test data set you ever write should contain at least one row whose only job is to make a rule fire. If all your data is valid, you have tested nothing.

**12.4 Test users — configure under cds.requires.auth.users in package.json**

| **Login** | **Is employee** | **Roles**                                                               |
| --------- | --------------- | ----------------------------------------------------------------------- |
| anitha    | E1001           | Host                                                                    |
| karthik   | E1002           | Host                                                                    |
| meera     | E1003           | Host + SecuritySupervisor (plant 1000) — this user exists to test BR-11 |
| rakesh    | E1004           | SecuritySupervisor (plant 1000)                                         |
| guard1    | —               | SecurityGuard (plant 1000)                                              |
| guard2    | —               | SecurityGuard (plant 2000) — exists to test plant-level restriction     |
| admin     | —               | Admin                                                                   |

**12.5 Starting passes**

| **passNo**         | **visitor / company**             | **mobile** | **plant / area** | **visitDate** | **window**  | **status** | **why it exists**                                                             |
| ------------------ | --------------------------------- | ---------- | ---------------- | ------------- | ----------- | ---------- | ----------------------------------------------------------------------------- |
| GP-1000-2026-00001 | Ramesh Gupta / Alpha Tooling      | 9876543210 | 1000 / SHOPFLOOR | today         | 10:00–13:00 | APPROVED   | The happy path for TC-04. Induction IND-2026-118, valid till 2026-12-31.      |
| GP-1000-2026-00002 | Sneha Kulkarni / Bharat Audit LLP | 9812345678 | 1000 / OFFICE    | today         | 09:30–17:30 | ON_SITE    | Already inside on badge B-014. Makes R1 non-empty and BR-08 testable.         |
| GP-1000-2026-00003 | Imran Qureshi / CoolTech AMC      | 9900112233 | 1000 / SHOPFLOOR | yesterday     | 14:00–17:00 | ON_SITE    | Never checked out. The overstay case for TC-11 and R2.                        |
| GP-1000-2026-00004 | Priya Menon / Nexus Logistics     | 9765432109 | 1000 / WAREHOUSE | yesterday     | 11:00–12:00 | APPROVED   | Never used. Becomes EXPIRED on the first day-end job (TC-11).                 |
| GP-2000-2026-00001 | Ramesh Gupta / Alpha Tooling      | 9876543210 | 2000 / SHOPFLOOR | today         | 10:00–13:00 | APPROVED   | Same mobile as pass 00001 at another plant. This is the BR-07 trap for TC-05. |
| (none — draft)     | Vikram Shah / Zenith Controls     | 9123456780 | 1000 / RNDLAB    | tomorrow      | 10:00–16:00 | DRAFT      | Owned by karthik. Proves drafts are invisible to anitha and to the Admin.     |

**12.6 Items on pass GP-1000-2026-00001**

| **itemNo** | **description**                | **serialNo** | **quantity** | **isReturnable** |
| ---------- | ------------------------------ | ------------ | ------------ | ---------------- |
| 10         | Dell Latitude laptop           | DL7420-88231 | 1            | true             |
| 20         | Torque wrench set              | TW-455-A     | 1            | true             |
| 30         | Sample castings for inspection | (blank)      | 4            | false            |

**13\. Acceptance Test Script**

The mentor runs every case, logged in as the persona named. A self-declared pass is not a pass.

| **ID** | **Scenario**                                                                                                                 | **As**              | **Expected**                                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01  | Raise a pass for OFFICE, all fields valid, submit.                                                                           | anitha              | Straight to APPROVED. passNo in the GP-1000-2026-nnnnn format. One event row DRAFT → APPROVED, action SUBMIT.                                                         |
| TC-02  | Raise a pass for SHOPFLOOR and submit with no induction reference. Then with an induction expiring the day before the visit. | anitha              | Refused on BR-05 both times, with the right message each time. Status stays DRAFT, no passNo, no event row.                                                           |
| TC-03  | Fix the expiry and submit. Then reject it with a 9-character reason, then a valid one.                                       | anitha, then rakesh | REQUESTED, appears on the supervisor worklist. Reject refused at 9 characters, accepted at 10+. Reason stored, event row written, host sees it.                       |
| TC-04  | Approve a valid SHOPFLOOR pass, then check in 45 minutes early, then 20 minutes early.                                       | rakesh, then guard1 | 45 min refused on BR-06 naming the window. 20 min succeeds: ON_SITE, actualInAt stamped by the server, badge recorded.                                                |
| TC-05  | With that visitor on site, submit and try to check in the second pass for the same mobile at plant 2000.                     | anitha, then guard2 | Submit warns but succeeds. Check-in refused on BR-07, and the message names the other pass and plant.                                                                 |
| TC-06  | Check in a visitor on badge B-014, which is already held by pass 00002.                                                      | guard1              | Refused on BR-08 naming the holder. Check pass 00002 out, retry: accepted.                                                                                            |
| TC-07  | Check out with the laptop unconfirmed, then confirm all items and check out.                                                 | guard1              | First refused on BR-09 listing the laptop by name. Then CHECKED_OUT, actualOutAt stamped, durationMinutes matches the timestamps, badge released.                     |
| TC-08  | Send a raw PATCH setting actualInAt, passNo and status on a CHECKED_OUT pass.                                                | curl, any role      | All refused, nothing changes in the database. This is the test that proves the rules live on the server.                                                              |
| TC-09  | Open anitha's pass by direct URL as karthik. Then approve your own pass as meera.                                            | karthik, then meera | 403 or empty — never data. Approval refused on BR-11. This is the segregation-of-duties test an auditor runs first.                                                   |
| TC-10  | Update, then delete, a PassEvent row over OData.                                                                             | admin               | Both refused. The audit trail cannot be edited by anybody in any role.                                                                                                |
| TC-11  | Run the day-end job. Run it again.                                                                                           | admin               | Pass 00004 → EXPIRED with an event row. Pass 00003 → isOverstay set, still ON_SITE, appears on R2. Second run changes nothing and reports zero.                       |
| TC-12  | Open R1 with visitors on site at two plants. Read a pass as each of the four roles.                                          | all                 | R1 shows exactly the on-site visitors, grouped by plant and area. idProofNumber masked for host and supervisor, full for guard during check-in and for Admin (BR-14). |

**14\. Deliverables and Rubric**

- A git repository, one commit per milestone, each message naming the milestone and the rules it implements.
- The application running on SQLite locally and deployed to SAP HANA Cloud where the mentor can reach it.
- npm test green from a clean checkout, in one command.
- A one-page README: how to run it, the test users, and the three decisions you found hardest.
- A 20-minute live demo following Section 4, no slides.

| **Area**                        | **%** | **Full marks means**                                                                                                                                                                                                                                        |
| ------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data model                      | 25    | Every field from Section 6 with the right type. Composition and association used correctly and defended. No copies of data that belongs to master data, and no invented fields.                                                                             |
| Business rules                  | 30    | All 14 rules enforced on the server, each traceable to a named function and a named test. Errors and warnings correctly distinguished, and every error collected rather than only the first.                                                                |
| Status, audit and authorization | 30    | One transition table used by every action, and every transition writing exactly one event row in the same transaction. Roles and instance restriction enforced at the service, proven against raw HTTP calls with no UI involved.                           |
| UI and explanation              | 15    | Three Fiori Elements apps generated from annotations, drafts working, the 15-second check-in passing, every string in i18n. And you can answer any callout question in this document without notes, and say which requirement any line of your code serves. |

**The 10% that predicts everything.** Explanation looks like the smallest slice. It is the one that predicts how a trainee does on a real project. Code that works but cannot be explained is code that cannot be maintained, handed over, or defended to a customer who is unhappy.