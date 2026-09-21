import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Compass, ListChecks } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadContent } from '../../content';
import { useSettings } from '../../data/settingsStore';
import { Aurora, Button, DimensionGlyph, IconButton, OptionButton, ProgressDots, RichText, Sheet } from '../../design';
import { fade, screen as screenMotion } from '../../design/motion';

const TOTAL = 5;

/** Onboarding (SPEC 6.1): חמישה מסכים, פעם אחת, ניתן לדילוג בכל רגע. */
export function OnboardingPage() {
  const { onboarding, model, safety, library } = loadContent();
  const navigate = useNavigate();
  const updateSettings = useSettings((s) => s.update);
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(1);
  const [moreOpen, setMoreOpen] = useState(false);

  const finish = async (to: string) => {
    await updateSettings({ onboarded: true });
    navigate(to, { replace: true });
  };

  const sources = library.articles.find((a) => a.id === 'model-sources');

  const screens: Record<number, ReactNode> = {
    1: (
      <>
        <div className="flex items-center justify-center gap-5 py-6">
          <DimensionGlyph dim="d3" size={52} decorative />
          <DimensionGlyph dim="d4" size={52} decorative />
          <DimensionGlyph dim="d5" size={52} decorative />
        </div>
        <h1 className="text-2xl">{onboarding.welcome.title}</h1>
        <p className="mt-3 text-lg text-muted">{onboarding.welcome.text}</p>
      </>
    ),
    2: (
      <>
        <h1 className="text-2xl">{onboarding.framing.title}</h1>
        <p className="mt-4 text-lg">{model.framing.full}</p>
        <Button variant="ghost" className="mt-4 -ms-5 text-accent" onClick={() => setMoreOpen(true)}>
          {onboarding.framing.libraryLink}
        </Button>
      </>
    ),
    3: (
      <>
        <h1 className="text-2xl">{onboarding.states.title}</h1>
        <ul className="mt-5 flex flex-col gap-4">
          {model.states.map((state) => (
            <li key={state.dim} className="flex items-start gap-4">
              <DimensionGlyph dim={state.dim} size={40} variant="solid" decorative className="mt-1" />
              <p>
                <strong dir="ltr" className="font-display text-lg">
                  {state.label}
                </strong>
                <span className="block text-muted">{state.oneLiner}</span>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-control border border-border bg-surface px-4 py-3 text-sm">
          <strong>{model.nesting.title}.</strong> {model.nesting.text}
        </p>
      </>
    ),
    4: (
      <>
        <h1 className="text-2xl">{safety.onboarding.title}</h1>
        <p className="mt-4 text-lg">
          <RichText text={safety.onboarding.text} />
        </p>
        <p className="mt-4 text-muted">
          <RichText text={safety.onboarding.ifDistress} />
        </p>
      </>
    ),
    5: (
      <>
        <h1 className="text-2xl">{onboarding.start.title}</h1>
        <div className="mt-6 flex flex-col gap-3">
          {onboarding.start.options.map((option) => (
            <OptionButton
              key={option.id}
              selected={false}
              hint={option.text}
              icon={
                option.id === 'checkin' ? (
                  <Compass aria-hidden size={26} strokeWidth={1.5} className="text-accent" />
                ) : (
                  <ListChecks aria-hidden size={26} strokeWidth={1.5} className="text-accent" />
                )
              }
              onSelect={() => void finish(option.id === 'checkin' ? '/checkin' : '/diagnosis')}
            >
              {option.title} <span className="text-sm font-normal text-muted">· {option.meta}</span>
            </OptionButton>
          ))}
        </div>
      </>
    ),
  };

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Aurora />
      <header className="relative z-10 mx-auto flex w-full max-w-[var(--content-max)] items-center justify-between gap-2 px-2 pt-[calc(var(--safe-top)+8px)]">
        {step > 1 ? (
          <IconButton label="חזרה" onClick={() => setStep((s) => s - 1)}>
            <ChevronRight aria-hidden size={24} />
          </IconButton>
        ) : (
          <span className="size-12" />
        )}
        <ProgressDots total={TOTAL} current={step} label="התקדמות בהיכרות" />
        <Button variant="ghost" onClick={() => void finish('/')}>
          {onboarding.skip}
        </Button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col justify-center px-6 py-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} variants={reduceMotion ? fade : screenMotion} initial="hidden" animate="visible" exit="exit">
            {screens[step]}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-[var(--content-max)] px-6 pb-[calc(var(--safe-bottom)+24px)]">
        {step < TOTAL && (
          <Button variant="primary" size="lg" fullWidth onClick={() => setStep((s) => s + 1)}>
            המשך
          </Button>
        )}
        {step === 1 && (
          <Link to="/backup" className="mt-3 flex min-h-12 items-center justify-center text-sm text-muted underline-offset-4 hover:underline">
            {onboarding.restore}
          </Link>
        )}
      </footer>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={sources?.title ?? ''}>
        <div className="flex flex-col gap-3">
          {sources?.blocks.map((block, index) =>
            block.type === 'p' || block.type === 'callout' ? (
              <p key={index} className={block.type === 'callout' ? 'font-medium' : 'text-muted'}>
                <RichText text={block.text} />
              </p>
            ) : block.type === 'h' ? (
              <h3 key={index} className="mt-2 text-lg">
                {block.text}
              </h3>
            ) : null,
          )}
        </div>
      </Sheet>
    </div>
  );
}
