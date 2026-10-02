# Platform Documentation Index

Welcome to the official documentation for **Obligacje Calculator**. This documentation is the master reference for product boundaries, real requirements, technical design, and the current production-readiness path.

## Table of Contents

### 0. Documentation Governance

- [Documentation Architecture and Rules](./00_documentation_architecture_and_rules.md) - Structure, naming, numbering, and archive rules for the documentation system.
- [ADR 0001: Holding-record workspace, not a transaction ledger](./adr/0001-holding-record-not-ledger.md) - The notebook's persisted-record model and explicit non-ledger limit.

### 1. Strategy & Vision (Product)

- [Product Vision & Purpose](./product/01_product_vision_and_purpose.md) - Why this calculator exists and what problem it should solve.
- [Core Product Philosophy](./product/02_core_philosophy.md) - The fundamental principles guiding development.
- [Target Users & Personas](./product/03_target_users_and_personas.md) - Detailed analysis of who we are building for.
- [UX & Design Principles](./product/13_ux_and_design_principles.md) - Aesthetic and usability standards.
- [UI Copy & Tone](./product/14_ui_copy_and_tone.md) - How we communicate with the user.
- [Content Strategy & Education](./product/15_content_strategy_and_education.md) - Our approach to financial literacy.
- [Functional Requirements](./product/17_functional_requirements.md) - Current product requirements after scope reset.
- [Roadmap & MVP Definition](./product/25_roadmap_and_mvp_definition.md) - Reset MVP and recovery path.
- [Trusted & Experimental Feature Matrix](./product/26_trusted_and_experimental_feature_matrix.md) - Current support classes for core, conditional, and experimental pages.
- [UX Improvement Plan](./product/18_ux_improvement_plan.md) - Continuous enhancement of the user experience.

### UI System

- [UI Design Direction](./ui/01_ui_design_direction.md) - Quiet instrument-panel visual direction.
- [UI Rules](./ui/02_ui_rules.md) - Layout, typography, color, and table rules.
- [Design System](./ui/03_design_system.md) - Shared formatter, token, component, and refactor rules.
- [Financial Workflow Accessibility Contract](./ui/04_accessibility_financial_workflow_contract.md) - Required accessible behavior for financial workflows.
- [Desktop Visual and UX Audit](./ui/05_desktop_visual_ux_audit.md) - Screenshot-based, prioritized UI findings and implementation acceptance criteria for six desktop routes.

### 2. Technical Architecture

- [Developer Architecture Guide](./technical/architecture/00_developer_guide.md) - Where new code belongs and how to verify it.
- [System Architecture](./technical/architecture/19_system_architecture.md) - High-level technical design.
- [Handler Pattern Orchestration](./technical/architecture/25_handler_pattern_orchestration.md) - **[NEW]** Decoupled calculation logic.
- [Information Architecture](./technical/architecture/12_information_architecture.md) - Structural map.
- [Non-Functional Requirements](./technical/architecture/18_non_functional_requirements.md) - Quality and performance.
- [Database & Data Modeling](./technical/architecture/20_database_and_data_modeling.md) - Schema and strategy.
- [Detailed Data Schemas](./technical/architecture/20_detailed_data_schemas.md) - Table structures.
- [API Design & Integrations](./technical/architecture/21_api_design_and_integrations.md) - NBP, GUS, Yahoo Finance.
- [Security & Privacy](./technical/architecture/22_security_and_privacy.md) - Protecting user data.
- [Testing & Quality Assurance](./technical/architecture/23_testing_and_quality_assurance.md) - Correctness.
- [Deployment & DevOps](./technical/architecture/24_deployment_and_devops.md) - CI/CD strategy.
- [Engineering and Coding Rules](./technical/architecture/26_engineering_and_coding_rules.md) - Strict repo rules for i18n, component structure, code hygiene, and maintainability.
- [HTTP Boundary Contract](./technical/architecture/33_http_boundary_contract.md) - Request identity, rate limits, correlation, telemetry, and administrative route rules.
- [Modularity Refactoring Audit](./technical/architecture/34_modularity_refactoring_audit.md) - Proven refactoring seams and reusable dashboard baseline.
- [Full-Stack Architecture Audit](./technical/architecture/35_full_stack_architecture_audit.md) - Read-only audit snapshot covering ownership, server correctness, dependency direction, enforcement gaps, and dashboard-template reuse.
- [Architecture Implementation Ledger](./technical/architecture/36_implementation_ledger.md) - Implementation progress, decisions, and executed verification.
- [Codebase Design and Domain Model Audit](./technical/architecture/37_codebase_design_and_domain_model_audit.md) - Current seam, terminology, and financial-model audit with prioritized remediation.
- [Project Map](./technical/architecture/28_project_map.md) - Repository ownership map for app, feature, shared, server, data, sync, and docs layers.

