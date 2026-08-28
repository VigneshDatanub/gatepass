-- ==========================================================================
-- SQL Script for GatePass Database Schema and Sample Data (ERD Builder)
-- Generated on 2026-08-27T04:43:47.572Z
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 0. Drop existing tables if they exist
-- --------------------------------------------------------------------------

DROP TABLE IF EXISTS nub_gatepass_transaction_PassEvents;
DROP TABLE IF EXISTS nub_gatepass_transaction_PassItems;
DROP TABLE IF EXISTS nub_gatepass_transaction_VisitorPasses;
DROP TABLE IF EXISTS nub_gatepass_master_VisitAreas;
DROP TABLE IF EXISTS nub_gatepass_master_Employees;
DROP TABLE IF EXISTS nub_gatepass_master_Plants;
DROP TABLE IF EXISTS nub_gatepass_config_PassStatus;
DROP TABLE IF EXISTS nub_gatepass_config_IdProofTypes;
DROP TABLE IF EXISTS nub_gatepass_config_VisitPurposes;

-- --------------------------------------------------------------------------
-- 1. Schema Definitions (DDL)
-- --------------------------------------------------------------------------

-- Table Structure for nub_gatepass_config_VisitPurposes
CREATE TABLE nub_gatepass_config_VisitPurposes (
  code VARCHAR(12) NOT NULL,
  name VARCHAR(255),
  descr VARCHAR(1000),
  PRIMARY KEY (code)
);

-- Table Structure for nub_gatepass_config_IdProofTypes
CREATE TABLE nub_gatepass_config_IdProofTypes (
  code VARCHAR(12) NOT NULL,
  name VARCHAR(255),
  descr VARCHAR(1000),
  PRIMARY KEY (code)
);

-- Table Structure for nub_gatepass_config_PassStatus
CREATE TABLE nub_gatepass_config_PassStatus (
  code VARCHAR(12) NOT NULL,
  name VARCHAR(255),
  descr VARCHAR(1000),
  criticality INT,
  PRIMARY KEY (code)
);

-- Table Structure for nub_gatepass_master_Plants
CREATE TABLE nub_gatepass_master_Plants (
  code VARCHAR(4) NOT NULL,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(40),
  gateOpenTime TIME,
  gateCloseTime TIME,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP,
  createdBy VARCHAR(255),
  modifiedAt TIMESTAMP,
  modifiedBy VARCHAR(255),
  PRIMARY KEY (code)
);

-- Table Structure for nub_gatepass_master_Employees
CREATE TABLE nub_gatepass_master_Employees (
  ID VARCHAR(36) NOT NULL,
  empNo VARCHAR(10) NOT NULL,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(100) NOT NULL,
  department VARCHAR(40),
  defaultPlant_code VARCHAR(4),
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP,
  createdBy VARCHAR(255),
  modifiedAt TIMESTAMP,
  modifiedBy VARCHAR(255),
  PRIMARY KEY (ID),
  UNIQUE (empNo),
  UNIQUE (email),
  FOREIGN KEY (defaultPlant_code) REFERENCES nub_gatepass_master_Plants (code)
);

-- Table Structure for nub_gatepass_master_VisitAreas
CREATE TABLE nub_gatepass_master_VisitAreas (
  code VARCHAR(20) NOT NULL,
  plant_code VARCHAR(4) NOT NULL,
  name VARCHAR(100) NOT NULL,
  requiresApproval BOOLEAN DEFAULT FALSE,
  requiresInduction BOOLEAN DEFAULT FALSE,
  maxVisitorsOnSite INT,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP,
  createdBy VARCHAR(255),
  modifiedAt TIMESTAMP,
  modifiedBy VARCHAR(255),
  PRIMARY KEY (code, plant_code),
  FOREIGN KEY (plant_code) REFERENCES nub_gatepass_master_Plants (code)
);

