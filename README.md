<<<<<<< HEAD
# SJ_Consulting_Admin
The Backend User Interface and Functionality for SJ consulting education Limited
=======
# SJ Consulting Admin Dashboard

Initial unauthenticated admin interface for SJ Consulting Limited, built with Next.js App Router, TypeScript, and the supplied ink/paper/metallic-gold design tokens.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/admin/login`.

## Current scope

- Admin login UI
- First-time password setup entry point
- Password recovery entry point
- Responsive brand shell and theme tokens
- Typed foundations for Supabase auth integration

The forms are intentionally UI-only in this first iteration. The next step is wiring them to Supabase Auth and the project’s admin-access schema.

//NOTE:
Important operational boundaries
The upload is saved before AI extraction. status: "pending" means extraction has not started; it is not proof that a background worker is running.

The saved raw_text may exceed the Edge Function’s current per-request text limit. The extraction workflow must split it into smaller batches without truncation.

Enforce the 100-question limit after extraction and again on publication. The upload endpoint cannot reliably infer question count from file size.

Storage upload and database creation are not one transaction. The cleanup handles ordinary database failures, but a process interruption can still leave an orphan file.

The 10 MB application limit does not override your hosting provider’s incoming request-size limit. If your host rejects the request before Next.js receives it, switch to owner-authorised direct Storage uploads or a smaller limit.

This version calculates summary counts dynamically. It is suitable as the initial implementation; measured usage can determine whether persisted counters are needed later.


THE ORPHAN CONCEPTS:
Where an orphan can occur
Our creation endpoint performs these steps:

text
1. Validate and read the document
                 ↓
2. Upload it to Supabase Storage
                 ↓
3. Insert the question_imports record
                 ↓
4. Return the batch ID
The vulnerable point is between steps 2 and 3:

text
Storage upload succeeds
         ↓
Database insert fails, or the server stops
         ↓
File exists, but no batch record references it
Strictly speaking, the file can still have Supabase-managed metadata in storage.objects; what is missing is your application’s question_imports record.

An extraction failure is a different situation
If the file and import record were both saved successfully, then AI extraction fails:

text
Storage file exists ✓
Import record exists ✓
AI extraction fails ✗
That is a failed or incomplete import—not an orphan. Keep the file and import so the owner can retry extraction, use the text-parser fallback, or enter questions manually.

What are the repercussions?
For an application-level orphan:

It consumes storage without appearing in the batch library.

The admin cannot manage it through the normal batch interface.

Retrying the upload can create additional copies.

It retains document content without the expected tracking record.


//Scenarios for orphan files, understanding of when the  batchID is generated and it relationship
with the question_import table
How the identifiers connect
Your table is named question_imports, and its id currently serves as the batch ID:

text
Supabase Storage
  question-documents/{userId}/{batchId}/source.pdf
                               │
                               ▼
question_imports
  id = batchId
  storage_path = the file’s path
                               │
                               ▼
questions
  import_id = batchId
In the endpoint we wrote, the server generates batchId before uploading the file. Therefore, an orphan file may already have that generated ID in its storage path—but there is no successfully saved question_imports row with that ID.


app/
├── api/
│   └── admin/
│       └── question-batches/
│           └── [batchId]/
│               ├── route.ts          ← Batch-detail GET/PATCH endpoint
│               └── extract/
│                   └── route.ts      ← Extraction POST endpoint
│
└── admin/
    └── questions/
        └── batches/
            └── [batchId]/
                └── page.tsx          ← Visible batch workspace
>>>>>>> 0173300a (Changes)
