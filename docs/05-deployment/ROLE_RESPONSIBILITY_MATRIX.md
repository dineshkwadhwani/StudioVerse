# StudioVerse — Role Responsibility Matrix

**Roles:** SA = Super Admin · C = Company · P = Professional · I = Individual  
**Legend:** ✓ = Full access · ◐ = Partial / scoped · — = Not permitted

---

## 1. Authentication & Registration

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Self-register as Company | — | ✓ | — | — |
| Self-register as Professional | — | — | ✓ | — |
| Self-register as Individual | — | — | — | ✓ |
| Super Admin account created via master seed | ✓ | — | — | — |
| Login (phone/email OTP) | ✓ | ✓ | ✓ | ✓ |

---

## 2. Tenant Management

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create tenant | ✓ | — | — | — |
| Edit tenant metadata (name, slug) | ✓ | — | — | — |
| Configure landing page sections (on/off, labels, limits) | ✓ | — | — | — |
| Configure wallet settings (opening coins, referral coins, cashout min) | ✓ | — | — | — |
| Configure mail settings (from email, from name) | ✓ | — | — | — |
| Configure bot settings (visibility, persona, message cap) | ✓ | — | — | — |
| Tenant activation checklist (planned) | ✓ | — | — | — |

---

## 3. User Management

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create user of any role platform-wide | ✓ | — | — | — |
| Create Professional user (scoped to company) | ✓ | ✓ | — | — |
| Create Individual user (scoped to coach) | ✓ | ✓ | ✓ | — |
| View all users platform-wide | ✓ | — | — | — |
| View own managed professionals | — | ✓ | — | — |
| View own managed individuals | — | ✓ | ✓ | — |
| Edit any user | ✓ | — | — | — |
| Edit own profile | ✓ | ✓ | ✓ | ✓ |
| Delete user | ✓ | — | — | — |
| Auto-provision new user during assignment | ✓ | ✓ | ✓ | — |

---

## 4. Programs

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create program | ✓ | ✓ | ✓ | — |
| Edit program | ✓ | ◐ own | ◐ own | — |
| Publish / unpublish program | ✓ | ◐ own | ◐ own | — |
| Delete program | ✓ | — | — | — |
| View published programs | ✓ | ✓ | ✓ | ✓ |
| Request promotion to marketplace | — | ✓ | ✓ | — |
| Approve / deny promotion request | ✓ | — | — | — |

---

## 5. Events

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create event | ✓ | ✓ | ✓ | — |
| Edit event | ✓ | ◐ own | ◐ own | — |
| Publish / unpublish event | ✓ | ◐ own | ◐ own | — |
| Delete event | ✓ | — | — | — |
| View published events | ✓ | ✓ | ✓ | ✓ |
| Request promotion to marketplace | — | ✓ | ✓ | — |
| Approve / deny promotion request | ✓ | — | — | — |

---

## 6. Assessments (Tools)

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create assessment | ✓ | — | — | — |
| Edit assessment | ✓ | — | — | — |
| Add / edit questions | ✓ | — | — | — |
| Generate questions via AI | ✓ | — | — | — |
| Publish / unpublish assessment | ✓ | — | — | — |
| Delete assessment | ✓ | — | — | — |
| View published assessments | ✓ | ✓ | ✓ | ✓ |
| Take an assigned assessment | — | — | — | ✓ |
| View own assessment report | ✓ | ✓ | ✓ | ✓ |
| View any assessment report | ✓ | — | — | — |

---

## 7. Assignments

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Assign activity to an individual | ✓ | ✓ | ✓ | — |
| Assign activity to a cohort | ✓ | ✓ | ✓ | — |
| Recommend an activity | ✓ | ✓ | ✓ | — |
| Cancel assignment | ✓ | ◐ own | ◐ own | — |
| View all assignments platform-wide | ✓ | — | — | — |
| View assignments I created (as assignor) | ✓ | ✓ | ✓ | — |
| View my assigned activities (as assignee) | ✓ | ✓ | ✓ | ✓ |
| Mark assignment in progress / complete | ✓ | ✓ | ✓ | ✓ |

---

## 8. Cohorts

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create cohort | ✓ | ✓ | ✓ | — |
| Edit cohort metadata | ✓ | ◐ own | ◐ own | — |
| Add members to cohort | ✓ | ◐ own | ◐ own | — |
| Remove members from cohort | ✓ | ◐ own | ◐ own | — |
| Assign cohort to activity | ✓ | ✓ | ✓ | — |
| View cohorts | ✓ | ◐ own | ◐ own | — |
| Delete cohort | ✓ | — | — | — |

