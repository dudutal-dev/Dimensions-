import { useId } from 'react';
import type { CheckinQuestion } from '../../content/schema';
import { Chip, OptionButton, Slider } from '../../design';

interface QuestionViewProps {
  question: CheckinQuestion;
  answer: string | number | undefined;
  onAnswer: (value: string | number) => void;
  chips: string[];
  onToggleChip: (chipId: string) => void;
}

/** תצוגת שאלה אחת מבדיקת המימד, לפי סוגה. */
export function QuestionView({ question, answer, onAnswer, chips, onToggleChip }: QuestionViewProps) {
  const labelId = useId();

  if (question.kind === 'scale') {
    const value = typeof answer === 'number' ? answer : Math.round((question.min + question.max) / 2);
    return (
      <div className="flex flex-col gap-5">
        <Slider
          label={question.prompt}
          value={value}
          onChange={onAnswer}
          min={question.min}
          max={question.max}
          minLabel={question.minLabel}
          maxLabel={question.maxLabel}
        />
        {question.chips && (
          <div role="group" aria-label="איפה מורגש הכיווץ" className="flex flex-wrap gap-2">
            {question.chips.map((chip) => (
              <Chip key={chip.id} selected={chips.includes(chip.id)} onToggle={() => onToggleChip(chip.id)}>
                {chip.label}
              </Chip>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3">
      <h2 id={labelId} className="font-sans text-base font-medium text-muted">
        {question.prompt}
      </h2>

      {question.kind === 'choice' &&
        (question.options.length <= 3 ? (
          <div className="flex flex-col gap-2">
            {question.options.map((option) => (
              <OptionButton key={option.id} selected={answer === option.id} onSelect={() => onAnswer(option.id)}>
                {option.label}
              </OptionButton>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => (
              <Chip key={option.id} selected={answer === option.id} onToggle={() => onAnswer(option.id)}>
                {option.label}
              </Chip>
            ))}
          </div>
        ))}

      {question.kind === 'wheel' && (
        // שלוש "טבעות" של מילים. השיוך למצבים אינו מוצג — בוחרים מילה, לא ציון.
        <div className="flex flex-col gap-4">
          {question.rings.map((ring) => (
            <div key={ring.ring} className="flex flex-wrap justify-center gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
              {ring.words.map((word) => (
                <Chip key={word.id} selected={answer === word.id} onToggle={() => onAnswer(word.id)}>
                  {word.label}
                </Chip>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
