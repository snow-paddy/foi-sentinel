-- =====================================================================
-- FOI Sentinel v2 — Phase 4: Seed realistic case backlog (~52 cases)
-- Exampleton Council context. Dates are evergreen (relative to today).
-- Triage JSON is pre-seeded (zero LLM cost); live AI is shown on Intake.
-- =====================================================================
USE WAREHOUSE FOI_WH;
USE SCHEMA FOI.FOI_SENTINEL_V2;

TRUNCATE TABLE IF EXISTS FOI_CASE;
TRUNCATE TABLE IF EXISTS FOI_CASE_EVENT;
TRUNCATE TABLE IF EXISTS FOI_TRIAGE;
TRUNCATE TABLE IF EXISTS FOI_COST_ESTIMATE;
TRUNCATE TABLE IF EXISTS FOI_EXEMPTION_ASSESSMENT;
TRUNCATE TABLE IF EXISTS FOI_REDACTION;
TRUNCATE TABLE IF EXISTS FOI_RESPONSE;
TRUNCATE TABLE IF EXISTS FOI_INTERNAL_REVIEW;
TRUNCATE TABLE IF EXISTS FOI_ICO_COMPLAINT;
TRUNCATE TABLE IF EXISTS FOI_DISCLOSURE_PUBLICATION;

INSERT INTO FOI_CASE
 (REFERENCE, SOURCE, REQUESTER_NAME, REQUESTER_ORGANISATION, REQUEST_TEXT, RECEIVED_DATE,
  REGIME, CURRENT_STAGE, STATUS, OWNING_DEPARTMENT, ASSIGNED_OFFICER, STATUTORY_DEADLINE,
  CLOCK_STATE, OUTCOME, CLOSED_DATE, ANSWERED_IN_TIME, IS_PUBLISHED,
  SENTIMENT_SCORE, COMPLEXITY_RANK, URGENCY_SCORE, IS_VEXATIOUS)
SELECT
  v.REFERENCE, v.SOURCE, v.NAME, v.ORG, v.TXT,
  DATEADD('day', -v.RECV_OFF, CURRENT_DATE())                              AS RECEIVED_DATE,
  v.REGIME, v.STAGE, v.STATUS, v.DEPT, v.OFFICER,
  CASE WHEN v.REGIME = 'SAR'
       THEN DATEADD('day', 30, DATEADD('day', -v.RECV_OFF, CURRENT_DATE()))         -- SAR: 1 calendar month
       WHEN v.REGIME = 'EIR' AND v.STAGE IN ('COST','EXEMPTIONS','PIT')
       THEN FN_ADD_WORKING_DAYS(DATEADD('day', -v.RECV_OFF, CURRENT_DATE()), 40)    -- EIR complex extension
       ELSE FN_ADD_WORKING_DAYS(DATEADD('day', -v.RECV_OFF, CURRENT_DATE()), 20)
  END                                                                      AS STATUTORY_DEADLINE,
  CASE WHEN v.CLARIF = 1 THEN 'STOPPED_CLARIFICATION'
       WHEN v.STAGE = 'PIT' THEN 'PIT_EXTENSION'
       ELSE 'RUNNING' END                                                  AS CLOCK_STATE,
  v.OUTCOME,
  CASE WHEN v.CLOSED_OFF IS NULL THEN NULL ELSE DATEADD('day', -v.CLOSED_OFF, CURRENT_DATE()) END AS CLOSED_DATE,
  CASE WHEN v.CLOSED_OFF IS NULL THEN NULL
       ELSE (DATEADD('day', -v.CLOSED_OFF, CURRENT_DATE())
             <= FN_ADD_WORKING_DAYS(DATEADD('day', -v.RECV_OFF, CURRENT_DATE()), 20)) END         AS ANSWERED_IN_TIME,
  v.PUBLISHED, v.SENT, v.CX, v.URG, v.VEX
