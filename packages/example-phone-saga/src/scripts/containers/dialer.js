import React, {Component} from 'react';
import {Field, reduxForm} from 'redux-form/immutable';

class Dialer extends Component {
  static propTypes = {
    handleSubmit: React.PropTypes.func.isRequired
  };

  render() {
    const {handleSubmit} = this.props;

    return (
      <form onSubmit={handleSubmit}>
        <Field
          component="input"
          name="recipient"
          placeholder="Recipient"
          required
          type="text"
        />
        <input type="submit" value="Dial" />
      </form>
    );
  }
}


const DialerForm = reduxForm({
  form: `dialer`
})(Dialer);

export default DialerForm;