### 3. Domain Knowledge

- [Polish Bonds Domain Guide](./technical/domain/04_polish_bonds_domain_guide.md) - Comprehensive rules and mechanics.
- [Financial Instrument Model](./technical/domain/05_financial_instrument_model.md) - Unified data structures.
- [Bond Calculation Engine](./technical/domain/06_bond_calculation_engine.md) - Math and logic deep-dive.
- [Calculation Scenarios](./technical/domain/07_calculation_scenarios.md) - Investment paths.
- [Risk Communication & Disclaimers](./product/16_risk_communication_and_disclaimers.md) - Legal boundaries.

### 4. Features & Logic

- [Historical Data & Backtesting](./technical/features/08_historical_data_and_backtesting.md) - Past performance.
- [Comparative Simulations](./technical/features/09_comparative_simulations.md) - Multi-asset comparisons.
- [Savings & Retirement Planner](./technical/features/10_savings_and_retirement_planner.md) - Planning tools.
- [User Notebook & Tracking](./technical/features/11_user_notebook_and_tracking.md) - Personal investments.

### 5. Current Plans & Roadmap

- [00. Current Product Roadmap](./plans/00_roadmap.md) - Current roadmap centered on the trusted-core production scope.
- [01. Long-Term Product Foundation Plan](./plans/01_longterm_product_foundation_plan.md) - Long-term direction after scope narrowing.
- [08. Cloud Run Release Candidate Plan](./plans/08_cloud_run_release_candidate_plan.md) - First Cloud Run deploy checklist for the trusted-core production scope.
- [09. Comprehensive Codebase Quality, Security, and Refactor Plan](./plans/09_comprehensive_codebase_quality_security_refactor_plan.md) - Full-codebase audit and prioritized remediation program for security, correctness, data integrity, architecture, testing, performance, UI/UX, accessibility, scalability, operations, and documentation.
- [10. Security, Resilience, and Adversarial Evidence Audit](./plans/10_security_resilience_evidence_audit.md) - Threat model, endpoint authorization matrix, adversarial runtime evidence, migration and supply-chain verification, load results, cross-browser/accessibility findings, and security acceptance criteria.
- [11. Codebase Simplification and Cleanup Audit](./plans/11_codebase_simplification_cleanup_audit.md) - Evidence-led, no-behavior-change plan for removing dead code, reducing brittle tests and duplicate orchestration, and keeping React/Next bundle work measurable.
- [12. Trusted-Core Release Scorecard](./plans/12_trusted_core_release_scorecard.md) - Repository evidence required for education, the single calculator, and economic-data admission.

### 6. Archived Plans

- [Archived Plans Index](./archive/plans/index.md) - Historical and completed execution plans preserved for reference.
- [13. Incremental Feature Folder Improvement Plan](./archive/plans/13_incremental_feature_folder_improvement_plan.md) - Completed feature-folder organization work retained for historical reference.
- [July 2026 UI Audit](./archive/ui/2026_07_ui_audit.md) - Superseded visual audit retained as historical evidence.

### 7. Operations

- [Monthly Bond Offer Sync](./operations/01_monthly_bond_offer_sync.md) - Operator workflow for refreshing current retail bond offers and macro data.
- [Cloud Run Preview Access](./operations/02_cloud_run_private_preview.md) - Public Cloud Run preview URL and required deployment secrets.
- [Local Development Workflow](./operations/03_local_development.md) - WSL-first Docker Compose, Taskfile, local DB, and smoke-check workflow.
- [Private Preview Verification](./operations/04_private_preview_verification.md) - Redacted operational readiness evidence and manual checks.
- [Redacted Operational Evidence Template](./operations/evidence-template.md) - Required record for cloud, IAM, backup, load-test, and deployment controls.
- [Durable Synchronization Contract](./operations/05_durable_sync_contract.md) - Event ownership, retries, retention cleanup, and external Inngest evidence gate.
- [External Evidence Gate](./operations/06_external_evidence_gate.md) - Redacted proof required before repository controls are described as deployed.
- [OAuth Token Lifecycle Runbook](./operations/07_oauth_token_lifecycle.md) - Token inventory, retention, revocation, and evidence procedure.

---

_Last Updated: August 11, 2026 - App is in production-readiness remediation for the trusted-core Cloud Run scope. The comprehensive codebase audit ledger distinguishes repository-complete controls from pending external operational evidence._
