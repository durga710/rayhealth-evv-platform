#!/usr/bin/env tsx
/**
 * Idempotent global learning-catalog seeder.
 *
 * Upserts a baseline set of Pennsylvania home-care training courses as GLOBAL
 * courses (agency_id = NULL) so every agency sees a ready-to-assign catalog
 * with real in-app content (objectives, lesson sections) and knowledge-check
 * quizzes. Upsert is keyed on (agency_id, code); existing courses are left as
 * they are so agency edits and prior seeds are never clobbered.
 *
 * Usage (against a Neon branch or local DB):
 *   DATABASE_URL="postgres://…?sslmode=require&branch=br-…" \
 *     npx tsx packages/core/scripts/seed-learning-catalog.ts
 *
 * Run AFTER migrations (`npm run db:migrate`).
 */
import { createDb } from '../src/db/knex.js';
import { LearningRepository } from '../src/repositories/learning-repository.js';
import type { NewLearningCourse } from '../src/domain/learning.js';

const CATALOG: NewLearningCourse[] = [
  {
    agencyId: null,
    code: 'ORIENT-PA',
    title: 'New Hire Orientation (PA §52.18)',
    description:
      'Required orientation covering agency policies, client rights, and your role before your first client visit.',
    cadence: 'one_time',
    expiresAfterDays: null,
    required: true,
    durationMinutes: 45,
    modules: {
      objectives: [
        'Understand your role and responsibilities as a direct care worker',
        'Describe client rights and how to protect dignity and privacy',
        'Know the agency chain of communication for questions and emergencies',
      ],
      sections: [
        {
          title: 'Your role in home care',
          content:
            'As a direct care worker you support clients with activities of daily living (ADLs) such as bathing, dressing, mobility, meal preparation, and light housekeeping. You are the agency’s eyes and ears in the home: report changes in a client’s condition, home safety hazards, or anything that concerns you. Always work within your assigned care plan — never perform tasks outside your training or the plan.',
        },
        {
          title: 'Client rights & dignity',
          content:
            'Every client has the right to be treated with respect, to privacy, to participate in their own care decisions, and to be free from abuse, neglect, and exploitation. Knock before entering, explain what you are doing, and honor reasonable preferences. Protect health information — never discuss a client’s situation with anyone outside the care team.',
        },
        {
          title: 'Communication & emergencies',
          content:
            'Clock in and out for every visit using the EVV app at the client’s home. If you cannot reach a client, suspect an emergency, or a visit cannot proceed safely, call your coordinator immediately. In a life-threatening emergency call 911 first, then notify the agency.',
        },
      ],
      note: 'Per PA Code §52.18, orientation must be completed before your first client contact.',
      quiz: [
        {
          question: 'Before performing a task for a client, you should:',
          options: [
            'Do whatever the client asks, even if it is not in the care plan',
            'Confirm the task is within your training and the assigned care plan',
            'Wait until your supervisor visits the home',
          ],
          correct: 1,
        },
        {
          question: 'A client tells you something private about their health. You may discuss it with:',
          options: [
            'Your family, since names are not used',
            'Anyone on social media if it is a good story',
            'Only the client’s care team, as needed to provide care',
          ],
          correct: 2,
        },
        {
          question: 'When should you clock in for a visit?',
          options: [
            'At the client’s home when the visit begins, using the EVV app',
            'From home before you leave',
            'At the end of the week for all visits at once',
          ],
          correct: 0,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'ANNUAL-HIPAA',
    title: 'Annual HIPAA Privacy & Security',
    description: 'Annual refresher on protecting client health information (PHI) and reporting privacy incidents.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 30,
    modules: {
      objectives: [
        'Define Protected Health Information (PHI) and give examples',
        'Apply the “minimum necessary” rule in daily work',
        'Recognize and report a potential privacy breach',
      ],
      sections: [
        {
          title: 'What is PHI?',
          content:
            'PHI is any health information that can identify a person — names, addresses, Medicaid IDs, diagnoses, visit notes, and even photos. You may only access and use PHI as needed to do your job. This is the “minimum necessary” rule: don’t look at records you don’t need, and don’t share more than required.',
        },
        {
          title: 'Protecting PHI in the field',
          content:
            'Keep your device locked with a passcode. Don’t leave paperwork visible in your car or home. Never text client details over personal apps. Use only the agency’s approved app for visit data. If you lose a device or paperwork, report it to the agency immediately.',
        },
        {
          title: 'Reporting incidents',
          content:
            'A breach is any unauthorized access, use, or disclosure of PHI — a lost phone, an email to the wrong person, or talking about a client in public. If you think a breach may have happened, report it to your privacy officer right away. Prompt reporting protects clients and limits harm; you will not be punished for reporting in good faith.',
        },
      ],
      quiz: [
        {
          question: 'Which of these is PHI?',
          options: ['A client’s Medicaid ID and diagnosis', 'The weather during your shift', 'Your own phone number'],
          correct: 0,
        },
        {
          question: 'The “minimum necessary” rule means you should:',
          options: [
            'Access only the client information you need to do your job',
            'Read every client’s full chart to be thorough',
            'Share client details with coworkers to stay informed',
          ],
          correct: 0,
        },
        {
          question: 'You accidentally send a visit note to the wrong person. You should:',
          options: ['Say nothing and hope nobody noticed', 'Report it to your privacy officer immediately', 'Delete your sent folder'],
          correct: 1,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'INFECTION-CTRL',
    title: 'Infection Control & Standard Precautions',
    description: 'Hand hygiene, PPE, and standard precautions to keep clients and caregivers safe.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 25,
    modules: {
      objectives: [
        'Perform hand hygiene at the right moments',
        'Select and use personal protective equipment (PPE) correctly',
        'Apply standard precautions in the home',
      ],
      sections: [
        {
          title: 'Hand hygiene',
          content:
            'Handwashing is the single most effective way to prevent the spread of infection. Wash with soap and water for at least 20 seconds before and after client contact, after using the restroom, before food prep, and after removing gloves. Use alcohol-based sanitizer when soap and water are not available and hands are not visibly soiled.',
        },
        {
          title: 'Standard precautions & PPE',
          content:
            'Treat all blood and body fluids as potentially infectious. Wear gloves when contact with body fluids is possible; wear a gown, mask, or eye protection when splashes are likely. Remove PPE carefully to avoid contaminating yourself, and dispose of it properly. Cover cuts, and never reuse single-use gloves.',
        },
      ],
      quiz: [
        {
          question: 'How long should you wash your hands with soap and water?',
          options: ['At least 20 seconds', 'About 3 seconds', 'Only if they look dirty'],
          correct: 0,
        },
        {
          question: 'Under standard precautions, blood and body fluids should be treated as:',
          options: ['Safe unless the client looks sick', 'Potentially infectious in all cases', 'A concern only in hospitals'],
          correct: 1,
        },
        {
          question: 'After removing your gloves, you should:',
          options: ['Reuse them for the next task', 'Perform hand hygiene', 'Skip washing if you used gloves'],
          correct: 1,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'ABUSE-NEGLECT',
    title: 'Recognizing & Reporting Abuse and Neglect',
    description: 'Identify signs of abuse, neglect, and exploitation, and follow mandated reporting duties.',
    cadence: 'annual',
    expiresAfterDays: 365,
    required: true,
    durationMinutes: 30,
    modules: {
      objectives: [
        'Recognize common signs of abuse, neglect, and financial exploitation',
        'Understand your duty to report',
        'Know how to report in Pennsylvania',
      ],
      sections: [
        {
          title: 'Types and signs',
          content:
            'Abuse can be physical, emotional, or sexual; neglect is the failure to provide for basic needs; exploitation is the misuse of a person’s money or property. Warning signs include unexplained bruises, fearfulness, poor hygiene, weight loss, missing belongings, or sudden changes in finances. Trust your instincts — you do not need proof to report a concern.',
        },
        {
          title: 'Your duty to report',
          content:
            'Direct care workers are expected to report suspected abuse, neglect, or exploitation. Report concerns to your supervisor and, when required, to the appropriate authorities. In Pennsylvania, suspected abuse of an older adult can be reported to the statewide elder abuse hotline at 1-800-490-8505. When in doubt, report — reports made in good faith are protected.',
        },
      ],
      quiz: [
        {
          question: 'Which of these may be a sign of neglect?',
          options: ['A tidy, well-stocked kitchen', 'Poor hygiene and unexplained weight loss', 'A client who enjoys visitors'],
          correct: 1,
        },
        {
          question: 'You suspect, but cannot prove, that a client is being exploited. You should:',
          options: ['Wait until you have solid proof', 'Report your good-faith concern', 'Confront the family yourself'],
          correct: 1,
        },
        {
          question: 'Reports of suspected abuse made in good faith are:',
          options: ['Protected', 'Grounds for firing you', 'Optional and rarely needed'],
          correct: 0,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'EVV-BASICS',
    title: 'Electronic Visit Verification (EVV) Basics',
    description: 'How and why to clock in and out correctly to keep visits compliant and payable.',
    cadence: 'one_time',
    expiresAfterDays: null,
    required: true,
    durationMinutes: 20,
    modules: {
      objectives: [
        'Explain why EVV is required',
        'Clock in and out correctly at the point of care',
        'Handle common EVV problems the right way',
      ],
      sections: [
        {
          title: 'Why EVV matters',
          content:
            'The 21st Century Cures Act requires Electronic Visit Verification for Medicaid personal care services. EVV captures who provided care, for whom, what service, where, and when the visit started and ended. Accurate EVV protects you, documents the care you gave, and is what allows the agency to be paid. Inaccurate or falsified EVV can jeopardize payment and is considered fraud.',
        },
        {
          title: 'Clocking in and out',
          content:
            'Open the app at the client’s home and clock in when the visit begins; clock out when it ends. Allow location access so the visit location can be verified — location is captured only at clock-in and clock-out, never tracked in between. If you forget to clock in, clock in as soon as you remember and tell your coordinator so the visit can be corrected properly.',
        },
      ],
      quiz: [
        {
          question: 'EVV is required by:',
          options: ['The 21st Century Cures Act', 'Your phone carrier', 'No one — it is optional'],
          correct: 0,
        },
        {
          question: 'When is your location captured?',
          options: ['Continuously throughout your shift', 'Only at clock-in and clock-out', 'Never'],
          correct: 1,
        },
        {
          question: 'You forgot to clock in at the start of a visit. You should:',
          options: [
            'Clock in when you remember and notify your coordinator to correct it',
            'Make up start and end times that look right',
            'Skip the visit record entirely',
          ],
          correct: 0,
        },
      ],
    },
  },
  {
    agencyId: null,
    code: 'CPR-FA',
    title: 'CPR & First Aid Certification',
    description: 'Hands-on CPR and first aid certification through an approved provider. Upload your card when complete.',
    cadence: 'certification',
    expiresAfterDays: 730,
    required: false,
    durationMinutes: 240,
    externalUrl: 'https://www.redcross.org/take-a-class/cpr',
    modules: {
      objectives: [
        'Recognize a cardiac or breathing emergency',
        'Complete an approved hands-on CPR/First Aid course',
        'Keep your certification current (renew before it expires)',
      ],
      sections: [
        {
          title: 'About this certification',
          content:
            'CPR and First Aid certification must be earned through an approved in-person or blended provider (for example, the American Red Cross or American Heart Association) because it requires a hands-on skills check. Use the official resource link to find and complete a class, then provide your certification card to the agency so your record can be updated. Certifications typically last two years — renew before the expiry date to stay eligible for assignments.',
        },
      ],
      quiz: [
        {
          question: 'CPR certification requires:',
          options: ['Only watching a video', 'An approved hands-on skills check', 'Nothing — self-study is enough'],
          correct: 1,
        },
        {
          question: 'CPR/First Aid certification typically must be renewed:',
          options: ['Never', 'Every two years (before it expires)', 'Every ten years'],
          correct: 1,
        },
      ],
    },
  },
];

async function run(): Promise<void> {
  const db = createDb();
  const repo = new LearningRepository(db);
  let created = 0;
  let existing = 0;
  try {
    for (const course of CATALOG) {
      const before = await repo.findCourseByCode(null, course.code);
      await repo.upsertCourseByCode(course);
      if (before) existing += 1;
      else created += 1;
    }
    process.stderr.write(`Learning catalog seed complete: ${created} created, ${existing} already present.\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    process.stderr.write(`Learning catalog seed failed: ${message}\n`);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

void run();
