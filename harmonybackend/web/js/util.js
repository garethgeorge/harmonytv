async function request(method, url) {
  return new Promise((accept, reject) => {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
      if (xmlHttp.readyState == 4) {
        if (xmlHttp.status == 200) {
          accept(xmlHttp.responseText);
        } else {
          reject(new Error("request status: " + xmlHttp.status));
        }
      }
    }
    xmlHttp.open(method, url, true); 
    xmlHttp.send(null);
  });
}