module.exports = {
  nothrow: func => {
    return function() {
      try {
        return func.apply(this, arguments);
      } catch (e) {
        console.error(e);
      }
    };
  },

  lexographic_comparator: (a, b) => {
    for (let i = 0; i < a.length; ++i) {
      if (a[i] < b[i]) {
        return -1;
      } else if (a[i] > b[i]) return 1;
    }
    return 0;
  }
};
