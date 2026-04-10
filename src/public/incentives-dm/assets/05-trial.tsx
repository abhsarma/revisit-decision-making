/* eslint-disable no-bitwise */
import { useEffect, useMemo } from 'react';
import type { JsonValue } from '../../../parser/types';
import { StoredAnswer, StimulusParams } from '../../../store/types';

const RNG_MODULUS = 4294967296;
const TEMP_MEANS = [5.55, 2.88, 4.21, 3.94, 2.09, 1.97, 0.70, 0.00, -0.89, 4.21, 5.34, 3.49, 3.94, 1.73, 1.73, 0.96, 0.00, -0.46];
const TEMP_STANDARD_DEVIATIONS = [3.3, 2.0, 3.5, 4.1, 2.9, 4.1, 2.9, 3.9, 3.7, 2.5, 3.7, 2.9, 4.1, 2.4, 3.6, 4.0, 3.0, 1.9];

type TrialParameters = { index: number; vis: string };
type PreviousAnswerSummary = {
  decision: 'Yes' | 'No';
  simulatedTemp: number;
  startingBudget: number;
};
type SimulatedResult = {
  seed: number;
  tempMean: number;
  tempSd: number;
  simulated: number;
  startingBudget: number;
};

function cyrb128(value: string): [number, number, number, number] {
  let hash1 = 1779033703;
  let hash2 = 3144134277;
  let hash3 = 1013904242;
  let hash4 = 2773480762;

  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index);
    hash1 = hash2 ^ Math.imul(hash1 ^ characterCode, 597399067);
    hash2 = hash3 ^ Math.imul(hash2 ^ characterCode, 2869860233);
    hash3 = hash4 ^ Math.imul(hash3 ^ characterCode, 951274213);
    hash4 = hash1 ^ Math.imul(hash4 ^ characterCode, 2716044179);
  }

  hash1 = Math.imul(hash3 ^ (hash1 >>> 18), 597399067);
  hash2 = Math.imul(hash4 ^ (hash2 >>> 22), 2869860233);
  hash3 = Math.imul(hash1 ^ (hash3 >>> 17), 951274213);
  hash4 = Math.imul(hash2 ^ (hash4 >>> 19), 2716044179);

  hash1 ^= hash2 ^ hash3 ^ hash4;
  hash2 ^= hash1;
  hash3 ^= hash1;
  hash4 ^= hash1;

  return [hash1 >>> 0, hash2 >>> 0, hash3 >>> 0, hash4 >>> 0];
}

function mulberry32(seed: number) {
  let state = seed;

  return () => {
    state += 0x6D2B79F5;
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / RNG_MODULUS;
  };
}

function getAnswerValue(answer: StoredAnswer | undefined, key: string): JsonValue | undefined {
  return answer?.answer[key];
}

function getStringAnswerValue(answer: StoredAnswer | undefined, key: string): string | null {
  const value = getAnswerValue(answer, key);
  return typeof value === 'string' ? value : null;
}

function getSimulatedResult(answer: StoredAnswer | undefined): SimulatedResult | null {
  const value = getAnswerValue(answer, 'simulatedResult');

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const {
    seed, tempMean, tempSd, simulated, startingBudget,
  } = value as Record<string, unknown>;

  if (
    typeof seed !== 'number'
    || typeof tempMean !== 'number'
    || typeof tempSd !== 'number'
    || typeof simulated !== 'number'
    || typeof startingBudget !== 'number'
  ) {
    return null;
  }

  return {
    seed,
    tempMean,
    tempSd,
    simulated,
    startingBudget,
  };
}

function rnorm(seed: number) {
  const rand = mulberry32(seed);

  const u1 = rand();
  const u2 = rand();

  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  return z;
}

