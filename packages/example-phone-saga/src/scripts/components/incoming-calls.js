import React from 'react';

export default function IncomingCalls({calls, answer, decline}) {
  return (<ul>
    {
      calls.map(({caller, id}) =>
        <li key={id}>
          <p>{caller}</p>
          <button onClick={() => answer(id)}>answer</button>
          <button onClick={() => decline(id)}>answer</button>
        </li>
      )
    }
  </ul>);
}

IncomingCalls.propTypes = {
  answer: React.PropTypes.func.isRequired,
  calls: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired,
    caller: React.PropTypes.string.isRequired
  }),
  decline: React.PropTypes.func.isRequired
};