-- Table Structure for nub_gatepass_transaction_VisitorPasses
CREATE TABLE nub_gatepass_transaction_VisitorPasses (
  ID VARCHAR(36) NOT NULL,
  passNo VARCHAR(20),
  host_ID VARCHAR(36),
  plant_code VARCHAR(4),
  area_code VARCHAR(20),
  area_plant_code VARCHAR(4),
  purpose_code VARCHAR(12),
  purposeDetail VARCHAR(200),
  visitorName VARCHAR(80),
  visitorCompany VARCHAR(80),
  visitorMobile VARCHAR(10),
  idProofType_code VARCHAR(12),
  idProofNumber VARCHAR(20),
  visitDate DATE,
  validFrom TIME,
  validTo TIME,
  inductionRef VARCHAR(30),
  inductionValidTill DATE,
  vehicleNo VARCHAR(15),
  status_code VARCHAR(12),
  badgeNo VARCHAR(10),
  actualInAt TIMESTAMP,
  actualOutAt TIMESTAMP,
  durationMinutes INT,
  isOverstay BOOLEAN DEFAULT FALSE,
  rejectionReason VARCHAR(200),
  createdAt TIMESTAMP,
  createdBy VARCHAR(255),
  modifiedAt TIMESTAMP,
  modifiedBy VARCHAR(255),
  PRIMARY KEY (ID),
  FOREIGN KEY (host_ID) REFERENCES nub_gatepass_master_Employees (ID),
  FOREIGN KEY (plant_code) REFERENCES nub_gatepass_master_Plants (code),
  FOREIGN KEY (area_code, area_plant_code) REFERENCES nub_gatepass_master_VisitAreas (code, plant_code),
  FOREIGN KEY (purpose_code) REFERENCES nub_gatepass_config_VisitPurposes (code),
  FOREIGN KEY (idProofType_code) REFERENCES nub_gatepass_config_IdProofTypes (code),
  FOREIGN KEY (status_code) REFERENCES nub_gatepass_config_PassStatus (code)
);

-- Table Structure for nub_gatepass_transaction_PassItems
CREATE TABLE nub_gatepass_transaction_PassItems (
  ID VARCHAR(36) NOT NULL,
  pass_ID VARCHAR(36),
  itemNo INT,
  description VARCHAR(100) NOT NULL,
  serialNo VARCHAR(40),
  quantity INT DEFAULT 1,
  isReturnable BOOLEAN DEFAULT TRUE,
  returnedAtExit BOOLEAN DEFAULT FALSE,
  exitRemark VARCHAR(100),
  createdAt TIMESTAMP,
  createdBy VARCHAR(255),
  modifiedAt TIMESTAMP,
  modifiedBy VARCHAR(255),
  PRIMARY KEY (ID),
  FOREIGN KEY (pass_ID) REFERENCES nub_gatepass_transaction_VisitorPasses (ID)
);

-- Table Structure for nub_gatepass_transaction_PassEvents
CREATE TABLE nub_gatepass_transaction_PassEvents (
  ID VARCHAR(36) NOT NULL,
  pass_ID VARCHAR(36),
  seq INT,
  fromStatus VARCHAR(12),
  toStatus VARCHAR(12),
  action VARCHAR(20),
  actor VARCHAR(80),
  actedAt TIMESTAMP,
  remark VARCHAR(200),
  PRIMARY KEY (ID),
  FOREIGN KEY (pass_ID) REFERENCES nub_gatepass_transaction_VisitorPasses (ID)
);

-- --------------------------------------------------------------------------
-- 2. Initial & Sample Data (DML)
-- --------------------------------------------------------------------------

-- Data for nub_gatepass_config_VisitPurposes
INSERT INTO nub_gatepass_config_VisitPurposes (code, name, descr) VALUES ('SUPPLIER', 'Supplier Visit', 'Supplier or vendor meeting');
INSERT INTO nub_gatepass_config_VisitPurposes (code, name, descr) VALUES ('CUSTOMER', 'Customer Visit', 'Customer visit or audit');
INSERT INTO nub_gatepass_config_VisitPurposes (code, name, descr) VALUES ('INTERVIEW', 'Interview', 'Job interview');
INSERT INTO nub_gatepass_config_VisitPurposes (code, name, descr) VALUES ('SERVICE', 'Service Visit', 'AMC or breakdown engineer');
INSERT INTO nub_gatepass_config_VisitPurposes (code, name, descr) VALUES ('COURIER', 'Courier', 'Courier or delivery');
INSERT INTO nub_gatepass_config_VisitPurposes (code, name, descr) VALUES ('GOVT', 'Government Inspection', 'Statutory inspection');
INSERT INTO nub_gatepass_config_VisitPurposes (code, name, descr) VALUES ('OTHER', 'Other', 'Other purpose — requires purposeDetail');

