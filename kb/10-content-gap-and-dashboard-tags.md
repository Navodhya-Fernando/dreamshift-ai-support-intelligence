# Content Gap & Dashboard Tags

## Purpose
This file defines categories for future analytics. It helps the system classify chats for dashboard insights.

## Intent Tags
- pricing_question
- package_comparison
- individual_service_question
- guarantee_question
- refund_question
- revision_question
- urgent_deadline
- payment_installment
- australia_job_search
- visa_or_work_rights
- no_australian_experience
- applied_no_interviews
- linkedin_question
- cv_resume_question
- cover_letter_question
- job_application_support
- missed_call_reschedule
- not_in_australia_yet
- interview_preparation
- industry_support
- consultation_booking
- human_handoff
- content_gap

## Package Interest Tags
- essential_interest
- advanced_interest
- ultimate_interest
- individual_cv_interest
- individual_cover_letter_interest
- individual_linkedin_interest
- unsure_package

## Objection Tags
- price_objection
- installment_request
- guarantee_skepticism
- job_guarantee_request
- visa_concern
- no_local_experience
- urgency_concern
- timing_objection
- not_in_australia_objection
- missed_call_reschedule_objection
- wants_done_for_you_applications
- trust_concern
- ai_generic_concern
- industry_fit_concern

## Market Tags
- australia
- sri_lanka
- uk
- usa
- canada
- new_zealand
- unknown_market

## Lead Temperature Tags
- hot_lead
- warm_lead
- cold_lead

## Useful Dashboard Questions
The future dashboard should answer:
- Which packages are users most interested in?
- Which objections appear most often?
- How many users ask about instalments?
- How many users ask about the guarantee?
- Which industries or roles appear most often?
- How many users mention 485 visa or temporary visa concerns?
- How many users ask urgent deadline questions?
- Which questions are not answered by the KB?
- Which chats lead to WhatsApp or consultation handoff?
- Which marketing pages or UTMs produce the most hot leads?

## Content Gap Rule
If the bot cannot answer confidently from the KB, it should:
1. Avoid guessing.
2. Give a safe partial answer if possible.
3. Recommend contacting DreamShift or booking a free consultation.
4. Tag the question as content_gap for future KB improvement.


## Confirmed Sales Objection Tags
These are confirmed by the DreamShift sales team and should be tracked as priority dashboard insights:
- price_objection
- timing_objection
- not_in_australia_objection
- missed_call_reschedule_objection
- wants_done_for_you_applications