FROM (
 SELECT * FROM VALUES
 -- REF, SOURCE, NAME, ORG, TXT, RECV_OFF, REGIME, STAGE, STATUS, DEPT, OFFICER, OUTCOME, CLOSED_OFF, PUBLISHED, SENT, CX, URG, VEX, CLARIF
 -- ============ NEW INTAKE ============
 ('FOI-2026-0101','EMAIL','Sarah Whitfield',NULL,'Please provide the total spend on agency social workers for each of the last three financial years, broken down by team.',1,'FOI','RECEIPT','OPEN','Childrens Services',NULL,NULL,NULL,FALSE,-0.05,5.0,4.0,FALSE,0),
 ('FOI-2026-0102','WEB_PORTAL','Tom Beresford',NULL,'How many fixed penalty notices were issued for fly-tipping in 2024, and what was the total value collected?',1,'FOI','RECEIPT','OPEN','Environmental Health',NULL,NULL,NULL,FALSE,0.10,3.0,3.5,FALSE,0),
 ('FOI-2026-0103','WHATDOTHEYKNOW','Priya Nair',NULL,'I request all email correspondence between the Head of Planning and any developer regarding the Western Harbour scheme since January 2024.',2,'FOI','RECEIPT','OPEN','Planning',NULL,NULL,NULL,FALSE,-0.20,7.5,6.0,FALSE,0),
 ('EIR-2026-0104','EMAIL','James Holloway','Exampleton Cycling Campaign','Under the EIR, please provide air quality monitoring data for the M32 corridor for the last 24 months.',2,'EIR','VALIDITY','OPEN','Environmental Health',NULL,NULL,NULL,FALSE,0.05,6.0,5.0,FALSE,0),
 ('FOI-2026-0105','LETTER','Margaret Ellis',NULL,'I would like to know the number of council houses sold under Right to Buy in the last five years.',3,'FOI','CLASSIFY','OPEN','Housing',NULL,NULL,NULL,FALSE,0.0,4.0,4.0,FALSE,0),
 ('FOI-2026-0106','EMAIL','David Osei','Exampleton Post','Please confirm how much the council spent on external PR and communications consultants in 2024/25.',3,'FOI','CLASSIFY','OPEN','Communications',NULL,NULL,NULL,FALSE,-0.15,4.5,5.5,FALSE,0),
 -- ============ SAR REDIRECT ============
 ('SAR-2026-0107','EMAIL','Anonymous Resident',NULL,'I want copies of all information the council holds about me and my housing benefit claim.',2,'SAR','SAR_REDIRECT','OPEN','Information Governance','R. Patel','SAR_REDIRECTED',NULL,FALSE,-0.30,5.0,6.0,FALSE,0),
 -- ============ DUPLICATE / s.21 ============
 ('FOI-2026-0108','WHATDOTHEYKNOW','Liam Carter',NULL,'How many potholes were reported and repaired in the last 12 months across the city?',4,'FOI','DUPLICATE','OPEN','Highways','J. Adeyemi','S21_REUSE',NULL,FALSE,0.05,2.5,3.0,FALSE,0),
 ('FOI-2026-0109','WEB_PORTAL','Rachel Dunn',NULL,'What is the current number of children in care in the borough?',3,'FOI','DUPLICATE','OPEN','Childrens Services','J. Adeyemi','S21_REUSE',NULL,FALSE,0.10,2.0,2.5,FALSE,0),
 -- ============ CLARIFICATION (clock stopped) ============
 ('FOI-2026-0110','EMAIL','Unknown Sender',NULL,'Send me everything about the contracts.',5,'FOI','CLARIFICATION','OPEN','Procurement','S. Begum',NULL,NULL,FALSE,-0.10,6.0,5.0,FALSE,1),
 ('EIR-2026-0111','EMAIL','Helen Archer','Friends of the Avon','Please provide information on flood-risk assessments — can you confirm which catchment areas you mean if unclear?',6,'EIR','CLARIFICATION','OPEN','Flood Risk','S. Begum',NULL,NULL,FALSE,0.30,5.5,4.5,FALSE,1),
 -- ============ ALLOCATION ============
 ('FOI-2026-0112','WEB_PORTAL','Mohammed Iqbal',NULL,'Please provide a breakdown of council tax arrears by ward for 2024/25.',6,'FOI','ALLOCATION','OPEN','Revenues & Benefits','R. Patel',NULL,NULL,FALSE,-0.05,5.0,5.0,FALSE,0),
 ('FOI-2026-0113','EMAIL','Claire Stephens',NULL,'How many EHCP assessments exceeded the 20-week statutory deadline in the last year?',7,'FOI','ALLOCATION','OPEN','SEND','R. Patel',NULL,NULL,FALSE,-0.25,6.5,6.0,FALSE,0),
 ('FOI-2026-0114','WHATDOTHEYKNOW','Andrew Fox',NULL,'List all senior officers earning over £100,000 and their job titles.',8,'FOI','ALLOCATION','OPEN','HR','J. Adeyemi',NULL,NULL,FALSE,0.0,4.0,4.5,FALSE,0),
 -- ============ SEARCH ============
 ('FOI-2026-0115','EMAIL','Nicola Reed','GMB Union','I am writing on behalf of the GMB Union under the Freedom of Information Act 2000. Our members have raised concerns about how workplace grievances are handled, and we request the following information for the last three financial years (2022/23, 2023/24 and 2024/25). (1) The total number of formal staff grievances raised in each year. (2) A breakdown by directorate or service area. (3) The outcome of each grievance by year, meaning upheld, partially upheld, not upheld or withdrawn. (4) The number of grievances taken to a formal appeal and the outcome of each appeal. (5) How many grievances cited bullying, harassment or discrimination as a factor. If any part cannot be provided within the cost limit, please release the remainder and cite the exemption relied upon for the rest. We would prefer the response by email as a spreadsheet where possible, and look forward to your reply within 20 working days.',9,'FOI','SEARCH','OPEN','HR','S. Begum',NULL,NULL,FALSE,-0.20,6.0,5.5,FALSE,0),
 ('EIR-2026-0116','WEB_PORTAL','Peter Quinn',NULL,'Under EIR, provide details of all tree-felling licences granted on council land in 2024.',9,'EIR','SEARCH','OPEN','Parks','J. Adeyemi',NULL,NULL,FALSE,0.10,4.5,4.0,FALSE,0),
 ('FOI-2026-0117','EMAIL','Susan Clarke',NULL,'How much was spent on temporary accommodation for homeless households last year?',10,'FOI','SEARCH','OPEN','Housing','S. Begum',NULL,NULL,FALSE,-0.10,5.5,5.0,FALSE,0),
 ('FOI-2026-0118','LETTER','Geoffrey Payne',NULL,'Provide minutes of all Cabinet meetings discussing the leisure-centre closures.',11,'FOI','SEARCH','OPEN','Democratic Services','R. Patel',NULL,NULL,FALSE,-0.30,6.0,5.5,FALSE,0),
 -- ============ COST (one FOI exceeding, one EIR no-limit) ============
 ('FOI-2026-0119','WHATDOTHEYKNOW','Investigative Desk','The Exampleton Cable','Provide every individual purchase-card transaction across all departments for the last six years with descriptions.',12,'FOI','COST','OPEN','Finance','S. Begum',NULL,NULL,FALSE,-0.15,9.0,6.5,FALSE,0),
 ('EIR-2026-0120','EMAIL','Catherine Bryant','Wildlife Trust','Under EIR, provide all ecological survey reports for council-owned sites over the past ten years.',12,'EIR','COST','OPEN','Parks','S. Begum',NULL,NULL,FALSE,0.05,8.0,5.5,FALSE,0),
 -- ============ EXEMPTIONS ============
 ('FOI-2026-0121','EMAIL','Daniel West',NULL,'Provide the names and home addresses of all council officers in the planning enforcement team.',13,'FOI','EXEMPTIONS','OPEN','Planning','J. Adeyemi',NULL,NULL,FALSE,-0.20,7.0,6.0,FALSE,0),
 ('FOI-2026-0122','WEB_PORTAL','Olivia Grant',NULL,'Provide the full tender evaluation scores and pricing for the recent waste-collection contract award.',13,'FOI','EXEMPTIONS','OPEN','Procurement','R. Patel',NULL,NULL,FALSE,-0.10,7.5,6.0,FALSE,0),
 -- ============ PIT (qualified exemption, extension) ============
 ('FOI-2026-0123','EMAIL','Marcus Webb','Local Democracy Reporting','Provide the internal risk register and legal advice relating to the SEND transport overspend.',14,'FOI','PIT','OPEN','Legal','S. Begum',NULL,NULL,FALSE,-0.25,8.5,7.0,FALSE,0),
 ('FOI-2026-0124','WHATDOTHEYKNOW','Janet Pearce',NULL,'Provide all correspondence with the developer about the affordable-housing viability assessment.',15,'FOI','PIT','OPEN','Planning','J. Adeyemi',NULL,NULL,FALSE,-0.15,8.0,6.5,FALSE,0),
 -- ============ REDACTION ============
 ('FOI-2026-0125','EMAIL','Robert Hayes',NULL,'Provide the complaints log for adult social care, including details of each complaint.',15,'FOI','REDACTION','OPEN','Adult Social Care','R. Patel',NULL,NULL,FALSE,-0.20,7.0,6.0,FALSE,0),
 -- ============ DRAFTING ============
 ('FOI-2026-0126','WEB_PORTAL','Emma Lawson',NULL,'How many school-place appeals were heard and what proportion were upheld in the last academic year?',16,'FOI','DRAFTING','OPEN','Education','S. Begum',NULL,NULL,FALSE,0.05,4.0,5.0,FALSE,0),
 ('FOI-2026-0127','EMAIL','Gary Sutton',NULL,'Provide the number of RIPA authorisations made by the council in the last three years.',16,'FOI','DRAFTING','OPEN','Legal','J. Adeyemi',NULL,NULL,FALSE,0.0,5.0,5.0,FALSE,0),
 -- ============ QA / sign-off ============
 ('FOI-2026-0128','EMAIL','Fiona Bright',NULL,'What were the total parking-enforcement revenues by car park for 2024/25?',17,'FOI','QA','OPEN','Parking','R. Patel',NULL,NULL,FALSE,0.10,3.5,4.5,FALSE,0),
 ('EIR-2026-0129','WEB_PORTAL','Neil Armstrong',NULL,'Under EIR, provide the latest contaminated-land register entries for the harbourside.',17,'EIR','QA','OPEN','Environmental Health','S. Begum',NULL,NULL,FALSE,0.05,4.5,4.5,FALSE,0),
 -- ============ INTERNAL REVIEW / ICO (open) ============
 ('FOI-2026-0095','EMAIL','Marcus Webb','Local Democracy Reporting','Internal review requested: dissatisfied with s.43 refusal on the waste contract pricing.',26,'FOI','REVIEW','OPEN','Legal','Senior Officer',NULL,NULL,FALSE,-0.35,8.0,7.5,FALSE,0),
 ('FOI-2026-0088','WHATDOTHEYKNOW','Priya Nair',NULL,'ICO complaint lodged: council failed to respond within 20 working days on planning correspondence.',40,'FOI','REVIEW','OPEN','Information Governance','Senior Officer',NULL,NULL,FALSE,-0.55,7.5,8.0,FALSE,0),
 -- ============ OVERDUE (still open, breached) ============
 ('FOI-2026-0090','EMAIL','Persistent Requester',NULL,'I demand the same information again immediately or I will escalate to the press and my councillor.',24,'FOI','SEARCH','OPEN','Chief Executive','S. Begum',NULL,NULL,FALSE,-0.71,7.0,9.5,TRUE,0),
 ('FOI-2026-0091','WEB_PORTAL','Karen Mills',NULL,'Provide all incident reports relating to the leisure centre over the last two years.',23,'FOI','ALLOCATION','OPEN','Leisure','R. Patel',NULL,NULL,FALSE,-0.20,5.5,8.5,FALSE,0),
 -- ============ CLOSED — answered in time (in-time KPI) ============
 ('FOI-2026-0050','EMAIL','Ian Forsyth',NULL,'Number of licensed HMOs in the city.',35,'FOI','DISPATCH','CLOSED','Housing','J. Adeyemi','GRANTED_FULL',20,TRUE,0.10,2.0,2.0,FALSE,0),
 ('FOI-2026-0051','WEB_PORTAL','Laura Bennett',NULL,'Spend on school crossing patrols last year.',34,'FOI','DISPATCH','CLOSED','Education','R. Patel','GRANTED_FULL',19,TRUE,0.05,2.5,2.5,FALSE,0),
 ('EIR-2026-0052','EMAIL','Steven Cole',NULL,'EIR: recycling tonnages by month for 2024.',33,'EIR','DISPATCH','CLOSED','Waste','S. Begum','GRANTED_FULL',18,TRUE,0.15,3.0,2.5,FALSE,0),
 ('FOI-2026-0053','WHATDOTHEYKNOW','Diane Foster',NULL,'Number of blue badges issued in 2024.',32,'FOI','DISPATCH','CLOSED','Adult Social Care','J. Adeyemi','GRANTED_FULL',17,TRUE,0.0,2.0,2.0,FALSE,0),
 ('FOI-2026-0054','EMAIL','Paul Hardy',NULL,'Council fleet vehicle count and fuel spend.',31,'FOI','DISPATCH','CLOSED','Fleet','R. Patel','GRANTED_PARTIAL',16,TRUE,0.05,3.5,3.0,FALSE,0),
 ('FOI-2026-0055','WEB_PORTAL','Megan Lloyd',NULL,'Number of food-hygiene inspections in 2024.',30,'FOI','DISPATCH','CLOSED','Environmental Health','S. Begum','GRANTED_FULL',15,TRUE,0.10,2.5,2.0,FALSE,0),
 ('FOI-2026-0056','EMAIL','Chris Doyle',NULL,'Library visitor numbers per branch 2024.',29,'FOI','DISPATCH','CLOSED','Libraries','J. Adeyemi','GRANTED_FULL',14,TRUE,0.20,2.0,2.0,FALSE,0),
 ('FOI-2026-0057','LETTER','Brian Knox',NULL,'Number of allotment plots and waiting list size.',28,'FOI','DISPATCH','CLOSED','Parks','R. Patel','GRANTED_FULL',13,TRUE,0.10,1.5,1.5,FALSE,0),
 ('EIR-2026-0058','EMAIL','Sandra Pike',NULL,'EIR: noise complaints received in 2024 by ward.',27,'EIR','DISPATCH','CLOSED','Environmental Health','S. Begum','GRANTED_FULL',12,TRUE,0.0,3.0,2.5,FALSE,0),
 ('FOI-2026-0059','WEB_PORTAL','Kevin Maddox',NULL,'School meals debt totals by year.',26,'FOI','DISPATCH','CLOSED','Education','J. Adeyemi','GRANTED_PARTIAL',11,TRUE,-0.05,3.5,3.0,FALSE,0),
 ('FOI-2026-0060','EMAIL','Alison Reid',NULL,'Number of CCTV cameras operated by the council.',25,'FOI','DISPATCH','CLOSED','Community Safety','R. Patel','REFUSED',10,TRUE,-0.10,4.0,3.5,FALSE,0),
 ('FOI-2026-0061','WHATDOTHEYKNOW','Tony Webb',NULL,'Bus-lane PCN totals 2024.',24,'FOI','DISPATCH','CLOSED','Transport','S. Begum','GRANTED_FULL',9,TRUE,0.05,2.5,2.0,FALSE,0),
 ('FOI-2026-0062','EMAIL','Hannah Boyd',NULL,'Number of social-care safeguarding referrals 2024.',23,'FOI','DISPATCH','CLOSED','Adult Social Care','J. Adeyemi','GRANTED_FULL',8,TRUE,0.0,3.0,2.5,FALSE,0),
 ('FOI-2026-0063','WEB_PORTAL','Mark Ellison',NULL,'Council-tax single-person discounts granted 2024.',22,'FOI','DISPATCH','CLOSED','Revenues & Benefits','R. Patel','GRANTED_FULL',7,TRUE,0.10,2.0,2.0,FALSE,0),
 ('FOI-2026-0064','EMAIL','Sophie Nash',NULL,'Number of planning applications determined 2024.',21,'FOI','DISPATCH','CLOSED','Planning','S. Begum','GRANTED_FULL',6,TRUE,0.15,2.5,2.0,FALSE,0),
 ('EIR-2026-0065','EMAIL','Gary Owen',NULL,'EIR: EV charging points installed on council land 2024.',20,'EIR','DISPATCH','CLOSED','Transport','J. Adeyemi','GRANTED_FULL',5,TRUE,0.20,2.5,2.0,FALSE,0),
 -- ============ CLOSED — LATE (breaches, for realistic <100% in-time) ============
 ('FOI-2026-0066','WHATDOTHEYKNOW','Research Team','OpenDemocracy','All consultancy contracts and day rates over five years.',45,'FOI','DISPATCH','CLOSED','Procurement','S. Begum','GRANTED_PARTIAL',8,FALSE,-0.20,8.0,5.0,FALSE,0),
 ('FOI-2026-0067','EMAIL','Derek Sims',NULL,'Detailed SEND transport route costings.',48,'FOI','DISPATCH','CLOSED','SEND','R. Patel','GRANTED_PARTIAL',6,FALSE,-0.30,8.5,5.5,FALSE,0),
 ('FOI-2026-0068','WEB_PORTAL','Yvonne Page',NULL,'All adult-social-care provider contracts and rates.',44,'FOI','DISPATCH','CLOSED','Adult Social Care','J. Adeyemi','GRANTED_FULL',5,FALSE,-0.15,7.5,5.0,FALSE,0),
 -- ============ PUBLISHED to disclosure log ============
 ('FOI-2026-0070','WEB_PORTAL','Open Data User',NULL,'Annual spend over £500 published dataset request.',38,'FOI','PUBLISH','CLOSED','Finance','S. Begum','GRANTED_FULL',18,TRUE,0.20,2.0,2.0,TRUE,0),
 ('FOI-2026-0071','EMAIL','Transparency Group',NULL,'Senior salary bands and organisational chart.',37,'FOI','PUBLISH','CLOSED','HR','R. Patel','GRANTED_FULL',17,TRUE,0.10,2.5,2.0,TRUE,0)
 AS v(REFERENCE,SOURCE,NAME,ORG,TXT,RECV_OFF,REGIME,STAGE,STATUS,DEPT,OFFICER,OUTCOME,CLOSED_OFF,PUBLISHED,SENT,CX,URG,VEX,CLARIF)
);

-- clock stopped date for clarification cases
UPDATE FOI_CASE SET CLOCK_STOPPED_AT = DATEADD('day', -2, CURRENT_DATE())
 WHERE CLOCK_STATE = 'STOPPED_CLARIFICATION';

SELECT COUNT(*) AS TOTAL_CASES,
       SUM(CASE WHEN STATUS='OPEN' THEN 1 ELSE 0 END) AS OPEN_CASES,
       SUM(CASE WHEN STATUS='CLOSED' THEN 1 ELSE 0 END) AS CLOSED_CASES,
       SUM(CASE WHEN STATUS='CLOSED' AND ANSWERED_IN_TIME THEN 1 ELSE 0 END) AS CLOSED_IN_TIME
FROM FOI_CASE;