-- Data for nub_gatepass_config_IdProofTypes
INSERT INTO nub_gatepass_config_IdProofTypes (code, name, descr) VALUES ('AADHAAR', 'Aadhaar', 'Aadhaar card');
INSERT INTO nub_gatepass_config_IdProofTypes (code, name, descr) VALUES ('PAN', 'PAN Card', 'Permanent Account Number card');
INSERT INTO nub_gatepass_config_IdProofTypes (code, name, descr) VALUES ('DL', 'Driving Licence', 'Driving licence');
INSERT INTO nub_gatepass_config_IdProofTypes (code, name, descr) VALUES ('PASSPORT', 'Passport', 'Passport');
INSERT INTO nub_gatepass_config_IdProofTypes (code, name, descr) VALUES ('EMPCARD', 'Employee Card', 'Employee card of another company');

-- Data for nub_gatepass_config_PassStatus
INSERT INTO nub_gatepass_config_PassStatus (code, name, descr, criticality) VALUES ('DRAFT', 'Draft', 'Pass is being prepared', 0);
INSERT INTO nub_gatepass_config_PassStatus (code, name, descr, criticality) VALUES ('REQUESTED', 'Requested', 'Awaiting supervisor approval', 2);
INSERT INTO nub_gatepass_config_PassStatus (code, name, descr, criticality) VALUES ('APPROVED', 'Approved', 'Approved and ready for check-in', 3);
INSERT INTO nub_gatepass_config_PassStatus (code, name, descr, criticality) VALUES ('REJECTED', 'Rejected', 'Rejected by the supervisor', 1);
INSERT INTO nub_gatepass_config_PassStatus (code, name, descr, criticality) VALUES ('ON_SITE', 'On Site', 'Visitor is inside the plant', 5);
INSERT INTO nub_gatepass_config_PassStatus (code, name, descr, criticality) VALUES ('CHECKED_OUT', 'Checked Out', 'Visitor has left the plant', 3);
INSERT INTO nub_gatepass_config_PassStatus (code, name, descr, criticality) VALUES ('CANCELLED', 'Cancelled', 'Pass cancelled by the host', 1);
INSERT INTO nub_gatepass_config_PassStatus (code, name, descr, criticality) VALUES ('EXPIRED', 'Expired', 'Pass expired without being used', 1);

-- Data for nub_gatepass_master_Plants
INSERT INTO nub_gatepass_master_Plants (code, name, city, gateOpenTime, gateCloseTime, isActive) VALUES (1000, 'NubTech Chennai Works', 'Chennai', '07:00:00', '20:00:00', TRUE);
INSERT INTO nub_gatepass_master_Plants (code, name, city, gateOpenTime, gateCloseTime, isActive) VALUES (2000, 'NubTech Hosur Plant', 'Hosur', '06:30:00', '21:00:00', TRUE);
INSERT INTO nub_gatepass_master_Plants (code, name, city, gateOpenTime, gateCloseTime, isActive) VALUES (3000, 'NubTech Pune Plant', 'Pune', '07:00:00', '19:30:00', TRUE);
INSERT INTO nub_gatepass_master_Plants (code, name, city, gateOpenTime, gateCloseTime, isActive) VALUES (4000, 'NubTech Baddi Unit', 'Baddi', '08:00:00', '18:00:00', FALSE);