---

## 9. Wallet — Coins

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| View own wallet balance | ✓ | ✓ | ✓ | ✓ |
| View transaction history | ✓ | ✓ | ✓ | ✓ |
| View all wallets platform-wide | ✓ | — | — | — |
| Assign coins to any user | ✓ | — | — | — |
| Buy coins via Razorpay | — | ✓ | ✓ | ✓ |
| Create coin packages | ✓ | — | — | — |
| Edit / delete coin packages | ✓ | — | — | — |
| Request coins from company | — | — | ◐ independent only | — |
| Approve / deny coin request | ✓ | ◐ own professionals | — | — |
| Request cashout | — | ✓ | ◐ independent only | — |
| Approve / deny cashout request | ✓ | — | — | — |
| Receive registration bonus coins | — | — | ✓ | ✓ |
| Receive referral bonus coins | ✓ | ✓ | ✓ | ✓ |

---

## 10. Referrals

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create referral (invite coach / individual / company) | ✓ | ✓ | ✓ | ✓ |
| View own referrals | ✓ | ✓ | ✓ | ✓ |
| View all referrals platform-wide | ✓ | — | — | — |
| Send referral reminders | ✓ | — | — | — |
| Track referral status (referred → reminded → joined) | ✓ | ✓ | ✓ | ✓ |

---

## 11. Bot Hero

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create / edit bot hero packages | ✓ | — | — | — |
| Submit bot hero request | — | — | ✓ | — |
| View own bot hero requests | — | — | ✓ | — |
| View all bot hero requests | ✓ | — | — | — |
| Approve / deny bot hero request | ✓ | — | — | — |
| Active bot hero featured on landing page | — | — | ◐ if approved | — |

---

## 12. Bot Chat

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Chat with studio bot (tenant-configured) | ✓ | ✓ | ✓ | ✓ |
| Chat with professional bot | ✓ | ✓ | ✓ | ✓ |
| Configure bot persona / visibility | ✓ | — | — | — |

---

## 13. Promotions & Listing Packages

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Create / edit promotion packages | ✓ | — | — | — |
| Create / edit listing packages | ✓ | — | — | — |
| Request content promotion | — | ✓ | ✓ | — |
| Approve / deny promotion request | ✓ | — | — | — |
| View promotion package catalogue | ✓ | ✓ | ✓ | — |

---

## 14. Approvals & Admin Requests

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| View pending coin requests | ✓ | ◐ own professionals | — | — |
| View pending cashout requests | ✓ | — | — | — |
| View pending bot hero requests | ✓ | — | — | — |
| View pending promotion requests | ✓ | — | — | — |
| Approve / deny coin request | ✓ | ◐ own professionals | — | — |
| Approve / deny cashout request | ✓ | — | — | — |
| Approve / deny bot hero request | ✓ | — | — | — |
| Approve / deny promotion request | ✓ | — | — | — |

---

## 15. Reports & Analytics

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Platform-wide stats dashboard (tenants, users, coins, referrals) | ✓ | — | — | — |
| View own activity completion stats | ✓ | ✓ | ✓ | ✓ |
| View assignments created stats | ✓ | ✓ | ✓ | — |
| View guest bot interaction logs | ✓ | — | — | — |
| View all coin orders | ✓ | — | — | — |
| View own coin orders | — | ✓ | ✓ | ✓ |

---

## 16. Landing Page & Public Content

| Operation | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Browse public programs / events / assessments | ✓ | ✓ | ✓ | ✓ |
| View tenant landing page (unauthenticated) | ✓ | ✓ | ✓ | ✓ |
| Configure landing page content | ✓ | — | — | — |
| Bot hero featured on landing | — | — | ◐ if active | — |

---

## Summary Count

| Category | SA | C | P | I |
|---|:---:|:---:|:---:|:---:|
| Tenant Management | 7 | 0 | 0 | 0 |
| User Management | 8 | 4 | 3 | 1 |
| Content (Programs + Events + Assessments) | 21 | 8 | 8 | 4 |
| Assignments & Cohorts | 15 | 11 | 11 | 3 |
| Wallet & Coins | 13 | 7 | 6 | 3 |
| Referrals | 5 | 4 | 4 | 4 |
| Bot Hero & Chat | 9 | 2 | 5 | 2 |
| Approvals | 8 | 3 | 0 | 0 |
| Reports | 6 | 3 | 3 | 2 |

---

*Generated from StudioVerse codebase audit — May 2026*
