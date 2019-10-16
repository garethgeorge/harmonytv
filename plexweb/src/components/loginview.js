import React from "react";
import "./loginview.css";
import config from "../config";
import * as model from "../model/model";

class LoginView extends React.Component {
  state = {
    username: "",
    password: "",
  }

  async login() {
    console.log("trying to login...");
    alert("logging in... " + JSON.stringify(this.state));
    const userObj = await model.user.loginWithCredentials(this.state.username, this.state.password);

    if (!userObj) {
      return alert("incorrect username or password");
    }
  }

  handleInputChange(input, event) {
    const state = Object.assign({}, this.state);
    state[input] = event.target.value;
    this.setState(state);
  }

  render() {
    return (
      <div className="loginview">
        <center>
          <h3>MyPlex</h3>
        </center>

        <form className="ink-form" onSubmit={this.login.bind(this)} action="javascript:void(0);">
          <div className="control-group">
            <label htmlFor="username">Username</label>
            <div className="control">
              <input id="username" name="username" type="text" placeholder="username" value={this.state["username"] || ""} onChange={this.handleInputChange.bind(this, "username")} />
            </div>
            <label htmlFor="password">Password</label>
            <div className="control">
              <input id="password" name="password" type="password" placeholder="password" value={this.state["password"] || ""} onChange={this.handleInputChange.bind(this, "password")} />
            </div>
          </div>
          <input type="submit" value="Login" className="button" style={{width: "100%"}} />
        </form>
      </div>
    )
  }
}

export default LoginView;