-- Data for nub_gatepass_master_Employees
INSERT INTO nub_gatepass_master_Employees (ID, empNo, name, email, department, defaultPlant_code, isActive) VALUES ('00000000-0000-0000-0000-000000001001', 'E1001', 'Anitha Raman', 'anitha.raman@nubtech.example', 'Purchase', 1000, TRUE);
INSERT INTO nub_gatepass_master_Employees (ID, empNo, name, email, department, defaultPlant_code, isActive) VALUES ('00000000-0000-0000-0000-000000001002', 'E1002', 'Karthik Subramanian', 'karthik.s@nubtech.example', 'Production', 1000, TRUE);
INSERT INTO nub_gatepass_master_Employees (ID, empNo, name, email, department, defaultPlant_code, isActive) VALUES ('00000000-0000-0000-0000-000000001003', 'E1003', 'Meera Joseph', 'meera.joseph@nubtech.example', 'Quality', 1000, TRUE);
INSERT INTO nub_gatepass_master_Employees (ID, empNo, name, email, department, defaultPlant_code, isActive) VALUES ('00000000-0000-0000-0000-000000001004', 'E1004', 'Rakesh Bhatia', 'rakesh.bhatia@nubtech.example', 'Security', 1000, TRUE);
INSERT INTO nub_gatepass_master_Employees (ID, empNo, name, email, department, defaultPlant_code, isActive) VALUES ('00000000-0000-0000-0000-000000001005', 'E1005', 'Suresh Iyer', 'suresh.iyer@nubtech.example', 'Maintenance', 2000, TRUE);
INSERT INTO nub_gatepass_master_Employees (ID, empNo, name, email, department, defaultPlant_code, isActive) VALUES ('00000000-0000-0000-0000-000000001006', 'E1006', 'Deepak Nair', 'deepak.nair@nubtech.example', 'Purchase', 1000, FALSE);

-- Data for nub_gatepass_master_VisitAreas
INSERT INTO nub_gatepass_master_VisitAreas (code, plant_code, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive) VALUES ('OFFICE', 1000, 'Administration Block', FALSE, FALSE, NULL, TRUE);
INSERT INTO nub_gatepass_master_VisitAreas (code, plant_code, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive) VALUES ('SHOPFLOOR', 1000, 'Machine Shop & Assembly', TRUE, TRUE, 15, TRUE);
INSERT INTO nub_gatepass_master_VisitAreas (code, plant_code, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive) VALUES ('WAREHOUSE', 1000, 'Finished Goods Warehouse', TRUE, TRUE, 8, TRUE);
INSERT INTO nub_gatepass_master_VisitAreas (code, plant_code, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive) VALUES ('RNDLAB', 1000, 'R&D Laboratory', TRUE, FALSE, 5, TRUE);
INSERT INTO nub_gatepass_master_VisitAreas (code, plant_code, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive) VALUES ('CANTEEN', 1000, 'Canteen Block', FALSE, FALSE, NULL, TRUE);
INSERT INTO nub_gatepass_master_VisitAreas (code, plant_code, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive) VALUES ('OFFICE', 2000, 'Hosur Office', FALSE, FALSE, NULL, TRUE);
INSERT INTO nub_gatepass_master_VisitAreas (code, plant_code, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive) VALUES ('SHOPFLOOR', 2000, 'Hosur Press Shop', TRUE, TRUE, 20, TRUE);
INSERT INTO nub_gatepass_master_VisitAreas (code, plant_code, name, requiresApproval, requiresInduction, maxVisitorsOnSite, isActive) VALUES ('OLDBLOCK', 1000, 'Old Admin Block (demolished)', FALSE, FALSE, NULL, FALSE);

