import React from "react";
import config from "../config";
import model from "../model";
import { observer } from "mobx-react";
import Loading from "../components/loading";

import "./login-view.scss";

const LoginView = observer(
  class LoginView extends React.Component {
    state = {
      username: "",
      password: ""
    };

    async login(event) {
      event.preventDefault();
      console.log("trying to login...");
      const { username, password } = this.state;
      this.setState({
        loading: true,
        username: "",
        password: ""
      });
      const userObj = await model.user.login(username, password);

      if (this.mounted) {
        this.setState({
          loading: false,
          username: "",
          password: ""
        });

        if (!userObj) {
          return alert("incorrect username or password");
        }
      }
    }

    componentWillMount() {
      this.mounted = true;
    }

    componentWillUnmount() {
      this.mounted = false;
    }

    handleInputChange(input, event) {
      const state = Object.assign({}, this.state);
      state[input] = event.target.value;
      this.setState(state);
    }

    render() {
      if (this.state.loading) return <Loading />;

      return (
        <div className="login-view-container absolute-center-content">
          <div className="loginview">
            <center>
              <h3>HarmonyTV</h3>
            </center>

            <form className="ink-form" onSubmit={this.login.bind(this)}>
              <div className="control-group">
                <label htmlFor="username">Username</label>
                <div className="control">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="username"
                    value={this.state["username"] || ""}
                    onChange={this.handleInputChange.bind(this, "username")}
                  />
                </div>
                <label htmlFor="password">Password</label>
                <div className="control">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="password"
                    value={this.state["password"] || ""}
                    onChange={this.handleInputChange.bind(this, "password")}
                  />
                </div>
              </div>
              <input
                type="submit"
                value="Login"
                className="button"
                style={{ width: "100%" }}
              />
            </form>
          </div>
        </div>
      );
    }
  }
);

export default LoginView;
