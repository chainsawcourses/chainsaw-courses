# Chainsaw Courses — IIRSM Pre-Submission Audit Report
**Document:** ChainsawCoursesV1.1 Manual + Online Course  
**Audit Date:** July 2026  
**Prepared for:** IIRSM CPD Endorsement Submission  

---

## Summary of Findings

| Area | Status | Issues Found |
|------|--------|-------------|
| Learning Outcomes & Bloom's Taxonomy | ⚠️ Needs Fix | 1 critical (LO1 verb), 1 advisory (LO4) |
| UK Spelling & Terminology | ⚠️ Needs Fix | 6 US spellings in PDF source |
| Legislation Coverage | ⚠️ Needs Fix | MHOR 1992 missing; no year citations |
| PPE Standards | ⚠️ Needs Fix | EN 381 not referenced |
| QR Codes & Digital Links | ✅ Good | URLs consistent; flow logical |
| Disclaimer (Page 3) | ✅ Strong | Comprehensive liability exclusion |
| Structural Consistency | ⚠️ Minor | "guide bar" vs "guidebar" in PDF |
| Version Metadata | ⚠️ Fix in PDF | PDF says "Version 1" — should be "V1.1" |
| Assessment Strategy | ✅ Good | 80% threshold, mapped to NPTC criteria |
| GLH/TQT Calculation | ✅ Defensible | 16 GLH / 19 TQT documented |

---

## 1. Learning Outcomes & Pedagogical Structure

### 🔴 Critical Fix: LO1 Uses a Passive Verb

**Current wording (Page 4 of PDF):**
> "Learning Outcome 1 (LO1): **Understand** the statutory legal framework and personal safety requirements dictating chainsaw operations."

**Problem:** "Understand" is explicitly flagged by Ofqual and IIRSM assessment frameworks as an **unmeasurable passive verb**. It cannot be evidenced or assessed. An IIRSM reviewer will flag this immediately.

**Recommended fix:**
> "Learning Outcome 1 (LO1): **Describe** the statutory legal framework and personal safety requirements governing chainsaw operations."

