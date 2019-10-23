import React from "react";
import "./loading.css";
import Loader from 'react-loader-spinner'


export default () => {
  return (
    <div className="loading-splash absolute-center-content">
      <div>
        <center>Loading...</center>
        <br/>
        <Loader type="Oval" color="rgb(155,155,155)" height={80} width={80} />
      </div>
    </div>
  );
}