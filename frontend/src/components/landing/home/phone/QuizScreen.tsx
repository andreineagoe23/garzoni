import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { money } from "../format";

const OPTIONS = [200, 400, 600];
const CORRECT = 1;

export default function QuizScreen() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = checked && selected === CORRECT;

  const onCheck = () => {
    if (checked) {
      setChecked(false);
      setSelected(null);
      return;
    }
    if (selected !== null) setChecked(true);
  };

  return (
    <>
      <div className="gzh-quiz__top">
        <span className="gzh-quiz__close" aria-hidden="true">
          ×
        </span>
        <div className="gzh-progress">
          <div
            className="gzh-progress__fill"
            style={{ width: checked ? "66%" : "40%" }}
          />
        </div>
      </div>
      <div className="gzh-quiz__prompt">
        <span className="gzh-eyebrow gzh-eyebrow--gold">
          {t("welcome.phone.quiz.label")}
        </span>
        <span className="gzh-quiz__question">
          {t("welcome.phone.quiz.question")}
        </span>
      </div>
      <div className="gzh-quiz__options">
        {OPTIONS.map((amount, i) => {
          let state = selected === i ? "picked" : "idle";
          if (checked && i === CORRECT) state = "correct";
          else if (checked && selected === i) state = "wrong";
          return (
            <button
              key={amount}
              type="button"
              className="gzh-tile"
              data-state={state}
              aria-pressed={selected === i}
              onClick={() => {
                if (!checked) setSelected(i);
              }}
            >
              <span>{money(amount)}</span>
              <span className="gzh-tile__key" aria-hidden="true">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
      <div className="gzh-spacer" />
      {checked ? (
        <div
          className="gzh-sheet"
          data-result={correct ? "correct" : "wrong"}
          role="status"
        >
          <div className="gzh-sheet__head">
            <span className="gzh-sheet__title">
              {t(
                correct
                  ? "welcome.phone.quiz.correctTitle"
                  : "welcome.phone.quiz.wrongTitle"
              )}
            </span>
            {correct && (
              <span className="gzh-xp-pill">{t("welcome.phone.quiz.xp")}</span>
            )}
          </div>
          <span className="gzh-sheet__body">
            {t(
              correct
                ? "welcome.phone.quiz.correctBody"
                : "welcome.phone.quiz.wrongBody"
            )}
          </span>
          <button
            type="button"
            className={`gzh-press ${correct ? "gzh-press--green" : "gzh-press--red"}`}
            onClick={onCheck}
          >
            {t("welcome.phone.quiz.tryAgain")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`gzh-press ${selected === null ? "gzh-press--idle" : "gzh-press--green"}`}
          aria-disabled={selected === null}
          onClick={onCheck}
        >
          {t("welcome.phone.quiz.check")}
        </button>
      )}
    </>
  );
}
