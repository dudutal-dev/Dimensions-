/**
 * סכמות Zod לחבילת התוכן (SPEC פרק 8, ARD-4).
 * מקור האמת לתוכן: content-source/. הקבצים כאן הם עריכה למסך ולקול — לא תוכן חדש.
 *
 * מוסכמות טקסט:
 * - בטקסט תצוגה (לא segments) מותר סימון קל: **מודגש**, *נטוי*,
 *   ותגית רובד בתוך שורה: {{established}} / {{speculative}} / {{metaphoric}}.
 * - בטקסט של segments אין שום סימון: הוא גם תסריט הקול של שלב ב'.
 */
import { z } from 'zod';

// ---------- יסודות ----------

export const DimSchema = z.enum(['d3', 'd4', 'd5']);
export type Dim = z.infer<typeof DimSchema>;

export const CheckinResultSchema = z.enum(['d3', 'd3-d4', 'd4', 'd4-d5', 'd5']);
export type CheckinResult = z.infer<typeof CheckinResultSchema>;

/** תגיות רובד: מבוסס / ספקולטיבי / מטפורי (מחליפות את סימוני האימוג'י שבמקור). */
export const LayerSchema = z.enum(['established', 'speculative', 'metaphoric']);
export type Layer = z.infer<typeof LayerSchema>;

export const DomainSchema = z.enum([
  'work',
  'money',
  'couple',
  'family',
  'body',
  'time',
  'creation',
  'alone',
]);
export type Domain = z.infer<typeof DomainSchema>;

export const DiagDomainSchema = z.enum([
  'time-pressure',
  'money-material',
  'relationships',
  'identity-meaning',
  'inner-body',
]);
export type DiagDomain = z.infer<typeof DiagDomainSchema>;

export const ChannelIdSchema = z.enum(['body', 'thought', 'emotion', 'language', 'time']);
export type ChannelId = z.infer<typeof ChannelIdSchema>;

const Text = z.string().trim().min(1);
const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'מזהה: אותיות קטנות, ספרות ומקפים');

const DimTripleSchema = z.object({ d3: Text, d4: Text, d5: Text }).strict();
export type DimTriple = z.infer<typeof DimTripleSchema>;

const AxisRowSchema = DimTripleSchema.extend({ axis: Text }).strict();

/** משקלים לניקוד: שלושה מספרים בין 0 ל-1 שסכומם 1. */
export const WeightsSchema = z
  .object({
    d3: z.number().min(0).max(1),
    d4: z.number().min(0).max(1),
    d5: z.number().min(0).max(1),
  })
  .strict()
  .refine((w) => Math.abs(w.d3 + w.d4 + w.d5 - 1) < 1e-6, 'סכום המשקלים חייב להיות 1');
export type Weights = z.infer<typeof WeightsSchema>;

// ---------- מקטעים (segments) ----------

export const BreathPatternSchema = z
  .object({
    inhaleSec: z.number().positive(),
    /** שאיפה קצרה נוספת מעל הראשונה (נשיפה כפולה-ארוכה). */
    topUpSec: z.number().positive().optional(),
    holdInSec: z.number().min(0),
    exhaleSec: z.number().positive(),
    holdOutSec: z.number().min(0),
  })
  .strict();
export type BreathPattern = z.infer<typeof BreathPatternSchema>;

export const SegmentTypeSchema = z.enum(['instruction', 'breath', 'silence', 'prompt', 'bell']);
export type SegmentType = z.infer<typeof SegmentTypeSchema>;

/**
 * מקטע של נגן התרגולים (SPEC 6.6).
 * - instruction / prompt: טקסט מדובר; ב-durationSec כלול זמן הקריאה והשהות שאחריו.
 * - breath: עיגול נשימה לפי breathPattern; ה-text הוא כיתוב מסך בלבד (לא מוקרא).
 * - silence / bell: ללא טקסט.
 */
