import { useMemo } from 'react';
import { StoredAnswer, StimulusParams } from '../../../store/types';
import '../../styles/incentives.css';
import { useNextStep } from '../../../store/hooks/useNextStep';

type SimulatedResult = {
  simulated: number;
  startingBudget: number;
};

function getSimulatedResult(answer: StoredAnswer | undefined): SimulatedResult | null {
  const simulatedResult = answer?.answer.simulatedResult;

  if (typeof simulatedResult !== 'object' || simulatedResult === null) {
    return null;
  }

  const { simulated, startingBudget } = simulatedResult as Record<string, unknown>;

  if (typeof simulated !== 'number' || typeof startingBudget !== 'number') {
    return null;
  }

  return { simulated, startingBudget };
}

// This React component renders a bar chart with 5 bars and 2 of them highlighted by dots.
// The data value comes from the config file and pass to this component by parameters.
function DisplayTrial({ parameters, answers }: StimulusParams<{inc: string}>) {
  const { inc } = parameters;

  const incAmount = inc === 'inc-sm' ? '3' : '2';

  const current = useMemo(
    () => Object.entries(answers).find(([key]) => key.split('_')[0].includes('qual-q'))?.[1],
    [answers],
  );

  const budget = useMemo(() => {
    const previous = current
      ? Object.values(answers).find((value) => +value.trialOrder === +current.trialOrder - 1)
      : undefined;
    const simulatedResult = getSimulatedResult(previous);
    const decision = previous?.answer.decision;

    if (!simulatedResult || (decision !== 'Yes' && decision !== 'No')) {
      throw new Error('unable to calculate remaining budget!');
    }

    return simulatedResult.startingBudget - (decision === 'Yes' ? 1000 : simulatedResult.simulated < 0 ? 5000 : 0);
  }, [answers, current]);

  const bonus = budget > 0 ? Math.round(budget * 0.5) / 1000 : 0;
  const awardText = inc === 'base' ? '' : ` This translates to a bonus of $${bonus}.`;
  const incText = (inc === 'base' || budget > 0) ? '' : `Please do not worry if you have a negative budget. You are still guaranteed the minimum amount of $${incAmount}.`;

  const { goToNextStep } = useNextStep();
  
  setTimeout(() => {
      goToNextStep();
  }, 3000);

  return (
    <div className="chart-wrapper">
      <p>
        You have completed all the trials!
        <b>
          Your remaining budget is: $
          <span id="remaining-budget">{budget}</span>
        </b>
        .
        <span id="actual-award">{awardText}</span>
      </p>
      <p>{incText}</p>
    </div>
  );
}

export default DisplayTrial;
