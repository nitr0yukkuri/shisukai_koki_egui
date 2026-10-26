# Jobhan

Support for turning what you said in an interview or meeting into a useful review for next time.

Jobhan is a Windows desktop app intended to support interview and meeting practice and reflection. Its purpose is not to have AI replace an interviewer by asking questions or evaluating a candidate. Instead, it aims to record and organize the user's own speech so they can review what they communicated and how they spoke. The initial focus is solo practice; post-session reflection with another person is a possible future direction.

A resume or entry sheet (ES) may be provided at the user's choice as context for understanding their experience and career goals. It is intended to make summaries and feedback about the user's speech more specific, not to make AI act as an interviewer.

Jobhan runs as an app separate from Zoom. It does not overlay the Zoom screen or capture or modify Zoom video.

This repository is for a four-person team project for a class.

## Problems we want to address

- Nervousness makes it difficult to speak clearly in interviews.
- It can be hard to start practicing alone.
- Speakers may not notice their fillers, such as “um” and “uh,” or their pace and pauses.
- There may be little material to review after a practice session.
- It can be difficult to reflect on what was said in light of one's own experience and career goals.

Jobhan aims to support practice and, afterward, provide a chance to revisit one's own speech, organize what was communicated, and decide what to try next.

## How it is intended to be used

### Practice alone

Answer question cards or questions prepared by the user. Questions are prompts to get a practice session started; the main focus is recording and organizing the user's speech so the answer and speaking style can be reviewed later. Optional hints may be available.

### Practice with another person

Practice one-on-one using Zoom or a similar tool with a career-center counselor, friend, or other partner. In the initial version, the other person does not need to install Jobhan. The app is intended to process only the practicing user's microphone input; it does not capture or record the other person's audio.

Accordingly, initial session records are centered on the questions and the user's answers or speech. A conversation log containing both participants' speech is a possible future feature, subject to designing consent and data handling with the other participant.

### Gradually reduce practice support

- **Practice mode**: Practice with question cards and hints.
- **Fewer hints**: Use support only when needed.
- **Interview simulation mode**: Limit hints during practice and review the session afterward.

“Interview simulation” here means a practice format. The app is not intended to be used during an actual hiring interview.

## Initial priorities

- Solo interview practice using question cards.
- Transcription of the user's microphone audio, with a way to check and correct recognition results.
- Optional hints when the user gets stuck.
- Local session-log storage, search, editing, and deletion.
- Adjustable hint levels and post-practice reflection.

Speech recognition can mishear or omit words, so users should be able to check and correct transcripts. AI-generated reflections are reference material; they are not intended to determine interview outcomes, suitability, or personality.

## Features under consideration

- Review speaking pace, silent intervals, and possible fillers such as “um” and “uh” after practice. Add this only after validating the calculation method, detection accuracy, and how users can inspect the relevant moments, including audio storage and playback scope.
- Use a resume or ES as context about the user's experience and goals to make summaries and reflections on their speech more specific.
- Organize key points, important keywords, and items to revisit next time.
- Compare an answer with the user's resume or ES and present possible differences as items for the user to check, without treating them as definitive.
- Explain a word selected in a session log and highlight important keywords.
- Manage company-specific checklists, notes, and questions to ask.
- With the other participant's consent, consider recording their speech and collecting their feedback.

AI is intended to organize the user's speech and support their reflection, not replace an interviewer or decide whether they pass. A resume or ES is context for understanding the user's background. The current plan is not to use these documents to train AI models. Summaries, advice, and differences from application documents are reference information; discrepancies should be presented as things the user may want to check, not labeled as lies or contradictions. Before adding AI features, the app should make the content sent, recipient, and storage method clear and let users review what they are about to send.

## Design direction

The interface should make it easy to continue practicing and find the information needed. Cute themes or romance-game-inspired presentation may be offered as optional design choices to make starting practice feel less intimidating. Romance is not the app's main purpose: companies and interview partners are not treated as romantic targets, and affinity scores are not used to represent hiring outcomes.

## Practice logs and privacy

- The initial direction is to handle only the user's microphone audio and not capture the other participant's voice.
- Audio processing and log storage are planned to take place on the user's device. The recognition and storage approaches still require technical evaluation.
- The app must clearly distinguish whether it stores audio or only transcripts, and allow users to delete logs.
- Before sending resumes, ES documents, or answers to an external service for an AI feature, the app should show what will be sent and where.
- When practicing with another person, tell them about the app and its audio handling in advance.

## Provisional technical direction

- **Desktop app**: Build a Windows app with Electron, React, and TypeScript. React provides the user interface (renderer), and Electron runs it as a Windows desktop application.
- **Practice logs**: Start with local SQLite storage; no cloud synchronization is planned for the initial version.
- **Speech recognition**: The current direction is to process audio on the PC. Compare Japanese recognition quality and filler-detection accuracy before choosing an approach.
- **Backend**: A backend is not planned for initial local practice. If an external AI API is added, the plan is to add a Node.js + TypeScript + Express API so API keys are not embedded in the desktop app.
- **Shared types**: Share request and response types between the desktop app and Express API. TypeScript types alone do not validate data at runtime, so add runtime validation at the API boundary.
- **Cloud database**: Neither Cloudflare D1 nor Supabase is selected at this time. Reconsider only if sign-in or cross-device synchronization becomes necessary. If D1 is chosen, evaluate a Workers-based architecture; if Supabase is chosen, evaluate whether its Postgres and Auth features are needed.

AI features using resumes or ES documents are intended to use them as context for understanding the user's speech and making summaries and reflection more specific, not as training data. Decide what is sent externally, to whom, and how consent works before introducing those features.

Older documents and ADRs that assume a Zoom overlay or Supabase do not define the current provisional direction.

## Documents

- [Glossary](./docs/glossary.md)
- [Technical architecture (includes the older overlay proposal and should be checked against the current direction)](./docs/architecture-electron-node.md)
- [ADRs](./docs/adr/README.md)
- [ADR for Electron, Node.js/TypeScript, and Supabase](./docs/adr/0003-use-electron-node-supabase.md)
- [CodeRabbit workflow](./docs/coderabbit.md)
- [Contributing](./CONTRIBUTING.md)

## Development policy

- Prefer one responsibility per issue.
- Record major design decisions in ADRs.
- Use CodeRabbit as an assistant reviewer.
- Use reproducible CI checks such as tests, lint, and builds as objective quality gates.
- As a four-person team, prioritize clear responsibility boundaries over unnecessary distributed-system complexity.
- Design questions, hints, logs, and reflections to avoid excessive eye movement and interaction during practice.

## Status

A minimal Node.js development setup is available that launches Electron Main / Preload and a React + TypeScript Renderer. Product features such as recording, transcription, saving logs to SQLite, and AI-assisted reflection have not been implemented yet.

## Development commands

Use Node.js 24 and npm. Install dependencies once, then use the npm scripts to launch and verify the project.

    npm ci
    npm run dev
    npm run start
    npm test
    npm run lint
    npm run typecheck
    npm run build
    npm run check

`npm run dev` starts the Vite Renderer and Electron together. `npm run start` builds the Renderer and then launches the desktop app. `npm run build` builds the Renderer but does not create a Windows installer.
