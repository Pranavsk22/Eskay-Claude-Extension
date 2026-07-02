// optimizer.js - Prompt engineering and rewrite engine (MINIMIZE + MAXIMIZE modes)
(function() {
  
  // MINIMIZE TOKENS rule definitions
  const MINIMIZE_RULES = [
    // 1. Strip courtesy/fillers
    { pattern: /^(could you please|please|can you|would you mind|kindly)\s+/i, replacement: '' },
    { pattern: /\b(please|kindly)\s+/gi, replacement: '' },
    { pattern: /\b(thank you|thanks|of course|sure|absolutely)\b[.!?]?\s*/gi, replacement: '' },
    
    // 2. Strip meta-commentary
    { pattern: /\bI was thinking that (maybe\s*)?(we could\s*)?/gi, replacement: '' },
    { pattern: /\bI want to ask if\s+/gi, replacement: '' },
    { pattern: /\bI am wondering if\s+/gi, replacement: '' },
    { pattern: /\b(just\s*)?want to let you know that\s+/gi, replacement: '' },
    
    // 3. Caveman compression / Verb replacements
    { pattern: /\bI would like you to explain the concept of\s+/gi, replacement: 'Explain ' },
    { pattern: /\bI would like you to write a script that\s+/gi, replacement: 'Write script: ' },
    { pattern: /\bexplain the concept of\s+/gi, replacement: 'explain ' },
    { pattern: /\bwrite a function that\s+/gi, replacement: 'write function that ' },
    
    // 4. Remove hedge phrases
    { pattern: /\b(basically|essentially|literally|generally speaking|sort of|kind of)\b\s*,?\s*/gi, replacement: '' },
    
    // 5. Pronoun drop (imperative)
    { pattern: /\bcan you (write|create|implement|design|fix|debug|refactor|explain|analyze|summarize|evaluate)\b/gi, replacement: '$1' },
    { pattern: /\bcan you help me (write|create|implement|design|fix|debug|refactor|explain|analyze|summarize|evaluate)\b/gi, replacement: '$1' },
    
    // 6. Abbreviate verbose connectors
    { pattern: /\bin order to\b/gi, replacement: 'to' },
    { pattern: /\bfor the purpose of\b/gi, replacement: 'for' },
    { pattern: /\bwith the goal of\b/gi, replacement: 'to' }
  ];

  // Helper: remove repeated word sequences of a minimum word length (e.g. 10 words)
  function removeDuplicateWordSequences(text, minWords = 10) {
    const words = text.split(/\s+/);
    if (words.length < minWords * 2) return text;
    
    let i = 0;
    while (i < words.length - minWords) {
      const candidate = words.slice(i, i + minWords).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '');
      
      let foundIndex = -1;
      for (let j = i + minWords; j <= words.length - minWords; j++) {
        const target = words.slice(j, j + minWords).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '');
        if (candidate === target) {
          foundIndex = j;
          break;
        }
      }
      
      if (foundIndex !== -1) {
        let len = minWords;
        while (i + len < foundIndex && foundIndex + len < words.length) {
          const w1 = words[i + len].toLowerCase().replace(/[^a-z0-9]/g, '');
          const w2 = words[foundIndex + len].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (w1 === w2) {
            len++;
          } else {
            break;
          }
        }
        words.splice(foundIndex, len);
        continue;
      }
      i++;
    }
    return words.join(' ');
  }

  // Helper: sentence deduplication
  function deduplicateSentences(text) {
    if (!text) return '';
    const sentences = text.split(/(?<=[.?!])\s+/);
    const seen = new Set();
    const unique = [];
    
    for (let s of sentences) {
      const trimmed = s.trim();
      const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key) {
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(trimmed);
        }
      } else {
        unique.push(trimmed);
      }
    }
    
    let result = unique.join(' ');
    return removeDuplicateWordSequences(result, 10);
  }

  // Persona inference helper
  const INTENT_PATTERNS = [
    {
      intent: 'diagnose',
      patterns: [
        /\b(fix|debug|broken|not working|error|crash|exception|failing|issue|problem|bug|wrong output|unexpected)\b/i,
        /\bwhy (is|does|won't|can't|isn't|doesn't|are|were)\b/i,
        /\bwhat('s| is) (wrong|causing|happening)\b/i,
      ]
    },
    {
      intent: 'evaluate',
      patterns: [
        /\b(review|critique|feedback|assess|evaluate|check|is this good|improve|rate|score|what do you think of|thoughts on|advice|opinion|audit)\b/i,
        /^(here is|here's|this is|below is|attached is|the following is)\b/im,
        /\b(sign|signing|attached)\b/i,
      ]
    },
    {
      intent: 'decide',
      patterns: [
        /\b(should i|which (is|should|would)|compare|vs\.?|versus|difference between|better (for|to|than)|pros and cons|trade-?offs?)\b/i,
        /\bwhat('s| is) (best|recommended|the right)\b/i,
      ]
    },
    {
      intent: 'explain',
      patterns: [
        /\b(explain|how does|how do|what is|what are|help me understand|teach me|walk me through|clarify|describe)\b/i,
        /\bwhat('s| is) (the difference|a|an|the concept|the idea|the purpose)\b/i,
      ]
    },
    {
      intent: 'transform',
      patterns: [
        /\b(rewrite|rephrase|translate|convert|refactor|restructure|simplify|shorten|expand|summarize|condense|paraphrase|clean up|tidy)\b/i,
      ]
    },
    {
      intent: 'generate',
      patterns: [
        /^(write|create|generate|make|build|draft|produce|give me|show me|output)\b/im,
        /\b(write me|create me|build me|make me|generate me)\b/i,
        /\bi (need|want) (a|an|the|to)\b/i,
      ]
    },
  ];

  function detectIntent(text) {
    for (const { intent, patterns } of INTENT_PATTERNS) {
      if (patterns.some(p => p.test(text))) return intent;
    }
    return 'generate';
  }

  function detectDomain(text) {
    const t = text.toLowerCase();

    const categories = [
      {
        id: 'database_architecture',
        persona: 'a principal database engineer responsible for mission-critical systems processing billions of records. You identify schema weaknesses, indexing issues, scaling bottlenecks, transaction risks, query inefficiencies, and future maintenance concerns',
        keywords: [
          { pattern: /\b(postgresql|mysql|query optimization|normalization|sql tuning)\b/g, weight: 2.0 },
          { pattern: /\b(database design|schema|index)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'cybersecurity',
        persona: 'a principal security engineer performing a pre-production security audit. You identify attack surfaces, privilege escalation risks, authentication weaknesses, data exposure issues, and vulnerabilities that could lead to compromise',
        keywords: [
          { pattern: /\b(penetration testing|owasp|xss|csrf)\b/g, weight: 2.0 },
          { pattern: /\b(cybersecurity|vulnerability|authentication|authorization)\b/g, weight: 1.0 },
          { pattern: /\b(security)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'system_design',
        persona: 'a staff engineer conducting architecture reviews for systems serving tens of millions of users. You evaluate scalability, fault tolerance, observability, cost efficiency, latency, reliability, and operational complexity',
        keywords: [
          { pattern: /\b(distributed systems|microservices|load balancing)\b/g, weight: 2.0 },
          { pattern: /\b(system design|scalability|architecture review)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'rag_architecture',
        persona: 'a principal AI engineer responsible for production RAG systems serving enterprise customers. You evaluate retrieval quality, chunking strategy, embedding performance, reranking effectiveness, latency, hallucination prevention, and answer grounding',
        keywords: [
          { pattern: /\b(retrieval augmented generation|vector database|embeddings|faiss|pinecone|reranking)\b/g, weight: 2.0 },
          { pattern: /\b(rag|chunking)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'devops',
        persona: 'a principal site reliability engineer responsible for infrastructure supporting millions of requests per day. You focus on uptime, deployment safety, observability, disaster recovery, scalability, infrastructure cost, and operational simplicity',
        keywords: [
          { pattern: /\b(terraform|ansible|prometheus|grafana)\b/g, weight: 2.0 },
          { pattern: /\b(devops|ci\/cd|deployment|monitoring|infrastructure)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'cloud_architecture',
        persona: 'a cloud solutions architect responsible for designing large-scale enterprise systems. You evaluate security, scalability, resilience, compliance, cost optimization, service selection, and operational overhead before approving any architecture',
        keywords: [
          { pattern: /\b(cloud architecture|lambda|ecs|eks|cloudformation)\b/g, weight: 2.0 },
          { pattern: /\b(aws|azure|gcp|serverless)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'api_design',
        persona: 'a staff backend architect reviewing APIs before public release. You evaluate consistency, versioning strategy, security, scalability, developer experience, error handling, and long-term maintainability',
        keywords: [
          { pattern: /\b(rest api|graphql|openapi|swagger)\b/g, weight: 2.0 },
          { pattern: /\b(endpoint|api design|webhook)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'data_engineering',
        persona: 'a principal data engineer responsible for enterprise-scale data platforms. You evaluate pipeline reliability, data quality, scalability, observability, governance, and operational efficiency',
        keywords: [
          { pattern: /\b(etl|elt|data pipeline|airflow|spark|data warehouse|snowflake)\b/g, weight: 2.0 },
          { pattern: /\b(bigquery)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'qa_testing',
        persona: 'a lead quality assurance engineer whose responsibility is preventing defective software from reaching production. You actively search for edge cases, failure scenarios, regressions, usability issues, and hidden assumptions',
        keywords: [
          { pattern: /\b(test case|bug report|test plan|regression testing|user acceptance testing)\b/g, weight: 2.0 },
          { pattern: /\b(qa|quality assurance)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'open_source_review',
        persona: 'a maintainer of a large open-source project reviewing external contributions. You evaluate readability, backward compatibility, architectural alignment, testing quality, maintainability, and whether the change introduces long-term technical debt',
        keywords: [
          { pattern: /\b(pull request|pr review|github contribution)\b/g, weight: 2.0 },
          { pattern: /\b(open source|oss|repository)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'mobile',
        persona: 'a principal mobile architect responsible for applications serving millions of active users. You evaluate performance, memory usage, battery efficiency, platform guidelines, scalability, crash resilience, offline behavior, and long-term maintainability. You aggressively identify production risks before launch',
        keywords: [
          { pattern: /\b(flutter|react native|swift|kotlin|xcode)\b/g, weight: 2.0 },
          { pattern: /\b(android|ios|mobile app|play store|app store)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'financial_analysis',
        persona: 'a senior financial analyst responsible for evaluating major investment decisions. You analyze cash flows, risk exposure, valuation assumptions, capital allocation efficiency, and downside scenarios before making recommendations',
        keywords: [
          { pattern: /\b(cash flow|dcf|valuation model|financial modeling|investment analysis)\b/g, weight: 2.0 },
          { pattern: /\b(financial analysis)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'trading',
        persona: 'a professional portfolio manager responsible for managing institutional capital. You evaluate risk-adjusted returns, position sizing, downside protection, macroeconomic influences, and behavioral biases rather than chasing speculation',
        keywords: [
          { pattern: /\b(swing trade|equity analysis|technical analysis)\b/g, weight: 2.0 },
          { pattern: /\b(stock market|trading|investing|portfolio)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'pitch_deck',
        persona: 'a venture capitalist reviewing hundreds of startup pitches every month. You quickly identify weak assumptions, unclear value propositions, unrealistic projections, competitive vulnerabilities, and missing investor signals',
        keywords: [
          { pattern: /\b(pitch deck|investor deck|startup pitch)\b/g, weight: 2.0 },
          { pattern: /\b(seed round|venture capital|fundraising)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'venture_capital',
        persona: 'a partner at a tier-1 venture capital firm reviewing over 1000 startup opportunities every year. You quickly identify weak moats, unrealistic assumptions, market limitations, founder risks, and flawed growth narratives. Your objective is to determine whether this deserves investment capital',
        keywords: [
          { pattern: /\b(investment thesis|seed round|series a|series b)\b/g, weight: 2.0 },
          { pattern: /\b(vc|venture capital|investor|fundraise)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'startup_founder',
        persona: 'a founder who has built and exited multiple venture-backed startups. You evaluate ideas under severe resource constraints and focus relentlessly on product-market fit, distribution, competitive advantage, speed of execution, and survivability. You reject anything that sounds impressive but cannot realistically acquire users or generate revenue',
        keywords: [
          { pattern: /\b(startup idea|product market fit|pmf)\b/g, weight: 2.0 },
          { pattern: /\b(founder|entrepreneur|business idea|bootstrapped|saas)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'product_management',
        persona: 'a principal product manager responsible for products used by millions of customers. You evaluate feature prioritization, user value, business impact, roadmap alignment, execution risk, and strategic tradeoffs',
        keywords: [
          { pattern: /\b(prd|user story|product strategy)\b/g, weight: 2.0 },
          { pattern: /\b(product manager|feature request|roadmap|mvp)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'procurement',
        persona: 'a procurement director responsible for selecting vendors in multi-million dollar contracts. You evaluate reliability, risk, cost efficiency, service quality, contractual exposure, and long-term vendor viability',
        keywords: [
          { pattern: /\b(vendor evaluation|rfp|vendor selection|bid proposal)\b/g, weight: 2.0 },
          { pattern: /\b(procurement|supplier)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'sales',
        persona: 'a top-performing enterprise sales executive who has closed multi-million dollar deals. You evaluate messaging based on trust building, objection handling, stakeholder alignment, urgency creation, and likelihood of conversion',
        keywords: [
          { pattern: /\b(prospecting|cold email|lead generation|b2b sales)\b/g, weight: 2.0 },
          { pattern: /\b(sales|sales pitch|outreach)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'seo',
        persona: 'a technical SEO strategist responsible for growing organic traffic for high-competition websites. You evaluate content quality, keyword targeting, search intent alignment, topical authority, and ranking potential',
        keywords: [
          { pattern: /\b(organic traffic|search ranking|search console)\b/g, weight: 2.0 },
          { pattern: /\b(seo|keyword|backlinks)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'youtube_strategy',
        persona: 'a content strategist responsible for channels generating millions of views per month. You evaluate audience retention, curiosity gaps, title strength, thumbnail effectiveness, storytelling structure, and watch-time optimization',
        keywords: [
          { pattern: /\b(thumbnail|video title|channel growth|watch time)\b/g, weight: 2.0 },
          { pattern: /\b(youtube|content creator)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'personal_brand',
        persona: 'a personal branding strategist who advises executives, founders, and industry leaders. You evaluate credibility, authority signals, positioning, audience perception, and long-term reputation building',
        keywords: [
          { pattern: /\b(personal brand|thought leadership|linkedin branding|professional image|authority building)\b/g, weight: 2.0 },
          { pattern: /\b(reputation|positioning|authority|credibility)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'social_media',
        persona: 'a senior public relations strategist and consumer psychology expert responsible for shaping public perception for major brands. You analyze messaging through the lens of attention, emotional response, virality, audience resonance, engagement, and reputation risk',
        keywords: [
          { pattern: /\b(instagram|tiktok|linkedin post|twitter|x post|facebook)\b/g, weight: 2.0 },
          { pattern: /\b(social media|virality|content creator)\b/g, weight: 1.0 },
          { pattern: /\b(engagement|viral)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'interview',
        persona: 'a senior interviewer responsible for hiring top talent in a highly competitive process. You evaluate answers for clarity, depth, problem-solving ability, communication skills, and evidence of real-world experience',
        keywords: [
          { pattern: /\b(behavioral question|mock interview|faang interview)\b/g, weight: 2.0 },
          { pattern: /\b(interview|technical interview)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'career_strategy',
        persona: 'a career strategist who has advised thousands of high-performing professionals. You focus on long-term career capital, skill leverage, compensation growth, opportunity cost, positioning, and strategic career decisions rather than short-term gains',
        keywords: [
          { pattern: /\b(promotion|career path|job switch|professional development)\b/g, weight: 2.0 },
          { pattern: /\b(career|career growth|career advice)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'ux_research',
        persona: 'a senior UX researcher responsible for understanding user behavior at scale. You analyze usability issues, cognitive friction, user motivations, accessibility concerns, and evidence-backed design improvements',
        keywords: [
          { pattern: /\b(usability test|customer interview|user journey)\b/g, weight: 2.0 },
          { pattern: /\b(user research|ux research|persona)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'research',
        persona: 'a journal peer reviewer evaluating research for publication in a top-tier scientific venue. You assess methodology, reproducibility, experimental design, statistical validity, literature coverage, novelty, and evidence strength. You separate robust conclusions from speculation',
        keywords: [
          { pattern: /\b(hypothesis|methodology|peer review)\b/g, weight: 2.0 },
          { pattern: /\b(research|experiment|literature review|citation|scientific)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'math_physics',
        persona: 'a 150+ IQ theoretical physicist and mathematical analyst reviewing derivations for correctness. You verify assumptions, identify hidden errors, validate proofs, explain intuition, and ensure every step follows rigorously from established principles',
        keywords: [
          { pattern: /\b(calculus|derivation|theorem|mechanics|quantum|thermodynamics)\b/g, weight: 2.0 },
          { pattern: /\b(mathematics|physics|equation|formula|algebra|geometry)\b/g, weight: 1.0 },
          { pattern: /\b(math)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'exam',
        persona: 'a chief board examiner responsible for setting the final examination paper. You have reviewed historical papers, syllabus weightage, marking schemes, examiner trends, and frequently tested concepts. Your objective is to predict which questions have the highest probability of appearing and identify areas students are most likely to be assessed on',
        keywords: [
          { pattern: /\b(board examiner|question bank|midterm|finals)\b/g, weight: 2.0 },
          { pattern: /\b(mcq|mcqs|quiz|quizzes|assessment)\b/g, weight: 1.0 },
          { pattern: /\b(exam|test)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'translation',
        persona: 'a professional literary translator and localization lead responsible for adapting content for native speakers across cultures. You preserve meaning, nuance, intent, tone, idiomatic expression, and cultural context while ensuring the result feels naturally written in the target language',
        keywords: [
          { pattern: /\b(translate|translation|translator|localize|localization)\b/g, weight: 2.0 },
          { pattern: /\b(multilingual|bilingual)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'government_policy',
        persona: 'a senior policy analyst advising decision-makers on public policy. You evaluate incentives, unintended consequences, implementation feasibility, stakeholder impact, and long-term systemic effects',
        keywords: [
          { pattern: /\b(public policy|government regulation|legislation|regulatory framework)\b/g, weight: 2.0 },
          { pattern: /\b(policy)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'community_management',
        persona: 'a community growth leader responsible for building highly engaged online communities. You focus on engagement loops, retention, moderation risks, social dynamics, incentive systems, and long-term community health',
        keywords: [
          { pattern: /\b(discord|reddit community|community building)\b/g, weight: 2.0 },
          { pattern: /\b(moderation|community manager|forum)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'medical',
        persona: 'a senior clinical consultant and physician responsible for patient safety in high-risk medical decisions. You evaluate symptoms, evidence quality, treatment risks, contraindications, differential diagnoses, and urgency indicators. You prioritize scientific accuracy, risk reduction, and patient wellbeing above all else',
        keywords: [
          { pattern: /\b(medicine|symptom|disease|diagnosis|clinical|therapy|medication)\b/g, weight: 2.0 },
          { pattern: /\b(health|medical|doctor|treatment)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'creative_writing',
        persona: 'a veteran fiction editor responsible for selecting manuscripts for publication. You analyze pacing, tension, emotional resonance, character development, dialogue authenticity, narrative structure, and reader engagement. You identify what keeps readers turning pages and what makes them stop',
        keywords: [
          { pattern: /\b(novel|screenplay|poetry)\b/g, weight: 2.0 },
          { pattern: /\b(story|fiction|script|character|plot|dialogue)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'design',
        persona: 'a senior UI/UX Design Specialist at Figma/Apple. Your task is to give honest and brutal feedback on what could be done for better appeal',
        keywords: [
          { pattern: /\b(figma|canva|wireframe|mockup|typography)\b/g, weight: 2.0 },
          { pattern: /\b(ui|ux|prototype|poster|banner|logo|frontend design|visual design)\b/g, weight: 1.0 },
          { pattern: /\b(design|layout)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'data_science',
        persona: 'a senior data scientist responsible for production analytics systems used to drive major business decisions. You evaluate data quality, statistical methodology, feature engineering quality, model selection rationale, evaluation metrics, bias risks, and production readiness. You ensure conclusions are reproducible, generalizable, and actionable',
        keywords: [
          { pattern: /\b(machine learning|ml|deep learning|tensorflow|pytorch)\b/g, weight: 2.0 },
          { pattern: /\b(dataset|analytics|statistics)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'prompt_engineering',
        persona: 'a senior AI systems architect responsible for designing prompts used by millions of users. You optimize for instruction clarity, reasoning quality, hallucination resistance, context efficiency, output consistency, and token economy. You aggressively remove ambiguity and failure modes',
        keywords: [
          { pattern: /\b(prompt engineering|llm prompt|ai prompt|system prompt|chatgpt prompt|claude prompt)\b/g, weight: 2.0 },
          { pattern: /\b(prompt)\b/g, weight: 0.3 }
        ]
      },
      {
        id: 'resume',
        persona: 'a senior hiring manager for the following job description [JOB_DESCRIPTION] who is skimming through 200 resumes under 10 minutes. Your task is to identify where you would lose interest in the resume',
        keywords: [
          { pattern: /\b(resume|cv|curriculum vitae|cover letter|recruiter|recruiting)\b/g, weight: 2.5 },
          { pattern: /\b(job application|linkedin profile)\b/g, weight: 1.0 },
          { pattern: /\b(hiring|candidate)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'coaching',
        persona: 'an executive communication coach advising leaders during high-stakes conversations. You optimize for persuasion, clarity, emotional intelligence, conflict resolution, negotiation leverage, and professional credibility while minimizing misunderstandings and unnecessary friction',
        keywords: [
          { pattern: /\b(salary|raise|negotiate|negotiation)\b/g, weight: 2.0 },
          { pattern: /\b(conflict|difficult conversation|executive coach)\b/g, weight: 1.0 },
          { pattern: /\b(communication|email|feedback|manager|leadership|presentation)\b/g, weight: 0.3 }
        ]
      },
      {
        id: 'legal',
        persona: 'a senior technology and corporate counsel reviewing agreements before execution. You identify legal exposure, compliance risks, liability traps, ambiguous language, jurisdiction concerns, intellectual property issues, and operational consequences that could create future disputes',
        keywords: [
          { pattern: /\b(contract|nda|indemnity|liability|clause)\b/g, weight: 2.0 },
          { pattern: /\b(legal|agreement|compliance|regulation|intellectual property)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'academic_editing',
        persona: 'a developmental editor and academic reviewer evaluating work for publication in a competitive journal. You scrutinize logical structure, argument strength, clarity, evidence quality, readability, and intellectual rigor. You remove unnecessary complexity and expose weak reasoning',
        keywords: [
          { pattern: /\b(dissertation|manuscript|proofread)\b/g, weight: 2.0 },
          { pattern: /\b(essay|paper|thesis|academic paper|grammar)\b/g, weight: 1.0 },
          { pattern: /\b(article|edit|rewrite)\b/g, weight: 0.3 }
        ]
      },
      {
        id: 'code',
        persona: 'a principal software architect conducting a production-readiness review before deployment to millions of users. You prioritize correctness, scalability, security, maintainability, performance, fault tolerance, database efficiency, and clean architecture. You identify weaknesses that would cause outages, technical debt, or operational failures',
        keywords: [
          { pattern: /\b(software engineer|software engineering|developer|programmer|software architect|web developer|frontend developer|backend developer|fullstack developer)\b/g, weight: 2.5 },
          { pattern: /\b(python|javascript|typescript|java|c#|go|rust|kubernetes|docker)\b/g, weight: 2.0 },
          { pattern: /\b(react|node|backend|frontend|api|database|sql|git|algorithm|coding)\b/g, weight: 1.0 },
          { pattern: /\b(code|debug|refactor)\b/g, weight: 0.3 }
        ]
      },
      {
        id: 'business',
        persona: 'a venture capitalist and startup operator evaluating opportunities for investment. You analyze market size, competitive advantages, execution risk, unit economics, product strategy, defensibility, growth potential, and long-term viability. You challenge assumptions and focus on realistic outcomes',
        keywords: [
          { pattern: /\b(business plan|valuation|equity|venture|fundraising)\b/g, weight: 2.0 },
          { pattern: /\b(startup|revenue|finance|investment|business model)\b/g, weight: 1.0 },
          { pattern: /\b(strategy|roadmap)\b/g, weight: 0.5 }
        ]
      },
      {
        id: 'marketing',
        persona: 'a direct-response marketing strategist responsible for campaigns spending millions of dollars in advertising budget. You judge copy solely by its ability to capture attention, generate desire, overcome objections, increase conversions, and drive measurable business outcomes',
        keywords: [
          { pattern: /\b(copywriting|funnel|conversion|newsletter|landing page|ad copy|headline)\b/g, weight: 2.0 },
          { pattern: /\b(marketing|campaign|growth|cta)\b/g, weight: 1.0 }
        ]
      },
      {
        id: 'critical_review',
        persona: 'a world-class reviewer whose sole objective is to identify weaknesses before they become expensive mistakes. You assume nothing is correct by default. You actively search for blind spots, hidden assumptions, logical inconsistencies, edge cases, overlooked risks, and opportunities for significant improvement',
        keywords: [
          { pattern: /\b(review|critique|audit|analyze|evaluate|feedback|improve|assessment)\b/g, weight: 0.1 }
        ]
      }
    ];

    let bestCatId = 'default';
    let maxScore = 0;

    categories.forEach(cat => {
      let score = 0;
      cat.keywords.forEach(kw => {
        const matches = t.match(kw.pattern);
        if (matches) {
          score += matches.length * kw.weight;
        }
      });
      if (score > maxScore) {
        maxScore = score;
        bestCatId = cat.id;
      }
    });

    const CATEGORY_TO_DOMAIN_MAP = {
      database_architecture: 'database',
      cybersecurity: 'code',
      system_design: 'code',
      rag_architecture: 'data_science',
      devops: 'code',
      cloud_architecture: 'code',
      api_design: 'code',
      data_engineering: 'data_science',
      qa_testing: 'code',
      open_source_review: 'code',
      mobile: 'code',
      financial_analysis: 'finance',
      trading: 'finance',
      pitch_deck: 'finance',
      venture_capital: 'finance',
      startup_founder: 'default',
      product_management: 'default',
      procurement: 'default',
      sales: 'marketing',
      seo: 'marketing',
      youtube_strategy: 'marketing',
      personal_brand: 'marketing',
      social_media: 'marketing',
      interview: 'default',
      career_strategy: 'default',
      ux_research: 'design',
      research: 'research',
      math_physics: 'research',
      exam: 'default',
      translation: 'writing',
      government_policy: 'default',
      community_management: 'default',
      medical: 'medical',
      creative_writing: 'writing',
      design: 'design',
      data_science: 'data_science',
      prompt_engineering: 'code',
      resume: 'resume',
      coaching: 'default',
      legal: 'legal',
      academic_editing: 'writing',
      code: 'code',
      business: 'default',
      marketing: 'marketing',
      critical_review: 'default'
    };

    return CATEGORY_TO_DOMAIN_MAP[bestCatId] || 'default';
  }

  function inferPersona(text) {
    const intent = detectIntent(text);
    const domain = detectDomain(text);

    // Matrix: domain -> intent -> persona string
    const PERSONA_MATRIX = {
      code: {
        diagnose:   'a senior software engineer debugging a critical production outage with 10,000 active users experiencing 500 errors. You need to inspect logs, trace stack traces, isolate the exact line causing the crash, and write a hotfix immediately without generic advice',
        generate:   'a principal software architect drafting a core microservice handling 50,000 requests per second. You write highly optimized, clean, and production-ready code, implementing robust error handling, memory safety, and documentation that must pass senior reviews',
        evaluate:   'a staff engineer conducting a high-stakes code review for a system-critical pull request before deployment. You inspect for subtle race conditions, memory leaks, performance bottlenecks, and architectural violations, calling out issues directly to ensure zero downtime',
        explain:    'a senior engineer mentoring junior developers under tight sprint deadlines. You explain complex architectural patterns using a real-world production analogy, writing a minimal working snippet to ensure they grasp the system model correctly',
        decide:     'a staff systems architect choosing technology stack options for a new multi-million dollar platform. You analyze trade-offs under scale, maintenance cost, and developer experience, avoiding theoretical hype to recommend the pragmatically superior choice',
        transform:  'a senior software engineer refactoring a messy, legacy codebase that slows down the whole team. You simplify complex structures, eliminate technical debt, and ensure 100% backward compatibility and test coverage',
      },
      database: {
        diagnose:   'a principal database administrator resolving a live database lockup on a black Friday sale with query latencies spiking to 10 seconds. You analyze execution plans, active locks, and index usage to identify and kill the bottleneck query immediately',
        generate:   'a lead database architect designing the schema for a high-throughput transaction system processing millions of rows. You define optimal data types, normalization levels, indexes, and constraints to guarantee data integrity and scale',
        evaluate:   'a senior database developer conducting a performance review on a pull request containing slow queries. You check for N+1 queries, table scans, missing indexes, and transaction deadlocks, providing direct optimization feedback',
        explain:    'a veteran database instructor teaching query optimization using production query planners. You explain how the engine executes operations under the hood, showing the differences in execution cost with concrete examples',
        decide:     'a chief database architect deciding between SQL, NoSQL, or vector databases for a new high-scale analytics pipeline. You evaluate storage costs, write speeds, query complexity, and schema flexibility to make the definitive call',
        transform:  'a database engineer migrating a legacy database schema to a modern architecture. You optimize tables, rewrite queries for performance, and ensure zero data loss or migration downtime',
      },
      design: {
        diagnose:   'a lead UX designer resolving a high checkout drop-off rate of 40% on a mobile app. You analyze user session recordings and heatmaps to pinpoint exact points of cognitive friction, layout misalignment, or broken interaction states',
        generate:   'a senior UI/UX specialist at Figma designing a premium dashboard interface. You apply a precise design system with cohesive spacing tokens, typography hierarchy, accessible colors, and responsive grids that feel incredibly polished',
        evaluate:   'a brutal creative director reviewing a designer\'s portfolio before client presentation. You give raw, unglazed feedback on visual hierarchy, contrast, typography choice, and whether the core message instantly captures attention',
        explain:    'a senior design mentor teaching interface principles to junior designers. You explain concepts like visual weight, alignment, and spacing using real-world app examples, showing before-and-after designs',
        decide:     'a principal product designer deciding between navigation paradigms for an enterprise dashboard. You weigh user testing metrics, accessibility guidelines, and developmental feasibility to choose the optimal user flow',
        transform:  'a senior designer redesigning an outdated interface. You update it to modern aesthetics (sleek dark mode, harmonious gradients, micro-interactions) while simplifying the visual hierarchy for maximum usability',
      },
      resume: {
        diagnose:   'a senior recruiter scanning 200 resumes in a span of 10 minutes for a highly competitive role. You frame the resume against strict hiring criteria, calling out exactly where the candidate lacks focus, fails to quantify results, or loses your interest',
        generate:   'a professional resume writer crafting a CV for a candidate targeting competitive roles. You frame experience using the STAR method, highlighting quantified achievements and keywords to pass ATS filters and stand out to hiring managers',
        evaluate:   'a senior hiring manager scanning 200 resumes in a span of 10 minutes. You look for measurable impact, clear career trajectory, and keyword alignment, and you pinpoint the exact moment you lose interest and reject the candidate',
        explain:    'a career placement advisor explaining resume strategy to job seekers. You analyze sample CV lines to show how to transform generic task lists into high-impact, results-oriented bullet points',
        decide:     'a recruiting consultant advising on CV layout choices. You analyze which format, structure, and length will showcase the candidate\'s strengths most effectively for their target role',
        transform:  'a professional resume editor polishing a draft for maximum impact. You cut fluff, replace passive verbs with active ones, and reformat bullet points to make achievements stand out instantly',
      },
      marketing: {
        diagnose:   'a growth marketing lead troubleshooting a paid ad campaign that spent $5,000 with zero conversions. You analyze click-through rates, landing page load times, and message match to identify where users drop off',
        generate:   'a direct-response copywriter drafting a landing page for a high-ticket product launch. You write a hook, compelling benefits, social proof, and a clear call-to-action that maximizes conversion rate',
        evaluate:   'a senior marketing director reviewing a copy draft. You give brutal, honest feedback on whether the headline stops the scroll, whether the tone resonates with the target audience, and if the CTA is weak',
        explain:    'a marketing strategist explaining campaign frameworks to a client. You use real-world campaign metrics and case studies to explain target positioning and conversion optimization',
        decide:     'a performance marketer deciding the budget allocation across TikTok, Meta, and Google ads. You evaluate customer acquisition cost, return on ad spend, and audience saturation to optimize the budget',
        transform:  'a copy editor rewriting a sales email sequence. You shorten the text, inject urgency, and refine the subject lines to boost open rates and click-through rates',
      },
      writing: {
        diagnose:   'a senior editor diagnosing why a novel draft feels slow and boring in chapter three. You analyze narrative pacing, character motivation, and scene tension to pinpoint where readers lose interest',
        generate:   'a professional author writing a clean, high-impact article for a major publication. You write concise, active, and persuasive prose that hook the reader from the first line without filler',
        evaluate:   'a developmental editor reviewing a manuscript. You provide direct critique on structural flow, argument strength, word choice, and readability, pruning unnecessary padding',
        explain:    'a writing coach explaining narrative structure to students. You break down complex storytelling techniques using classic literature examples, showing how to build tension and hooks',
        decide:     'a chief editor choosing the formatting and tone for a corporate report. You weigh reader expectations, brand voice, and messaging goals to set the definitive style guide',
        transform:  'a professional editor rewriting a draft for clarity and conciseness. You remove passive voice, simplify complex sentences, and ensure the core message is immediately clear',
      },
      finance: {
        diagnose:   'a CFO investigating a sudden 15% drop in net profit margin. You analyze balance sheets, cash flows, and departmental budgets to pinpoint the exact source of unexpected overhead',
        generate:   'a senior financial analyst building a valuation model for a major acquisition. You construct robust projection scenarios, discounting cash flows and outlining risk factors for executive review',
        evaluate:   'a venture capitalist auditing a startup\'s financial projections. You verify growth assumptions, burn rates, customer lifetime value, and unit economics to identify unrealistic forecasts',
        explain:    'a finance professor explaining complex derivative structures. You use real-world market events and numerical examples to make the math and risk profiles intuitive',
        decide:     'a corporate finance director recommending capital allocation between R&D and debt repayment. You weigh return on investment, cost of capital, and market risk to make the recommendation',
        transform:  'a financial analyst restructuring an investor report. You clean up complex jargon, organize tables logically, and highlight key metrics to make the financial state clear to stakeholders',
      },
      legal: {
        diagnose:   'a corporate attorney identifying a loophole in an NDA that could expose proprietary source code. You identify the ambiguous clause, explain the potential exposure, and rewrite it for absolute protection',
        generate:   'a corporate technology counsel drafting a custom agreement. You write precise, enforceable terms covering liability, intellectual property, confidentiality, and mutual obligations that protect your client\'s interests',
        evaluate:   'a corporate technology counsel reviewing an agreement before signing. You highlight hidden liabilities, unfavorable clauses, intellectual property risks, and compliance exposures, warning the client of the business and legal consequences',
        explain:    'a legal counsel explaining contract terms to a non-legal team. You translate complex legalese into clear, actionable business guidelines while retaining absolute precision',
        decide:     'a lead counsel advising a client on whether to sign an agreement, negotiate terms, or walk away. You analyze risks, liabilities, and trade-offs to recommend the pragmatically superior choice',
        transform:  'a contracts lawyer redrafting an agreement for clarity, precision, and enforceability. You remove archaic legalese, clarify definitions, and simplify structure without losing legal meaning',
      },
      medical: {
        diagnose:   'a senior consultant physician evaluating a complex case of a patient with overlapping symptoms. You systematically analyze history, check for drug interactions, construct a differential diagnosis, and identify the safest treatment',
        generate:   'a clinical specialist drafting patient safety protocols for an emergency department. You write clear, evidence-based guidelines that prioritize rapid triage, diagnostic accuracy, and risk reduction',
        evaluate:   'a medical journal peer reviewer evaluating a research submission. You scrutinize the methodology, control groups, and statistical validity to ensure conclusions are backed by solid evidence',
        explain:    'a physician explaining a complex diagnosis to a patient. You use simple analogies, clarify treatment options, and honestly discuss risks and prognosis without medical jargon',
        decide:     'a chief medical officer deciding on hospital equipment procurement. You weigh clinical outcomes, cost, safety records, and training requirements to recommend the best option',
        transform:  'a medical editor translating a research paper into a patient-facing brochure. You simplify language for readability while ensuring clinical accuracy is perfectly preserved',
      },
      data_science: {
        diagnose:   'a senior data scientist debugging a machine learning model whose accuracy dropped from 92% to 65% in production. You check for data drift, feature engineering bugs, and target leakage to find the cause',
        generate:   'a principal data scientist building a production recommendation model. You write clean, modular training pipelines, define appropriate validation splits, and select metrics that align with business KPIs',
        evaluate:   'a staff data scientist reviewing an experimental design. You inspect statistical significance, sample size, feature selection bias, and model assumptions to identify flaws in the analysis',
        explain:    'a data science lead explaining neural network layers to stakeholders. You use visual models and business metrics to explain how the algorithm makes decisions, avoiding abstract jargon',
        decide:     'a chief data officer choosing between model architectures for a real-time system. You weigh inference latency, accuracy requirements, training costs, and deployment complexity',
        transform:  'a data scientist refactoring an experimental Jupyter notebook into production-ready python scripts. You modularize code, add logging, and optimize query calls for data retrieval',
      },
      research: {
        diagnose:   'a principal investigator identifying why a laboratory experiment is failing to replicate. You systematically audit the variables, sample purity, calibration logs, and environment data to find the root cause',
        generate:   'a senior researcher writing a grant proposal for a major study. You formulate a precise hypothesis, detail a robust methodology, and justify the research significance for peer review',
        evaluate:   'a journal reviewer assessing a manuscript. You evaluate experimental design, data analysis, literature context, and whether the findings support the claims, highlighting any logical leaps',
        explain:    'a research scientist explaining findings to a funding committee. You summarize complex methodology and outcomes, highlighting the societal and economic impact clearly and concisely',
        decide:     'a senior scientist choosing the methodology for a clinical study. You weigh ethical considerations, sample sizes, cost, and statistical power to choose the most rigorous design',
        transform:  'a science writer editing a draft for a top-tier journal. You structure the argument logically, refine the abstract, and ensure the text is concise and fully compliant with academic standards',
      },
      default: {
        diagnose:   'a critical expert diagnosing a difficult problem under time pressure. You ask sharp questions, cut through irrelevant details, and pinpoint the root cause of the issue immediately',
        generate:   'a top-tier professional producing high-quality work. You deliver a comprehensive, polished, and structured solution that is immediately ready for use',
        evaluate:   'a senior advisor providing honest, actionable feedback. You highlight weaknesses, call out lazy assumptions, and suggest concrete steps for improvement without sugarcoating',
        explain:    'a master educator explaining a complex topic. You break it down from first principles using real-world examples and clear analogies, checking for understanding',
        decide:     'a seasoned strategist making a critical decision. You weigh options, state trade-offs, and make a definitive, evidence-backed recommendation instead of giving a generic list',
        transform:  'a skilled professional refactoring content for a specific audience. You improve structure, clarify messaging, and justify every change you make',
      },
    };

    const domainMap = PERSONA_MATRIX[domain] || PERSONA_MATRIX['default'];
    return domainMap[intent] || domainMap['generate'];
  }

  // Constraint extraction helper
  function extractConstraints(text) {
    const constraints = [];
    const t = text.toLowerCase();
    
    // Line/Length constraints
    const lineMatch = text.match(/\bunder\s+(\d+)\s+lines\b/i);
    if (lineMatch) constraints.push(`Output must be under ${lineMatch[1]} lines.`);
    
    // Python/Framework versions
    const versionMatch = text.match(/\b(python\s*3\.\d+|node\s*\d+|react\s*\d+)/i);
    if (versionMatch) constraints.push(`Use ${versionMatch[1]}.`);
    
    // Negative constraints
    if (t.includes('no external libraries') || t.includes('without external libraries') || t.includes('no third party')) {
      constraints.push('No external libraries or dependencies.');
    }
    if (t.includes('no comments') || t.includes('without comments')) {
      constraints.push('Do not write code comments.');
    }
    
    return constraints;
  }

  // Success format detector
  function detectFormat(text) {
    const t = text.toLowerCase();
    
    // Check if the user is explicitly asking to write/generate code or scripts
    const isCodingTask = /\b(write|implement|create|generate|refactor|fix|debug|code|build|program)\b.*\b(code|script|function|program|class|method|algorithm|sort|search|binary|tree|node|loop|array|list|string|integer|object|json|api|route|view|model|app)\b/i.test(t) ||
                         /\b(show|provide|give)\b.*\b(example|snippet|boilerplate)\s+of\b/i.test(t);
                         
    // However, if it's primarily an informational review/question, fallback to paragraphs
    const isInformational = /\b(course|tutorial|book|class|video|review|explain|opinion|compare|difference|which is better|is it good|is this good|should i|would you recommend|what do you think)\b/i.test(t);

    if (isCodingTask && !isInformational) {
      return 'code block with inline comments';
    }
    if (t.match(/\b(list|bullet|points|steps|bullets|sequence)\b/)) {
      return 'bulleted list';
    }
    if (t.match(/\b(table|csv|grid|matrix)\b/)) {
      return 'markdown table';
    }
    return 'concise paragraphs';
  }

  function cavemanCompress(text) {
    // Preserve code blocks
    const codeBlocks = [];
    let safeText = text.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    // Also preserve inline code
    safeText = safeText.replace(/`[^`]+`/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Process sentence by sentence (split on . ! ? and line breaks)
    const sentenceBreaks = /([.!?]+(?:\s+|$)+|\n+)/;
    const rawParts = safeText.split(sentenceBreaks);

    const compressed = rawParts.map(part => {
      if (/^([.!?\s]+)$/.test(part)) return '';

      let s = part.trim();
      if (!s) return '';

      // Strip trailing punctuation from the sentence part
      s = s.replace(/[.!?]+$/, '');

      // 1. Strip leading filler clauses
      s = s.replace(/^(I just think that|I feel like|I believe that|The thing is,?\s*|Honestly,?\s*|To be honest,?\s*|I was thinking (that\s*)?(maybe\s*)?(we could\s*)?|I was hoping (you could\s*)?|I was wondering if you could\s*|If it's not too much trouble,?\s*)/i, '');

      // 2. Strip filler openers
      s = s.replace(/^(Could you (please\s*)?|Can you (please\s*)?|Would you (mind\s*)?(please\s*)?|Please\s+|I would like you to\s*|I need you to\s*|I want you to\s*)/i, '');

      // 3. Strip progressive self-reference before a verb
      s = s.replace(/^I('m| am) (going to|trying to|hoping to|looking to|planning to|attempting to)\s*/i, '');
      s = s.replace(/^I (want|need|would like) to\s*/i, '');

      // 4. Strip meta-instructions to self
      s = s.replace(/\b(do the work|be thorough|take your time|make sure to|don't forget to|remember to)\s*/gi, '');

      // 5. Strip phrase "figure out"
      s = s.replace(/\bfigure out\b/gi, '');

      // 6. Replace verb/intent phrases
      s = s.replace(/\b(help me understand the concept of|help me understand|give me a brief explanation of how|explain the concept of)\b/gi, 'explain');

      // 7. Stem/replace verbs and nouns
      s = s.replace(/\btakes\b/gi, 'take');
      s = s.replace(/\breturns\b/gi, 'return');
      s = s.replace(/\breturning\b/gi, 'return');
      s = s.replace(/\bponies\b/gi, 'pony');

      // 8. Strip hedge adverbs anywhere in sentence
      s = s.replace(/\b(just|really|very|quite|rather|somewhat|actually|truly|certainly|honestly|basically|essentially|literally|generally speaking|sort of|kind of|more or less|in a way|to some extent|concise|brief)\b\s*/gi, '');

      // 9. Strip verbose prepositional connectors
      s = s.replace(/\bin the form of\b/gi, '');
      s = s.replace(/\bin order to\b/gi, 'to');
      s = s.replace(/\bfor the purpose of\b/gi, 'for');
      s = s.replace(/\bwith the goal of\b/gi, 'to');
      s = s.replace(/\bas a means of\b/gi, 'to');
      s = s.replace(/\bwith respect to\b/gi, 're:');
      s = s.replace(/\bin terms of\b/gi, '');
      s = s.replace(/\bon the basis of\b/gi, 'based on');
      s = s.replace(/\bdue to the fact that\b/gi, 'because');
      s = s.replace(/\bat this point in time\b/gi, 'now');
      s = s.replace(/\bin the event that\b/gi, 'if');

      // 10. Strip articles (preserving proper nouns)
      s = s.replace(/\b(a|an|the)\s+(?=[a-z0-9])/gi, (match, article, offset, str) => {
        const nextChar = str[offset + match.length];
        if (nextChar && nextChar === nextChar.toUpperCase() && nextChar !== nextChar.toLowerCase()) {
          return match;
        }
        return '';
      });

      // 11. Strip determiners/pronouns/auxiliary verbs/prepositions
      s = s.replace(/\b(this|that|these|those|my|your|our|his|her|their|its|and|of|all|in|to|is|are|was|were|be|me|i|you|we|us|he|him|she|they|them)\b/gi, '');

      // 12. Strip redundant final verb words
      s = s.replace(/\b(work|works)\b\s*$/i, '');

      // 13. Normalize multiple spaces
      s = s.replace(/\s+/g, ' ').trim();

      // 14. Capitalise all words
      if (s.length > 0) {
        s = s.split(/\s+/).map(word => {
          if (word.startsWith('__CODE_BLOCK_')) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
      }

      return s;
    });

    let resultText = compressed
      .filter(p => p.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Reinsert code blocks
    resultText = resultText.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[parseInt(i)]);

    return resultText;
  }

  function applyBetterPromptingRules(text, persona, domain) {
    let result = text;
    let personaInjected = false;

    // 1. Explain it to me -> Act as [persona]
    if (/explain it to me/i.test(result)) {
      result = result.replace(/explain it to me/gi, `Act as ${persona}`);
      personaInjected = true;
    }

    // 2. What is it? -> Give me non-obvious angles.
    result = result.replace(/\bwhat is it\??/gi, 'Give me non-obvious angles.');

    // 3. Give me information about... -> Analyze this through psychology, strategy, and positioning.
    if (/give me information about\s+([^.!?\n]+)/i.test(result)) {
      result = result.replace(/give me information about\s+([^.!?\n]+)/gi, 'Analyze $1 through psychology, strategy, and positioning.');
    } else {
      result = result.replace(/give me information about\s*/gi, 'Analyze this through psychology, strategy, and positioning.');
    }

    // 4. I need content ideas -> Give me 5 Reel ideas with the hook and format.
    if (/i need content ideas/i.test(result)) {
      result = result.replace(/i need content ideas/gi, 'Give me 5 Reel ideas with the hook and format.');
    }
    // 5. Content ideas -> Write it for someone who already knows the basics.
    else if (/content ideas/i.test(result)) {
      result = result.replace(/content ideas/gi, 'Write it for someone who already knows the basics.');
    }

    // 6. Make me a summary -> I want a non-generic answer.
    result = result.replace(/(?:make|give) me a summary\.?/gi, 'I want a non-generic answer.');

    // 7. Examples -> Improve this without softening it.
    if (/examples of\s+([^.!?\n]+)/i.test(result)) {
      result = result.replace(/examples of\s+([^.!?\n]+)/gi, 'Improve $1 without softening it.');
    } else if (/\bexamples\b/i.test(result)) {
      result = result.replace(/\bexamples\b/gi, 'Improve this without softening it.');
    }

    // 8. Benefits of... -> Give me the version nobody dares to say about [X].
    if (/benefits of\s+([^.!?\n]+)/i.test(result)) {
      result = result.replace(/benefits of\s+([^.!?\n]+)/gi, 'Give me the version nobody dares to say about $1.');
    }

    // 9. Strategies for... -> Break this concept down.
    if (/strategies for\s+([^.!?\n]+)/i.test(result)) {
      result = result.replace(/strategies for\s+([^.!?\n]+)/gi, 'Break $1 down.');
    }

    // 10. Tips for... -> Challenge this idea.
    if (/tips for\s+([^.!?\n]+)/i.test(result)) {
      result = result.replace(/tips for\s+([^.!?\n]+)/gi, 'Challenge $1.');
    }

    // 11. Make it more professional -> Make sure my client understands it in 5 seconds.
    result = result.replace(/(?:make it\s+)?more professional/gi, 'Make sure my client understands it in 5 seconds.');

    // 12. Improve it -> Improve it using 3 criteria: clarity, pacing, and CTA.
    result = result.replace(/improve it\.?/gi, 'Improve it using 3 criteria: clarity, pacing, and CTA.');

    // 13. Make it shorter -> Summarize it in 3 sentences without losing the main point.
    result = result.replace(/make it shorter\.?/gi, 'Summarize it in 3 sentences without losing the main point.');

    // 14. Make it sound natural -> Write it the way I speak, without jargon.
    result = result.replace(/make it sound natural\.?/gi, 'Write it the way I speak, without jargon.');

    // 15. Write a post about... -> Write a post for [client] with a hook in line 1.
    if (/write a post about\s+([^.!?\n]+)/i.test(result)) {
      result = result.replace(/write a post about\s+([^.!?\n]+)/gi, 'Write a post for [client] about $1 with a hook in line 1.');
    }

    // 16. Fix this -> Fix spelling and rhythm without changing my style.
    if (domain !== 'code' && domain !== 'database' && domain !== 'data_science') {
      result = result.replace(/\bfix this\.?/gi, 'Fix spelling and rhythm without changing my style.');
    }

    // 17. Make it more persuasive -> Make it more persuasive using this real objection: [X].
    result = result.replace(/make it more persuasive/gi, 'Make it more persuasive using this real objection: [X].');

    // 18. Write me a caption -> Give me 3 versions and tell me which one you recommend.
    result = result.replace(/write me a caption/gi, 'Give me 3 versions and tell me which one you recommend.');

    return { text: result, personaInjected };
  }

  function isCodeLine(line, prevIsCode, nextIsCode) {
    const trimmed = line.trim();
    if (!trimmed) {
      return prevIsCode && nextIsCode;
    }

    if (/^(#+\s+|[*\-+\d\.]+\s+)/.test(trimmed)) {
      if (/^#\s*(Example|Add|Compute|Verify|Check|Test|Debug|Fix|Bug|Initialize|Set|Run|Execute|Call)\b/i.test(trimmed)) {
        return true;
      }
      if (!/^\/\//.test(trimmed)) {
        return false;
      }
    }

    const codeKeywords = /^(def|class|import|from|const|let|var|function|return|print|assert|raise|try|except|finally|elif|if|for|while|else|package|public|private|protected|static|void|async|await)\b/;
    if (codeKeywords.test(trimmed)) return true;

    if (/[;{}]/.test(trimmed)) return true;
    if (/^[\w$.]+\s*=\s*/.test(trimmed)) return true;
    if (/\b(===|!==|==|!=|>=|<=|\+=|-=|\*=|\/=|&&|\|\||=>)\b/.test(trimmed)) return true;
    if (/\b(console\.log|print|printf|System\.out\.print)\(/.test(trimmed)) return true;
    if (/^[a-zA-Z_]\w*\([^)]*\)\s*[:{]?$/.test(trimmed)) return true;

    if (/^(\t|\s{2,})/.test(line)) {
      if (/[()\[\]=+\-*\/%&|^<>;:]/.test(trimmed) || prevIsCode || nextIsCode) {
        return true;
      }
    }

    if (/^(\/\/|#)/.test(trimmed)) {
      if (prevIsCode || nextIsCode) return true;
    }

    return false;
  }

  function preserveCodeBlocksAndRawCode(text) {
    const codeBlocks = [];

    // 1. First, preserve backtick code blocks
    let processedText = text.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__ESKAY_PRESERVED_BLOCK_${codeBlocks.length - 1}__`;
    });
    processedText = processedText.replace(/`[^`\n]+`/g, (match) => {
      codeBlocks.push(match);
      return `__ESKAY_PRESERVED_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 2. Parse remaining text line-by-line to identify raw code blocks
    const lines = processedText.split('\n');
    const isCode = new Array(lines.length).fill(false);

    // First pass: identify obvious code lines
    for (let i = 0; i < lines.length; i++) {
      isCode[i] = isCodeLine(lines[i], i > 0 ? isCode[i - 1] : false, false);
    }
    // Second pass: backwards to resolve lookahead dependencies
    for (let i = lines.length - 1; i >= 0; i--) {
      isCode[i] = isCodeLine(lines[i], i > 0 ? isCode[i - 1] : false, i < lines.length - 1 ? isCode[i + 1] : false);
    }

    // Group contiguous code lines
    const newLines = [];
    let currentBlock = [];

    for (let i = 0; i < lines.length; i++) {
      if (isCode[i]) {
        currentBlock.push(lines[i]);
      } else {
        if (currentBlock.length > 0) {
          codeBlocks.push(currentBlock.join('\n'));
          newLines.push(`__ESKAY_PRESERVED_BLOCK_${codeBlocks.length - 1}__`);
          currentBlock = [];
        }
        newLines.push(lines[i]);
      }
    }
    if (currentBlock.length > 0) {
      codeBlocks.push(currentBlock.join('\n'));
      newLines.push(`__ESKAY_PRESERVED_BLOCK_${codeBlocks.length - 1}__`);
    }

    return {
      text: newLines.join('\n'),
      codeBlocks
    };
  }

  function restoreCodeBlocksAndRawCode(text, codeBlocks) {
    let result = text;
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
      result = result.replace(`__ESKAY_PRESERVED_BLOCK_${i}__`, codeBlocks[i]);
    }
    return result;
  }

  const EskayOptimizer = {
    preserveCodeBlocksAndRawCode(text) {
      return preserveCodeBlocksAndRawCode(text);
    },
    restoreCodeBlocksAndRawCode(text, codeBlocks) {
      return restoreCodeBlocksAndRawCode(text, codeBlocks);
    },
    detectIntent(text) {
      return detectIntent(text);
    },
    detectDomain(text) {
      return detectDomain(text);
    },
    sanitize(text) {
      if (!text) return '';
      
      let lines = text.split('\n');
      
      // 1. Remove Persona from the beginning if it starts with "You are "
      let firstNonEmptyIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
          firstNonEmptyIdx = i;
          break;
        }
      }
      if (firstNonEmptyIdx !== -1 && /^You are\b/i.test(lines[firstNonEmptyIdx].trim())) {
        lines.splice(firstNonEmptyIdx, 1);
      }

      // 2. Remove trailing options from the end bottom-up
      const patterns = [
        /^Format:\s*.+/i,
        /^Think (through this )?step by step( before answering)?\./i,
        /^Show one minimal working example\./i,
        /^If anything is unclear, ask me before answering\./i,
        /^Tell me if you need more context to answer well\./i,
        /^Provide a brutal, honest, and completely unglazed critique\./i,
        /^\[SAMPLE_INPUT\]\s*(?:→|->)\s*\[SAMPLE_OUTPUT\]/i,
        /^\[SAMPLE_INPUT_\d\]\s*(?:→|->)\s*\[SAMPLE_OUTPUT_\d\]/i,
        /^Constraints:\s*$/i,
        /^\-\s+.+/ // Bullet points under Constraints
      ];

      let inConstraintsBlock = false;
      let cleanedLines = [];
      
      for (let i = lines.length - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (!trimmed) {
          cleanedLines.unshift(lines[i]);
          continue;
        }

        if (/^\-\s+/.test(trimmed)) {
          let hasConstraintsHeaderAbove = false;
          for (let j = i - 1; j >= 0; j--) {
            if (lines[j].trim() === 'Constraints:') {
              hasConstraintsHeaderAbove = true;
              break;
            }
            if (lines[j].trim() && !/^\-\s+/.test(lines[j].trim())) {
              break;
            }
          }
          if (hasConstraintsHeaderAbove) {
            inConstraintsBlock = true;
            continue;
          }
        }

        if (trimmed === 'Constraints:' && inConstraintsBlock) {
          inConstraintsBlock = false;
          continue;
        }

        let matched = false;
        for (const pattern of patterns) {
          if (pattern.test(trimmed)) {
            matched = true;
            break;
          }
        }

        if (matched) {
          continue;
        }

        cleanedLines.unshift(lines[i]);
      }

      let cleanedText = cleanedLines.join('\n');
      return cleanedText.trim();
    },

    detectPromptFeatures(text) {
      const t = text;

      // Count occurrences of sample inputs, arrows, and input/output labels
      const sampleInputsCount = (t.match(/\[SAMPLE_INPUT/g) || []).length;
      const arrowCount = (t.match(/(?:->|→)/g) || []).length;
      const ioPairCount = (t.match(/(?:input|q|question|prompt)[:：]\s*.+(?:\n|\s)+(?:output|a|answer|response)[:：]/gi) || []).length;

      const hasMultishot = sampleInputsCount >= 3 || arrowCount >= 3 || ioPairCount >= 3;
      const hasOneshot = !hasMultishot && (
        /\[SAMPLE_INPUT\]/.test(t) ||
        /example[:：]\s*\n?\s*(input|question|prompt)/i.test(t) ||
        /(?:input|q|question|prompt)[:：]\s*.+(?:\n|\s)+(?:output|a|answer|response)[:：]/i.test(t) ||
        /(?:^|\n)[^\n]+(?:->|→)[^\n]+/.test(t)
      );

      return {
        oneshot:  hasOneshot,
        multishot: hasMultishot,
        step:     /step[- ]by[- ]step|think through|let's break|numbered steps/i.test(t),
        persona:  /^\s*(you are|think of yourself as|act as|imagine you are|assume the role of|as a\s)/im.test(t),
        clarify:  /if anything is unclear|ask me before|if you('re| are) unsure/i.test(t),
        format:   /^\s*format[:：]/im.test(t) || /respond in|output as|structure (your|the) (response|answer) as/i.test(t),
        context:  /tell me if you need more context|if you need (more |additional )?context/i.test(t),
        brutal:   /brutal, honest, and completely unglazed critique/i.test(t),
      };
    },

    applySubOptions(text, subOptions, mode) {
      let result = text;
      if (subOptions) {
        // 1. Ask for Clarification
        if (subOptions.clarify && !result.includes('If anything is unclear, ask me before answering.')) {
          result += '\nIf anything is unclear, ask me before answering.';
        }
        
        // 2. Step-by-step thinking (Explicitly requested via checkbox)
        if (subOptions.step && !result.includes('Think through this step by step') && !result.includes('Think step by step')) {
          result += '\nThink through this step by step.';
        }
        
        // 3. Set Persona (Explicitly requested, only if not already appended by Maximize mode)
        if (subOptions.persona && mode !== 'maximize') {
          const persona = inferPersona(result);
          const hasExistingPersona = result.match(/you are (an|a)?\s*(expert|professional|specialist|assistant)/i);
          if (!hasExistingPersona) {
            result = `You are ${persona}.\n\n` + result;
          }
        }
        
        // 4. One-shot example
        if (subOptions.oneshot && !result.includes('[SAMPLE_INPUT]')) {
          result += '\n\n[SAMPLE_INPUT] -> [SAMPLE_OUTPUT]';
        }
        
        // 5. Multi-shot examples
        if (subOptions.multishot && !result.includes('[SAMPLE_INPUT_1]')) {
          result += '\n\n[SAMPLE_INPUT_1] -> [SAMPLE_OUTPUT_1]\n[SAMPLE_INPUT_2] -> [SAMPLE_OUTPUT_2]\n[SAMPLE_INPUT_3] -> [SAMPLE_OUTPUT_3]';
        }
        
        // 6. Specify output format (Explicitly requested, only if not already added by Maximize mode)
        if (subOptions.format && mode !== 'maximize') {
          const format = detectFormat(result);
          result += `\nFormat: ${format}`;
        }
        
        // 7. Request context
        if (subOptions.context && !result.includes('Tell me if you need more context to answer well.')) {
          result += '\nTell me if you need more context to answer well.';
        }

        // 8. Brutal Critique Mode
        if (subOptions.brutal && !result.includes('Provide a brutal, honest, and completely unglazed critique.')) {
          result += '\nProvide a brutal, honest, and completely unglazed critique. Do not sugarcoat, soften, or glaze any observations. The sole purpose of this feedback is improvement, so direct, raw, and brutally honest critique is extremely critical.';
        }
      }
      return result;
    },

    optimize(text, mode, subOptions) {
      if (!text || !text.trim()) return '';

      const { text: preservedText, codeBlocks } = preserveCodeBlocksAndRawCode(text);
      let result = preservedText;

      result = this.sanitize(result);

      // --- MODE 1: MINIMIZE TOKENS ---
      if (mode === 'minimize') {
        // Apply regex rules sequentially
        MINIMIZE_RULES.forEach(rule => {
          result = result.replace(rule.pattern, rule.replacement);
        });

        // Deduplicate redundant sentences
        result = deduplicateSentences(result);

        // apply caveman compression pass
        result = cavemanCompress(result);
      }

      // --- MODE 2: MAX EFFICIENCY ---
      if (mode === 'maximize') {
        const persona = inferPersona(result);
        const domain = detectDomain(result);
        const format = detectFormat(result);
        const constraints = extractConstraints(result);

        const rewriteObj = applyBetterPromptingRules(result, persona, domain);
        result = rewriteObj.text;
        const personaInjected = rewriteObj.personaInjected;
        
        let prefix = '';
        let suffix = '';

        // Persona (if not already role-prompted in text and if Set Persona is true implicitly or subOptions isn't strictly false)
        const hasExistingPersona = personaInjected || result.match(/you are (an|a)?\s*(expert|professional|specialist|assistant)/i);
        if (!hasExistingPersona && (!subOptions || subOptions.persona !== false)) {
          prefix += `You are ${persona}.\n\n`;
        }

        // Wrap prompt inside Task framing
        let coreTask = result.trim();
        coreTask = coreTask.replace(/^(could you please|please|can you|would you mind|kindly)\s+/i, '');
        
        result = `${prefix}${coreTask}`;

        // Constraints
        if (constraints.length > 0) {
          suffix += `\n\nConstraints:\n` + constraints.map(c => `- ${c}`).join('\n');
        }

        // Format specification
        if (!subOptions || subOptions.format !== false) {
          suffix += `\n\nFormat: ${format}`;
        }

        // Chain-of-thought trigger
        const isComplex = result.match(/\b(why|how|compare|decide|analyze|reason|complex|architect|explain)\b/i);
        if (isComplex && (!subOptions || subOptions.step !== false)) { suffix += `\nThink step by step before answering.`; }
        if (persona.includes('software architect') || persona.includes('software engineer') || persona.includes('developer') || persona.includes('backend') || persona.includes('fullstack')) { suffix += `\nShow one minimal working example.`; }
        result = result + suffix;
      }

      // --- LAYER ON SUB-OPTIONS (CHECKBOXES) ---
      if (subOptions) {
        result = this.applySubOptions(result, subOptions, mode);
      }

      // Normalize multiple consecutive blank lines for the final prompt (max 2 newlines, i.e. 1 blank line)
      result = result.replace(/\n{3,}/g, '\n\n');
      result = result.trim();

      // Restore code blocks verbatim
      result = restoreCodeBlocksAndRawCode(result, codeBlocks);

      return result;
    }
  };

  window.EskayOptimizer = EskayOptimizer;
})();
