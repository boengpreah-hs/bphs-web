# Firestore Security Specification & Invariants (TDD Specification)

This specification defines the Attribute-Based Access Control (ABAC) invariants, security postures, and extreme-vulnerability payloads to secure the Baray Secondary School Management Database.

## 1. Data Invariants

- **Student Records Identity**: Students can only be modified by authorized administrators. Student IDs must match alphanumeric patterns and not allow recursive "Denial of Wallet" payloads (maximum ID string size: 64, maximum field strings: 4KB).
- **Temporal Strictness**: Activity, academic, and exam post timestamp values must match the server-side `request.time` exactly at transaction time to prevent spoofing or retrogressive dates.
- **Config Singletons**: Global card layout, about us, and app config singletons are in `/settings` and are strictly private/read-only to guest users, and writable exclusively by administrators.
- **Unbounded Arrays Guard**: No unbounded arrays are used. High-volume records like students and bullet posts are stored in separate individual single-document collections instead of combined array states on single main documents.

---

## 2. The "Dirty Dozen" Threat Payloads

Here are 12 specific hostile JSON payloads designed to test our ruleset for vulnerabilities:

### Threat 1: Administrative Spoofing (Student Create Bypass)
- **Target**: `/students/999`
- **Method**: Create as unauthenticated/guest user
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 2: Student ID Poisoning (Path Allocation Attack)
- **Target**: `/students/STUDENT_ID_STRETCH_1KB_AAAAAAAAAAAAAAAAAAAAA...` (Huge character string)
- **Method**: Create as administrator with oversized ID
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 3: Student Field Poisoning (Large Base64/Overdose)
- **Target**: `/students/002`
- **Method**: Create with `phone` field containing >1MB long binary string.
- **Expected Outcome**: `PERMISSION_DENIED` (Strict size restrictions: phone size <= 32 characters)

### Threat 4: Gender Value Hijacking
- **Target**: `/students/003`
- **Method**: Write `gender` with arbitrary value like `"Apache Helicopter"`.
- **Expected Outcome**: `PERMISSION_DENIED` (Strict enum `"ប្រុស"` | `"ស្រី"` check failure)

### Threat 5: Post Date Spoofing (Temporal Bypass)
- **Target**: `/activities/act999`
- **Method**: Create activity post setting `date` or custom timestamp to year `1990-01-01` to disrupt timeline logic.
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 6: Singleton Resource Decapitation (Delete Layout)
- **Target**: `/settings/card_layout`
- **Method**: Issue recursive `delete` operation on a central system configuration.
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 7: Config Shadow Value Injection
- **Target**: `/settings/card_layout`
- **Method**: Update layouts with custom unauthorized keys or corrupted integers.
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 8: Private Information Public Scrape
- **Target**: Retrieve all administrative settings `/settings/app_config`
- **Method**: Unauthorized public unauthenticated read scan
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 9: Admin Privilege Self-Assignment
- **Target**: Update admin credential settings document `/settings/app_config` manually
- **Method**: Non-admin matching ID attempts user updates
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 10: Academic Bulletin Orphaned Integrity Breach
- **Target**: Create `/academic/ac999`
- **Method**: Write title name size empty or with missing required properties
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 11: Exam Post Cat Overrider
- **Target**: `/exams/ex999`
- **Method**: Write `cat` field with non-enum string `"sat_exam"`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 12: Activity Likes Infinitum Exploitation
- **Target**: Guest user increases activity likes directly from client bypassing server logic
- **Method**: Direct increment of `likes` count to `999999` without actual session limits.
- **Expected Outcome**: `PERMISSION_DENIED`

---

## 3. The Test Runner Reference

A local testing harness `firestore.rules.test.ts` is implemented using the `@firebase/rules-unit-testing` framework. All operations from non-admins must throw permission exceptions.
