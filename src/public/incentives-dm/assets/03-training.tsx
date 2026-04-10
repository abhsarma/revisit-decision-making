import { StimulusParams } from '../../../store/types';

// This React component renders a bar chart with 5 bars and 2 of them highlighted by dots.
// The data value comes from the config file and pass to this component by parameters.
function DisplayTrial({ parameters }: StimulusParams<{ index: number; vis: string }>) {
  const { index, vis } = parameters;

  const trainingIdx = `training-${index}`;
  const imgURL = `../incentives-dm/assets/img/training/0${index}-training-${vis}.jpg`;

  return (
    <div className="chart-wrapper">

      <h2>
        Training Trial #
        {index}
      </h2>
      <p>
        <img src={imgURL} alt={trainingIdx} width="70%" />
        <br />
        Based on the forecast above, please answer the following question.
      </p>
    </div>
  );
}

export default DisplayTrial;
