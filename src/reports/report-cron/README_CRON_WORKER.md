# Reports Cron Job and Background Worker Implementation

## Overview
This document explains the implementation of scheduled report generation in the Electric Inventory backend.

The implementation is split into:

- A **background worker process** that runs cron schedules.
- A **cron service** that decides when to run each report type.
- A **report service** that generates branch-wise Excel reports, saves files, and sends emails.
- A **manual trigger entrypoint** for on-demand execution without waiting for cron time.

## Implementation Files

- `src/reports.worker.ts`
- `src/reports.worker.module.ts`
- `src/reports/report-cron/report-cron.service.ts`
- `src/reports/reports.service.ts`
- `src/reports/reports.module.ts`
- `src/reports.trigger.ts`
- `src/shared/enums/report-type.enum.ts`
- `src/shared/enums/delivery-method.enum.ts`
- `src/reports/entities/report-preference.entity.ts`

## Architecture and Flow

### 1) Worker Bootstrap
`src/reports.worker.ts` starts a Nest application context only for worker use:

- Sets `REPORTS_CRON_ENABLED=true`.
- Bootstraps `ReportsWorkerModule`.
- Keeps process running so cron decorators execute.

This allows running scheduler logic independently from the main API server.

### 2) Worker Module Setup
`src/reports.worker.module.ts` imports:

- `ConfigModule` for environment variables.
- `TypeOrmModule.forRoot(...)` for DB connectivity.
- `ScheduleModule.forRoot()` for cron support.
- `ReportsModule` containing `ReportCronService` and `ReportsService`.

### 3) Cron Scheduling Layer
`src/reports/report-cron/report-cron.service.ts` contains five cron handlers:

- Daily: `@Cron('59 59 23 * * *')`
- Weekly: `@Cron('59 59 23 * * 0')`
- Monthly: `@Cron('59 59 23 * * *')` + month-end guard
- Half-yearly: `@Cron('59 59 23 * * *')` + half-year-end guard
- Yearly: `@Cron('59 59 23 * * *')` + year-end guard

Each handler first checks:

- `process.env.REPORTS_CRON_ENABLED === 'true'`

If disabled, the handler exits without processing.

### 4) Report Generation and Delivery
`src/reports/reports.service.ts` executes report work:

- Calculates period summaries from `purchase` data.
- Builds formatted Excel workbooks using `exceljs`.
- Saves files locally to `D:\Reports\<reportType>\`.
- Sends report attachments by email (when recipients exist).
- Processes data branch-wise by iterating active branches and users.

The report types supported:

- `daily`
- `weekly`
- `monthly`
- `half_yearly`
- `yearly`

Delivery methods supported for user preferences:

- `local_file`
- `email`

### Report Generation in Local Storage (Functionality)

Local report generation is handled by `generateAndSaveReport(reportType, user)`:

- Builds report data for the selected period (`daily/weekly/monthly/half_yearly/yearly`).
- Creates a styled Excel workbook (`.xlsx`) using `exceljs`.
- Ensures target folder exists under `D:\Reports\<reportType>\`.
- Saves file with timestamped name format:
  - `<reportType>_YYYY-MM-DD_HH-MM-SS_branch_<branchName>.xlsx`
- Returns full saved file path for logging/API response.

This provides persistent report archival on server/local disk for audit and manual access.

### Sending Report Email (Functionality)

Email functionality is handled by `sendReportEmail(...)` through `EmailService`:

- Generates report as an in-memory Excel buffer (`generateReportBuffer`).
- Renders HTML email body using `src/templates/report-email.hbs`.
- Sends mail with SMTP configuration (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`).
- Attaches the generated `.xlsx` report to the email.
- Sends branch-wise to deduplicated recipients (user emails/usernames) for each branch.

When no recipients exist for a branch, the system logs a warning and continues processing other branches.

### 5) Manual Trigger Entrypoint
`src/reports.trigger.ts` provides one-time execution:

- Bootstraps worker context.
- Reads `REPORT_TRIGGER_TYPE` (defaults to `daily`).
- Validates against `ReportType` enum.
- Runs `reportsService.runReportNow(reportType)` and exits.

This is useful for immediate testing, demos, and ad-hoc operations.

## NPM Scripts

Defined in `package.json`:

- `npm run start:worker` -> run worker entrypoint.
- `npm run start:worker:dev` -> worker with watch mode.
- `npm run start:worker:prod` -> run compiled worker from `dist`.
- `npm run trigger:reports` -> run one-time trigger entrypoint.

## Runtime Commands (PowerShell)

### Start worker for scheduled execution
```powershell
npm run start:worker
```

### Trigger one-time report run
```powershell
npm run trigger:reports
```

### Trigger specific type
```powershell
$env:REPORT_TRIGGER_TYPE='weekly'; npm run trigger:reports
$env:REPORT_TRIGGER_TYPE='monthly'; npm run trigger:reports
$env:REPORT_TRIGGER_TYPE='half_yearly'; npm run trigger:reports
$env:REPORT_TRIGGER_TYPE='yearly'; npm run trigger:reports
```

## Environment and Prerequisites

Required:

- Database configuration for TypeORM.
- SMTP configuration for email delivery.
- Write access to `D:\Reports` path on host machine.

Behavioral flags:

- `REPORTS_CRON_ENABLED=true` enables cron processing.
  - Worker entrypoint sets this automatically.
- `REPORT_TRIGGER_TYPE` is used by manual trigger entrypoint.

## Branch-wise Processing Behavior

For a selected report type:

1. Fetch all active branches (`isRemoved=false`).
2. For each branch, fetch active users and collect recipient emails/usernames.
3. Generate Excel report for that branch.
4. Save the file locally.
5. Send email with attachment if recipients are present.
6. Log warnings when no recipients are found for a branch.

Failures in one branch are logged and do not stop processing of remaining branches.

## User Preference Support

Report preferences (`report_preferences` table) store:

- `userId`
- `reportType`
- `deliveryMethod`
- `isActive`

Preferences are managed via `ReportsController` endpoints and used by `processScheduledReports(userId)` for user-driven generation flows.

## Summary

The cron and worker implementation is production-oriented and decoupled from API traffic:

- Scheduler runs in a dedicated worker process.
- Execution supports daily/weekly/monthly/half-yearly/yearly cadences.
- Report generation is branch-aware and fault-tolerant.
- Delivery supports both local archival and email distribution.
- Manual trigger path allows operational flexibility without waiting for scheduled time.
