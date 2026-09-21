import { Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { audioEngine } from '../../audio/AudioEngine';
import { loadContent } from '../../content';
import { Card, RichText } from '../../design';

/**
 * "צריך עזרה?" (SPEC 6.12): סימני האזהרה בלשון רכה, מה עושים, וחיוג ישיר לער״ן.
 * המסך סטטי ועובד בלי נתונים ובלי רשת — הוא צריך להיפתח תמיד.
 */
export function HelpPage() {
  const { safety } = loadContent();
  const { help } = safety;

  return (
    <>
      <h1 className="mt-2 text-2xl">{help.title}</h1>
      <p className="mt-2 leading-[1.75]">
        <RichText text={help.intro} />
      </p>

      <aside className="mt-5 rounded-card border border-accent/50 bg-accent/10 p-4">
        <p className="leading-[1.65]">
          <RichText text={help.healthyPractice} />
        </p>
      </aside>

      <section className="mt-8" aria-labelledby="signs-title">
        <h2 id="signs-title" className="text-lg">
          מתי כדאי לעצור ולפנות לאיש מקצוע
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 ps-5">
          {help.warningSigns.map((sign) => (
            <li key={sign.id} className="leading-[1.65]">
              <RichText text={sign.text} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="todo-title">
        <h2 id="todo-title" className="text-lg">
          מה עושים
        </h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 ps-5">
          {help.whatToDo.map((step) => (
            <li key={step} className="leading-[1.65]">
              <RichText text={step} />
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="resources-title">
        <h2 id="resources-title" className="text-lg">
          לדבר עם מישהו עכשיו
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {safety.resources.map((resource) => (
            <li key={resource.id}>
              <Card padding="lg" elevation={2}>
                <h3 className="font-body text-base font-semibold">{resource.name}</h3>
                <p className="mt-1 text-sm text-muted">{resource.description}</p>
                <a
                  href={`tel:${resource.phone}`}
                  className="pressable mt-4 flex min-h-14 items-center justify-center gap-2 rounded-control bg-accent-fill px-5 text-lg font-semibold text-on-accent"
                >
                  <Phone aria-hidden size={20} />
                  <span>
                    חיוג <span dir="ltr">{resource.phone}</span>
                  </span>
                </a>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="boundaries-title">
        <h2 id="boundaries-title" className="text-lg">
          גבולות התרגול
        </h2>
        <p className="mt-2 leading-[1.65] text-muted">
          <RichText text={safety.notTherapy} />
        </p>
        <p className="mt-2 leading-[1.65] text-muted">
          <RichText text={safety.notRecommended} />
        </p>
        <dl className="mt-4 flex flex-col gap-3">
          {safety.boundaries.map((boundary) => (
            <div key={boundary.id}>
              <dt className="font-medium">
                <RichText text={boundary.title} />
              </dt>
              <dd className="text-muted">
                <RichText text={boundary.text} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-8 text-sm text-muted">
        רוצה לחזור לקרקע עכשיו?{' '}
        <Link to="/sos" onClick={() => void audioEngine.unlock()} className="font-medium text-accent underline underline-offset-4">
          90 שניות של נשימה
        </Link>
      </p>
    </>
  );
}
