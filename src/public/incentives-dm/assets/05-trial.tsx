import * as d3 from 'd3';
import {useCallback, useEffect, useMemo, useState} from 'react';
import { StoredAnswer, StimulusParams } from '../../../store/types';

function rnorm(seed: number) {
    const rand = mulberry32(seed);

    const u1 = rand();
    const u2 = rand();

    // const u1 = Math.random();
    // const u2 = Math.random();

    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    return z;
}

// Source - https://stackoverflow.com/a/47593316
// Posted by bryc, modified by community. See post 'Timeline' for change history
// Retrieved 2026-02-09, License - CC BY-SA 4.0
function cyrb128(str: string) {
    let h1 = 1779033703; let h2 = 3144134277;
    let h3 = 1013904242; let
    h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function mulberry32(a: number) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// This React component renders a bar chart with 5 bars and 2 of them highlighted by dots.
// The data value comes from the config file and pass to this component by parameters.
function DisplayTrial({ parameters, setAnswer, answers }: StimulusParams<{index: number, vis: string}>) {
    const { index, vis } = parameters;
    const [forecast, setForecast] = useState<number>();

    const attentionCheckLoc = Object.keys(answers).map(d => d.split("_")[0].split("-")[0] === "attnCheck");
    const attentionCheckIndices: number[] = attentionCheckLoc.reduce((out: number[], bool, idx) => bool ? out.concat(idx) : out, [])

    let imgURL = ''
    if (index < 0) {
        imgURL = `../incentives-dm/assets/img/trial/attn-${vis}-trial-${Math.abs(index)}.jpg`;
    } else {
        imgURL = `../incentives-dm/assets/img/trial/${vis}-trial-${index}.jpg`;
    }

    const prolificId = useMemo(() => {
        return Object.entries(answers)[0][1].answer.prolificId;
    }, [answers, index]);

    const current = useMemo(() => {
            if (index < 0) { // attention check
                const attnIndex = index === -1 ? "low" : "high"
                return Object.entries(answers).find(([key, _]) => key.split("_")[0] === `attnCheck-${attnIndex}-${vis}`)?.[1];
            } else {
                return Object.entries(answers).find(([key, _]) => key.split("_")[0] === `trial-${index}-${vis}`)?.[1];
            }
    }, [answers, index]);

    const trialIndex = useMemo(() => {
        if (current) {
            // gets the number of pre-trial pages by matching on first instance of trials in the `key` of the answers object
            // so that the correct trial index is shown to participants
            const intro_page_count = Number(Object.entries(answers).find(([key, _]) => key.split("_")[0].includes("trial"))?.[0].split("_")[1]);
            let adjust;
            
            // if first two trials are attention check 
            if (attentionCheckIndices[1] == (intro_page_count - 1)) {
                adjust = 0;
            } else if (attentionCheckIndices[0] == (intro_page_count - 1)) {
                adjust = +current.trialOrder > attentionCheckIndices[1] ? 1 : 0;
            } else {
                adjust = +current.trialOrder > attentionCheckIndices[1] ? 2 : +current.trialOrder > attentionCheckIndices[0] ? 1 : 0;
            }
            
            const trialIndex = +current.trialOrder - intro_page_count + 1 - adjust;
            return trialIndex < 1 ? 1 : trialIndex;
        } else {
            return 1
        }

        // console.log(current);
        // return current ? +current.trialOrder - 6 : 1;
    }, [answers, index]);

    const previousAnswer = useMemo(() => {
        let previous = current ? Object.values(answers).find((val) => +val.trialOrder === +current.trialOrder - 1) : null;
        const previousTrialOrder = previous ? +previous.trialOrder : NaN;

        if (attentionCheckIndices.includes(previousTrialOrder)) {
            // substract '2' to get the trial before last
            previous = current ? Object.values(answers).find((val) => +val.trialOrder === +current.trialOrder - 2) : null;
            const newPreviousTrialOrder = previous ? +previous.trialOrder : NaN;

            // check again since the two attention checks can be back to back    
            if (attentionCheckIndices.includes(newPreviousTrialOrder)) {
                previous = current ? Object.values(answers).find((val) => +val.trialOrder === +current.trialOrder - 3) : null;
            }
        }

        if (!previous?.answer.simulatedResult) {
            return null
        }

        // @ts-ignore
        return {decision: previous.answer.decision, simulatedTemp: previous.answer.simulatedResult.simulated, startingBudget: previous.answer.simulatedResult.startingBudget};
    }, [answers, index]);

    let budget = 18000;
    let prevResultText = "";
    
    if (previousAnswer) {
        const cost = previousAnswer.decision === 'Yes' ? 1000 : previousAnswer.simulatedTemp < 0 ? 5000 : 0;
        const decision = previousAnswer.decision === 'Yes' ? "salt" : "not salt"
        const temp = Math.round(previousAnswer.simulatedTemp * 10) / 10

        budget = previousAnswer.startingBudget - cost;

        prevResultText = `In the previous trial you decided to ${decision} the roads. The actual temperature was ${temp}°C. The cost incurred was $${cost}.`
    }

    useEffect(() => {
        const meansList = [5.55,  2.88,  4.21,  3.94,  2.09,  1.97,  0.70,  0.00, -0.89,  4.21,  5.34,  3.49,  3.94,  1.73,  1.73,  0.96,  0.00, -0.46];
        const sdList = [3.3, 2.0, 3.5, 4.1, 2.9, 4.1, 2.9, 3.9, 3.7, 2.5, 3.7, 2.9, 4.1, 2.4, 3.6, 4.0, 3.0, 1.9];
        const tempMean = meansList[index - 1];
        const tempSd = sdList[index - 1];
        const seed = cyrb128(prolificId + "_" + index);
        const z = index > 0 ? rnorm(seed[0]) : -11; // simulate rnorm(mean)
        const temp = z * tempSd + tempMean

        console.log(tempMean, tempSd, temp, z);

        if (index > 0) {
            if (!forecast) {
                setForecast(temp);
                setAnswer({
                    status: true,
                    answers: {
                        // @ts-ignore
                        simulatedResult: { seed: seed[0], tempMean: tempMean, tempSd: tempSd, simulated: temp, startingBudget: budget },
                    },
                });
            } else {
                setAnswer({
                    status: true,
                    answers: {
                        // @ts-ignore
                        simulatedResult: { seed: seed[0], tempMean: tempMean, tempSd: tempSd, simulated: forecast, startingBudget: budget },
                    },
                });
            }
        }
    }, [index, setAnswer, budget, forecast]);

  return (
        <>
            <div className="chart-wrapper">
                <h3>
                    Trial number:
                    <span id="task-index"> {trialIndex}</span>
                    /18
                </h3>
                <p>
                    <span id="prev-decision">{prevResultText}</span><br/>
                    Budget Remaining: $
                    <span id="remaining-budget">{budget}</span>
                </p>
                <div className="img-container">
                    <img src={imgURL} width="90%" />
                </div>
            </div>
        </>
    );
}

export default DisplayTrial;

{
    /* <div className='help-wrapper'>
        <div className="help-button">
            <button onclick="">Show Help</button>
        </div>
        <div className="help-content">
            <h2>Task details</h2>
            <h3>Scenario</h3>
            <p>
                Assume that you work for a road maintenance company that is contracted to treat the roads in a town with salt brine to prevent icing when the temperature goes below freezing (0°C or 32°F). Applying salt brine to the roads is costly for your company; in addition, it also is detrimental to the environment as it can pollute groundwater and kill roadside vegetation. However, not salting the roads can cause significant accidents during freezing temperatures which are borne by your company.<br/>
            </p>


            <h3>Task</h3>
            <p>
                Your job is to salt the roads in the town when temperatures fall below 0°C (32°F), which will help them withstand the cold. In the experiment, you will be shown a night-time temperature forecast (visualised using the representation that one you had encountered on the previous pages), and you will have to decide whether you will salt the roads based on the forecast.<br/>
            </p>


            <h3>Budget Constraints</h3>
            <p>
                You have a budget for 18 days of $18,000. Salting all the roads in the town costs $1,000 (per night). If you fail to salt the roads and the temperature drops below 0°C (32°F), it will cost $5,000 from your budget.<br/>
            </p>

            <h3>Compensation</h3>
            <p>
                Please respond to the best of your ability. You are **guaranteed to receive $1.5** regardless of how you perform in the trials. In addition, you will **receive an extra $0.5 (50 cents) for every $1,000 that you have in your budget** at the end of the 18 days.<br/>
            </p>


            <h3>Note</h3>
            <p>
                In the trials, the temperatures will be shown on the Celsius (°C) scale. If you are more familiar with the Fahrenheit (°F) scale, please recall that 0°C equals 32°F, and a change of 1°C is equivalent to a change of 1.8°F.
            </p>
        </div>
    </div> */
}