export const SegmentSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*\.s\d{2}$/, 'מזהה מקטע בצורת owner.s01'),
    type: SegmentTypeSchema,
    text: z.string(),
    durationSec: z.number().int().positive(),
    breathPattern: BreathPatternSchema.optional(),
  })
  .strict()
  .superRefine((seg, ctx) => {
    const spoken = seg.type === 'instruction' || seg.type === 'prompt';
    if (spoken && seg.text.trim().length === 0) {
      ctx.addIssue({ code: 'custom', message: `${seg.id}: מקטע מדובר חייב טקסט` });
    }
    if ((seg.type === 'silence' || seg.type === 'bell') && seg.text.length > 0) {
      ctx.addIssue({ code: 'custom', message: `${seg.id}: מקטע שקט/פעמון ללא טקסט` });
    }
    if (seg.type === 'breath' && !seg.breathPattern) {
      ctx.addIssue({ code: 'custom', message: `${seg.id}: מקטע נשימה חייב breathPattern` });
    }
    if (seg.type !== 'breath' && seg.breathPattern) {
      ctx.addIssue({ code: 'custom', message: `${seg.id}: breathPattern רק במקטע נשימה` });
    }
  });
export type Segment = z.infer<typeof SegmentSchema>;

const SegmentsSchema = z.array(SegmentSchema).min(1);

// ---------- model.json ----------

export const ModelStateSchema = z
  .object({
    dim: DimSchema,
    label: z.enum(['3D', '4D', '5D']),
    title: Text,
    essence: Text,
    /** משפט אחד ל-Onboarding. */
    oneLiner: Text,
    causality: Text,
    aspects: z.array(z.object({ key: Slug, label: Text, text: Text }).strict()).min(3),
    gift: Text,
    traps: z.array(Text).optional(),
    hallmark: Text.optional(),
  })
  .strict();

export const ModelContentSchema = z
  .object({
    framing: z.object({ short: Text, full: Text }).strict(),
    states: z.array(ModelStateSchema).length(3),
    nesting: z.object({ title: Text, text: Text }).strict(),
    summary: z.array(AxisRowSchema).min(1),
    comparison: z.array(AxisRowSchema).min(1),
    parallels: z
      .object({
        rows: z
          .array(
            z
              .object({
                model: Text,
                d3: Text,
                d4: Text,
                d5: Text,
                layer: LayerSchema.optional(),
              })
              .strict(),
          )
          .min(1),
        note: Text,
      })
      .strict(),
  })
  .strict();
export type ModelContent = z.infer<typeof ModelContentSchema>;

// ---------- diagnosis.json ----------

const DiagOptionSchema = z.object({ dim: DimSchema, text: Text }).strict();
const DiagOptionsSchema = z
  .array(DiagOptionSchema)
  .length(3)
  .refine((opts) => new Set(opts.map((o) => o.dim)).size === 3, 'תשובה אחת לכל מצב');

export const DiagQuestionSchema = z
  .object({
    id: z.string().regex(/^q\d{2}$/),
    domain: DiagDomainSchema,
    stem: Text,
    options: DiagOptionsSchema,
    /** גרסת גוף שלישי ל"שאל אדם קרוב". {name} מוחלף בשם המשתמש. */
    thirdPerson: z.object({ stem: Text, options: DiagOptionsSchema }).strict(),
  })
  .strict();

export const DiagnosisContentSchema = z
  .object({
    title: Text,
    instruction: Text,
    domains: z
      .array(
        z
          .object({
            id: DiagDomainSchema,
            label: Text,
            /** תחומי חיים (מתוך 8) שמוצעים כתחום מוקד כשהפער הגדול נמצא כאן. */
            focusDomainCandidates: z.array(DomainSchema).min(1),
          })
          .strict(),
      )
      .length(5),
    questions: z.array(DiagQuestionSchema).length(12),
    askOther: z.object({ intro: Text, shareText: Text, instruction: Text, why: Text }).strict(),
    interpretation: z
      .object({
        dominanceThreshold: z.number().min(0).max(1),
        profiles: z
          .array(
            z
              .object({
                id: z.enum(['d3-dominant', 'd4-dominant', 'd5-dominant']),
                condition: Text,
                title: Text,
                text: Text,
                entryPhase: z.enum(['A', 'B', 'C']),
                entryWeek: z.number().int().min(1).max(12),
              })
              .strict(),
          )
          .length(3),
        gapNote: Text,
        truthNote: Text,
      })
      .strict(),
    schedule: z
      .object({ weeks: z.array(z.number().int().min(0).max(12)), then: Text })
      .strict(),
  })
  .strict();
