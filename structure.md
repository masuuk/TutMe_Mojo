TutMe/
│
├── src/                              # Bun + Elysia backend (single process, no build step)
│   ├── index.ts                      #   App: routes, auth/sessions, static serving, library search
│   ├── db.ts                         #   bun:sqlite connection, schema, row types
│   ├── seed.ts                       #   Seed content (tracks/lessons) + reference URLs → /app/*, /books/*
│   ├── quizData.ts                   #   Quiz questions keyed by exact lesson title
│   ├── validate.ts                   #   Quiz↔lesson coupling validation (bun run validate)
│   ├── genOffline.ts                 #   Generates public/offline_content.js from seed
│   └── index.test.ts                 #   Unit + HTTP integration tests (31)
│
├── test/
│   └── setup.ts                      #   Preload: points TUTME_DB_PATH at throwaway temp DB
│
├── data/                             #   SQLite files (generated, git-ignored)
│
└── public/                           # Everything the server serves
    │
    ├── index.html                    # 🏠 Landing page (marketing + nav pills + tcards)
    ├── app.html                      # SPA shell (the quiz/XP app)
    ├── app.js                        # SPA logic: hash router, auth, quizzes, Ctrl+K search
    ├── styles.css                    # All styling (pill selectors keyed by data-href)
    ├── offline_content.js            # Generated offline bundle (do not hand-edit)
    │
    ├── app/                          # 📚 Learning Hub (snake_case everywhere)
    │   │
    │   ├── mojo/                     # ── Mojo track (the core v1 tutorial) ──
    │   │   ├── index.html            #   Hub: links 101, book_1/2, advisory, all 15 chapters
    │   │   ├── 101.html              #   Mojo 1.x crash course
    │   │   ├── book_1.html           #   Textbook (Book 1)
    │   │   ├── book_2.html           #   Textbook (Book 2)
    │   │   ├── advisory.html         #   Advisory page (linked from mojo hub)
    │   │   └── chapters/             #   mojo_01_intro … mojo_15_docstrings (prev/next chain)
    │   │
    │   ├── data_science/             # ── Data Science track (ML fully merged in) ──
    │   │   ├── index.html            #   Hub: mini-chips + TOC for all shelves
    │   │   ├── textbooks/            #   ds_textbook_00_cover … 14        (15 pages, chained)
    │   │   ├── ml_textbook/          #   ds_ml_textbook_00_cover … 09    (10 pages, chained)
    │   │   ├── advanced/             #   ds_advanced_00_cover … 17        (18 pages, chained)
    │   │   └── standalone/           #   3 unique pages:
    │   │                             #     ds_tools, linear_regression, numerical_python_to_mojo
    │   │                             #   (the 6 long-form books moved to /books — chips link there)
    │   │
    │   ├── applications/             # ── Application tracks (extensible) ──
    │   │   │                         #   Each field is a hub that links into /books/<field>/*
    │   │   ├── index.html            #   Section hub → field sub-hubs
    │   │   ├── finance/
    │   │   │   └── index.html        #   → /books/finance/*
    │   │   ├── geomatics/
    │   │   │   └── index.html        #   → /books/geomatics/*
    │   │   ├── operations_research/
    │   │   │   └── index.html        #   → /books/operations_research/*
    │   │   └── _template/            #   (suggested) scaffold for future fields
    │   │       └── index.html        #   copy this to add e.g. biology/, logistics/
    │   │
    │   └── praxis/                   # ── Practice drills (standalone pages, no chain) ──
    │       ├── index.html            #   Shelf: links all drills + mini projects
    │       ├── drill_01 … 25         #   Individual drills (reference /books/* for theory)
    │       ├── mini_project_01 … 03
    │       └── praxis.js             #   Quiz interactivity only (check/reset/feedback)
    │
    ├── books/                        # 📖 Canonical reference library (single source of truth)
    │   ├── book_nav.js               #   Injects floating nav bar (#tutme-book-nav) into every book
    │   │
    │   ├── data_science/             #   ML is a sub-topic here, not a separate field
    │   │   ├── data_science.html
    │   │   ├── linear_regression.html
    │   │   ├── time_series_analytics.html
    │   │   ├── decision_aware_ml.html
    │   │   ├── fine_tuning_llms.html
    │   │   └── perceptrons_and_activation_tutorial.html
    │   │
    │   ├── finance/
    │   │   ├── future_value.html
    │   │   ├── npv_amortisation.html
    │   │   └── the_annuity_codex.html
    │   │
    │   ├── geomatics/
    │   │   ├── gnss_surveying.html
    │   │   └── karney_krueger_equations.html
    │   │
    │   └── operations_research/
    │       ├── operations_research.html
    │       └── simplex_algorithm.html   # expanded edition
    │
    └── library/                      # 📔 Flattened chapter library (indexed by search)
        ├── *.html                    #   59 chapters: ds_*, m10_*, mojo_*, tb_* prefixes
        └── assets/                   #   fonts_*.css (Google Fonts snapshots, shared)


        


            ### Conceptual hirarchy



                                     MOJO v1
                           │
             ┌─────────────┼─────────────┐
             │             │             │
          LEARN         APPLY          PRACTISE
             │             │             │
        Mojo Core    Data Science    Exercises
                    Applications
                          │
                   ┌──────┼──────┐
                   │      │      │
                Finance   OR  Geomatics 



            ### becomes 



            MOJO v1 PROGRAMMING
│
├── 1. MOJO CORE
│      ├── Fundamentals
│      ├── Language
│      ├── Memory
│      ├── Types
│      ├── Functions
│      ├── Structs
│      ├── Traits
│      ├── Generics
│      ├── Modules
│      ├── Concurrency
│      └── Testing
│
├── 2. DATA SCIENCE
│      ├── Foundations
│      ├── Statistics
│      ├── Numerical Computing
│      ├── Regression
│      ├── Time Series
│      ├── Advanced Analytics
│      └── Scientific Computing
│
├── 3. APPLICATIONS
│      ├── Geomatics
│      ├── Finance
│      ├── Operations Research
│      └── Future Application Areas
│
└── 4. PRAXIS
       ├── Mojo Fundamentals
       ├── Data Science
       ├── Geomatics
       ├── Finance
       ├── Operations Research
       ├── General Programming
       └── Mini Projects