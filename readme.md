# SAP BTP Trainee Programme: GatePass (CAP Starter Project)

Welcome to the **GatePass** application! This project was built as part of the SAP BTP Trainee Programme to demonstrate the full power of the SAP Cloud Application Programming (CAP) Model using Fiori Elements.

## Business Scenario
**Client**: NubTech Industries Pvt. Ltd. (Plant Security & EHS)

A genuine white-space process: there is no standard SAP transaction that perfectly covers Visitor Gate Passes combined with On-Site Registers and Induction tracking. This CAP app fills that gap.

## Architecture & Features

### 1. Data Model (`db/schema.cds`)
The database is structured using CAP Best Practices and `context` boundaries:
- **`master`**: Plants, Employees, VisitAreas.
- **`config`**: Code Lists for VisitPurposes, IdProofTypes, and PassStatus.
- **`transaction`**: The core document (`VisitorPasses`) with 1:N Compositions for `PassItems` (laptops/materials) and `PassEvents` (immutable audit trail).

### 2. Service Layer (`srv/gatepass-service.cds`)
- **OData V4**: Exposes the Data Model for Fiori UI.
- **Draft Choreography**: Fully supports `@odata.draft.enabled` for robust save-as-you-go document creation.
- **Role-Based Access Control (RBAC)**: Secure access using `@restrict` and `@requires`. `Host`, `SecurityGuard`, `SecuritySupervisor`, and `Admin` roles restrict data visibility and actions.

### 3. Business Logic (`srv/gatepass-service.js`)
All 14 Business Rules are enforced centrally in the service layer:
- **State Machine**: Enforces valid status transitions (e.g., `DRAFT` ➔ `APPROVED` ➔ `ON_SITE` ➔ `CHECKED_OUT`).
- **Data Validation**: Enforces time window restrictions (gate hours, max 12 hours) and mandatory field checks (purpose details, reason for rejection).
- **Security Check**: Enforces Segregation of Duties (a Host cannot approve their own pass).
- **ID Masking**: Masks ID Proof Numbers for standard users, revealing them only to Admins or Guards during active Check-In.

### 4. Background Jobs
- **Day-End Job**: An unbound action (`runDayEndJob`) designed to run at midnight. Automatically marks open passes as `isOverstay` or expires unused `APPROVED` passes to keep the plant register accurate.

### 5. Automated Tests (`test/gatepass.test.js`)
10 automated unit tests utilizing `@sap/cds/test` verify the absolute integrity of all business rules, draft workflows, and system-field immutability.

### 6. Fiori Elements UI (`app/`)
- **My Passes**: S1 (List Report) & S2 (Object Page) optimized for Hosts to request and manage visitors.
- **Gate Console**: S3 (List Report) optimized for Guards featuring quick Check-In/Out.
- **Reports**: R1 (On Site Now), R2 (Overstay), and R3 (Daily Footfall) variant views.

## Running the Application Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the tests:
   ```bash
   npm run test
   ```
   *(Note: On Windows, use `node --test test/` if `npm` scripts are restricted).*

3. Start the application with the in-memory SQLite database:
   ```bash
   cds watch
   ```

4. **Testing Authentication**:
   The `package.json` contains mocked authentication profiles:
   - Login as `anitha:pass` (Host) to create a pass.
   - Login as `meera:pass` (Supervisor) to approve a pass.
   - Login as `guard1:pass` (Guard) to check someone in.
   - Login as `admin:pass` (Admin) to view raw ID numbers and master data.

*Built for the SAP BTP Trainee Programme.*