export type DiagnosisContent = z.infer<typeof DiagnosisContentSchema>;

// ---------- checkin.json ----------

const ChoiceQuestionSchema = z
  .object({
    id: Slug,
    kind: z.literal('choice'),
    prompt: Text,
    options: z.array(z.object({ id: Slug, label: Text, weights: WeightsSchema }).strict()).min(2),
  })
  .strict();

const ScaleQuestionSchema = z
  .object({
    id: Slug,
    kind: z.literal('scale'),
    prompt: Text,
    min: z.number().int(),
    max: z.number().int(),
    minLabel: Text,
    maxLabel: Text,
    /** רצועות ערכים: כל רצועה חלה עד upTo (כולל). */
    bands: z.array(z.object({ upTo: z.number().int(), weights: WeightsSchema }).strict()).min(2),
    /** צ'יפים לרישום בלבד (לא משתתפים בניקוד). */
    chips: z.array(z.object({ id: Slug, label: Text }).strict()).optional(),
  })
  .strict();

const WheelQuestionSchema = z
  .object({
    id: Slug,
    kind: z.literal('wheel'),
    prompt: Text,
    /** שלוש טבעות. השיוך למצב אינו מוצג למשתמש. */
    rings: z
      .array(
        z
          .object({
            ring: DimSchema,
            weights: WeightsSchema,
            words: z.array(z.object({ id: Slug, label: Text }).strict()).min(3),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();

export const CheckinQuestionSchema = z.discriminatedUnion('kind', [
  ChoiceQuestionSchema,
  ScaleQuestionSchema,
  WheelQuestionSchema,
]);
export type CheckinQuestion = z.infer<typeof CheckinQuestionSchema>;

const ScoredChannelSchema = z.enum(['body', 'thought', 'emotion', 'time']);

export const CheckinContentSchema = z
  .object({
    title: Text,
    intro: Text,
    scoring: z
      .object({
        /** ניקוד ערוץ = ממוצע משקלי השאלות שלו; הסכום הכולל משוקלל במכפילים ומנורמל ל-1. */
        aggregation: z.literal('channel-mean'),
        channelMultipliers: z.record(ScoredChannelSchema, z.number().positive()),
        /** אם הפער בין שני המצבים המובילים קטן מהסף — מוצגת תוצאת ביניים. */
        blendThreshold: z.number().min(0).max(1),
      })
      .strict(),
    steps: z
      .array(
        z
          .object({
            id: Slug,
            channel: ScoredChannelSchema,
            title: Text,
            questions: z.array(CheckinQuestionSchema).min(1),
          })
          .strict(),
      )
      .length(5),
    context: z
      .object({ domainPrompt: Text, withWhomPrompt: Text, withWhomSuggestions: z.array(Text) })
      .strict(),
    anchors: z
      .array(
        z
          .object({
            id: Slug,
            label: Text,
            defaultTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          })
          .strict(),
      )
      .length(5),
    results: z.record(
      CheckinResultSchema,
      z
        .object({
          title: Text,
          text: Text,
          /** קבוצת הכלים שאליה מוביל "לעבור מכאן". */
          shiftGroup: Slug.optional(),
        })
        .strict(),
    ),
    explain: z
      .object({
        channelLabels: z.record(ScoredChannelSchema, Text),
        template: Text,
        mixedNote: Text,
      })
      .strict(),
    quickMode: z.object({ title: Text, hint: Text }).strict(),
    heatmapEmpty: Text,
    heatmapEmptyOne: Text,
  })
  .strict();
export type CheckinContent = z.infer<typeof CheckinContentSchema>;

// ---------- channels.json ----------

const NoteSchema = z.object({ text: Text, layer: LayerSchema.optional() }).strict();

const LanguageMarkerSchema = z
  .object({
    id: Slug,
    label: Text,
    /** צורות המילה/הביטוי לחיפוש מקומי ביומן (domain/language-markers). */
    forms: z.array(Text).min(1),
  })
  .strict();

export const ChannelsContentSchema = z
  .object({
    principle: Text,
    channels: z
      .array(
        z
          .object({
            id: ChannelIdSchema,
            title: Text,
            tagline: Text.optional(),
            table: z.array(AxisRowSchema).optional(),
            descriptions: DimTripleSchema.optional(),
            quickTest: z.object({ question: Text, answers: DimTripleSchema }).strict().optional(),
            notes: z.array(NoteSchema).optional(),
            exercise: Text.optional(),
          })
          .strict()
          .refine((c) => c.table || c.descriptions, 'ערוץ חייב טבלה או תיאורים'),
      )
      .length(5),
    languageMarkers: z
      .object({
        d3: z.array(LanguageMarkerSchema).min(1),
        d4: z.array(LanguageMarkerSchema),
        d5: z.array(LanguageMarkerSchema).min(1),
      })
      .strict(),
    recognitionLevels: z
      .array(z.object({ level: z.number().int().min(1).max(3), name: Text, weeks: Text, text: Text }).strict())
      .length(3),
  })
  .strict();
export type ChannelsContent = z.infer<typeof ChannelsContentSchema>;

// ---------- fake5d.json ----------

export const Fake5dContentSchema = z
  .object({
    title: Text,
    intro: Text,
    rows: z
      .array(
        z
          .object({
            id: Slug,
            looksLike: Text,
            actually: Text,
            howToTell: Text,
            /** שורה שמפנה גם למסך "צריך עזרה?". */
            safety: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1),
    goldenTest: Text,
  })
  .strict();
export type Fake5dContent = z.infer<typeof Fake5dContentSchema>;

// ---------- tools.json ----------

export const ToolGroupIdSchema = z.enum(['from-3d', 'from-4d', 'shortcuts', 'fell']);
export type ToolGroupId = z.infer<typeof ToolGroupIdSchema>;

export const ToolSchema = z
  .object({
    id: Slug,
    group: ToolGroupIdSchema,
    order: z.number().int().positive(),
    name: Text,
    whenToUse: Text,
    summary: Text,
    layer: LayerSchema.optional(),
    caution: Text.optional(),
    source: Text,
    durationSec: z.number().int().positive(),
    segments: SegmentsSchema.optional(),
    /** כלי שרץ כתרגיל מתוך exercises.json (למשל פרוטוקול 90 השניות). */
    exerciseRef: z.string().optional(),
  })
  .strict()
  .refine((t) => Boolean(t.segments) !== Boolean(t.exerciseRef), 'כלי: segments או exerciseRef, לא שניהם');
export type Tool = z.infer<typeof ToolSchema>;

export const ToolsContentSchema = z
  .object({
    principles: z.array(Text).min(1),
    groups: z
      .array(
        z
          .object({
            id: ToolGroupIdSchema,
            title: Text,
            subtitle: Text,
            obstacle: Text.optional(),
            goal: Text.optional(),
            passSign: Text.optional(),
            intro: Text.optional(),
          })
          .strict(),
      )
      .length(4),
    tools: z.array(ToolSchema).min(1),
    gates: z
      .object({
        title: Text,
        intro: Text,
        items: z.array(z.object({ id: Slug, label: Text }).strict()).min(1),
        task: Text,
      })
      .strict(),
    afterSession: z.object({ question: Text, notePlaceholder: Text }).strict(),
  })
  .strict();
export type ToolsContent = z.infer<typeof ToolsContentSchema>;

// ---------- triggers.json ----------

export const TriggersContentSchema = z
  .object({
    triggers: z
      .array(
        z
          .object({
            id: z.string().regex(/^trg-[a-z0-9]+(-[a-z0-9]+)*$/),
            label: Text,
            d3Reaction: Text,
            move: z.array(Text).min(1),
            relatedToolIds: z.array(Slug),
            caution: Text.optional(),
            durationSec: z.number().int().positive(),
            segments: SegmentsSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type TriggersContent = z.infer<typeof TriggersContentSchema>;

// ---------- domains.json ----------

export const DomainsContentSchema = z
  .object({
    domains: z
      .array(
        z
          .object({
            id: DomainSchema,
            label: Text,
            shortLabel: Text,
            protocol: z
              .object({
                intro: Text.optional(),
                practices: z
                  .array(
                    z
                      .object({ id: z.string().regex(/^[a-z]+\.p\d{2}$/), text: Text })
                      .strict(),
                  )
                  .min(1),
                relatedExerciseIds: z.array(z.string()).optional(),
                relatedToolIds: z.array(Slug).optional(),
              })
              .strict()
              .nullable(),
          })
          .strict(),
      )
      .length(8),
    lifeMap: z
      .object({
        intro: Text,
        columns: z.object({ dominant: Text, trigger: Text, bringsBack: Text }).strict(),
      })
      .strict(),
    patterns: z
      .array(
        z
          .object({
            id: Slug,
            name: Text,
            description: Text,
            /** תנאי הזיהוי: באילו תחומים כל מצב דומיננטי. 'all-others' = בכל שאר התחומים. */
            rule: z
              .object({
                d3: z.array(DomainSchema).optional(),
                d4: z.union([z.array(DomainSchema), z.literal('all-others')]).optional(),
                d5: z.array(DomainSchema).optional(),
              })
              .strict(),
            note: Text.optional(),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();
export type DomainsContent = z.infer<typeof DomainsContentSchema>;

// ---------- exercises.json ----------

export const GuidedFormKindSchema = z.enum([
  'trigger-journal',
  'belief-inquiry',
  'shadow-321',
  'forgiveness',
]);

export const ExerciseSchema = z
  .object({
    id: z.string().regex(/^(t([1-9]|1[0-2])|sos90|walk)$/),
    code: Text,
    name: Text,
    summary: Text,
    layer: LayerSchema.optional(),
    /** timed = הנגן מתקדם לבד; form = טופס מודרך, כל prompt ממתין למשתמש. */
    mode: z.enum(['timed', 'form']),
    source: Text,
    weeks: z.array(z.number().int().min(0).max(12)),
    caution: Text.optional(),
    note: NoteSchema.optional(),
    durationSec: z.number().int().positive(),
    form: z
      .object({
        kind: GuidedFormKindSchema,
        steps: z
          .array(
            z
              .object({
                fieldId: Slug,
                label: Text,
                /** המקטע (prompt) שמקריא/מציג את השאלה של השלב. */
                segmentId: z.string(),
                optional: z.boolean().optional(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict()
      .optional(),
    segments: SegmentsSchema,
  })
  .strict()
  .refine((e) => (e.mode === 'form') === Boolean(e.form), 'mode=form מחייב form, ולהפך');
export type Exercise = z.infer<typeof ExerciseSchema>;

export const ExercisesContentSchema = z
  .object({ exercises: z.array(ExerciseSchema).length(14) })
  .strict();
export type ExercisesContent = z.infer<typeof ExercisesContentSchema>;

// ---------- journey.json ----------

const PracticeItemSchema = z
  .object({
    exerciseId: z.string(),
    minutes: z.number().positive().optional(),
    frequency: z.enum(['daily', 'evening', '3x-day', '2x-week']),
    /** true = נמשך משבוע קודם ("כנ״ל"); false = חדש השבוע. */
    carried: z.boolean(),
    note: Text.optional(),
  })
  .strict();

export const JourneyWeekSchema = z
  .object({
    week: z.number().int().min(1).max(12),
    id: z.string().regex(/^w(0[1-9]|1[0-2])$/),
    phase: z.enum(['A', 'B', 'C']),
    practices: z.array(PracticeItemSchema),
    freePractice: z.object({ minMinutes: z.number(), maxMinutes: z.number(), text: Text }).strict().optional(),
    lifeTask: z.object({ title: Text, text: Text }).strict(),
    checkpoint: z.object({ kind: z.enum(['mid', 'final']), text: Text }).strict().optional(),
    intro: SegmentsSchema,
  })
  .strict();

export const JourneyContentSchema = z
  .object({
    title: Text,
    disclaimer: Text,
    principles: z.array(z.object({ title: Text, text: Text }).strict()).min(1),
    week0: z
      .object({
        id: z.literal('w00'),
        title: Text,
        steps: z.array(z.object({ id: Slug, text: Text }).strict()).min(1),
        metrics: z.array(z.object({ id: Slug, label: Text, unit: Text }).strict()).min(1),
        intro: SegmentsSchema,
      })
      .strict(),
    phases: z
      .array(
        z
          .object({
            id: z.enum(['A', 'B', 'C']),
            name: Text,
            formalName: Text,
            fromWeek: z.number().int(),
            toWeek: z.number().int(),
            goal: Text,
            warning: Text.optional(),
            criteriaTitle: Text,
            criteria: z.array(Text).min(1),
            criteriaNote: Text.optional(),
          })
          .strict(),
      )
      .length(3),
    weeks: z.array(JourneyWeekSchema).length(12),
    stayAnotherWeek: Text,
    missedDay: Text,
    returnAfterBreak: z
      .object({ text: Text, exerciseIds: z.array(z.string()).min(1), days: z.number().int().positive() })
      .strict(),
    obstacles: z.array(z.object({ id: Slug, obstacle: Text, remedy: Text }).strict()).min(1),
    maintenance: z
      .object({
        title: Text,
        items: z.array(z.object({ id: Slug, cadence: Text, text: Text }).strict()).min(1),
      })
      .strict(),
  })
  .strict();
export type JourneyContent = z.infer<typeof JourneyContentSchema>;

// ---------- library.json ----------

export const LibraryRefSchema = z.enum([
  'model.states',
  'model.summary',
  'model.comparison',
  'model.parallels',
  'channels',
  'channels.recognitionLevels',
  'fake5d',
  'tools.gates',
  'safety.warningSigns',
]);

export const LibraryBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('p'), text: Text, layer: LayerSchema.optional() }).strict(),
  z.object({ type: z.literal('h'), text: Text, layer: LayerSchema.optional() }).strict(),
  z
    .object({
      type: z.literal('list'),
      ordered: z.boolean().optional(),
      items: z.array(Text).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('table'),
      columns: z.array(Text).min(2),
      rows: z.array(z.array(Text).min(2)).min(1),
    })
    .strict(),
  /** נוסחה — מוצגת משמאל לימין. */
  z.object({ type: z.literal('formula'), text: Text }).strict(),
  z.object({ type: z.literal('callout'), text: Text, tone: z.enum(['key', 'note']) }).strict(),
  /** הפניה לנתון מקובץ תוכן אחר — מוצג כרכיב ייעודי, בלי לשכפל טקסט. */
  z.object({ type: z.literal('ref'), ref: LibraryRefSchema }).strict(),
]);
export type LibraryBlock = z.infer<typeof LibraryBlockSchema>;

export const LibraryContentSchema = z
  .object({
    layers: z.record(LayerSchema, z.object({ label: Text, description: Text }).strict()),
    sections: z.array(z.object({ id: Slug, title: Text, intro: Text.optional() }).strict()).min(1),
    articles: z
      .array(
        z
          .object({
            id: Slug,
            section: Slug,
            title: Text,
            summary: Text.optional(),
            layer: LayerSchema.optional(),
            /** נפתח רק אחרי השלמת 12 השבועות. */
            lockedUntilJourneyComplete: z.boolean().optional(),
            source: Text,
            blocks: z.array(LibraryBlockSchema).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((lib, ctx) => {
    const sectionIds = new Set(lib.sections.map((s) => s.id));
    for (const a of lib.articles) {
      if (!sectionIds.has(a.section)) {
        ctx.addIssue({ code: 'custom', message: `מאמר ${a.id}: פרק לא קיים (${a.section})` });
      }
      for (const b of a.blocks) {
        if (b.type === 'table' && b.rows.some((r) => r.length !== b.columns.length)) {
          ctx.addIssue({ code: 'custom', message: `מאמר ${a.id}: שורת טבלה באורך שגוי` });
        }
      }
    }
  });
export type LibraryContent = z.infer<typeof LibraryContentSchema>;

// ---------- safety.json ----------

export const SafetyContentSchema = z
  .object({
    onboarding: z.object({ title: Text, text: Text, ifDistress: Text }).strict(),
    boundaries: z.array(z.object({ id: Slug, title: Text, text: Text }).strict()).min(1),
    notTherapy: Text,
    notRecommended: Text,
    help: z
      .object({
        title: Text,
        intro: Text,
        healthyPractice: Text,
        warningSigns: z.array(z.object({ id: Slug, text: Text }).strict()).min(1),
        whatToDo: z.array(Text).min(1),
      })
      .strict(),
    resources: z
      .array(z.object({ id: Slug, name: Text, phone: Text, description: Text }).strict())
      .min(1),
    gentleNudge: z
      .object({
        rule: z
          .object({
            questionId: Slug,
            value: z.number().int(),
            consecutive: z.number().int().positive(),
          })
          .strict(),
        text: Text,
      })
      .strict(),
    cautions: z.object({ deepWork: Text, phaseB: Text }).strict(),
  })
  .strict();
export type SafetyContent = z.infer<typeof SafetyContentSchema>;

// ---------- onboarding.json ----------

/** טקסטים ייחודיים ל-Onboarding. המסגור, שלושת המצבים והגבולות נלקחים מ-model.json ומ-safety.json. */
export const OnboardingContentSchema = z
  .object({
    welcome: z.object({ title: Text, text: Text }).strict(),
    framing: z.object({ title: Text, libraryLink: Text }).strict(),
    states: z.object({ title: Text }).strict(),
    start: z
      .object({
        title: Text,
        options: z
          .array(z.object({ id: z.enum(['diagnosis', 'checkin']), title: Text, meta: Text, text: Text }).strict())
          .length(2),
      })
      .strict(),
    restore: Text,
    skip: Text,
  })
  .strict();
export type OnboardingContent = z.infer<typeof OnboardingContentSchema>;

// ---------- החבילה כולה ----------

export const contentSchemas = {
  model: ModelContentSchema,
  diagnosis: DiagnosisContentSchema,
  checkin: CheckinContentSchema,
  channels: ChannelsContentSchema,
  fake5d: Fake5dContentSchema,
  tools: ToolsContentSchema,
  triggers: TriggersContentSchema,
  domains: DomainsContentSchema,
  exercises: ExercisesContentSchema,
  journey: JourneyContentSchema,
  library: LibraryContentSchema,
  safety: SafetyContentSchema,
  onboarding: OnboardingContentSchema,
} as const;

export type ContentFileName = keyof typeof contentSchemas;

export interface ContentBundle {
  model: ModelContent;
  diagnosis: DiagnosisContent;
  checkin: CheckinContent;
  channels: ChannelsContent;
  fake5d: Fake5dContent;
  tools: ToolsContent;
  triggers: TriggersContent;
  domains: DomainsContent;
  exercises: ExercisesContent;
  journey: JourneyContent;
  library: LibraryContent;
  safety: SafetyContent;
  onboarding: OnboardingContent;
}
