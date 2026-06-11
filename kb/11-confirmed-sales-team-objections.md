# Confirmed Sales Team Objections

## Purpose
This file exists to make the RAG chatbot retrieve confirmed sales objections more reliably.

## Confirmed Objection List
DreamShift sales team confirmed these objections:
1. Price
2. Timing
3. Client is not in Australia at the moment
4. Rescheduling the consultation call if missed
5. Client wants DreamShift to apply for jobs on their behalf

## How the Bot Should Prioritize These
If a user question matches one of these objections, the chatbot should answer clearly and then guide the user toward the free consultation if the situation depends on package choice, timeline, or team availability.

## Price Response Rule
Mention package value first. Explain that packages include a full job-search toolkit, not only a CV. Mention instalments with the additional AUD 10 charge. Then offer individual services only as a secondary path.

## Timing Response Rule
Do not promise urgent delivery. Always say urgent delivery depends on team availability and should be confirmed by contacting DreamShift or booking a free consultation.

## Not in Australia Response Rule
DreamShift can support clients targeting Australia even if they are not currently in Australia. The bot should not give visa or migration advice.

## Missed Call / Rescheduling Response Rule
The user can reschedule by using the booking link or contacting DreamShift. The tone should be friendly and low-pressure.

## Job Application Support Response Rule
If the user wants DreamShift to apply for jobs, recommend the Ultimate Career Package and explain that it includes 2 months of job application support. Do not imply that Essential or Advanced include applying on behalf of the client.
