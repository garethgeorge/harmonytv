module.exports = {
  nothrow: func => {
    return function() {
      try {
        return func.apply(this, arguments);
      } catch (e) {
        console.error(e);
      }
    };
  }
};
