import * as d3 from 'd3';
import {useEffect} from 'react';
import {StimulusParams } from '../../../store/types';

// This React component renders a bar chart with 5 bars and 2 of them highlighted by dots.
// The data value comes from the config file and pass to this component by parameters.
function DisplayTrial({ parameters }: StimulusParams<any>) {
    const { index, vis, target } = parameters;

    const trainingIdx = "training-" + index;
    const imgURL = `../incentives-dm/assets/img/training/0${index}-training-${vis}.jpg`;

    // useEffect(() => {
    //     setTimeout(() => {
    //         d3.select("#target").html(target);;
    //     }, 100)

    //     setTimeout(() => {
    //         d3.select(`div#trainingProb-${index}`).on("click", () => { d3.select("#target").html(target); });
    //         d3.select("input").on("keyup", () => { d3.select("#target").html(target); })
    //     }, 10)
    // });

    return (
        <div className="chart-wrapper">

            <h2>Training Trial #{index}</h2>
            <p>
                <img src={imgURL} alt={trainingIdx} width="70%"/><br/>
                Based on the forecast above, please answer the following question.
            </p>
        </div>
    );
}

export default DisplayTrial;