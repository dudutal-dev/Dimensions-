/**
 * טעינת חבילת התוכן לאפליקציה. ה-JSON עובר ולידציה מלאה ב-build (npm run content:check);
 * כאן הוא מפוענח פעם אחת דרך הסכמות כדי לקבל טיפוסים מדויקים.
 */
import channels from './channels.json';
import checkin from './checkin.json';
import diagnosis from './diagnosis.json';
import domains from './domains.json';
import exercises from './exercises.json';
import fake5d from './fake5d.json';
import journey from './journey.json';
import library from './library.json';
import model from './model.json';
import safety from './safety.json';
import tools from './tools.json';
import triggers from './triggers.json';
import { contentSchemas, type ContentBundle } from './schema';

let cached: ContentBundle | null = null;

export function loadContent(): ContentBundle {
  cached ??= {
    model: contentSchemas.model.parse(model),
    diagnosis: contentSchemas.diagnosis.parse(diagnosis),
    checkin: contentSchemas.checkin.parse(checkin),
    channels: contentSchemas.channels.parse(channels),
    fake5d: contentSchemas.fake5d.parse(fake5d),
    tools: contentSchemas.tools.parse(tools),
    triggers: contentSchemas.triggers.parse(triggers),
    domains: contentSchemas.domains.parse(domains),
    exercises: contentSchemas.exercises.parse(exercises),
    journey: contentSchemas.journey.parse(journey),
    library: contentSchemas.library.parse(library),
    safety: contentSchemas.safety.parse(safety),
  };
  return cached;
}

export * from './schema';