// This React component renders a bar chart with 5 bars and 2 of them highlighted by dots.
// The data value comes from the config file and pass to this component by parameters.
function DisplayTrial({ parameters, setAnswer, answers }: StimulusParams<TrialParameters>) {
  const { index, vis } = parameters;
  const attentionCheckIndices = Object.keys(answers).flatMap((key, answerIndex) => (
    key.split('_')[0].split('-')[0] === 'attnCheck' ? [answerIndex] : []
  ));
  const imgURL = index < 0
    ? `../incentives-dm/assets/img/trial/attn-${vis}-trial-${Math.abs(index)}.jpg`
    : `../incentives-dm/assets/img/trial/${vis}-trial-${index}.jpg`;
  const prolificId = getStringAnswerValue(Object.values(answers)[0], 'prolificId') ?? '';
  const current = index < 0
    ? Object.entries(answers).find(([key]) => key.split('_')[0] === `attnCheck-${index === -1 ? 'low' : 'high'}-${vis}`)?.[1]
    : Object.entries(answers).find(([key]) => key.split('_')[0] === `trial-${index}-${vis}`)?.[1];
  const trialIndex = (() => {
    if (!current) {
      return 1;
    }

    const firstTrialKey = Object.keys(answers).find((key) => key.split('_')[0].includes('trial'));
    const introPageCount = firstTrialKey ? Number(firstTrialKey.split('_')[1]) : 0;
    const currentTrialOrder = Number(current.trialOrder);

    let adjust = 0;
    if (attentionCheckIndices[1] === (introPageCount - 1)) {
      adjust = 0;
    } else if (attentionCheckIndices[0] === (introPageCount - 1)) {
      adjust = currentTrialOrder > attentionCheckIndices[1] ? 1 : 0;
    } else {
      adjust = currentTrialOrder > attentionCheckIndices[1]
        ? 2
        : currentTrialOrder > attentionCheckIndices[0] ? 1 : 0;
    }

    const computedTrialIndex = currentTrialOrder - introPageCount + 1 - adjust;
    return computedTrialIndex < 1 ? 1 : computedTrialIndex;
  })();
  const previousAnswer: PreviousAnswerSummary | null = (() => {
    if (!current) {
      return null;
    }

    const currentTrialOrder = Number(current.trialOrder);
    let stepBack = 1;
    let previous = Object.values(answers).find((value) => Number(value.trialOrder) === currentTrialOrder - stepBack);

    while (previous && attentionCheckIndices.includes(Number(previous.trialOrder))) {
      stepBack += 1;
      // eslint-disable-next-line no-loop-func
      previous = Object.values(answers).find((value) => Number(value.trialOrder) === currentTrialOrder - stepBack);
    }

    const simulatedResult = getSimulatedResult(previous);
    const decision = getStringAnswerValue(previous, 'decision');

    if (!simulatedResult || (decision !== 'Yes' && decision !== 'No')) {
      return null;
    }

    return {
      decision,
      simulatedTemp: simulatedResult.simulated,
      startingBudget: simulatedResult.startingBudget,
    };
  })();

  let budget = 18000;
  let prevResultText = '';

  if (previousAnswer) {
    const cost = previousAnswer.decision === 'Yes' ? 1000 : previousAnswer.simulatedTemp < 0 ? 5000 : 0;
    const decision = previousAnswer.decision === 'Yes' ? 'salt' : 'not salt';
    const temp = Math.round(previousAnswer.simulatedTemp * 10) / 10;

    budget = previousAnswer.startingBudget - cost;

    prevResultText = `In the previous trial you decided to ${decision} the roads. The actual temperature was ${temp}°C. The cost incurred was $${cost}.`;
  }

  const simulatedResult = useMemo(() => {
    if (index <= 0) {
      return null;
    }

    const tempMean = TEMP_MEANS[index - 1];
    const tempSd = TEMP_STANDARD_DEVIATIONS[index - 1];
    const [seed] = cyrb128(`${prolificId}_${index}`);
    const simulated = rnorm(seed) * tempSd + tempMean;

    return {
      seed,
      tempMean,
      tempSd,
      simulated,
    };
  }, [index, prolificId]);

  useEffect(() => {
    if (simulatedResult) {
      setAnswer({
        status: true,
        answers: {
          simulatedResult: {
            ...simulatedResult,
            startingBudget: budget,
          },
        },
      });
    }
  }, [budget, setAnswer, simulatedResult]);

  return (
    <div className="chart-wrapper">
      <h3>
        Trial number:
        <span id="task-index">
          {' '}
          {trialIndex}
        </span>
        /18
      </h3>
      <p>
        <span id="prev-decision">{prevResultText}</span>
        <br />
        Budget Remaining: $
        <span id="remaining-budget">{budget}</span>
      </p>
      <div className="img-container">
        <img src={imgURL} alt={`trial-${index}-${vis}`} width="90%" />
      </div>
    </div>
  );
}

export default DisplayTrial;