*(Note: "Describe" sits at Bloom's Level 2 — Remember/Understand — but is measurable and evidence-based.)*  
✅ **Already fixed in the online course content (chainsaw-manual.txt).**  
⚠️ **Must be updated in the PDF source document.**

---

### 🟡 Advisory: LO4 Says "Demonstrate" in a Theory-Only Course

**Current wording:**
> "Learning Outcome 4 (LO4): **Demonstrate** how to diagnose, service, and maintain the structural integrity of a chainsaw cutting assembly."

**Problem:** "Demonstrate" implies a practical, observable action — which conflicts with your theory-only disclaimer. An IIRSM reviewer may question how a learner "demonstrates" anything in a digital/paper course.

**Recommended fix:**
> "Learning Outcome 4 (LO4): **Describe** the diagnostic, servicing, and maintenance procedures required to sustain the structural integrity of a chainsaw cutting assembly."

---

### ✅ All Other Learning Outcomes — Bloom's Compliant

| LO | Verb | Bloom's Level | Status |
|----|------|---------------|--------|
| LO2 | Evaluate | Level 5 — Evaluate | ✅ |
| LO3 | Analyse | Level 4 — Analyse | ✅ |
| LO4 | Demonstrate → **Describe** | Level 2 | ⚠️ Advisory |
| LO5 | Implement | Level 3 — Apply | ✅ |
| LO6 | Apply | Level 3 — Apply | ✅ |

---

### 🟡 Advisory: AC 3.1 Uses Colloquial Language

**Current:** `"Suck-Squeeze-Bang-Blow"` — as a mnemonic in an assessment criterion.

This is a good teaching tool in the body text but looks unprofessional within a formally stated assessment criterion in an IIRSM submission. Consider moving the mnemonic to the body text only and stating the AC as:

> "AC 3.1: Describe the internal 2-stroke combustion cycle and calculate the correct fuel-to-oil ratio at a standard 50:1 mix."

---

## 2. UK Spelling & Terminology (PDF Source — Must Fix)

The following US spellings were found in the manual PDF text and must be corrected before submission. These have already been corrected in the online course system.

| US Spelling | UK Spelling | Location in PDF |
|-------------|-------------|-----------------|
| `color` | `colour` | AC 4.1, maintenance sections |
| `discoloration` | `discolouration` | Maintenance chapter |
| `center` | `centre` | AC 3.3, safety features section |
| `math` | `maths` | AC 3.1 |
| `Analyze` | `Analyse` | LO3, AC 6.1 |
| `recognized` | `recognised` | Course specification page |

---

## 3. Legislation Coverage

### 🔴 Critical Gap: Manual Handling Operations Regulations (MHOR 1992) — Not Found

A chainsaw maintenance and cross-cutting course **must** reference MHOR 1992. Log handling, lifting timber, and stacking are covered throughout — but the regulation is never cited. IIRSM will expect this.

**Recommended addition** — add to the legislation table in Module 1 (Law & Regulations) and the course specification:

> "Manual Handling Operations Regulations 1992 (MHOR): Requires employers to avoid manual handling tasks where reasonably practicable, assess unavoidable tasks, and reduce the risk of injury. Applicable to the lifting and repositioning of logs and timber."

---

### 🟡 No Year Citations on Any Regulation

The manual references PUWER, HSWA, and COSHH by name but **never with their year**, which is standard practice for a professional H&S training document submitted to IIRSM.

**Fix:** Change all bare regulation names to include year:

| Currently | Should Be |
|-----------|-----------|
| PUWER | PUWER 1998 |
| HSWA | Health and Safety at Work Act 1974 |
| COSHH | COSHH 2002 |
| Manual Handling (when added) | MHOR 1992 |

---

### 🟡 Missing Regulations Worth Noting

| Regulation | Relevance | Priority |
|------------|-----------|----------|
| PPE at Work Regulations 2022 | Directly covers PPE requirements | High |
| Noise at Work Regulations 2005 | Chainsaw noise (hearing PPE) | Medium |
| Control of Vibration at Work Regulations 2005 | HAVS / hand-arm vibration from chainsaws | Medium |
| RIDDOR 2013 | Reporting injuries in forestry | Low |

---

## 4. PPE Standards — EN 381 Missing

The manual correctly references Type A and Type C chainsaw trousers and CE/UKCA marking — but **EN 381 (the European/UK chainsaw PPE standard) is never cited**.

For a UK professional submission to IIRSM, you should reference:

> "All chainsaw PPE must comply with **BS EN 381** (now superseded in part by EN ISO 11393 for leg protection). Type A trousers protect to 20 m/s chain speed; Type C to 28 m/s."

---

## 5. QR Codes & Digital Integration

### ✅ URL Consistency
- All references to `chainsawcourses.com` and `app.chainsawcourses.com` are consistent.
- Page 6 correctly explains the QR code/video flow before first use.
- Page 138 (back cover) shows `www.chainsawcourses.com` — consistent.

### ✅ User Flow Logic
The "scan QR → launch video → take quiz → unlock next module" flow described on page 6 matches the actual app behaviour. No broken links found in the system.

### 🟡 QR Codes Not Visually Verified in PDF
The QR codes printed in the manual could not be tested from the source file. Before submission, physically scan every QR code in a printed copy to confirm they load the correct app page.

---

## 6. Disclaimer Assessment (Page 3)

### ✅ Strong — Passes the "Theory Only" Test

The disclaimer on **page 3** (not page 9 as previously noted) covers all critical bases:

| Requirement | Covered? |
|-------------|----------|
| Theory-only scope stated | ✅ Explicit |
| No practical qualification conferred | ✅ Explicit |
| Statutory training still required | ✅ Explicit |
| Liability exclusion | ✅ Broad and explicit |
| Lone working prohibition | ✅ Stated in bold |
| Alcohol/substance prohibition | ✅ Explicit |

### 🟡 One Suggested Addition

Add a sentence explicitly confirming legal operating requirements:
> "Completion of this course does not satisfy the legal requirement to hold a recognised practical chainsaw qualification (such as NPTC 0039-20) before operating a chainsaw in a professional or commercial capacity in the UK."

---

## 7. Version Metadata

| Issue | Current | Required |
|-------|---------|----------|
| Version number on page 2 | "Version 1: July 2026" | "Version 1.1: July 2026" |
| v1.1 appears in PDF text | ❌ Not found | Should appear on cover/title page |

---

## 8. Structural Polish

### ✅ Fixed in Online Course
- "Understand" → "Describe" in LO1
- All US spellings corrected
- "guide bar" → "guidebar" made consistent

### ⚠️ Remaining for PDF Source Fix
All items in sections 1–7 above need applying to the Word/InDesign source before printing or resubmitting the PDF.

### 🟡 Minor Consistency Note
AC 3.3 and AC 6.1 use "Analyse" (UK) — good. Confirm all instances are consistent once US → UK spelling is applied to the PDF.

---

## 9. IIRSM-Specific Recommendations

IIRSM endorsement of a CPD course requires the following — check your submission pack includes:

- [ ] Completed IIRSM CPD endorsement application form
- [ ] Clear RQF/Level statement (recommend stating: **"This course is pitched at RQF Level 2"**)
- [ ] Tutor/author CV or credentials (David J Daniel)
- [ ] Evidence of quality assurance review (this audit report serves that purpose)
- [ ] Sample assessment questions and marking scheme
- [ ] Equality & Diversity statement (your existing E&D policy PDF covers this)
- [ ] Data Protection statement (your existing GDPR policy PDF covers this)

---

## 10. Gemini Audit Plan — Amendments

Gemini's plan was solid. Two corrections:

1. **"Verify your legal disclaimer (specifically Page 9)"** — The disclaimer is on **Page 3** of V1.1, not page 9. Page 9 is the Introduction. Gemini's page reference was incorrect.
2. **Add MHOR 1992** — Gemini's legislation check didn't flag manual handling. Given the log-lifting content, this is the most important missing regulation.

---

## Action Priority List

### Fix in PDF source before submission:
1. 🔴 LO1: "Understand" → "Describe"
2. 🔴 LO4: "Demonstrate" → "Describe the process of"
3. 🔴 Add MHOR 1992 to legislation table
4. 🔴 Add PPE regulation years to all citations
5. 🟡 Correct 6 US spellings
6. 🟡 Add EN 381 / EN ISO 11393 PPE standard reference
7. 🟡 Update version to "V1.1" on cover/page 2
8. 🟡 Fix "guide bar" → "guidebar" throughout
9. 🟡 Move "Suck-Squeeze-Bang-Blow" from AC 3.1 to body text only
10. 🟡 Add NPTC practical qualification disclaimer sentence to Page 3

### Already fixed (online course system):
- ✅ LO1 verb corrected in course content
- ✅ UK spellings corrected in course content
- ✅ "guidebar" made consistent in course content