-- Data for nub_gatepass_transaction_VisitorPasses
INSERT INTO nub_gatepass_transaction_VisitorPasses (ID, passNo, host_ID, plant_code, area_code, area_plant_code, purpose_code, purposeDetail, visitorName, visitorCompany, visitorMobile, idProofType_code, idProofNumber, visitDate, validFrom, validTo, inductionRef, inductionValidTill, vehicleNo, status_code, badgeNo, actualInAt, actualOutAt, durationMinutes, isOverstay, rejectionReason, createdBy) VALUES ('10000000-0000-0000-0000-000000000001', 'GP-1000-2026-00001', '00000000-0000-0000-0000-000000001001', 1000, 'SHOPFLOOR', 1000, 'SUPPLIER', NULL, 'Ramesh Gupta', 'Alpha Tooling', 9876543210, 'AADHAAR', 123456789012, '2026-08-26', '10:00:00', '13:00:00', 'IND-2026-118', '2026-12-31', NULL, 'APPROVED', NULL, NULL, NULL, NULL, FALSE, NULL, 'anitha');
INSERT INTO nub_gatepass_transaction_VisitorPasses (ID, passNo, host_ID, plant_code, area_code, area_plant_code, purpose_code, purposeDetail, visitorName, visitorCompany, visitorMobile, idProofType_code, idProofNumber, visitDate, validFrom, validTo, inductionRef, inductionValidTill, vehicleNo, status_code, badgeNo, actualInAt, actualOutAt, durationMinutes, isOverstay, rejectionReason, createdBy) VALUES ('10000000-0000-0000-0000-000000000002', 'GP-1000-2026-00002', '00000000-0000-0000-0000-000000001001', 1000, 'OFFICE', 1000, 'CUSTOMER', NULL, 'Sneha Kulkarni', 'Bharat Audit LLP', 9812345678, 'PAN', 'ABCDE1234F', '2026-08-26', '09:30:00', '17:30:00', NULL, NULL, NULL, 'ON_SITE', 'B-014', '2026-08-26T09:30:00Z', NULL, NULL, FALSE, NULL, 'anitha');
INSERT INTO nub_gatepass_transaction_VisitorPasses (ID, passNo, host_ID, plant_code, area_code, area_plant_code, purpose_code, purposeDetail, visitorName, visitorCompany, visitorMobile, idProofType_code, idProofNumber, visitDate, validFrom, validTo, inductionRef, inductionValidTill, vehicleNo, status_code, badgeNo, actualInAt, actualOutAt, durationMinutes, isOverstay, rejectionReason, createdBy) VALUES ('10000000-0000-0000-0000-000000000003', 'GP-1000-2026-00003', '00000000-0000-0000-0000-000000001002', 1000, 'SHOPFLOOR', 1000, 'SERVICE', NULL, 'Imran Qureshi', 'CoolTech AMC', 9900112233, 'DL', 'KA1234567890', '2026-08-25', '14:00:00', '17:00:00', 'IND-2026-099', '2026-12-31', NULL, 'ON_SITE', 'B-007', '2026-08-25T14:00:00Z', NULL, NULL, FALSE, NULL, 'karthik');
INSERT INTO nub_gatepass_transaction_VisitorPasses (ID, passNo, host_ID, plant_code, area_code, area_plant_code, purpose_code, purposeDetail, visitorName, visitorCompany, visitorMobile, idProofType_code, idProofNumber, visitDate, validFrom, validTo, inductionRef, inductionValidTill, vehicleNo, status_code, badgeNo, actualInAt, actualOutAt, durationMinutes, isOverstay, rejectionReason, createdBy) VALUES ('10000000-0000-0000-0000-000000000004', 'GP-1000-2026-00004', '00000000-0000-0000-0000-000000001003', 1000, 'WAREHOUSE', 1000, 'SUPPLIER', NULL, 'Priya Menon', 'Nexus Logistics', 9765432109, 'AADHAAR', 987654321098, '2026-08-25', '11:00:00', '12:00:00', 'IND-2026-107', '2026-12-31', NULL, 'APPROVED', NULL, NULL, NULL, NULL, FALSE, NULL, 'meera');
INSERT INTO nub_gatepass_transaction_VisitorPasses (ID, passNo, host_ID, plant_code, area_code, area_plant_code, purpose_code, purposeDetail, visitorName, visitorCompany, visitorMobile, idProofType_code, idProofNumber, visitDate, validFrom, validTo, inductionRef, inductionValidTill, vehicleNo, status_code, badgeNo, actualInAt, actualOutAt, durationMinutes, isOverstay, rejectionReason, createdBy) VALUES ('10000000-0000-0000-0000-000000000005', 'GP-2000-2026-00001', '00000000-0000-0000-0000-000000001005', 2000, 'SHOPFLOOR', 2000, 'SUPPLIER', NULL, 'Ramesh Gupta', 'Alpha Tooling', 9876543210, 'AADHAAR', 123456789012, '2026-08-26', '10:00:00', '13:00:00', 'IND-2026-201', '2026-12-31', NULL, 'APPROVED', NULL, NULL, NULL, NULL, FALSE, NULL, 'suresh');
INSERT INTO nub_gatepass_transaction_VisitorPasses (ID, passNo, host_ID, plant_code, area_code, area_plant_code, purpose_code, purposeDetail, visitorName, visitorCompany, visitorMobile, idProofType_code, idProofNumber, visitDate, validFrom, validTo, inductionRef, inductionValidTill, vehicleNo, status_code, badgeNo, actualInAt, actualOutAt, durationMinutes, isOverstay, rejectionReason, createdBy) VALUES ('10000000-0000-0000-0000-000000000006', NULL, '00000000-0000-0000-0000-000000001002', 1000, 'RNDLAB', 1000, 'SERVICE', NULL, 'Vikram Shah', 'Zenith Controls', 9123456780, 'EMPCARD', 'ZC-2024-5501', '2026-08-27', '10:00:00', '16:00:00', NULL, NULL, NULL, 'DRAFT', NULL, NULL, NULL, NULL, FALSE, NULL, 'karthik');

-- Data for nub_gatepass_transaction_PassItems
INSERT INTO nub_gatepass_transaction_PassItems (ID, pass_ID, itemNo, description, serialNo, quantity, isReturnable, returnedAtExit, exitRemark) VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 10, 'Dell Latitude laptop', 'DL7420-88231', 1, TRUE, FALSE, NULL);
INSERT INTO nub_gatepass_transaction_PassItems (ID, pass_ID, itemNo, description, serialNo, quantity, isReturnable, returnedAtExit, exitRemark) VALUES ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 20, 'Torque wrench set', 'TW-455-A', 1, TRUE, FALSE, NULL);
INSERT INTO nub_gatepass_transaction_PassItems (ID, pass_ID, itemNo, description, serialNo, quantity, isReturnable, returnedAtExit, exitRemark) VALUES ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 30, 'Sample castings for inspection', NULL, 4, FALSE, FALSE, NULL);

-- Data for nub_gatepass_transaction_PassEvents
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, NULL, 'REQUESTED', 'SUBMIT', 'anitha', '2026-08-25T08:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, 'REQUESTED', 'APPROVED', 'APPROVE', 'rakesh', '2026-08-25T09:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 1, NULL, 'APPROVED', 'SUBMIT', 'anitha', '2026-08-26T07:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 2, 'APPROVED', 'ON_SITE', 'CHECK_IN', 'guard1', '2026-08-26T09:30:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 1, NULL, 'REQUESTED', 'SUBMIT', 'karthik', '2026-08-24T10:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 2, 'REQUESTED', 'APPROVED', 'APPROVE', 'rakesh', '2026-08-24T11:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 3, 'APPROVED', 'ON_SITE', 'CHECK_IN', 'guard1', '2026-08-25T14:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000004', 1, NULL, 'REQUESTED', 'SUBMIT', 'meera', '2026-08-24T08:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000004', 2, 'REQUESTED', 'APPROVED', 'APPROVE', 'rakesh', '2026-08-24T09:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000005', 1, NULL, 'REQUESTED', 'SUBMIT', 'suresh', '2026-08-25T08:00:00Z', NULL);
INSERT INTO nub_gatepass_transaction_PassEvents (ID, pass_ID, seq, fromStatus, toStatus, action, actor, actedAt, remark) VALUES ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000005', 2, 'REQUESTED', 'APPROVED', 'APPROVE', 'rakesh', '2026-08-25T09:00:00Z', NULL);

